NAME: Statement Upload And Parser Fix
PRIORITY: 1
CATEGORY: UX
PROBLEM: The desktop frontend has no upload button or drag-and-drop zone for user bank statements (Meezan, HBL, Atlas, Faysal), displaying only an "Upload FMR" button that confuses users. Additionally, the backend PDF parser contains an indentation bug that skips all portfolio holdings extraction whenever the customer account name regex fails to match. This breaks the primary onboarding flow for first-time retail investors and causes statement imports to silently fail during live demos.
APPROACH: Add a dedicated "Upload Statement" modal in the frontend dashboard with an institution selector and file picker linked to an upload endpoint. Correct the indentation in `backend/app/services/pdf_parser.py` so holdings extraction executes independently of name matching. Provide immediate visual feedback, parsing progress indicators, and parsed summary confirmations upon upload.

NAME: Real Statement History Ledger
PRIORITY: 2
CATEGORY: UX
PROBLEM: The "Recent Portfolio Updates" table in the dashboard displays hardcoded static mock rows dated November 2023 rather than actual parsed statement data. Furthermore, the "View All History" button lacks an onClick handler and is completely unresponsive. This damages credibility in front of hackathon judges and prevents users from verifying their transaction history.
APPROACH: Connect the recent updates table to dynamic statement records queried from the SQLite database via a dedicated endpoint. Implement an interactive "Statement History" drawer or modal triggered by the "View All History" button that lists all ingested statements with date, bank, portfolio valuation, and status. Allow users to re-parse or delete specific historical statements directly from the ledger interface.

NAME: Dashboard Timeout Crash Elimination
PRIORITY: 3
CATEGORY: Performance
PROBLEM: The dashboard wraps initial portfolio data loading in an aggressive 5-second Promise.race client-side timeout that triggers on cold starts or concurrent background scraping. When triggered, the application replaces the entire dashboard with a full-screen connection error view that hides all navigation and content. This creates high risk of an embarrassing false-positive crash during live hackathon judging evaluations.
APPROACH: Remove the arbitrary 5000ms Promise.race timeout in `frontend/src/pages/Dashboard.tsx` and configure standard Axios timeout handling with graceful fallback states. Replace full-screen error blocking with localized skeleton loaders for individual cards and widgets. Ensure secondary endpoints (allocation, performance, holdings) fail gracefully without preventing the core dashboard layout from rendering.

NAME: Backend Logger And Exception Fixes
PRIORITY: 4
CATEGORY: Performance
PROBLEM: The database layer in `backend/app/crud.py` invokes `logger.info` during portfolio healing routines without importing or initializing Python's logger, triggering fatal NameError exceptions during PDF ingestion. Additionally, `backend/app/services/news_service.py` sets a global socket timeout that mutates runtime behavior for all networking libraries and wipes database records before network fetches complete. These defects introduce silent transaction rollbacks and data loss risks during runtime operations.
APPROACH: Import and configure standard Python logging in `backend/app/crud.py` to ensure portfolio healing transactions succeed without uncaught exceptions. Remove socket.setdefaulttimeout in `news_service.py` and pass explicit timeouts directly to individual HTTP requests. Refactor article ingestion to perform transactional upserts so existing news feeds are preserved if an external feed fetch fails.

NAME: Alibaba Cloud Model Studio Integration
PRIORITY: 5
CATEGORY: Judge Impact
PROBLEM: The application currently relies solely on Google Gemini API keys for FMR document parsing and news intelligence, containing zero native Alibaba Cloud integrations. In an Alibaba Cloud hackathon track, failing to leverage Alibaba Cloud services results in severe scoring penalties from judges. Furthermore, Google Gemini free tier rate limits create latency bottlenecks during live document processing.
APPROACH: Migrate FMR document parsing and news intelligence services to Alibaba Cloud Model Studio using the Qwen 2.5 LLM series (qwen-vl-max for multimodal PDF parsing and qwen-max for market reasoning). Implement OpenAI-compatible SDK client bindings targeting Alibaba Cloud DashScope endpoints with robust fallbacks. Highlight Alibaba Cloud Model Studio benchmarks in the project pitch and architecture documentation to demonstrate authentic enterprise cloud alignment.

NAME: Shariah Zakat And Purification Engine
PRIORITY: 6
CATEGORY: Judge Impact
PROBLEM: The existing Zakat calculation modal oversimplifies Islamic wealth purification by applying a flat 2.5% multiplier to gross net worth while ignoring the State Bank of Pakistan silver Nisab threshold. Furthermore, it treats 100% of equity fund assets as zakatable despite AAOIFI and Pakistani Shariah standards exempting fixed operational assets, and it is styled in jarring neon pink with placeholder icons. This inaccuracy alienates Pakistani Islamic finance investors who represent over 60% of mutual fund capital.
APPROACH: Implement an Islamic Zakat and Shariah purification engine that dynamically checks the current SBP Nisab benchmark before calculating liability. Apply fund-specific zakatable asset ratios (e.g. 100% for cash funds vs ~25% for equity funds) extracted from FMR reports and calculate dividend cleansing amounts for charity. Redesign the modal with dignified emerald and gold styling, clear jurisprudential breakdowns, and an exportable Section 60 tax exemption certificate.

NAME: Database Concurrency And WAL Mode
PRIORITY: 7
CATEGORY: Performance
PROBLEM: SQLite is initialized with default rollback journal settings that acquire an exclusive file lock during write operations from the MUFAP scraper, PDF watcher, or news updater. These exclusive locks cause concurrent API read requests from the frontend to stall or timeout with database locked errors. This concurrency bottleneck severely degrades desktop responsiveness when background data syncing is active.
APPROACH: Configure SQLAlchemy SQLite connection listeners in `backend/app/database.py` to enable Write-Ahead Logging (`PRAGMA journal_mode=WAL;`). Set `PRAGMA synchronous=NORMAL;` and `PRAGMA busy_timeout=5000;` to allow non-blocking concurrent reads during active background writes. Ensure foreign key constraints are actively enforced at the connection level.

NAME: Database Query Batching Optimization
PRIORITY: 8
CATEGORY: Performance
PROBLEM: The outperformer suggestion endpoint (`/dashboard/fund-outperformers`) executes over 500 sequential SQL queries inside nested fund and peer loops to evaluate performance metrics. Similarly, bank performance endpoints loop through each fund executing three independent queries per fund without batching. This N+1 query multiplication causes high CPU usage and multi-second API response delays.
APPROACH: Refactor `get_fund_outperformers` and `get_bank_performance` to fetch all relevant funds, latest performance metrics, and NAV records in single batched SQL queries using subqueries and `joinedload`. Perform peer scoring, quartile ranking, and outperformer matching entirely in memory using pre-fetched dictionaries. Reduce total database roundtrips per endpoint call from hundreds to fewer than three queries.

NAME: Database Indexing And Schema Tuning
PRIORITY: 9
CATEGORY: Performance
PROBLEM: Foreign key columns and high-frequency filter fields across core database tables lack database indexes, forcing SQLite to perform full table scans on growing datasets. In particular, `Fund.bank_id`, `Portfolio.user_id`, `Statement.portfolio_id`, and `NewsArticle.published_at` have no index definitions. Additionally, `FundNAVHistory` and `FundPerformanceMetrics` lack composite indexes on `(fund_id, date)`.
APPROACH: Add `index=True` declarations across all foreign key columns in `backend/app/models.py` including `Fund.bank_id`, `Portfolio.user_id`, and `Portfolio.bank_id`. Define composite indexes `ix_fund_nav_history_fund_date` and `ix_fund_perf_fund_date` on `(fund_id, date)` for historical time-series tables. Update migration and initialization scripts to generate these indexes on startup.

NAME: Serverless Scraper And Timeout Hardening
PRIORITY: 10
CATEGORY: Judge Impact
PROBLEM: The local Playwright MUFAP scraper runs in an unmanaged background thread with 60-second timeouts and three retries, accumulating up to 4.5 minutes of blocking CPU and memory consumption. Moreover, if a user's computer is turned off at the scheduled 6:00 PM scrape time, daily NAV prices are completely missed. This creates data gaps and risks process hangs during desktop evaluation.
APPROACH: Harden the scraper with explicit 25-second timeouts, resource teardown guards, and concurrency locking to prevent overlapping execution. Deploy a serverless containerized scraper to Alibaba Cloud Function Compute triggered by daily cron to write public NAV feeds to Alibaba Cloud Object Storage. Enable the desktop client to download cached daily NAV JSON from the cloud bucket on startup in milliseconds.

NAME: Inflation Hedge And SIP Simulator
PRIORITY: 11
CATEGORY: Judge Impact
PROBLEM: The application displays nominal portfolio gains without accounting for Pakistan's historically high inflation (15% to 30%+ CPI), giving retail investors a misleading sense of wealth preservation. Users cannot determine whether their mutual fund returns are beating cash depreciation or project future wealth via systematic investment plans (SIP). This misses a major opportunity to demonstrate financial inclusion and retail investor empowerment.
APPROACH: Build an interactive "Inflation vs Investment" simulator comparing portfolio CAGR against State Bank of Pakistan historical CPI inflation data. Implement a Goal-Based SIP planner allowing users to model disciplined monthly contributions toward life goals such as Hajj pilgrimage, child education, or retirement. Provide an "Inflation-Beating Scorecard" that highlights which held funds are generating positive real returns.

NAME: Personalized AI Portfolio Diagnostic Engine
PRIORITY: 12
CATEGORY: Judge Impact
PROBLEM: The dashboard endpoint `/dashboard/insights` is advertised as an AI-powered intelligence feature but actually executes deterministic static `if/else` threshold checks. Hackathon judges inspecting the codebase will quickly detect superficial AI claims and penalize the submission for misleading labeling. The static rules also fail to provide nuanced, personalized asset allocation advice based on investor profiles.
APPROACH: Replace static threshold rules with a genuine diagnostic reasoning pipeline powered by Alibaba Cloud Qwen 2.5 that analyzes portfolio diversification, fee drag, and risk alignment. Structure prompts with system boundaries ensuring advice remains educational and compliant with SECP NBFC regulations. Return structured diagnostic cards with risk scores, diversification commentary, and actionable optimization steps.

NAME: FastAPI Async Event Loop Unblocking
PRIORITY: 13
CATEGORY: Performance
PROBLEM: Synchronous CPU-intensive operations (Argon2 password verification in auth routes) and heavy I/O tasks (multimodal AI parsing and batch PDF extraction) are declared inside `async def` route handlers. In FastAPI, running synchronous blocking tasks in `async def` functions blocks the main asyncio event loop, freezing all concurrent requests. This causes the entire backend to become unresponsive whenever a user logs in or uploads a document.
APPROACH: Change synchronous route definitions in `backend/app/routers/auth.py`, `performance.py`, and `users.py` from `async def` to standard `def` so FastAPI automatically dispatches them to threadpools. Wrap blocking Gemini/Qwen AI network calls and PDF parsing loops with `starlette.concurrency.run_in_threadpool` or FastAPI `BackgroundTasks`. Ensure HTTP responses return immediately while heavy parsing jobs run asynchronously in worker threads.

NAME: Client Route Architecture Refactoring
PRIORITY: 14
CATEGORY: UX
PROBLEM: Subpages such as `/news`, `/ai-news`, and `/suggestions` are rendered conditionally inside `Dashboard.tsx` instead of using standard React Router route structures. As a result, navigating to the news or suggestions tab triggers `Dashboard.tsx` lifecycle hooks, firing four redundant portfolio API calls that are ignored by the subpage. If any portfolio API call encounters an error, the whole application switches to a connection error screen, blocking access to unaffected features.
APPROACH: Refactor `frontend/src/App.tsx` and layout components to use proper React Router nested route hierarchies with a persistent sidebar layout shell. Isolate dashboard portfolio data fetching to `Dashboard.tsx` so subpages mount cleanly without triggering extraneous API calls. Ensure each subpage manages its own localized state, loading skeletons, and error boundaries independently.

NAME: Global Toast Notification System
PRIORITY: 15
CATEGORY: UX
PROBLEM: Critical application actions—including FMR uploads, PDF password updates, news article pinning, and PDF exports—trigger native browser `window.alert()` dialogs. These synchronous OS modal alerts freeze the Electron desktop UI thread and look visually unpolished. They also fail to provide modern asynchronous feedback when operations succeed or fail in the background.
APPROACH: Implement an in-app toast notification system using a lightweight provider or custom Tailwind notification container. Replace all `window.alert()` calls across `Dashboard.tsx`, `News.tsx`, and `AINews.tsx` with styled success, error, warning, and info toasts. Ensure toast notifications auto-dismiss gracefully, support action buttons, and remain non-blocking to user interaction.

NAME: Authentication Interceptor And Form States
PRIORITY: 16
CATEGORY: UX
PROBLEM: The authentication forms in `Login.tsx` and `Register.tsx` lack submitting state indicators, leaving submit buttons clickable while network requests are in flight. Furthermore, the Axios client lacks a response interceptor to catch 401 Unauthorized errors when the 30-minute JWT token expires. When session expiration occurs, subpages show confusing generic error banners rather than cleanly prompting the user to sign in again.
APPROACH: Add `isLoading` states and animated loading spinners to authentication buttons, disabling duplicate clicks during network requests. Configure an Axios response interceptor in `frontend/src/api/client.ts` that intercepts 401 status codes, clears expired tokens from `localStorage`, and redirects users to `/login` with an informative session expired notice. Include inline validation feedback for email and password fields.

NAME: Sovereign Finance Design System Tokens
PRIORITY: 17
CATEGORY: Design
PROBLEM: The frontend stylesheet contains leftover Vite starter CSS boilerplate, prompt drift artifacts such as neon purple variables aliased to emerald, and hardcoded dark purple background rules that break light mode readability. The app lacks a cohesive visual identity tailored to the prestige of Pakistani wealth management institutions. This gives the application an AI-generated, template-like look that blends into generic hackathon submissions.
APPROACH: Refactor `frontend/src/index.css` with a unified Pakistani sovereign finance design token system based on deep midnight slate, institutional emerald green, and Hilal gold accents. Define semantic CSS variables for surfaces, borders, and typography that adapt seamlessly between dark and light themes. Configure Google Fonts (Plus Jakarta Sans for headers, Inter for body, JetBrains Mono for tabular figures) in `index.html`.

NAME: Hero Net Worth Visual Hierarchy
PRIORITY: 18
CATEGORY: Design
PROBLEM: The dashboard top summary displays four identical gray box cards where Total Net Worth has the same visual weight as secondary metrics. Financial figures lack Pakistani denomination context (Lacs and Crores), forcing local investors to mentally convert multi-digit numbers. The cards also lack visual trend indicators, delta badges, or sparklines to convey momentum at a glance.
APPROACH: Redesign the KPI grid to feature an asymmetric, elevated Hero Net Worth card that commands primary visual focus with emerald gradients and live MUFAP status badges. Add secondary Pakistani denomination formatting tooltips displaying figures in Lacs and Crores alongside standard PKR notation. Incorporate color-coded ROI badges and tabular number alignment for rapid financial comprehension.

NAME: Component Icon And Asset Normalization
PRIORITY: 19
CATEGORY: Design
PROBLEM: Multiple dashboard and news modals use a 45-degree rotated lightning bolt (`Zap`) as a crude substitute for a modal close icon, with explicit code comments acknowledging the AI shortcut. Password visibility toggles use diagonal arrows instead of eye icons, the asset allocation pie chart uses pure white for slice four (making it invisible in light mode), and AI news displays raw platform-dependent emojis. These shortcuts signal low attention to detail.
APPROACH: Replace rotated `Zap` icons across all modals and world context items with standard `X` icons from `lucide-react`. Replace password toggle arrows with `Eye` and `EyeOff` components, and replace raw system emojis with standardized financial vector icons. Update the asset allocation pie chart palette with accessible, high-contrast colors that remain visible across both dark and light modes.

NAME: Bilingual Urdu Financial Copilot
PRIORITY: 20
CATEGORY: Judge Impact
PROBLEM: Financial reports and mutual fund interfaces in Pakistan are almost universally presented in technical English jargon, creating a severe barrier to financial inclusion for the majority of the population. The current application has no multi-language support or conversational accessibility for non-English speakers. This limits the real-world impact score in the Financial Inclusion track.
APPROACH: Introduce a bilingual interface toggle supporting English and Urdu (Nastaliq script) typography across key dashboard metrics and summaries. Integrate an Urdu-capable conversational financial copilot powered by Alibaba Cloud Qwen 2.5 that answers user queries (e.g. "Mera portfolio inflation ko beat kar raha hai?") in clear, conversational Urdu. Provide pre-built voice or text prompt chips for common Pakistani retail investment questions.

NAME: Capital Gains And Tax Optimizer
PRIORITY: 21
CATEGORY: Judge Impact
PROBLEM: The application assumes a flat 15% capital gains tax rate, failing to reflect Pakistan's Income Tax Ordinance rules regarding Filer vs Non-Filer tax rate differentials and holding period tiers under Section 37A. Additionally, it ignores Voluntary Pension Scheme (VPS) tax rebates under Section 63, which offer up to a 20% direct tax credit on annual taxable income. This deprives investors of high-value tax planning insights.
APPROACH: Build a tax optimization module that computes realized and unrealized capital gains segmented by holding periods and user tax filer status. Implement a "VPS Tax Rebate Calculator" showing the exact PKR tax savings achievable by allocating funds to pension sub-funds. Generate a downloadable tax annexure summarizing annual capital gains and rebate claims ready for FBR wealth statement filing.

NAME: Benchmark Alpha And Fee Analyzer
PRIORITY: 22
CATEGORY: Judge Impact
PROBLEM: Pakistani asset management companies charge high Total Expense Ratios (1.5% to 3.5% annually) for actively managed equity funds that frequently underperform passive indices like the KSE-100 and KMI-30. The app currently tracks fund returns in isolation without benchmarking against market indices or quantifying fee drag. Retail investors cannot evaluate whether their active management fees are justified.
APPROACH: Ingest daily KSE-100 and KMI-30 index levels alongside MUFAP NAV data and display comparative alpha charts over 1-month, 6-month, 1-year, and 3-year periods. Calculate expense-adjusted alpha and Sharpe ratios to highlight outperforming and underperforming funds relative to their management fees. Provide visual "Value for Money" badges that help investors identify low-cost, high-performing funds.

NAME: Zero Knowledge Encrypted Cloud Vault
PRIORITY: 23
CATEGORY: Judge Impact
PROBLEM: While the local-first architecture protects user privacy, investors who manage portfolios across multiple desktop machines have no secure way to synchronize data without manual file copying. Storing unencrypted financial statements in public cloud storage would violate the app's core privacy commitment. The lack of a secure sync option limits usability for multi-device users.
APPROACH: Build an optional encrypted backup feature that encrypts the local SQLite database using AES-256 with a client-managed master passphrase before uploading to Alibaba Cloud Object Storage Service (OSS). Integrate Alibaba Cloud Key Management Service (KMS) for client-side envelope encryption where the cloud provider never holds decryption keys. Provide simple one-click backup and restore workflows directly within the application settings.

NAME: Semantic News Tag Taxonomy System
PRIORITY: 24
CATEGORY: Design
PROBLEM: The financial news feed renders 18 disparate tag pill background colors across articles, producing a chaotic rainbow appearance that distracts from reading. The colors have no semantic relationship to financial market sentiment or asset classes. This visual noise undermines the analytical credibility of the AI news intelligence module.
APPROACH: Consolidate news category tags into four semantic color families: Emerald/Green for monetary policy and Islamic finance, Blue/Indigo for PSX equities and capital markets, Amber/Gold for commodities and precious metals, and Rose/Red for inflation and macroeconomic risk. Standardize tag pill padding, font sizing, and subtle border accents across all news cards for a clean, editorial layout.
