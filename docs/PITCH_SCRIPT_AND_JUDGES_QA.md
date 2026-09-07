# 🎙️ FundTracker Advanced — Evaluation Pitch & Judges' Technical Q&A
### BanoQabil × Alibaba Cloud AI Hackathon Pakistan
**Project Code:** P01090 | **Team Name:** Fund Tracker | **Lead Developer:** Muhammad Bin Jamil  
**Repository:** https://github.com/MBJ420/banoqabil-alibaba-hackathon-fund-tracker

---

## 🎯 Executive Evaluation Pitch (Asynchronous Reviewer Script)

Respected Judges,

Pakistan's mutual fund industry manages over PKR 2 trillion in assets, yet retail investors face severe structural obstacles:
1. **Incomplete Statements:** Asset managers like HBL omit cumulative profit/loss and purchase costs from monthly PDFs, leaving investors blind to their real performance.
2. **Portfolio Fragmentation:** Investors hold funds across Meezan, HBL, Atlas, and Faysal, forcing them to manually maintain fragile Excel spreadsheets.
3. **Missing APIs:** MUFAP publishes closing NAVs behind Cloudflare-protected web pages with zero public REST APIs.
4. **Inflation & Fee Drag:** Double-digit CPI inflation silently destroys purchasing power, while opaque 1.5% to 3.5% Total Expense Ratios (TER) eat compound gains without beating market benchmarks.
5. **Shariah Zakat & Jargon Barriers:** Muslim investors struggle to calculate Zakat on equity funds (which require complex balance-sheet deductions), and complex English terminology alienates beginner investors.

**FundTracker Advanced** solves every one of these problems with a sovereign, local-first wealth platform:
- **Automated Statement Ingestion & P&L Reconciler:** Drop bank e-statements into a folder; the system extracts digital text layers and reconstructs true cost basis and unrealized gain/loss.
- **Headless MUFAP Scraper:** Playwright Chromium automation syncs closing NAVs and returns for **210+ mutual funds** every evening.
- **AAOIFI Shariah-Compliant Zakat Terminal:** Dynamically applies a prudent ~28% working capital deduction on equity funds, handles Silver/Gold Nisab, and exports tax deduction certificates.
- **100% Alibaba Cloud Model Studio (Qwen 2.5):** Powers monthly FMR PDF parsing via PyMuPDF, a Two-Pass Macroeconomic News Engine that forecasts sector impact without hallucination, and private portfolio rebalancing advice.
- **Zero-Knowledge Privacy:** All PKR balances and personal identifiers stay quarantined on the local machine; cloud AI receives only sanitized percentage distributions.
- **Inclusive Roman Urdu Localization:** Entire UI and conversational AI Copilot localized in Roman Urdu, democratizing financial literacy for every Pakistani retail investor.

FundTracker Advanced delivers institutional wealth management directly to retail investors' desktops.

---

## 💡 Judges' Technical Q&A & Architecture Defense

### Q1: Why is tracking Profit & Loss (P&L) such a big problem in Pakistan, and how does your app solve it?
**Answer:**
Pakistani AMCs lack unified statement reporting standards. While Al Meezan includes net gain/loss on monthly statements, **HBL Asset Management, Atlas, and others omit cumulative profit/loss entirely**—reporting only raw unit counts and closing balances. An investor holding units bought at different times and NAV prices has no simple way to know their actual profit or yield.
FundTracker solves this by parsing historical transaction ledgers from statement PDFs:
$$\text{Invested Capital} = \sum (\text{Units Purchased} \times \text{Acquisition Price})$$
$$\text{Unrealized Gain/Loss} = \text{Current Market Value} - \text{Invested Capital}$$
$$\text{Yield \%} = \left( \frac{\text{Current Market Value} - \text{Invested Capital}}{\text{Invested Capital}} \right) \times 100$$
This provides complete clarity regardless of which AMC issued the statement.

---

### Q2: How does your Shariah Zakat Calculator comply with Islamic jurisprudence on equity funds?
**Answer:**
Most retail investors either do not pay Zakat on mutual funds or incorrectly pay 2.5% on their entire gross equity fund valuation. Under **AAOIFI Standard No. 35** and rulings by leading scholars (e.g., Mufti Taqi Usmani):
- Mutual fund shares represent fractional ownership of operating companies.
- Zakat is obligatory **only on liquid and working capital assets** (cash, trade receivables, finished goods inventory).
- Zakat is **exempt on illiquid fixed assets** (factory buildings, plant & machinery, land, patents, equipment).
FundTracker applies a dynamic **~28% prudent working capital ceiling** for equity funds, while applying 100% to liquid cash and Sukuk/income funds. It supports both Hijri lunar (2.5%) and Gregorian solar (2.577%) calendars, verifies Nisab thresholds against live Silver/Gold rates, and exports Section 60 Tax Deduction Certificates.

---

### Q3: Why did you add Roman Urdu localization, and how is it integrated?
**Answer:**
Over 80% of Pakistani retail investors find English institutional financial terminology (such as Total Expense Ratio, NAV, Jensen's Alpha, Asset Allocation) intimidating and alienating.
We integrated a centralized `LanguageContext` that enables instant, seamless switching between English and natural Roman Urdu (`"Maliyati Intelligence"`, `"Kul Nafa / Nuqsan"`, `"Mehngai Simulator"`). Furthermore, our **AI Financial Copilot** (`/dashboard/copilot`) accepts questions and delivers structured advice natively in Roman Urdu, significantly lowering the barrier to entry for first-time investors.

---

### Q4: How does the Two-Pass Macro News Engine prevent hallucination?
**Answer:**
Standard LLMs hallucinate when asked to evaluate complex, multi-day economic developments from raw news text. Our Two-Pass architecture prevents this:
- **Pass 1 (World Context Manager):** Qwen 2.5 maintains a structured, persistent state of macroeconomic reality (SBP Monetary Policy rate, IMF review tranches, inflation prints) using explicit operations: `KEEP`, `AMEND`, `RESOLVE`, or `ADD`.
- **Pass 2 (Sector Impact Analyzer):** Breaking news is evaluated against the grounded World Context to produce deterministic, structured JSON impact scores (0–10) and directions (`Bullish`, `Bearish`, `Neutral`) across Short, Medium, and Long horizons for PSX Equities, Money Market, Fixed Income, and Gold.

---

### Q5: How is user financial privacy guaranteed when using Alibaba Cloud Model Studio?
**Answer:**
We enforce a strict **Zero-Knowledge Privacy Contract** implemented in application backend code before any network request is made:
- **Quarantined on PC:** Absolute PKR net worth, bank account numbers, CNIC/ID, and holder names never leave the local SQLite database.
- **Sent to Alibaba Cloud:** Only normalized percentage allocations (e.g., *Equity 58.4%, Money Market 41.6%*), category names, trailing return percentages, and live market context.
Alibaba Cloud's Qwen 2.5 model reasons over the asset distribution to diagnose risk drift and fee drag without ever knowing the user's identity or wealth.

---

### Q6: How does FundTracker help investors discover outperforming funds?
**Answer:**
With over 200+ mutual funds in Pakistan, retail investors suffer from choice paralysis and often remain trapped in underperforming funds for years. Our **Outperformer Peer Discovery Engine** automatically groups funds by category (e.g., Islamic Equity, Money Market, Sovereign Income) and evaluates 1-year trailing yield and Sharpe ratios. If a user holds a fund in the bottom quartile, the platform flags top-tier alternative funds in the same asset class and calculates the annualized opportunity cost.

---

### Q7: How does the application handle daily MUFAP data without a public REST API?
**Answer:**
MUFAP (`mufap.com.pk`) renders NAV tables dynamically through client-side JavaScript and uses Cloudflare protections, causing standard HTTP scrapers to fail with `403 Forbidden`.
We engineered a headless **Playwright Chromium scraper** configured with `WindowsProactorEventLoopPolicy` and realistic user headers. An APScheduler cron job runs daily at 6:00 PM PKT when AMCs submit closing valuations, populating the local SQLite WAL database with 210+ mutual funds with zero manual intervention.
