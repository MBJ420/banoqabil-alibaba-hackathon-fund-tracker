# 🎬 FundTracker Advanced — Demo Video Cheat-Sheet (3.5 - 4.5 Mins)

### Setup:
- Resolution: 1080p Full Screen
- Tool: Loom, OBS, or Windows Game Bar (Win + Alt + R)
- App running with demo/sample data loaded.

---

### 1. Intro & The #1 Problem (0:00 - 0:35)
- **Screen:** Main Dashboard (Overview)
- **Action:** Hover over KPI cards (Total Net Worth, Invested Capital, Gain/Loss, Top Performer).
- **Points to cover:**
  - Introduce yourself: Muhammad Bin Jamil, Team Fund Tracker (ID: P01090).
  - The Core Problem: AMC statements in Pakistan are broken; HBL omits Profit & Loss completely (only shows raw units).
  - Tracking multiple AMCs (Meezan, HBL, Atlas, Faysal) in Excel is messy and error-prone.
  - The Solution: FundTracker consolidates all accounts into one unified dashboard with real P&L and yield.

---

### 2. Statement Ingestion & P&L Reconciler (0:35 - 1:10)
- **Screen:** Click "Manage Data" / "Data Ledger"
- **Action:** Show statement history table and upload interface.
- **Points to cover:**
  - Drop bank e-statement PDFs into folders; extracted automatically via pdfplumber.
  - Reconstructs cost basis for AMCs like HBL that omit profit/loss: P&L = (Current NAV - Acquisition Cost NAV) * Units.
  - Stored in a local SQLite WAL audit ledger (zero cloud leaks).

---

### 3. Alibaba Cloud Qwen 2.5 Macro News Engine (1:10 - 1:45)
- **Screen:** Click "Market News" -> "AI Analysis"
- **Action:** Show live Dawn / Business Recorder feed and sector forecast table.
- **Points to cover:**
  - Problem: Investors don't have time to read dozens of financial articles daily.
  - 100% Alibaba Cloud Model Studio (Qwen 2.5 via DashScope).
  - Two-Pass Engine:
    - Pass 1: Maintains World Context memory (SBP policy rate, IMF reviews).
    - Pass 2: Generates 0-10 impact scores and direction (Bullish/Bearish) across Equities, Cash, and Gold over Short, Med, and Long horizons.

---

### 4. Outperformer Peer Discovery (1:45 - 2:20)
- **Screen:** Click "Portfolio Suggestions" / Outperformer Section
- **Action:** Show fund comparison card comparing holding vs rival fund.
- **Points to cover:**
  - Problem: 200+ mutual funds exist in Pakistan; retail investors don't know better funds exist.
  - Playwright headless browser scrapes 210+ funds from MUFAP daily at 6 PM.
  - App compares user's fund against top-performing peers in the same category and shows the return gap.

---

### 5. AAOIFI Shariah-Compliant Zakat Calculator (2:20 - 2:55)
- **Screen:** Click "Zakat Calc" in top header
- **Action:** Toggle Silver/Gold Nisab, show per-fund table, point to Section 60 button.
- **Points to cover:**
  - Problem: Paying 2.5% on gross equity fund value is incorrect (factories/machinery are exempt in Shariah).
  - Solution: AAOIFI Standard No. 35 implementation.
  - Applies dynamic ~28% working capital deduction on equities vs 100% on cash/income.
  - Configurable Silver (52.5 tolas) / Gold (7.5 tolas) Nisab.
  - Printable Section 60 Tax Deduction Certificate.

---

### 6. Benchmark Alpha & Inflation Simulator (2:55 - 3:30)
- **Screen:** Click "Benchmark Analyzer" -> then "Inflation Simulator"
- **Action:** Show Jensen's Alpha chart ("Great Value" vs "Overpriced"), then adjust inflation slider.
- **Points to cover:**
  - Benchmark Analyzer: Shows if fund manager beats KSE-100 / KMI-30 after 1.5%-3.5% TER management fees.
  - Inflation Simulator: Shows the "money illusion" using Fisher equation (18% nominal yield vs 23% inflation = real wealth loss).

---

### 7. Tax Optimizer (3:30 - 3:55)
- **Screen:** Click "Tax Optimizer"
- **Action:** Show salaried tax slabs and Section 63 VPS slider.
- **Points to cover:**
  - Finance Act 2024 compliance: FBR slabs (0% to 35%).
  - Section 37A: 15% filer rate vs 30% non-filer penalty.
  - Tax-loss harvesting: Offsets losing fund redemptions against winners.
  - Section 63 VPS advisor: Saves up to 20% salary tax through pension funds.

---

### 8. Roman Urdu Localization & AI Copilot (3:55 - 4:25)
- **Screen:** Click "EN / UR" toggle in header -> Click "AI Copilot"
- **Action:** Watch UI switch to Roman Urdu. Click an Urdu chip prompt (e.g. "Mera portfolio kaisa perform kar raha hai?").
- **Points to cover:**
  - Problem: English financial jargon alienates everyday Pakistani investors.
  - Entire app translated to Roman Urdu ("Maliyati Intelligence", "Kul Nafa / Nuqsan").
  - Alibaba Cloud Qwen 2.5 Copilot answers natively in Roman Urdu.

---

### 9. Zero-Knowledge Privacy & Outro (4:25 - 4:45)
- **Screen:** Return to main dashboard.
- **Points to cover:**
  - Local-first architecture (Electron + SQLite WAL).
  - Zero-Knowledge Privacy: Zero PKR balances, CNIC, or account numbers ever sent to cloud AI.
  - Closing: Team Fund Tracker (P01090), GitHub repo link, wrap up.
