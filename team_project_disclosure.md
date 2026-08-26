# 🛡️ FundTracker: Project Disclosure, Production Audit & Risk Assessment

> **Document Version:** 1.0.0  
> **Last Updated:** August 26, 2026  
> **Audience:** Core Development Team, Post-Hackathon Investors, SECP Compliance Reviewers  
> **Purpose:** A brutally honest technical, mathematical, and regulatory breakdown of all platform features. This document distinguishes between **fully hardened production systems** and **hackathon demo simulations**, detailing potential failure modes, edge cases, and the post-hackathon commercial roadmap.

---

## 📊 Executive Feature Readiness Matrix

| Feature Module | Current Status | Primary Data Source | Production Readiness | Primary Failure Risk / Edge Case |
| :--- | :---: | :---: | :---: | :--- |
| **PDF Statement Parser** | Live | Local PDF Ingestion | 🟢 **90% Production Ready** | Scanned image PDFs (non-text), non-standard custom bank layouts. |
| **Statement History Ledger** | Live | SQLite DB (`Statement` table) | 🟢 **95% Production Ready** | Deleting statement does not currently recalculate historical FIFO cost basis. |
| **MUFAP Daily NAV Scraper** | Live | `mufap.com.pk` (Playwright) | 🟢 **85% Production Ready** | MUFAP DOM restructure, Cloudflare bot-challenge IP blocks. |
| **News RSS Pipeline** | Live | Dawn & Business Recorder | 🟢 **90% Production Ready** | Feed structural changes, RSS rate limits (handled with 15s timeout). |
| **Database Concurrency (WAL)** | Live | SQLite Engine | 🟢 **95% Production Ready** | Multi-device sync impossible without cloud replication. |
| **AI News Sentiment Engine** | Live | Google Gemini API | 🟡 **70% Demo / Semi-Prod** | LLM hallucination, API rate limits, non-deterministic market correlations. |
| **Benchmark Alpha Analyzer** | Live UI | User DB + Static Index Baseline | 🟡 **65% Hackathon Prototype** | Static KSE-100/KMI-30 baselines; lacks daily live PSX API sync. |
| **Capital Gains & Tax Optimizer** | Live UI | User DB + FBR Sec 37A/63 Rules | 🟡 **65% Hackathon Prototype** | Annual Finance Act tax slab changes; WHT at source discrepancies. |
| **Inflation & SIP Simulator** | Live UI | SBP CPI History + Annuity Math | 🟡 **70% Hackathon Prototype** | Uses annual CPI averages rather than live monthly PBS prints. |
| **Portfolio AI Suggestions** | Live UI | Rule Engine + Gemini LLM | 🟡 **60% Hackathon Prototype** | SECP regulatory disclaimers required (non-advisory compliance). |

---

## 🔬 In-Depth Module-by-Module Audit

---

### 1. 📄 Statement Ingestion & PDF Parser Engine
* **How It Works:** Reads digital PDF statements from Meezan Bank, HBL Asset Management, Atlas Funds, and Faysal Funds using `pdfplumber` and custom regex pattern extractors.
* **Production Status:** 🟢 **High (90%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **Scanned / Photo PDFs:** The parser relies on native PDF text layers. If a user uploads a scanned image or photograph of a physical statement, OCR is not currently triggered, resulting in zero extracted holdings.
  2. **Bank Layout Mutations:** If Meezan Bank or HBL redesigns their monthly PDF layout or changes column header names (e.g. from *"Units Held"* to *"Balance Units"*), regex extraction will fail silently without a schema updater.
  3. **Multi-Portfolio Reconciliation:** If a user holds both conventional and Islamic sub-accounts within the same bank, the parser assumes a single portfolio entity unless tagged explicitly.
* **Production Fix Required:** Implement Tesseract/Qwen-VL multimodal OCR fallback and add an administrative parser schema editor.

---

### 2. 🕷️ MUFAP Daily NAV Scraper
* **How It Works:** Uses Playwright headless Chromium on Windows (`WindowsProactorEventLoopPolicy`) to bypass Cloudflare anti-bot checks, scrape `mufap.com.pk`, and ingest daily NAVs and 1M/6M/1Y/YTD returns for 185+ funds into SQLite.
* **Production Status:** 🟢 **High (85%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **MUFAP Server Downtime:** MUFAP.com.pk frequently undergoes maintenance between 6:00 PM and 9:00 PM PKT when daily NAVs are being uploaded by AMCs.
  2. **IP Blacklisting:** Running the scraper too frequently from a single residential IP can result in temporary HTTP 403 Forbidden Cloudflare blocks.
  3. **Fund Renaming:** If an AMC merges or renames a fund (e.g. *"Meezan Sovereign Fund"* to *"Meezan Daily Income Fund"*), the scraper might create a duplicate record instead of updating the existing fund record.
* **Production Fix Required:** Migrate scraper to a containerized Alibaba Cloud Function Compute cron worker with rotating proxy headers and automated fund alias resolution.

---

### 3. 📈 Benchmark Alpha & Fee Analyzer (`/benchmark`)
* **How It Works:** Pulls user's actual portfolio gain/loss percentage from SQLite and calculates Jensen's Alpha against KSE-100 and KMI-30 benchmark returns, subtracting the fund's Total Expense Ratio (TER).
* **Production Status:** 🟡 **Hackathon Prototype (65%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **Static Index Baselines:** The KSE-100 and KMI-30 returns for 1M, 6M, 1Y, and 3Y are stored as pre-calibrated historical baseline constants rather than pulling from a live PSX WebSocket/REST API.
  2. **Survivorship Bias:** The tool assumes the fund stayed in the same category over 3 years without accounting for category shifts or fund mergers.
  3. **Dividend Reinvestment:** Does not fully distinguish between Total Return Index (KSE-100 TRI) and Price Return Index (KSE-100 PRI).
* **Production Fix Required:** Connect backend to Pakistan Stock Exchange Data Portal API (`dps.psx.com.pk/historical`) and pull official KSE-100 TRI daily series.

---

### 4. 💰 Capital Gains & Tax Optimizer (`/tax`)
* **How It Works:** Calculates capital gains tax liability using Pakistan FBR Section 37A rules ($15\%$ Filer, $30\%$ Non-Filer for holdings $< 12$ months, $0\%$ for $\ge 12$ months) and computes Section 63 VPS pension tax rebates (capped at $20\%$ of taxable income up to PKR 200,000).
* **Production Status:** 🟡 **Hackathon Prototype (65%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **Annual Finance Act Changes:** Pakistan's tax laws change every budget (e.g. Finance Act 2024 introduced revised tiered capital gains rates based on asset acquisition dates before/after July 1, 2024). The static formula must be updated when tax laws change.
  2. **Withholding Tax at Source (WHT):** In reality, AMCs in Pakistan automatically deduct withholding tax when units are redeemed based on the active taxpayer list (ATL). The app's calculator provides an estimate, not a legal tax certificate.
  3. **Tax Loss Harvesting Limitations:** In Pakistan, capital losses in mutual funds can only be adjusted against capital gains in the same category and cannot be offset against salary income.
* **Production Fix Required:** Add a tax year selector (e.g. TY 2024-25, TY 2025-26) and export an FBR-compliant wealth statement annexure.

---

### 5. 📉 Inflation Hedge & SIP Simulator (`/simulator`)
* **How It Works:** Uses Fisher's real interest rate equation and standard future value annuity formulas to model compound growth against historical State Bank of Pakistan CPI inflation (2015–2024 average ~11.8%, recent average ~16.5%).
* **Production Status:** 🟡 **Hackathon Prototype (70%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **Uniform Inflation Assumption:** Real inflation in Pakistan is non-linear (e.g. 29% in 2023 vs 4% in 2016). Using a constant average inflation rate over a 10-year projection can either underestimate or overestimate real purchasing power.
  2. **Currency Depreciation (PKR/USD):** The simulator models PKR inflation (CPI) but does not account for PKR currency devaluation against the US Dollar, which heavily impacts electronics, imported education, and Hajj packages.
* **Production Fix Required:** Ingest monthly CPI releases directly from the Pakistan Bureau of Statistics (PBS) and allow users to toggle between CPI and USD-adjusted inflation.

---

### 6. 🧠 AI News Sentiment & Macro Predictions (`/ai-news`)
* **How It Works:** Ingests live RSS articles from Dawn Business and Business Recorder, feeds them to Google Gemini LLM with custom prompt constraints, and generates sector impact scores (Equities, Money Market, Islamic, Sovereign).
* **Production Status:** 🟡 **Demo / Semi-Production (70%)**
* **The "Dark Side" (Failure Modes & Edge Cases):**
  1. **LLM Hallucinations:** Large Language Models can misinterpret subtle central bank monetary policy nuance (e.g. a "dovish pause" vs "hawkish hike") and assign an incorrect positive score to a rate hike.
  2. **API Rate Limits & Costs:** Running real-time LLM inference for dozens of news articles per user can exhaust free-tier API quotas and incur recurring token costs.
  3. **Market Lag:** Macro news sentiment does not always translate to immediate NAV changes on the same day due to mutual fund valuation rules.
* **Production Fix Required:** Implement a vector database cache (RAG) and integrate Alibaba Cloud Model Studio (Qwen 2.5) with local caching to eliminate duplicate inference costs.

---

### 7. ⚖️ Legal & Regulatory Disclaimers (SECP Compliance)
* **The Risk:** In Pakistan, offering automated financial advice without an SECP Investment Advisory License violates Securities Act regulations.
* **Current Mitigation:** The app must explicitly display disclaimers stating that all projections, tax estimates, and AI insights are **for informational and educational purposes only** and do not constitute certified financial or tax advice.

---

## 🗺️ Post-Hackathon Commercialization Roadmap

If transitioning this prototype into a commercial SaaS / FinTech mobile app in Pakistan:

### Phase 1: Institutional Data Feeds (Months 1–2)
* [ ] Integrate PSX Data Portal live API for real-time KSE-100, KMI-30, and PSX-All Share closing values.
* [ ] Ingest live SBP Policy Rate (KIBOR) and PBS monthly CPI prints.
* [ ] Connect to SECP / FBR Taxpayer API to verify Filer/Non-Filer status automatically.

### Phase 2: Security & Multi-Tenant Cloud Architecture (Months 3–4)
* [ ] Implement end-to-end zero-knowledge encrypted database sync on Alibaba Cloud Object Storage (OSS).
* [ ] Add Multi-Factor Authentication (SMS OTP via Jazz/Telenor/Zong gateway).
* [ ] Add Automated PDF OCR (Qwen-VL) for scanned paper statements.

### Phase 3: Shariah Advisory Board Certification (Months 5–6)
* [ ] Obtain formal Shariah certification for the Zakat & Purification engine from a recognized Islamic finance scholar (AAOIFI standards).
* [ ] File for SECP Regulatory Sandbox registration under digital wealth management.

---

*This document represents an honest, engineering-grade disclosure of the FundTracker platform state as of the BanoQabil x Alibaba Cloud AI Hackathon.*
