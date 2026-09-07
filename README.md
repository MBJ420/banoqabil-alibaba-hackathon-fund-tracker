# 🏦 FundTracker Advanced
### BanoQabil × Alibaba Cloud AI Hackathon — Financial Inclusion Track
**Project Code:** P01090 | **Team Name:** Fund Tracker | **Lead Developer:** Muhammad Bin Jamil  
**Repository:** [github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker](https://github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker)

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20TypeScript-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styling-Tailwind%20CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Electron](https://img.shields.io/badge/Desktop-Electron-47848F?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Alibaba Cloud](https://img.shields.io/badge/AI-Alibaba%20Cloud%20Qwen%202.5-FF6A00?style=flat&logo=alibabacloud&logoColor=white)](https://www.alibabacloud.com/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20(WAL)-003B57?style=flat&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

> **FundTracker Advanced** is an intelligent, local-first mutual fund portfolio tracker, macroeconomic advisory platform, and Shariah wealth terminal engineered specifically for Pakistani retail investors. It consolidates fragmented investments across **Al Meezan Investment Management, HBL Asset Management, Atlas Asset Management, and Faysal Funds** into a unified, privacy-guaranteed desktop application.

---

## 📌 Table of Contents
1. [Core Mission & Problem Statement](#-core-mission--problem-statement)
2. [Key Features & Innovations](#-key-features--innovations)
3. [Alibaba Cloud Model Studio Integration](#-alibaba-cloud-model-studio-integration)
4. [System Architecture](#-system-architecture)
5. [Tech Stack](#-tech-stack)
6. [Database Schema & Architecture](#-database-schema--architecture)
7. [API Endpoints](#-api-endpoints)
8. [Setup & Running Locally](#-setup--running-locally)
9. [Documentation & Deliverables Index](#-documentation--deliverables-index)
10. [Compliance & Disclaimers](#-compliance--disclaimers)

---

## 🎯 Core Mission & Problem Statement

Less than **0.5% of Pakistan's population** invests in mutual funds or the capital market. Retail investors face acute structural challenges:

1. **Fragmented Portfolios Without P&L:** Investors with accounts across multiple Asset Management Companies (AMCs) receive incompatible monthly PDF statements. Major AMCs (such as HBL) report current balances but omit net gain/loss, making true ROI invisible.
2. **Absence of Open Financial APIs:** Unlike Western markets, Pakistan lacks open banking APIs or public PSX/MUFAP endpoints for retail consumers to pull automated NAV feeds.
3. **Complex Shariah Zakat Obligations:** Over 70% of Pakistani retail investors seek Islamic funds, but calculating Zakat on equities and balanced funds requires complex working-capital balance sheet deductions that standard calculators fail to address.
4. **Punitive Tax Regulations & Missed Rebates:** Under the Finance Act 2024, non-filers face a punitive 30% CGT rate (vs. 15% for filers). Furthermore, retail investors routinely miss out on Section 63 Voluntary Pension Scheme (VPS) tax rebates worth up to 20% of taxable income.
5. **The "Money Illusion" & Inflation:** With double-digit inflation (12%–29% CPI historically), investors mistake nominal paper gains for real wealth creation.
6. **Financial Jargon & Language Barriers:** Complex financial terminology and English-only interfaces alienate millions of potential Pakistani retail investors.

**FundTracker Advanced** solves all six problems in a single, offline-resilient, privacy-first desktop application.

---

## 🚀 Key Features & Innovations

### 1. 📄 Multi-AMC Bank PDF Statement Auto-Ingestion
- Parses native digital PDF statements from **Al Meezan Investment Management, HBL Asset Management, Atlas Asset Management, and Faysal Funds** using `pdfplumber` and robust regex extractors.
- Reconciles acquisition costs, calculates historical FIFO gain/loss, and handles encrypted statements (Atlas password configs).
- Drop statements directly into `Fund Tracker PDF Data/{username}/{bank}/` for instant background ingestion via `watchdog`, or upload via the GUI.

### 2. 🕷️ Automated Headless MUFAP NAV Scraper (210+ Funds)
- Automated Playwright headless Chromium scraper scraping `mufap.com.pk` daily at 6:00 PM PKT.
- Dynamically discovers and auto-registers newly launched mutual funds on each scrape.
- Captures daily closing NAVs and trailing performance returns (1M, 6M, 1Y, YTD) across conventional and Islamic asset classes.
- Includes manual one-click scraper execution with live status and health tracking from the GUI.

### 3. 🌙 Shariah Zakat & Wealth Purification Terminal
- Compliant with **AAOIFI Shariah Standard No. 35** and OIC Islamic Fiqh Academy guidelines.
- **Editable Gold & Silver Nisab:** Real-time editable Nisab thresholds (87.48g gold / 612.36g silver) reflecting live Pakistani bullion market rates.
- **Prudent Equity Working Capital Ceiling (*Ihtiyat*):** Deducts illiquid fixed assets (*Amwal al-Qunyah*) and sets an intentional 28% ceiling on equity holdings to ensure religious obligations are fully fulfilled without underpaying.
- **Balanced Fund Rule:** Applies a 70% liquid cash / 30% equity allocation model for balanced/asset-allocation funds.
- **Section 60 Tax Exemption Certificate:** Generates formal zakat deduction statements eligible for tax credit under Section 60 of the Income Tax Ordinance 2001.
- Complete scholarly fiqh documentation and sources cited within the terminal.

### 4. 💼 Capital Gains & VPS Pension Tax Optimizer
- Fully updated for **Pakistan Finance Act 2024** regulations and FBR Section 37A capital gains tax tiers (15% Filer, 30% Non-Filer).
- **Section 63 VPS 20% Rebate Advisor:** 2-step decision flow with monthly salary sync that calculates exact annual tax savings (up to 20% of taxable income) and models a 50% tax-free lump-sum at retirement.
- Tax-loss harvesting guidance allowing offsetting of capital losses within same asset categories.

### 5. 📉 Inflation Hedge & Goal-Based SIP Annuity Simulator
- Uses historical State Bank of Pakistan (SBP) CPI data and Fisher's real rate of return equation:
  $$\text{Real Purchasing Power} = \frac{\text{Nominal Future Value}}{(1 + \text{CPI Inflation})^t}$$
- Simulates compound growth across customizable monthly SIP contributions and demonstrates real purchasing power versus PKR cash depreciation.

### 6. 📈 Benchmark Alpha & Active Fee Drag Analyzer
- Calculates Jensen's Gross and Net Alpha against the **KSE-100** and **KMI-30** benchmark indices:
  $$\text{Net Alpha} = (\text{Fund Return} - \text{Benchmark Return}) - \text{Total Expense Ratio}$$
- Analyzes Total Expense Ratio (TER) fee drag to categorize mutual funds into *Great Value*, *Fair Value*, or *Overpriced*.
- **Cross-AMC Peer Outperformer Engine:** Identifies higher-yielding funds in the same category across different fund managers, strictly distinguishing conventional from pension funds.

### 7. 📑 Portfolio Data Manager & Audit Ledger
- Interactive Statement History Ledger with full statement audit trails.
- Add manual monthly investment entries for non-statement holdings.
- Delete or rollback erroneous uploads with safety confirmation modals.

### 8. 🇵🇰 Bilingual Interface (English ↔ Roman Urdu)
- Instant 1-click toggle between English and conversational Roman Urdu throughout the entire application.
- Translates technical financial metrics into relatable terminology (`"Kul Nafa / Nuqsan"`, `"Mehngai Simulator"`, `"Maliyati Intelligence"`).

### 9. 🛡️ Privacy-First Zero-Knowledge Architecture
- All user data, statements, holdings, and database records remain strictly local on the user's PC.
- No personal balances or account identifiers are ever transmitted to the cloud.

---

## 🤖 Alibaba Cloud Model Studio Integration

All artificial intelligence workloads in FundTracker Advanced are powered by **Alibaba Cloud Model Studio** via DashScope API bindings (`https://dashscope-intl.aliyuncs.com/compatible-mode/v1`) using the **Qwen 2.5** LLM series:

```
┌────────────────────────────────────────────────────────────────────────┐
│               ALIBABA CLOUD MODEL STUDIO (QWEN 2.5)                   │
├──────────────────────────────────┬─────────────────────────────────────┤
│ 📰 Two-Pass Macro News Engine    │ 📊 Zero-Knowledge Diagnostics       │
│ • Pass 1: World Context Memory   │ • Evaluates anonymized allocations  │
│ • Pass 2: Sector Impact Scoring  │ • Macro-aware rebalancing advice    │
│ • Predicts Equity/Debt/Gold      │ • Bilingual (English & Roman Urdu)  │
├──────────────────────────────────┼─────────────────────────────────────┤
│ 📄 PyMuPDF + Qwen FMR Parser     │ 🔄 Resilient Client Bindings        │
│ • Parses messy AMC reports       │ • OpenAI-compatible SDK client      │
│ • Extracts risk & allocations    │ • Exponential backoff & timeout     │
└──────────────────────────────────┴─────────────────────────────────────┘
```

1. **Two-Pass Macroeconomic News Sentiment Engine:** Ingests live RSS feeds from *Dawn Business* and *Business Recorder*. Pass 1 maintains persistent institutional memory of macroeconomic events (`KEEP`, `AMEND`, `RESOLVE`, `ADD`). Pass 2 forecasts sector impact direction (`Bullish`, `Bearish`, `Neutral`) and impact scores (0–10) across Short, Medium, and Long horizons for PSX Equities, Money Market, Fixed Income, and Gold.
2. **PyMuPDF + Qwen FMR Parser:** Extracts fund manager commentary, risk levels, and asset allocation percentages from complex monthly Fund Manager Reports.
3. **Zero-Knowledge Portfolio Health Diagnostics:** Diagnoses asset allocation drift and provides macro-aware rebalancing recommendations without ever sending user account balances or personal identifiers to external servers.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             LOCAL DESKTOP CLIENT (ELECTRON)                            │
│                                                                                        │
│   • React 18 + TypeScript + Vite + Tailwind CSS + ApexCharts Interactive Visuals       │
│   • Bilingual State Engine: English ↔ Roman Urdu (LanguageContext)                     │
│   • Shariah Zakat & Nisab Terminal & Portfolio Data Manager                            │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP REST (Port 8001) / IPC
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FASTAPI BACKEND RUNTIME                                │
│                                                                                        │
│   ├── Automated Watchdog Ingestion (Watches "Fund Tracker PDF Data/" subdirectories)   │
│   ├── Multi-AMC Statement Parsing Engine (Meezan, HBL, Atlas, Faysal regex extractors) │
│   ├── Profit & Loss (P&L) Ledger & Acquisition Cost Reconciler                         │
│   ├── AAOIFI Standard No. 35 Shariah Zakat & Nisab Computation Engine                  │
│   ├── Finance Act 2024 Tax Optimizer & Section 63 VPS 20% Rebate Advisor               │
│   ├── SBP CPI Inflation Purchasing Power & Goal-Based SIP Annuity Engine               │
│   ├── Jensen's Gross/Net Alpha Engine & Active Fee Drag Analyzer                       │
│   └── Cross-AMC Outperformer Quartile Discovery Engine                                 │
└───────────────┬───────────────────────────┬────────────────────────────┬───────────────┘
                │                           │                            │
                ▼                           ▼                            ▼
┌───────────────────────────────┐ ┌──────────────────────────┐ ┌─────────────────────────┐
│       EMBEDDED SQLITE         │ │    HEADLESS PLAYWRIGHT   │ │   ALIBABA CLOUD MODEL   │
│         IN WAL MODE           │ │      SCRAPER ENGINE      │ │     STUDIO (QWEN 2.5)   │
│                               │ │                          │ │                         │
│ • PRAGMA journal_mode=WAL     │ │ • Headless Chromium      │ │ • DashScope API Client  │
│ • Zero read locking           │ │ • mufap.com.pk scraping  │ │ • PyMuPDF FMR Parser    │
│ • 210+ Verified Mutual Funds  │ │ • Cloudflare bypass      │ │ • Two-Pass Macro Engine │
│ • 1,770+ NAV History Records  │ │ • Daily 6:00 PM PKT cron │ │ • FundTracker AI Intel  │
│ • 18 Statement Audit Records  │ │ • 210+ NAVs & Returns    │ │ • Bilingual Roman Urdu  │
└───────────────────────────────┘ └──────────────────────────┘ └─────────────────────────┘
```

---

## 🧰 Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend Runtime** | Python 3.11+ / FastAPI | High-performance asynchronous REST API |
| **Database** | SQLite 3 (WAL mode) | Embedded, zero-configuration local storage with concurrent reads |
| **ORM & Migrations**| SQLAlchemy & Alembic | Schema modeling and version-controlled migrations |
| **Web Scraping** | Playwright (Headless Chromium) | Automated daily NAV scraping from MUFAP with Cloudflare bypass |
| **PDF Extraction** | `pdfplumber` & `PyMuPDF (fitz)` | Multi-AMC bank statement text extraction |
| **AI / Cloud LLM** | Alibaba Cloud Model Studio (Qwen 2.5) | Macro sentiment reasoning, FMR parsing, and portfolio diagnostics |
| **Desktop Wrapper** | Electron | Native Windows desktop packaging |
| **Frontend UI** | React 18 + TypeScript + Vite | Reactive single-page application |
| **Styling** | Tailwind CSS | Modern, responsive dark-themed user interface |
| **Data Viz** | ApexCharts | Interactive time-series NAV, asset allocation, and alpha charts |
| **Animations** | Framer Motion | Smooth UI transitions and interactive cards |

---

## 🗄 Database Schema & Architecture

The embedded SQLite database operates with **Write-Ahead Logging (`PRAGMA journal_mode=WAL;`)**, `PRAGMA synchronous=NORMAL;`, and `PRAGMA busy_timeout=5000;`, enabling concurrent reads from the Electron client during active background scraper writes.

| Table | Description |
| :--- | :--- |
| `users` | Local accounts (username + argon2/bcrypt hashed password) |
| `banks` | Verified fund houses: Meezan, HBL, Atlas, Faysal |
| `funds` | 210+ mutual funds with category, risk level, and expense ratios |
| `portfolios` | Links user accounts to AMC portfolio holdings |
| `statements` | Parsed statement ledger records, units, acquisition cost, and P&L |
| `fund_nav_history` | Historical daily NAV closing prices for interactive charting |
| `fund_performance_metrics` | Trailing return benchmarks (1M, 6M, 1Y, YTD) scraped from MUFAP |
| `user_bank_configs` | Per-user credentials & passwords for encrypted PDF statements |
| `news_articles` | Cached Dawn Business & Business Recorder macroeconomic news |
| `asset_predictions` | Qwen 2.5 multi-horizon impact scores across asset categories |
| `world_context_entries` | Persistent macro context memory maintained by Qwen 2.5 |
| `scraper_status` | Operational health and execution audit log of the MUFAP scraper |

---

## 🌐 API Endpoints

Explore the interactive Swagger documentation when running the backend at **`http://localhost:8001/docs`**.

### Core Routes:
- `POST /token` — Authenticates user and returns JWT bearer token.
- `POST /users/register` — Registers a new local user account.
- `GET /dashboard/summary` — Net worth, total invested, cumulative gain/loss, and portfolio asset breakdown.
- `GET /dashboard/holdings` — Active mutual fund holdings with live NAV values and returns.
- `GET /dashboard/performance` — Historical portfolio value series for charting.
- `POST /statements/upload` — Upload and parse bank statement PDF.
- `GET /statements/history` — Fetch statement audit history ledger.
- `DELETE /statements/{id}` — Roll back a previously parsed statement.
- `POST /statements/manual` — Add manual monthly investment entry.
- `GET /api/performance/bank/{name}` — Category-wise fund metrics and NAVs for a given AMC.
- `GET /api/performance/{id}/chart` — Full historical daily NAV curve for a specific fund.
- `GET /news/articles` — Scraped macroeconomic news articles.
- `GET /news/predictions` — Qwen 2.5 macroeconomic sector impact forecasts.
- `POST /api/scraper/trigger` — Trigger on-demand MUFAP NAV scrape.
- `GET /api/scraper/status` — Live status of the MUFAP scraper.

---

## 🛠 Setup & Running Locally

### Prerequisites
1. **Python 3.11+** — [python.org](https://www.python.org/downloads/) *(Ensure "Add Python to PATH" is checked)*
2. **Node.js 20+** — [nodejs.org](https://nodejs.org/)
3. **Git** — [git-scm.com](https://git-scm.com/)
4. **Alibaba Cloud DashScope API Key** — [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/) *(Optional: Google Gemini key supported as fallback)*

---

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker.git
cd "Fund Tracker Advanced"
```

#### 2. Backend Setup
```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv
venv\Scripts\activate       # On Linux/macOS: source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser binary (needed for MUFAP scraper)
playwright install chromium

# Set up environment variables
copy .env.example .env     # On Linux/macOS: cp .env.example .env
```
Open `backend/.env` in any text editor and add your Alibaba Cloud DashScope API key:
```env
DASHSCOPE_API_KEY=your_dashscope_api_key_here
DASHSCOPE_MODEL=qwen-plus
```

#### 3. Frontend Setup
```bash
# In a new terminal window
cd frontend
npm install
```

---

### Running the Application

**Option A: Windows 1-Click Launcher (Recommended)**
```cmd
Double-click start_app.bat
```
This automatically boots the FastAPI backend and launches the Electron desktop application window. To stop the application, run `stop_app.bat`.

**Option B: Manual Terminal Launch**
```bash
# Terminal 1 — Start Backend Server
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8001

# Terminal 2 — Start Desktop Electron Client
cd frontend
npm run electron:dev
```

---

## 📚 Documentation & Deliverables Index

All detailed architecture whitepapers, presentation slide decks, and datasets are organized in the [`docs/`](./docs) directory:

- 📄 **[Technical Whitepaper & System Documentation](docs/TECHNICAL_DOCUMENTATION.md)** — In-depth architectural analysis, math formulas, and engineering disclosures.
- 🛡️ **[Production Audit & Feature Readiness Matrix](docs/PRODUCTION_AUDIT_AND_DISCLOSURE.md)** — Detailed production audit, failure modes, and post-hackathon commercialization roadmap.
- 🖼️ **[System Architecture Diagram](docs/SYSTEM_ARCHITECTURE_DIAGRAM.png)** — High-resolution system topology diagram.
- 🖼️ **[AI Pipeline & Privacy Flow](docs/AI_PIPELINE_AND_PRIVACY_FLOW.png)** — Visualizing zero-knowledge privacy flow and Alibaba Cloud Qwen 2.5 integration.
- 📊 **[Pakistan Mutual Fund NAV Dataset (CSV)](docs/PAKISTAN_MUTUAL_FUND_NAV_DATASET.csv)** — Dataset of 210+ mutual funds across Meezan, HBL, Atlas, and Faysal.
- 📽️ **[Hackathon Presentation Slide Deck (PPTX)](docs/FundTracker_Advanced_Hackathon_Presentation.pptx)** — Official presentation deck for hackathon evaluation.
- 🎙️ **[Pitch Script & Judges Q&A](docs/PITCH_SCRIPT_AND_JUDGES_QA.md)** — Comprehensive presentation script and anticipated technical Q&A.
- 🎬 **[Demo Video Walkthrough Script](docs/DEMO_VIDEO_WALKTHROUGH_SCRIPT.md)** — Complete step-by-step narration script for live video demonstration.

---

## ⚖️ Compliance & Disclaimers

1. **SECP Regulatory Compliance:** FundTracker Advanced is an educational and portfolio tracking tool designed to empower retail investors. All projections, tax estimates, Zakat calculations, and AI-generated insights are provided **for informational purposes only** and do not constitute legal financial, tax, or investment advice under Securities and Exchange Commission of Pakistan (SECP) regulations.
2. **Shariah Zakat Reference:** Zakat computations adhere to the working capital methodology outlined in AAOIFI Shariah Standard No. 35. Users with specific fiqh questions are advised to consult their certified Islamic scholars.
3. **Data Privacy Assurance:** FundTracker Advanced operates on a strict **local-first, zero-knowledge architecture**. Personal statements, account numbers, and financial balances remain on the local machine and are never transmitted to external cloud servers.

---

*Built with passion for the **BanoQabil × Alibaba Cloud AI Hackathon** — Driving Financial Inclusion and Technological Empowerment in Pakistan.*

