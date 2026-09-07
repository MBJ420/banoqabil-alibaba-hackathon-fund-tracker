# 🏦 FundTracker Advanced — Technical Whitepaper & System Documentation
### BanoQabil × Alibaba Cloud AI Hackathon Pakistan
**Project Code:** P01090 | **Team Name:** Fund Tracker | **Lead Developer:** Muhammad Bin Jamil  
**Repository:** [github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker](https://github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker)

---

## 1. Executive Summary & Core Mission

**FundTracker Advanced** is an intelligent, local-first mutual fund portfolio tracker, macroeconomic advisory platform, and Shariah wealth terminal engineered specifically for Pakistani retail investors. It resolves the acute structural problems of retail investing in Pakistan by consolidating investments across **Al Meezan Investment Management, HBL Asset Management, Atlas Asset Management, and Faysal Funds** into a unified, privacy-guaranteed desktop environment.

Unlike generic international finance trackers that assume standard open banking APIs and English-only interfaces, FundTracker Advanced addresses the distinct realities of Pakistan's financial ecosystem:
1. **Automated Multi-AMC Ingestion & P&L Reconstruction:** Ingests unstructured bank PDF statements and computes cumulative Profit & Loss (P&L), solving the issue where AMCs like HBL omit net gains from their investor statements.
2. **Headless MUFAP NAV Ingestion:** Overcomes the absence of public financial APIs in Pakistan by using a Playwright headless browser to scrape daily closing NAVs and trailing returns for **210+ mutual funds** directly from the Mutual Funds Association of Pakistan (MUFAP).
3. **AAOIFI Shariah-Compliant Zakat Calculator:** Dynamically applies Shariah rulings to calculate Zakat across liquid cash, debt/Sukuk, and equity funds—utilizing a prudent ~28% working capital deduction on illiquid balance sheet assets.
4. **100% Alibaba Cloud Model Studio (Qwen 2.5):** Integrates Alibaba Cloud's state-of-the-art LLM via DashScope to power a PyMuPDF FMR document parser, a Two-Pass Macroeconomic News Sentiment Engine, and zero-knowledge portfolio health diagnostics.
5. **Inclusive Roman Urdu Localization:** Demystifies institutional jargon for retail investors by offering complete UI localization and FundTracker AI insights in Roman Urdu.
6. **Sovereign Tax & Inflation Math:** Implements official Finance Act 2024 capital gains tax tiers, Section 63 VPS pension tax rebates with a 20% advisor, SBP CPI real purchasing power simulations, and KSE-100 / KMI-30 Jensen's Alpha analysis.

---

## 2. Comprehensive System Architecture

The application adopts a **local-first desktop architecture** to maximize user privacy, eliminate cloud subscription barriers, and ensure offline resilience.

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

## 3. The Real-World Problems Solved by FundTracker Advanced

### 3.1. Profit & Loss Blindness: Missing P&L in AMC Statements
- **The Problem:** In Pakistan, different AMCs follow completely incompatible reporting standards. While Al Meezan includes net gains on its statements, HBL Asset Management and other institutions provide only raw unit counts and closing balances, completely omitting cumulative gain/loss and average purchase cost. As a result, investors are blind to whether their capital is actually growing.
- **Technical Solution:** FundTracker's ingestion engine parses transaction history and unit movements, reconstructing the investor's true **Cost Basis**:
  $$\text{Invested Capital} = \sum (\text{Units Purchased} \times \text{Acquisition NAV})$$
  $$\text{Unrealized P&L} = \text{Current Market Value} - \text{Invested Capital}$$
  $$\text{Yield \%} = \left( \frac{\text{Current Market Value} - \text{Invested Capital}}{\text{Invested Capital}} \right) \times 100$$
  This brings institutional clarity to previously opaque bank statements.

### 3.2. Severe Portfolio Fragmentation Across Multiple AMCs
- **The Problem:** Sophisticated retail investors hold units across multiple asset managers (e.g., Al Meezan for Islamic equities, HBL for cash management, Atlas for income). Investors must log into multiple fragmented portals and manually record values in spreadsheets.
- **Technical Solution:** A unified multi-AMC ledger that automatically consolidates holdings, asset allocation percentages, and cumulative returns into a single dashboard screen.

### 3.3. Absolute Privacy & Local-First Security
- **The Problem:** Cloud-based wealth aggregators require users to upload personal financial statements to remote servers, exposing CNICs, bank account numbers, and net worth balances to third-party data breaches.
- **Technical Solution:** A **Zero-Knowledge Privacy Contract**. The entire core ledger runs locally on the user's desktop inside an embedded SQLite WAL database. When communicating with cloud AI services, all monetary balances (PKR), account numbers, and personal identifiers are algorithmically stripped on the local backend. Only normalized asset percentages (e.g., *Equity 58.4%, Money Market 41.6%*) leave the computer.

### 3.4. Shariah-Compliant Zakat on Equity & Hybrid Funds
- **The Problem:** Most Muslim retail investors in Pakistan pay Zakat either by guessing or by incorrectly applying 2.5% to their entire gross equity fund value. Under Islamic jurisprudence (Fiqh) and AAOIFI standards, mutual fund shares represent ownership in underlying businesses; Zakat is only due on the company's liquid and working-capital assets (cash, receivables, inventory), NOT on illiquid fixed assets (factory buildings, plant & machinery, land, intellectual property).
- **Technical Solution:** An **AAOIFI Standard No. 35 Shariah Zakat Terminal**:
  - **Equity Funds:** Dynamically applies a prudent ~28% working capital ceiling to determine the net zakatable base:
    $$\text{Zakatable Base}_{\text{Equity}} = \text{Market Value} \times 28\%$$
  - **Cash & Money Market Funds:** Subject to 100% Zakat on total value.
  - **Income / Sukuk Funds:** Subject to 100% Zakat on total value.
  - **Balanced / Asset Allocation Funds:** Weighted blend ($70\% \text{ Cash/Income} + 30\% \text{ Equity} \approx 64\% \text{ Zakatable Base}$).
  - **Calendar Options:** Supports Hijri Lunar year (2.5%) and Gregorian Solar year (2.577% AAOIFI standard).
  - **Nisab Threshold Engine:** Live/configurable Silver (52.5 tolas) and Gold (7.5 tolas) rates with automatic Sahib-e-Nisab detection, and exportable Section 60 Tax Deduction Certificates.

### 3.5. Outperformer Discovery: Uncovering Better Alternative Funds
- **The Problem:** Over 200+ mutual funds operate in Pakistan. Retail investors frequently hold underperforming funds for years simply because they lack the tools to compare them against top-quartile alternatives in the same category.
- **Technical Solution:** The **Outperformer Peer Discovery Engine** scans same-category funds across all AMCs daily, ranking them by 1-year trailing yield and Sharpe ratio. If a user holds an underperforming fund, the platform flags superior peers, quantifying the annualized opportunity cost.

### 3.6. Financial Literacy & Roman Urdu Accessibility
- **The Problem:** Financial jargon (TER, NAV, Jensen's Alpha, Asset Allocation) and English-only user interfaces intimidate beginner retail investors and alienate millions of Pakistani citizens who prefer Urdu.
- **Technical Solution:** Complete **Roman Urdu Localization** powered by `LanguageContext`:
  - Instant toggle between English and natural Roman Urdu (`"Maliyati Intelligence"`, `"Kul Nafa / Nuqsan"`, `"Mehngai Simulator"`).
  - In-app ratio guides that explain complex investment metrics in plain language.
  - FundTracker AI bilingual intelligence delivering macroeconomic insights and fund diagnostics in both languages.

### 3.7. Portfolio Diversification & Macro Risk Drift
- **The Problem:** Investors often unintentionally over-concentrate in a single asset class (e.g., 90% in money market funds during a bull stock market or 90% in equities during an aggressive SBP interest rate hiking cycle).
- **Technical Solution:** Real-time asset diversification breakdown paired with **Alibaba Cloud Qwen 2.5 diagnostics**, which generates macro-contextualized rebalancing recommendations and a portfolio health score (0–100).

### 3.8. Authentic Market News Ingestion
- **The Problem:** Retail investors miss critical economic developments (SBP Monetary Policy meetings, IMF review tranches, Eurobond repayments) that immediately affect mutual fund yields.
- **Technical Solution:** Background news ingestion from authentic Pakistani financial publications (*Dawn* and *Business Recorder*), populating the local database with indexed economic updates.

### 3.9. AI News Digest & Multi-Horizon Sector Impact
- **The Problem:** Investors do not have hours each day to read lengthy economic articles and analyze how macroeconomic events affect their specific mutual funds.
- **Technical Solution:** A **Two-Pass Macroeconomic News Engine** powered by Alibaba Cloud Qwen 2.5:
  - *Pass 1 (World Context Manager):* Maintains persistent institutional memory of ongoing events using `KEEP`, `AMEND`, `RESOLVE`, and `ADD` directives.
  - *Pass 2 (Sector Impact Analyzer):* Analyzes breaking news against the World Context to forecast impact direction (`Bullish`, `Bearish`, `Neutral`) and impact scores (0–10) across Short, Medium, and Long horizons for PSX Equities, Money Market, Fixed Income, and Gold.

### 3.10. Inflation Drag & The "Money Illusion"
- **The Problem:** Double-digit CPI inflation (12% to 29% historically) secretly diminishes real wealth while investors celebrate nominal paper gains (e.g., earning 18% in a cash fund while inflation is 23% equals a real wealth loss of 5%).
- **Technical Solution:** An interactive **Inflation Hedge & SIP Simulator** based on Fisher's real interest rate formulation and State Bank of Pakistan historical CPI prints:
  $$\text{Real Purchasing Power} = \frac{\text{Nominal Future Value}}{(1 + \text{CPI Inflation})^t}$$

### 3.11. Benchmark Alpha & Active Fee Drag Analysis
- **The Problem:** Asset managers charge 1.5% to 3.5% Total Expense Ratios (TER). Over a decade, a 3% annual fee consumes more than 25% of compound portfolio returns, often while failing to beat passive benchmarks.
- **Technical Solution:** A **Benchmark Alpha Analyzer** that computes Jensen's Gross and Net Alpha against the KSE-100 and KMI-30 Islamic indices:
  $$\text{Net Alpha} = (\text{Fund Return} - \text{Benchmark Return}) - \text{Total Expense Ratio}$$
  Categorizes funds into *Great Value*, *Fair Value*, or *Overpriced*.

### 3.12. Tax Optimization Under Finance Act 2024
- **The Problem:** Pakistan's tax regime enforces a punitive 30% CGT on non-filers (vs 15% for filers) and complex tiered salaried tax brackets. Furthermore, most investors leave substantial money on the table by not utilizing Section 63 VPS pension credits.
- **Technical Solution:** A comprehensive **Tax Optimizer**:
  - Models official FBR 2024-25 salaried tax brackets (0% up to Rs 600k, 5%, 15%, 25%, 30%, 35%).
  - Tax-loss harvesting calculations (offsetting losing fund redemptions against winning redemptions).
  - 2-step Section 63 Voluntary Pension Scheme (VPS) advisor displaying exact salary tax savings (up to 20% of taxable income) and 50% tax-free lump sum at retirement.

---

## 4. Artificial Intelligence & Alibaba Cloud Integration

### 4.1. 100% Alibaba Cloud Model Studio (Qwen 2.5) Architecture
All artificial intelligence workloads in FundTracker Advanced are executed on **Alibaba Cloud Model Studio** using DashScope API bindings (`qwen-plus` and `qwen-max` models) across three critical pipelines:

1. **PyMuPDF + Qwen 2.5 FMR Document Parser:**
   - Combines high-speed local digital text extraction via `fitz` with Qwen 2.5 JSON formatting.
   - Extracts fund manager commentary, asset allocation breakdowns, risk ratings, and historical benchmarks from unstructured monthly FMR PDFs.
2. **Two-Pass Macroeconomic News Engine:**
   - Evaluates macro shifts against historical memory and generates structured JSON market impact forecasts without hallucination.
3. **Zero-Knowledge Portfolio Diagnostics & Rebalancing Intelligence:**
   - Evaluates sanitized allocation distributions and delivers personalized rebalancing actions.
   - Powers the FundTracker AI portfolio intelligence and news impact engines, communicating with zero exposure of personal account balances or PII.

---

## 5. Database Engineering & Production Verification

- **Storage Engine:** SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`).
- **Concurrency Setup:** Configured with `PRAGMA synchronous=NORMAL;` and `PRAGMA busy_timeout=5000;`, enabling concurrent read queries from the Electron client during active background writes.
- **Query Optimization:** In-memory batch joins reduce database roundtrips by over 95%, guaranteeing sub-100ms UI response times.
- **Verified Production Database Footprint:**
  - **210+ Verified Mutual Funds** across Meezan, HBL, Atlas, and Faysal.
  - **1,770+ Historical Daily NAV Records**.
  - **1,770+ Historical Fund Performance Metric Records**.
  - **18 Statement Audit Ledger Records**.
  - **26 Processed Macroeconomic News Articles**.

---

## 6. Regulatory Compliance & Disclaimers

- **SECP Compliance:** In alignment with SECP NBFC regulations, mutual fund investments are subject to market risk. Past performance does not guarantee future results.
- **AAOIFI & Shariah Standards:** Zakat computations conform to AAOIFI Standard No. 35. Users are advised to review unique balance-sheet footnotes for specific fund exclusions.
- **Tax Law Alignment:** Capital gains and pension calculations adhere to the Income Tax Ordinance 2001 as amended by the Finance Act 2024.
