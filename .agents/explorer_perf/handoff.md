# Performance & Code Optimization Audit Report (Agent C)

**Target Project**: Pakistan Fund Tracker (Bano Qabil x Alibaba Cloud Hackathon)  
**Assessor**: Agent C (Performance & Code Optimization Specialist)  
**Date**: 2026-08-22  
**Working Directory**: `e:\BanoQabil Alibaba Hackathon Fund Tracker\Fund Tracker Advanced\.agents\explorer_perf`  

---

## 1. Observation

Direct code inspection of backend services (`backend/app/services/*.py`), routers (`backend/app/routers/*.py`), database configuration and models (`backend/app/database.py`, `backend/app/models.py`, `backend/app/crud.py`), entry points (`backend/app/main.py`), and frontend data fetchers (`frontend/src/pages/*.tsx`) revealed the following concrete observations:

### Observation 1.1: Blocking Synchronous Operations inside `async def` FastAPI Routes
* **File**: `backend/app/routers/auth.py`, Lines 15–26 (`login_for_access_token`)
  * Route is defined as `async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], ...)`.
  * Line 20 executes `crud.verify_password(form_data.password, user.password_hash)` using `passlib.context.CryptContext(schemes=["argon2"])`. Argon2 is computationally intensive by design.
  * Lines 32–34 execute synchronous directory creation `(user_data_path / bank).mkdir(parents=True, exist_ok=True)`.
  * In FastAPI, calling CPU-intensive or blocking synchronous functions inside an `async def` handler runs them directly on the asyncio main event loop, stalling all concurrent HTTP requests.
* **File**: `backend/app/routers/performance.py`, Lines 18–42 (`upload_fmr`)
  * Route is defined as `async def upload_fmr(...)`.
  * Line 36 calls `parse_fmr_pdf_with_ai(file_path, db)` synchronously. This function uploads a PDF to Google Gemini File API, blocks with `time.sleep(2)`, awaits Gemini model inference over HTTPS, and executes DB commits. The entire event loop is blocked for 10–25 seconds.
* **File**: `backend/app/routers/users.py`, Lines 64–84 (`save_bank_config`)
  * Lines 78–79 execute a synchronous loop: `for f in bank_dir.glob("*.pdf"): handler.process_file(str(f))`.
  * PDF extraction via `pdfplumber` for multiple files runs inside the request handler, freezing the HTTP response for 10–30+ seconds.

### Observation 1.2: Database N+1 and N*M Query Loops
* **File**: `backend/app/routers/dashboard.py`, Lines 520–674 (`get_fund_outperformers`)
  * Line 543: `all_funds = db.query(models.Fund).all()` loads all funds.
  * Line 611: Loops over matched user funds: `for u_fund, holding in matched_user_funds.items():`.
  * Line 626: Loops over all same-type peer funds: `for p in peers:`.
  * Line 629: Calls `get_fund_metrics(p)` which executes (Lines 566–568):
    ```python
    latest = db.query(models.FundPerformanceMetrics).filter(
        models.FundPerformanceMetrics.fund_id == f.id
    ).order_by(desc(models.FundPerformanceMetrics.date)).first()
    ```
  * Line 649: Accesses `op["fund_obj"].bank.name`, triggering lazy-loading queries on `Bank`.
  * For a user with 5 funds and 100 tracked peer funds, this executes **500+ sequential SQL queries** per request.
* **File**: `backend/app/routers/performance.py`, Lines 97–150 (`get_bank_performance`)
  * Line 110: `funds = db.query(Fund).filter(Fund.bank_id == bank.id).all()`.
  * Lines 113–125: Loops over every fund in the bank and executes 3 independent queries per fund:
    1. `latest_metrics = db.query(FundPerformanceMetrics)...`
    2. `latest_nav = db.query(FundNAVHistory)...`
    3. `history_rows = db.query(FundNAVHistory)...`
  * For a bank with 25 funds, this executes **76 sequential database queries**.
* **File**: `backend/app/services/scraper.py`, Lines 203–294 and 303–311
  * Line 246: `yesterday_entry = db.query(FundNAVHistory).filter(...).first()` is queried for every extracted row and **never used**.
  * Line 257: `mapped_fund = db.query(Fund).filter(Fund.id == mapped_fund_id).first()` queries `Fund` again per row despite `tracked_funds` already being loaded in memory at Line 130.
  * Lines 304–308: Stale fund inactive check runs a loop of `latest_nav = db.query(FundNAVHistory)...` for every active fund.

### Observation 1.3: Missing Foreign Key & Composite Database Indexes
* **File**: `backend/app/models.py`:
  * Line 29: `Fund.bank_id = Column(Integer, ForeignKey("banks.id"))` — **No `index=True`**. Joining or filtering funds by bank causes full table scans of `funds`.
  * Lines 53–54: `Portfolio.user_id` and `Portfolio.bank_id` — **No `index=True`**. Filtering `Portfolio.user_id == current_user.id` on dashboard endpoints causes full table scans.
  * Lines 66–67: `Statement.portfolio_id` and `Statement.date` — **No `index=True`**. Subqueries and date-ordered lookups scan all statement rows.
  * Lines 78–79: `FundNAVHistory.fund_id` and `FundNAVHistory.date` have single-column indexes, but **lack a composite index `(fund_id, date)`** or composite unique constraint.
  * Lines 88–89: `FundPerformanceMetrics` **lacks a composite index `(fund_id, date)`**.
  * Lines 118–124: `NewsArticle.published_at` and `NewsArticle.source` — **No `index=True`**. Sorting feed by date scans all articles.
  * Line 133: `AssetPrediction.asset_class` — **No `index=True`**.

### Observation 1.4: SQLite Concurrency & File Lock Bottlenecks (WAL Mode Disabled)
* **File**: `backend/app/database.py`, Lines 11–13:
  ```python
  engine = create_engine(
      SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
  )
  ```
  * SQLite is initialized with default rollback journal mode (`DELETE`). In this mode, any write operation (MUFAP scraper, Watcher PDF ingestion, news pipeline) acquires an exclusive lock on the entire database file, blocking concurrent reads from API requests.
  * `PRAGMA journal_mode=WAL;` (Write-Ahead Logging), `PRAGMA synchronous=NORMAL;`, and `PRAGMA busy_timeout=5000;` are not configured.

### Observation 1.5: Playwright Scraper Lifecycle, Memory Overhead, & Unbounded Timeouts
* **File**: `backend/app/services/scraper.py`, Lines 48–128:
  * 3 retry attempts inside `for attempt in range(3):`.
  * Line 68: `page.goto(target_url, wait_until='domcontentloaded', timeout=60000)` (60-second timeout).
  * Lines 72–78: Polling loop with 15 iterations of `page.wait_for_timeout(2000)` (up to 30 seconds).
  * Line 89: VPS navigation with `timeout=60000` (60-second timeout).
  * Maximum failure duration can reach **4.5 minutes** of continuous CPU/memory consumption.
  * Line 117 closes `browser`, but `page.close()` and `context.close()` are not explicitly managed before browser closure, which can leave orphaned headless Chromium child processes on Windows if an exception terminates the context.
* **File**: `backend/app/main.py`, Lines 88–90:
  * On every app launch, if `last_run > 24h` or DB is fresh, startup launches `threading.Thread(target=scrape_mufap_data, daemon=True).start()`.
  * Running a 300MB headless Chromium instance during app startup competes with UI rendering and initial API requests. There is no concurrency lock to prevent overlapping runs if the scheduled job also fires.

### Observation 1.6: Startup & Demo Bottlenecks & Critical Runtime Bugs
* **File**: `frontend/src/pages/Dashboard.tsx`, Lines 81–83 & 105–108:
  ```typescript
  const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), 5000)
  );
  const responses = await Promise.race([
      Promise.all(requests),
      timeoutPromise
  ]);
  ```
  * The frontend fires 4–5 parallel API requests (`/dashboard/summary`, `/allocation`, `/performance`, `/holdings`, `/bank/{name}`) with a hardcoded **5-second timeout**. If SQLite is locked or queries are slow, the entire dashboard errors out during a live demo.
* **File**: `backend/app/crud.py`, Lines 92 & 100:
  * `logger.info(f"Healing portfolio...")` is called on Lines 92 and 100, but **`logger` is never imported or initialized in `crud.py`**.
  * When a PDF with a valid account title triggers the healing logic, python throws `NameError: name 'logger' is not defined` and aborts the transaction.
* **File**: `backend/app/services/pdf_parser.py`, Lines 105–116:
  * The entire holdings parsing block (`if bank_name.lower() in ["atlas", "faysal"]: ... elif bank_name.lower() == "hbl": ... else: ...`) is indented **inside** `if name_match:`.
  * If a statement's customer title header does not match the regex, `name_match` is `None`, causing the parser to **silently skip all holdings extraction** and return an empty portfolio.
* **File**: `backend/app/services/news_service.py`, Line 29:
  * `socket.setdefaulttimeout(20)` mutates the global socket timeout for the entire Python runtime, potentially breaking other networking libraries.
  * Lines 381–383: Executes `db.query(NewsArticle).delete()` and `db.commit()` before inserting new articles. If the insertion fails or the app crashes midway, the table remains empty.

---

## 2. Logic Chain

```
[Observation 1.1: CPU/Network heavy tasks in async routes]
       │
       ▼
[FastAPI event loop is blocked; single thread cannot process concurrent client requests]
       │
       ▼
[Observation 1.4: SQLite WAL disabled; DB locked during writes] 
       │
       ▼
[API requests stall for > 5000ms during scraper/PDF parsing runs]
       │
       ▼
[Observation 1.6: Frontend Promise.race timeout at 5000ms triggers "Request timed out"]
       │
       ▼
==> DASHBOARD FREEZES / CRASHES DURING LIVE DEMO <==
```

```
[Observation 1.2: N+1 queries in get_fund_outperformers & get_bank_performance]
       │
       ▼
[500+ sequential SQL queries dispatched over SQLite connection per page view]
       │
       ▼
[Observation 1.3: Missing indexes on Fund.bank_id, Portfolio.user_id, Statement.portfolio_id]
       │
       ▼
[Every query performs full table scan on growing dataset]
       │
       ▼
==> HIGH CPU UTILIZATION & SEVERE RESPONSE LATENCY <==
```

```
[Observation 1.5: Scraper runs Playwright Chromium with 60s timeouts & 3 retries]
       │
       ▼
[Chromium spawns on startup in unmanaged thread without concurrency locks]
       │
       ▼
==> HIGH MEMORY CONSUMPTION (150-300MB) & POTENTIAL ZOMBIE PROCESS LEAKS <==
```

---

## 3. Caveats

1. **Local SQLite vs Client-Server DB**: Fund Tracker is architected as an offline-first desktop application with SQLite. Optimization recommendations focus on maximizing SQLite concurrent throughput (WAL mode, pragma tuning, batch querying) rather than introducing PostgreSQL dependencies that break offline portability.
2. **Scraper Site Structure Dependency**: MUFAP website uses Cloudflare protections and dynamic client-side DataTables. Playwright cannot be fully replaced by static `requests` without risking Cloudflare blocks; hence, optimization focuses on browser lifecycle management, resource caching, and strict timeout bounds.
3. **AI Token Constraints**: Google Gemini Flash API rate limits (15 RPM on free tier) necessitate intentional pacing (`time.sleep(15)` in `news_ai_analyzer.py`), which must remain isolated in background threads.

---

## 4. Conclusion & Recommended Action Plan

The application architecture has solid core functionality but suffers from 4 critical performance and stability bottlenecks:
1. **Async Event Loop Blocking & Thread Starvation**: Async FastAPI route definitions for CPU-heavy (Argon2) and I/O-heavy (Gemini/pdfplumber) tasks.
2. **Database Query Multiplication (N+1)**: Unbatched loop queries in outperformer analysis and bank performance endpoints.
3. **Unoptimized SQLite Configuration & Missing Indexes**: Lack of WAL mode causing table locking, plus missing foreign key and composite indexes.
4. **Scraper Lifecycle & Frontend Timeout Fragility**: 4.5-minute unmanaged scraper retry bounds and a brittle 5-second frontend race timeout.

### Summary Table of Actionable Fixes

| ID | File Path | Function / Component | Severity | Issue | Concrete Fix Recommendation |
|---|---|---|---|---|---|
| **PERF-01** | `backend/app/database.py:11` | SQLite Engine Config | **CRITICAL** | Database locking on writes, blocking concurrent reads | Enable WAL mode and busy timeout via SQLAlchemy `connect` listener (`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;`). |
| **PERF-02** | `backend/app/routers/dashboard.py:520` | `get_fund_outperformers` | **CRITICAL** | 500+ N+1 queries in nested fund metric loop | Batch query latest metrics for all funds in a single SQL query; load `Fund.bank` eagerly with `joinedload`. |
| **PERF-03** | `backend/app/routers/performance.py:97` | `get_bank_performance` | **HIGH** | 70+ N+1 queries per bank view | Batch fetch NAV history and metrics for all bank funds using `in_([f.id for f in funds])` and aggregate in memory. |
| **PERF-04** | `backend/app/models.py:29-133` | Database Schema | **HIGH** | Missing indexes on foreign keys and filter fields | Add `index=True` on `Fund.bank_id`, `Portfolio.user_id`, `Portfolio.bank_id`, `Statement.portfolio_id`, and composite index on `FundNAVHistory(fund_id, date)`. |
| **PERF-05** | `backend/app/routers/auth.py:15` | `login_for_access_token` | **HIGH** | Argon2 password hashing inside `async def` blocks event loop | Change signature from `async def` to standard `def` so FastAPI runs Argon2 in the background threadpool. |
| **PERF-06** | `backend/app/routers/performance.py:18` | `upload_fmr` | **HIGH** | Blocking Gemini AI call inside `async def` freezes server | Change signature to `def upload_fmr` or wrap `parse_fmr_pdf_with_ai` in `run_in_threadpool`. |
| **PERF-07** | `backend/app/services/scraper.py:48` | `scrape_mufap_data` | **HIGH** | 60s timeouts & 3 retries stall execution for 4.5 min | Reduce `goto` timeout to 25s, use `page.wait_for_selector`, ensure explicit `page.close()` and `context.close()`, and guard with `threading.Lock`. |
| **PERF-08** | `frontend/src/pages/Dashboard.tsx:81` | `fetchData` | **HIGH** | 5000ms `Promise.race` timeout causes false demo failures | Increase timeout to 15000ms and catch endpoint errors individually rather than dropping the whole view. |
| **PERF-09** | `backend/app/crud.py:92,100` | `save_statement` | **CRITICAL BUG** | `NameError: name 'logger' is not defined` | Add `import logging; logger = logging.getLogger(__name__)` at the top of `backend/app/crud.py`. |
| **PERF-10** | `backend/app/services/pdf_parser.py:105` | `_generic_parse` | **CRITICAL BUG** | Holdings parsing is indented inside `if name_match:` | Un-indent holdings parsing block so holdings extract even if account name regex misses. |
| **PERF-11** | `backend/app/services/news_service.py:29` | Global Config | **MEDIUM** | `socket.setdefaulttimeout(20)` mutates global state | Remove global socket timeout; pass `timeout` explicitly in `requests.get` and `feedparser`. |
| **PERF-12** | `backend/app/routers/users.py:64` | `save_bank_config` | **MEDIUM** | Synchronous batch PDF processing inside request | Move `handler.process_file` loop to FastAPI `BackgroundTasks`. |

---

## 5. Concrete Code-Level Fix Snippets

### Fix 1: Enable SQLite WAL Mode & Connection Pragmas (`backend/app/database.py`)
```python
# Before (lines 11-13)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# After
from sqlalchemy import event

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False, "timeout": 15}
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()
```

### Fix 2: Add Missing Indexes (`backend/app/models.py`)
```python
from sqlalchemy import Index

class Fund(Base):
    __tablename__ = "funds"
    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("banks.id"), index=True) # <-- Added index=True
    name = Column(String, index=True)
    ...

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True) # <-- Added index=True
    bank_id = Column(Integer, ForeignKey("banks.id"), index=True) # <-- Added index=True
    account_number = Column(String, index=True)
    ...

class Statement(Base):
    __tablename__ = "statements"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True) # <-- Added index=True
    date = Column(String, index=True) # <-- Added index=True
    ...

class FundNAVHistory(Base):
    __tablename__ = "fund_nav_history"
    __table_args__ = (
        Index("ix_fund_nav_history_fund_date", "fund_id", "date"),
    )
    ...

class FundPerformanceMetrics(Base):
    __tablename__ = "fund_performance_metrics"
    __table_args__ = (
        Index("ix_fund_perf_fund_date", "fund_id", "date"),
    )
    ...
```

### Fix 3: Eliminate N+1 Queries in Outperformer Analysis (`backend/app/routers/dashboard.py`)
```python
# Optimize get_fund_outperformers by bulk-fetching latest metrics for all active funds in ONE query:
@router.get("/fund-outperformers", response_model=Dict[str, Any])
def get_fund_outperformers(
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    from sqlalchemy.orm import joinedload
    
    latest_statements, _ = get_latest_statements(db, current_user.id)
    
    # 1. User holdings extraction ...
    
    # 2. Fetch all funds with their Bank relationship in a single query
    all_funds = db.query(models.Fund).options(joinedload(models.Fund.bank)).filter(models.Fund.is_active == True).all()
    
    # 3. Batch load all latest performance metrics in ONE query using a subquery
    subq = db.query(
        models.FundPerformanceMetrics.fund_id,
        func.max(models.FundPerformanceMetrics.date).label("max_date")
    ).group_by(models.FundPerformanceMetrics.fund_id).subquery()
    
    latest_metrics_rows = db.query(models.FundPerformanceMetrics).join(
        subq,
        (models.FundPerformanceMetrics.fund_id == subq.c.fund_id) &
        (models.FundPerformanceMetrics.date == subq.c.max_date)
    ).all()
    
    metrics_by_fund = {m.fund_id: m for m in latest_metrics_rows}
    
    # Now evaluate composite scores in memory with ZERO additional database queries
```

### Fix 4: Fix Missing Logger Import (`backend/app/crud.py`)
```python
# Insert at top of backend/app/crud.py (Line 1):
import logging
logger = logging.getLogger(__name__)
```

### Fix 5: Fix PDF Parser Indentation Bug (`backend/app/services/pdf_parser.py`)
```python
# Un-indent lines 116-281 so holdings parsing runs even if name_match is None:
if name_match:
    name = name_match.group(1).strip().upper()
    blacklist = ["GROSS DIVIDEND", "WHT", "ZAKAT", "NET DIVIDEND", "PORTFOLIO NO", "FOLIO NO", "ACCOUNT NO", "TAX"]
    is_garbage = any(word in name for word in blacklist) or any(char.isdigit() for char in name)
    if name and not is_garbage and len(name) < 60 and (len(name.split()) > 1):
        data["account_name"] = name.replace("MR. ", "").replace("MS. ", "").strip()

# --- HOLDINGS PARSING (Placed at top-level inside _generic_parse, outside if name_match) ---
if bank_name.lower() in ["atlas", "faysal"]:
    ...
```

---

## 6. Verification Method

To independently verify these findings:

1. **Verify Missing Logger in `crud.py`**:
   * Inspect lines 92 and 100 in `backend/app/crud.py`. Confirm `logger.info` is called while `logging`/`logger` is nowhere in the file imports.
2. **Verify N+1 Query Multiplier**:
   * Enable SQLAlchemy query logging by setting `echo=True` in `backend/app/database.py`:
     ```python
     engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True)
     ```
   * Trigger `GET http://localhost:8001/dashboard/fund-outperformers`. Count SQL statements in terminal output — observe over 200–500 distinct `SELECT` statements emitted for a single request.
3. **Verify Event Loop Blocking on Login**:
   * Inspect `backend/app/routers/auth.py` line 15. Observe `async def login_for_access_token` executes synchronous Argon2 hashing.
4. **Verify Database Missing Indexes**:
   * Run SQLite pragma check on `fundtracker.db`:
     ```sql
     PRAGMA index_list('funds');
     PRAGMA index_list('portfolios');
     PRAGMA index_list('statements');
     ```
   * Observe `bank_id`, `user_id`, and `portfolio_id` foreign keys lack index entries.
5. **Verify Playwright Timeout Behavior**:
   * Inspect `backend/app/services/scraper.py` lines 48–128. Calculate cumulative wait times (3 attempts * (60s goto + 30s wait_for_timeout + 60s VPS goto) = ~450 seconds maximum blocking execution time).
