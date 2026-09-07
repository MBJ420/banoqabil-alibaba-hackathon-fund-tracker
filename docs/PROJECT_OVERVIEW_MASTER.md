# 🏦 FundTracker Advanced — Complete Project Overview & Technical Master Documentation
### BanoQabil × Alibaba Cloud AI Hackathon Pakistan (Final Submission Whitepaper)
**Team ID:** P01090  
**Team Name:** Fund Tracker  
**Lead Developer:** Muhammad Bin Jamil  
**Repository:** [github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker](https://github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker)  
**Track:** Artificial Intelligence & Cloud Computing (Alibaba Cloud Model Studio)

---

## 1. Executive Summary

**FundTracker Advanced** is an intelligent, local-first mutual fund wealth intelligence platform, macroeconomic decision engine, and Shariah compliance terminal built specifically for Pakistani retail investors. It bridges the deep structural gap between Pakistan's fragmented mutual fund industry and retail citizens by transforming complex monthly bank PDF statements, fluctuating market NAVs, and volatile economic indicators into clear, inflation-beating, tax-optimized financial decisions.

Pakistan’s mutual fund sector manages over **PKR 2+ trillion in assets**, yet retail participation remains beneath 2% of the population. This low penetration is driven by four structural failures:
1. **Broken Statement Reporting:** Asset Management Companies (AMCs) provide incompatible monthly statements. While Al Meezan shows profit and loss, HBL Asset Management and others completely omit cumulative gain/loss and acquisition cost, leaving investors blind to their real performance.
2. **The Discovery Gap & Opaque Fees:** With over 200+ mutual funds available, investors suffer from choice paralysis and remain trapped in mediocre funds while losing 1.5% to 3.5% annually to Total Expense Ratios (TER).
3. **The "Money Illusion" of Inflation:** Double-digit CPI inflation (historically 12% to 29%) silently destroys real purchasing power while investors celebrate nominal paper yields.
4. **Shariah & Jargon Barriers:** Muslim investors struggle to accurately calculate Zakat on equity funds (which require complex balance-sheet working-capital deductions under AAOIFI standards), and complex English financial terminology alienates first-time investors.

FundTracker Advanced solves all of these challenges through a sovereign desktop application powered by an embedded SQLite database in WAL mode, automated background headless scraping, full Roman Urdu localization, and **100% Alibaba Cloud Model Studio (Qwen 2.5)** artificial intelligence governed by an airtight Zero-Knowledge Privacy Contract.

---

## 2. Core Problems in Pakistan's Financial Ecosystem & How We Solve Them

| Real-World Problem in Pakistan | Industry Root Cause | FundTracker Advanced Engineering Solution |
| :--- | :--- | :--- |
| **1. Missing Profit & Loss on Statements** | HBL and other AMCs omit cumulative gains/losses, reporting only raw unit counts and closing balances. | Automated extraction engine parses transaction history, reconstructs historical cost basis, and calculates exact realized/unrealized P&L and net yield %. |
| **2. Multi-AMC Fragmentation** | Portfolios are scattered across Meezan, HBL, Atlas, and Faysal portals with zero interoperability. | Unified multi-AMC ledger that automatically consolidates holdings, asset mix, and returns onto a single desktop screen. |
| **3. Financial Data Privacy Concerns** | Cloud-based wealth apps require uploading sensitive bank PDFs, exposing CNICs and net worth to third parties. | Local-first desktop architecture (Electron + SQLite WAL). Zero PKR balances or personal identities ever leave the local PC. |
| **4. Shariah Zakat Inaccuracies** | Retail investors mistakenly pay 2.5% on their entire equity fund value, ignoring that fixed assets are exempt. | AAOIFI Standard No. 35 engine dynamically deducts illiquid assets (~28% working capital on equities vs 100% on cash/debt) with live Silver/Gold Nisab. |
| **5. The Discovery Gap & Fee Drag** | Retail investors cannot easily identify superior funds, losing returns to 1.5%–3.5% TER management fees. | Cross-AMC peer discovery engine compares holdings against 210+ funds scraped daily from MUFAP, flagging top-quartile alternatives. |
| **6. English Jargon & Literacy Barrier** | Heavy institutional terminology (NAV, TER, Jensen's Alpha) intimidates beginner investors. | Complete **Roman Urdu localization** across navigation, KPIs, and educational guides (`"Kul Nafa / Nuqsan"`, `"Mehngai Simulator"`). |
| **7. Unbalanced Asset Allocation & Drift** | Portfolios suffer from risk drift (e.g., 90% cash in a bull market or 90% equities during interest rate hikes). | Real-time diversification tracker paired with Qwen 2.5 portfolio health scoring and macro-aware rebalancing advice. |
| **8. Missing Out on Market Developments** | Investors miss critical monetary policy meetings, IMF tranches, and economic shifts. | Direct news ingestion from authentic Pakistani financial publications (*Dawn* and *Business Recorder*). |
| **9. Economic News Overload** | Reading dozens of dense financial articles every day is exhausting and time-consuming. | Two-Pass Macro Engine: Qwen 2.5 maintains World Context memory and forecasts sector impacts (0–10) across Equities, Cash, and Gold. |
| **10. Inflation Drag ("Money Illusion")** | Earning 18% in cash while inflation is 23% equals a 5% real wealth loss. | SBP CPI inflation simulator based on the Fisher equation, calculating true real purchasing power over time. |
| **11. Active Manager Underperformance** | Asset managers charge heavy fees without beating market benchmarks. | Benchmark Alpha Analyzer calculating Jensen's Gross and Net Alpha vs KSE-100 / KMI-30 indices with value classifications. |
| **12. Punitive Local Tax Complexities** | Finance Act 2024 penalizes non-filers at 30% CGT, and investors miss statutory Section 63 VPS pension credits. | Tax Optimizer modeling FBR salaried slabs (0%–35%), Section 37A CGT, tax-loss harvesting, and Section 63 VPS 20% salary rebate advisor. |
| **13. Lack of Macro Guidance & Diagnostics** | Beginner retail investors lack unbiased financial analysis and struggle to interpret macroeconomic shifts. | **FundTracker AI, powered by Qwen:** Two-pass macroeconomic news impact forecasting and zero-knowledge portfolio health diagnostics. |

---

## 3. High-Level System Architecture

FundTracker Advanced adopts a **local-first desktop architecture** designed for high throughput, complete offline resilience, and zero data leakage.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             LOCAL DESKTOP CLIENT (ELECTRON)                            │
│                                                                                        │
│   • React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons                         │
│   • Interactive ApexCharts Financial Visualizations                                    │
│   • Bilingual Language Context (English ↔ Roman Urdu Toggle)                           │
│   • Shariah Zakat & Wealth Terminal & Portfolio Data Manager                           │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Local HTTP REST (Port 8001) / IPC
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FASTAPI BACKEND RUNTIME                                │
│                                                                                        │
│   ├── Automated Watchdog Service (Watches "Fund Tracker PDF Data/" directory)          │
│   ├── Multi-AMC Statement Parsing Engine (Meezan, HBL, Atlas, Faysal regex extractors) │
│   ├── Profit & Loss (P&L) Ledger & Acquisition Cost Basis Reconciler                   │
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

## 4. 100% Alibaba Cloud Model Studio (Qwen 2.5) AI Architecture

All artificial intelligence workloads in FundTracker Advanced are executed exclusively on **Alibaba Cloud Model Studio** using DashScope API bindings (`qwen-plus` and `qwen-max` models) across three distinct engineering pipelines:

### 4.1. FMR Document Parser (PyMuPDF + Qwen 2.5)
- **Problem:** Monthly Fund Manager Reports (FMRs) are published as complex, unstandardized PDFs containing essential market commentary, risk ratings, and asset allocation percentages.
- **Implementation:** PyMuPDF (`fitz`) performs ultra-fast local digital text and table extraction. The text stream is forwarded to Qwen 2.5 with strict JSON schema instructions.
- **Output:** Transforms raw narrative into structured database entities: fund risk category (*Low, Moderate, High*), asset allocation strings (*Equities: 74%, T-Bills: 20%, Cash: 6%*), and historical benchmark comparisons.

### 4.2. Two-Pass Macroeconomic News Sentiment Engine
Standard LLM implementations hallucinate when asked to evaluate complex economic conditions from raw daily news. FundTracker Advanced implements a stateful **Two-Pass Architecture**:
- **Pass 1 — World Context Manager:**
  - Qwen 2.5 maintains a persistent institutional memory of macroeconomic reality (SBP Policy Rates, IMF review tranches, currency reserves, energy tariffs) stored in the database.
  - As new news arrives, Qwen 2.5 updates the World Context using explicit operations:
    - `KEEP`: Event is still ongoing and active.
    - `AMEND`: Event parameters have shifted (e.g., SBP cut interest rates by 100 bps).
    - `RESOLVE`: Event has concluded (e.g., IMF tranche successfully disbursed).
    - `ADD`: New macroeconomic development detected.
- **Pass 2 — Sector Asset Impact Forecasting:**
  - The model evaluates breaking news against the grounded World Context to produce deterministic, structured market impact assessments.
  - Forecasts market direction (`Bullish`, `Bearish`, `Neutral`) and impact scores (0–10) across three time horizons (**Short Term: 1–30 days, Medium Term: 1–6 months, Long Term: 6–12 months**) for four core asset classes:
    1. *PSX Equities (Equity Funds)*
    2. *Money Market (Cash Funds)*
    3. *Fixed Income & Sovereign Debt (Income / Sukuk Funds)*
    4. *Commodities (Gold & Silver Funds)*

### 4.3. Zero-Knowledge Financial Privacy Contract
To guarantee enterprise-grade data privacy, FundTracker Advanced enforces an algorithmic sanitization boundary in local backend Python code **before any network packet leaves the user's computer**:

```
┌───────────────────────────────┐
│     STAGE 1: LOCAL STORE      │  • Raw bank PDFs parsed into local SQLite WAL database.
│    (QUARANTINED ON PC)        │  • Contains: Total Net Worth (e.g. PKR 4,850,000), CNIC, Account Numbers.
└───────────────┬───────────────┘  • NEVER transmitted over any external network.
                │
                ▼ Local Backend Sanitization Filter
┌───────────────────────────────┐
│     STAGE 2: SANITIZATION     │  • Backend strips ALL PKR currency values and rupee amounts.
│        (LOCAL SHIELD)         │  • Strips account numbers, CNIC, and investor legal name.
└───────────────┬───────────────┘  • Normalizes holdings into percentages (e.g., Equity 58.4%, Cash 41.6%).
                │
                ▼ Authenticated DashScope API (qwen-plus / qwen-max)
┌───────────────────────────────┐
│   STAGE 3: CLOUD REASONING    │  • Qwen 2.5 receives relative % allocations + live market context only.
│   (ALIBABA CLOUD DASHSCOPE)   │  • Evaluates risk drift, fee drag, and generates ranked rebalancing steps.
└───────────────────────────────┘  • Absolute privacy: Cloud model never knows user wealth or identity.
```

---

## 5. Authentic Financial Engines & Mathematical Formulations

### 5.1. Missing P&L & Cost Basis Reconciliation Engine
To solve statement blindness where AMCs like HBL omit profit and loss, FundTracker reconstructs the historical acquisition cost basis from digital transaction records:
$$\text{Invested Capital} = \sum_{i=1}^{n} (\text{Units Purchased}_i \times \text{Purchase Price}_i)$$
$$\text{Current Market Value} = \text{Total Units} \times \text{Latest Closing NAV}$$
$$\text{Unrealized Profit/Loss (PKR)} = \text{Current Market Value} - \text{Invested Capital}$$
$$\text{Net Yield \%} = \left( \frac{\text{Current Market Value} - \text{Invested Capital}}{\text{Invested Capital}} \right) \times 100$$

### 5.2. AAOIFI Shariah-Compliant Zakat & Wealth Purification Terminal
Muslim investors holding mutual funds face confusion because equity funds hold operating businesses. Under **AAOIFI Standard No. 35** and rulings by leading scholars (e.g., Mufti Taqi Usmani), Zakat is not due on illiquid fixed assets (factory buildings, plant & machinery, land, patents), but strictly on liquid working capital (cash, receivables, trade inventory):
- **Equity Funds:** Dynamically applies a prudent ~28% working capital ceiling to determine the net zakatable base:
  $$\text{Zakatable Base}_{\text{Equity}} = \text{Current Market Value} \times 28\%$$
- **Money Market / Cash Funds:** 100% subject to Zakat on total value.
- **Income / Sukuk Funds:** 100% subject to Zakat on total value.
- **Balanced / Asset Allocation Funds:** Blended ratio ($70\% \text{ Cash/Income} \times 1.0 + 30\% \text{ Equity} \times 0.28 \approx 64\% \text{ Zakatable Base}$).
- **Dual Calendar Basis:**
  - *Hijri Lunar Year:* Standard $2.5\%$ rate.
  - *Gregorian Solar Year:* Standard $2.577\%$ rate (AAOIFI conversion for tax-year alignment).
- **Nisab Threshold Configuration:**
  - *Silver Standard:* $52.5 \text{ tolas} \times \text{Live Silver Price per Tola}$.
  - *Gold Standard:* $7.5 \text{ tolas} \times \text{Live Gold Price per Tola}$.
  - Automatic Sahib-e-Nisab detection and exportable **Section 60 Tax Deduction Certificates**.

### 5.3. Benchmark Alpha & Active Fee Drag Analyzer
Asset managers in Pakistan charge between 1.5% and 3.5% in Total Expense Ratios (TER). FundTracker evaluates whether the fund manager earns their fee relative to passive benchmarks (KSE-100 and KMI-30 Islamic Index):
$$\text{Gross Jensen's Alpha} = R_i - R_b$$
$$\text{Net Jensen's Alpha} = (R_i - R_b) - \text{TER}$$
Where $R_i$ is the fund trailing return, $R_b$ is the benchmark index return, and $\text{TER}$ is the Total Expense Ratio. Funds are classified into three institutional tiers:
1. **Great Value (Emerald):** Generates positive Net Alpha above the benchmark after all fees.
2. **Fair Value (White):** Matches benchmark performance within acceptable tracking error.
3. **Overpriced (Red):** Negative Net Alpha; investors are paying high management fees while lagging passive market returns.

### 5.4. SBP Inflation vs Purchasing Power Simulator
To counter the "money illusion" where investors celebrate paper returns while losing real purchasing power, FundTracker models real wealth using the **Fisher Equation** and State Bank of Pakistan historical CPI prints:
$$\text{Real Purchasing Power} = \frac{\text{Nominal Future Value}}{(1 + \text{CPI Inflation})^t}$$
Includes an interactive goal-based SIP annuity calculator for Hajj, children's higher education, and retirement planning.

### 5.5. Finance Act 2024 Capital Gains & Tax Optimizer
- **Salaried Tax Slabs (FBR 2024–25):** Models all tiered brackets from 0% (up to Rs 600k) through 5%, 15%, 25%, 30%, up to 35% top bracket.
- **Section 37A Capital Gains Tax:** Computes 15% for Active Tax Filers vs a punitive 30% rate for Non-Filers (100% surcharge).
- **Tax-Loss Harvesting:** Automatically offsets capital losses on lagging funds against realized gains to minimize FBR tax liability.
- **Section 63 Voluntary Pension Scheme (VPS) Advisor:** 2-step decision flow calculating exact salary tax rebates (up to 20% of taxable income) when investing in approved pension funds, plus a 50% tax-free lump-sum withdrawal at retirement.

### 5.6. Inclusive Financial Literacy & Roman Urdu Localization Engine
Over 80% of Pakistani retail investors are intimidated by English-only institutional finance jargon. FundTracker integrates a centralized `LanguageContext` that enables instant switching between English and natural Roman Urdu:
- Navigation & KPIs translated to intuitive terminology (`"Kul Nafa / Nuqsan"`, `"Mehngai Simulator"`, `"Sarmaye ki Taqseem"`).
- In-app ratio guides breaking down NAV, TER, Sharpe ratio, and asset allocation in plain language.
- FundTracker AI bilingual intelligence delivering macroeconomic insights and fund diagnostics natively in English and Roman Urdu.

---

## 6. Database Engineering & Concurrency Architecture

- **Engine:** Embedded SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`).
- **Concurrency Optimization:** Configured with `PRAGMA synchronous=NORMAL;` and `PRAGMA busy_timeout=5000;`, enabling concurrent read operations from the UI while background scrapers and watchers perform bulk writes without `database is locked` errors.
- **Query Optimization:** The outperformer suggestion engine refactored from sequential queries to batched subquery joins, reducing database roundtrips by over 95% and eliminating cold-start latency.
- **Production Database Footprint:**
  - **210+ Verified Mutual Funds** seeded and mapped across Meezan, HBL, Atlas, and Faysal.
  - **1,770+ Historical Daily NAV Records** indexed by `(fund_id, date)`.
  - **1,770+ Historical Fund Performance Metric Records** (1M, 6M, 1Y, YTD returns).
  - **18 Statement Audit Ledger Records** tracking all uploaded PDFs.
  - **26 Processed Macroeconomic News Articles** from Dawn and Business Recorder.

---

## 7. User Journey & Feature Walkthrough

1. **Portfolio Overview (All Institutions):** Consolidates total net worth, invested capital, cumulative gain/loss, and portfolio growth trajectory across all accounts.
2. **Data Ledger & Statement Upload (`PortfolioDataManagerModal`):** Users upload monthly bank statements; the engine auto-extracts unit counts, cost basis, and reconciles P&L.
3. **Market News & Macro AI Analysis:** Live feed of authentic news articles paired with Alibaba Cloud Qwen 2.5 Two-Pass sector impact forecasts.
4. **Portfolio Suggestions & Peer Discovery:** Daily outperformer screening alerts users to top-quartile funds in the same asset category.
5. **Shariah Zakat Terminal (`IslamicZakatModal`):** Dynamic working capital deductions, Silver/Gold Nisab threshold checks, and Section 60 tax certificate exports.
6. **Inflation Simulator:** Interactive sliders demonstrating nominal vs real purchasing power against historical CPI prints.
7. **Tax Optimizer:** Salaried tax slab analysis, Section 37A CGT calculation, and Section 63 VPS pension 20% rebate advisor.
9. **FundTracker AI Bilingual Intelligence:** Real-time macroeconomic news impact analysis and portfolio diagnostics powered by Alibaba Cloud Qwen 2.5 in English and Roman Urdu.

---

## 8. Verified Deliverables & Supporting Attachments

All deliverables are compiled in the [`docs/`](./) directory:
1. **Master Presentation Deck:** `docs/FundTracker_Advanced_Hackathon_Presentation.pptx` (15-slide widescreen Gamma-styled presentation with embedded Slide 3 AI visual).
2. **Slide 3 3D Infographic:** `docs/SLIDE3_CORE_PROBLEMS_VISUAL.jpg` (Full-resolution 3D illustration of the 4 core Pakistani retail investor problems).
3. **Full System Architecture Diagram:** `docs/SYSTEM_ARCHITECTURE_DIAGRAM.png` (High-resolution architectural flow diagram).
4. **AI Pipeline & Privacy Flow Diagram:** `docs/AI_PIPELINE_AND_PRIVACY_FLOW.png` (Zero-Knowledge Privacy Contract & Two-Pass Macro Engine diagram).
5. **Verified NAV Dataset:** `docs/PAKISTAN_MUTUAL_FUND_NAV_DATASET.csv` (210+ mutual funds with categories, NAVs, and trailing return metrics).
6. **Technical Project Documentation:** `docs/TECHNICAL_DOCUMENTATION.md` (Complete technical whitepaper and architectural formulas).
7. **Demo Video Walkthrough Script:** `docs/DEMO_VIDEO_WALKTHROUGH_SCRIPT.md` (Concise feature-by-feature recording cheat sheet).

---

## 9. Conclusion & Hackathon Impact

**FundTracker Advanced** proves that enterprise cloud artificial intelligence from **Alibaba Cloud Model Studio (Qwen 2.5)** can be harmonized with a local-first, privacy-preserving desktop architecture to solve real sovereign financial problems in Pakistan. By addressing missing P&L on bank statements, multi-AMC fragmentation, opaque fee drag, inflation erosion, AAOIFI Shariah compliance, and language barriers through Roman Urdu, FundTracker Advanced empowers millions of Pakistani retail investors to protect and grow their wealth with institutional clarity.
