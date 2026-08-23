# UX & User Flow Hackathon Readiness Audit: Pakistan Fund Tracker
**Agent:** Agent A (UX & User Flow Assessor)  
**Date:** 2026-08-22  
**Target File:** `.agents/explorer_ux/handoff.md`  
**Target Persona:** First-time Pakistani retail investor (non-tech-savvy, holding mutual fund units across Meezan, HBL, Atlas, Faysal)

---

## 1. Observation

A systematic code-level inspection of all frontend pages (`frontend/src/pages/*.tsx`), core application wiring (`frontend/src/App.tsx`, `frontend/src/api/client.ts`), Electron entry points (`frontend/electron/*`), and backend routers (`backend/app/routers/*.py`) revealed the following concrete observations:

### Observation 1.1: Missing Frontend UI Hook for Statement PDF Ingestion
* **Location:** `frontend/src/pages/Dashboard.tsx:436–440`, `frontend/src/pages/Dashboard.tsx:680–685`, `frontend/electron/preload.cjs:18–19`, `frontend/electron/main.cjs:43–50`
* **Code Evidence:**
  ```tsx
  // Dashboard.tsx:436-440
  <label className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/10">
      {isUploadingFMR ? <Activity size={16} className="animate-spin" /> : <UploadCloud size={16} />}
      <span>{isUploadingFMR ? 'Uploading...' : 'Upload FMR'}</span>
      <input type="file" accept=".pdf" className="hidden" onChange={handleFMRUpload} disabled={isUploadingFMR} />
  </label>
  ```
  ```tsx
  // Dashboard.tsx:680-685 (Empty State)
  if (banks.length === 0) {
      return (
          <div className="py-12 text-center">
              <p className="text-text-secondary">No statements found. Upload an FMR or PDF to begin tracking.</p>
          </div>
      );
  }
  ```
  ```javascript
  // preload.cjs:18-20
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (filePath, bank, username) => ipcRenderer.invoke('file:save', { filePath, bank, username }),
  exportPDF: (title) => ipcRenderer.invoke('exportPDF', title)
  ```
* **Verbatim Finding:** The only upload button in the UI is labeled "Upload FMR" which routes to `POST /api/performance/upload-fmr` (a fund-house market report enrichment endpoint). There is **zero** UI hook (button, dropzone, or modal) to upload a user's personal bank statement (Meezan, HBL, Atlas, Faysal). In `preload.cjs`, `window.api.saveFile` is declared, but `main.cjs` has no handler for `'file:save'`, and the React frontend never invokes `window.api.openFileDialog` or `saveFile`. A non-tech-savvy user cannot import their investments from the UI.

---

### Observation 1.2: Hardcoded 2023 Mock Data in "Recent Portfolio Updates" & Dead "View All History" Button
* **Location:** `frontend/src/pages/Dashboard.tsx:738–778`
* **Code Evidence:**
  ```tsx
  // Dashboard.tsx:738-740
  <button className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-widest">
      View All History
  </button>
  ```
  ```tsx
  // Dashboard.tsx:754-758
  <tbody className="divide-y divide-[var(--color-white-5)]">
      {[
          { date: '2023-11-24', bank: 'Meezan Bank', action: 'FMR Uploaded', amount: '1,240,000.00', status: 'VERIFIED' },
          { date: '2023-11-22', bank: 'HBL Asset Mgmt', action: 'Portfolio Rebalance', amount: '-450,000.00', status: 'PENDING' },
          { date: '2023-11-15', bank: 'Atlas Funds', action: 'Dividend Reinvested', amount: '12,500.00', status: 'VERIFIED' },
      ].map((row, i) => (
  ```
* **Verbatim Finding:** The "Recent Portfolio Updates" section renders 3 hardcoded static rows dated November 2023 regardless of the logged-in user or active dataset. The "View All History" button has no `onClick` handler and is completely unresponsive.

---

### Observation 1.3: Aggressive 5-Second `Promise.race` Timeout Triggers False-Positive Crash Screen
* **Location:** `frontend/src/pages/Dashboard.tsx:81–83, 105–108, 131–138, 269–288`
* **Code Evidence:**
  ```tsx
  // Dashboard.tsx:81-83
  const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), 5000)
  );
  ...
  const responses = await Promise.race([
      Promise.all(requests),
      timeoutPromise
  ]) as any;
  ...
  // Dashboard.tsx:136
  setError(err.message || "Failed to load dashboard data. Ensure backend is running.");
  ```
* **Verbatim Finding:** During app cold start or when SQLite queries take >5000ms (common when Playwright scraper or heavy PDF ingestion runs concurrently), `Promise.race` rejects. Line 269 returns a full-screen "Connection Error" component with a "Retry Connection" button, completely hiding the application interface.

---

### Observation 1.4: Routing Architecture Redundancy & Leaked API Calls
* **Location:** `frontend/src/App.tsx:9–20`, `frontend/src/pages/Dashboard.tsx:48–50, 78–141, 388–392`
* **Code Evidence:**
  ```tsx
  // App.tsx:9-20
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/*" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  </Routes>
  ```
  ```tsx
  // Dashboard.tsx:389-391
  {currentPage === '/news' && <NewsPage />}
  {currentPage === '/ai-news' && <AINewsPage />}
  {currentPage === '/suggestions' && <PortfolioSuggestions />}
  ```
* **Verbatim Finding:** Subpages (`/news`, `/ai-news`, `/suggestions`) are rendered conditionally inside `Dashboard.tsx` instead of using React Router child routes or layout wrappers. Consequently, navigating to `/news` triggers `Dashboard.tsx`'s `useEffect` (line 78), firing 4–5 expensive portfolio API calls (`/dashboard/summary`, `/dashboard/allocation`, `/dashboard/performance`, `/dashboard/holdings`) that are completely ignored by `NewsPage`. If any of these portfolio calls fail, the entire screen switches to the Dashboard error screen, preventing the user from reading news.

---

### Observation 1.5: Missing Auth Response Interceptors & Session Expiry Handling
* **Location:** `frontend/src/api/client.ts:13–24`, `backend/app/routers/auth.py:37`
* **Code Evidence:**
  ```typescript
  // client.ts:12-24
  client.interceptors.request.use(
      (config) => {
          const token = localStorage.getItem('token');
          if (token) {
              config.headers.Authorization = `Bearer ${token}`;
          }
          return config;
      },
      (error) => Promise.reject(error)
  );
  // NO response interceptor registered
  ```
  ```python
  # auth.py:37
  access_token_expires = timedelta(minutes=30)
  ```
* **Verbatim Finding:** When the 30-minute JWT token expires, API requests in `News.tsx`, `AINews.tsx`, and `PortfolioSuggestions.tsx` fail with `401 Unauthorized`. Because there is no Axios response interceptor, the app does not clear `localStorage` or redirect to `/login`; instead, subpages display unhelpful error banners (e.g., `Failed to fetch articles` in `News.tsx:102`, `Failed to load suggestions` in `PortfolioSuggestions.tsx:82`).

---

### Observation 1.6: Pervasive Reliance on Blocking `window.alert()` Dialogs
* **Location:**
  - `frontend/src/pages/Dashboard.tsx:165, 173, 200, 256, 260, 263`
  - `frontend/src/pages/News.tsx:165, 168`
* **Code Evidence:**
  ```tsx
  alert(res.data.message || "FMR processed successfully."); // Dashboard:165
  alert("Failed to upload FMR: " + (err.response?.data?.detail || err.message)); // Dashboard:173
  alert('Failed to save password: ' + (err.response?.data?.detail || err.message)); // Dashboard:200
  alert("Native PDF Export is not available in this environment."); // Dashboard:260
  alert("Article successfully pinned to your AI World Context!"); // News:165
  ```
* **Verbatim Finding:** Critical user feedback actions trigger native OS alert dialogs that freeze the browser/Electron UI thread, provide zero styling consistency, and degrade the modern desktop application feel.

---

### Observation 1.7: Missing Loading States on Authentication Forms
* **Location:** `frontend/src/pages/Login.tsx:12–34, 72–77`, `frontend/src/pages/Register.tsx:12–22, 60–65`
* **Code Evidence:**
  ```tsx
  // Login.tsx:72-77
  <button
      type="submit"
      className="w-full p-3 font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20 mt-2"
  >
      Sign In
  </button>
  ```
* **Verbatim Finding:** Neither `Login.tsx` nor `Register.tsx` maintains an `isLoading` / `isSubmitting` state. The submit buttons remain enabled and interactive while network requests are in flight, allowing duplicate submissions and giving zero visual response during slow responses.

---

### Observation 1.8: Inaccurate / Oversimplified Zakat Liability Logic
* **Location:** `frontend/src/pages/Dashboard.tsx:831–854`
* **Code Evidence:**
  ```tsx
  // Dashboard.tsx:840
  - PKR {((summary.total_net_worth || 0) * 0.025).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  ```
* **Verbatim Finding:** The Zakat Calculator multiplies the entire portfolio Net Worth by 2.5% without checking the Nisab threshold (~52.5 tola silver or 7.5 tola gold), ignoring deductible liabilities, and ignoring asset-type exemptions (e.g. debt vs equity fund asset zakatability according to Pakistani Shariah standards).

---

### Observation 1.9: Icon and Component Inconsistencies
* **Location:** `frontend/src/pages/Dashboard.tsx:812, 869, 1071, 1146, 1189`
* **Code Evidence:**
  ```tsx
  // Dashboard.tsx:812, 869, 1071, 1146 (Modal Close Buttons)
  <Zap size={16} className="rotate-45" /> {/* Close Icon Approximation */}
  
  // Dashboard.tsx:1189 (PDF Password Visibility Toggle)
  {pdfPasswordVisible[bank] ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
  ```
* **Verbatim Finding:** Modal close buttons render a rotated lightning bolt icon (`Zap`) rather than an `X` icon. The password visibility toggle uses directional arrows (`ArrowDownRight` / `ArrowUpRight`) rather than `Eye` / `EyeOff`.

---

## 2. Logic Chain

```
[Observation 1.1: No Statement Upload Button in Frontend]
    │
    ├─► Step 1: Core app proposition is tracking mutual fund statement PDFs.
    ├─► Step 2: Non-tech retail user clicks "Upload FMR" (only visible upload button), expecting to upload their bank statement.
    ├─► Step 3: FMR AI parser fails to parse bank statement or parses it with 0 funds matched because statement structure != FMR structure.
    └─► Conclusion 1: Ingestion flow is broken for non-technical users unless they manually place files into filesystem subfolders.

[Observation 1.2: Hardcoded 2023 Mock Data + Dead "View All History" Button]
    │
    ├─► Step 1: User imports a statement for August 2026.
    ├─► Step 2: "Recent Portfolio Updates" table still displays static transactions from November 2023 (Meezan, HBL, Atlas).
    ├─► Step 3: User clicks "View All History" to inspect their actual transaction log; nothing happens (no onClick handler).
    └─► Conclusion 2: Severe demo credibility flaw; judges and users will spot fabricated dates immediately.

[Observation 1.3 & 1.4: 5s Promise.race Timeout + Leaked Subpage Requests]
    │
    ├─► Step 1: Navigating to /news or /ai-news causes Dashboard to fire all portfolio requests.
    ├─► Step 2: If database is momentarily locked by the background scraper or takes >5.0s, timeoutPromise rejects.
    ├─► Step 3: Dashboard switches to full-screen Connection Error, masking News, AI News, and Portfolio Suggestions entirely.
    └─► Conclusion 3: System reliability during a live hackathon demo is fragile.

[Observation 1.5 & 1.6 & 1.7: Missing Response Interceptor, alerts, & missing button states]
    │
    ├─► Step 1: Token expires after 30 min -> user clicks "Refresh News" -> receives uncaught 401 error.
    ├─► Step 2: User clicks "Upload FMR" -> OS alert pops up freezing window.
    ├─► Step 3: User attempts login on slow connection -> double clicks "Sign In" -> multiple requests sent.
    └─► Conclusion 4: Frontend polish lacks production feedback states (spinners, toasts, graceful auth re-login).
```

---

## 3. Caveats

1. **Backend Service Capabilities:** The underlying backend parsers (`pdf_parser.py`, `fmr_parser.py`, `scraper.py`) are functional and robust when files are placed in their respective directories. The primary breakdowns exist in the frontend UI orchestration, error handling, feedback loops, and integration wiring.
2. **Offline Local Focus:** The application is architected as a local-first desktop application using SQLite; observations regarding local file access are made with this architecture in mind.
3. **Alibaba Cloud / AI Scope:** This report evaluates the current codebase state against the UX requirements for the Financial Inclusion track.

---

## 4. Conclusion & Structured Actionable Recommendations

The application has a strong technical foundation (FastAPI + SQLite + React + Tailwind + Playwright + Gemini AI), but suffers from critical UX disconnects and missing feedback mechanisms that would confuse a first-time Pakistani retail investor and present high risk during a live hackathon demo.

### Prioritized Remediation Plan

| Priority | Category | Action Item | Target File(s) | Concrete Fix |
| :--- | :--- | :--- | :--- | :--- |
| **P1** | **Broken Flow** | **Add Statement PDF Upload Modal / Drag-and-Drop in Header & Empty State** | `frontend/src/pages/Dashboard.tsx`, `backend/app/routers/dashboard.py` (or new endpoint `POST /dashboard/upload-statement`) | Add a dedicated "Upload Statement" modal with a Bank dropdown (`Meezan`, `HBL`, `Atlas`, `Faysal`) and file picker. Save file to `PDF_DATA_DIR / {username} / {bank}` or call an upload API that invokes `pdf_parser` immediately. |
| **P2** | **Demo Breaker** | **Replace Hardcoded 2023 Table with Real Statement Ingestion History & Connect "View All History"** | `frontend/src/pages/Dashboard.tsx:738–778`, `backend/app/routers/dashboard.py` | Query `models.Statement` to display actual parsed statement dates, institution names, total values, and parsing status. Add modal for "View All History". |
| **P3** | **Demo Breaker** | **Eliminate 5s `Promise.race` Timeout Crash** | `frontend/src/pages/Dashboard.tsx:81–83` | Remove the arbitrary 5000ms client timeout or increase it to 30s; let Axios handle network timeouts gracefully with per-component loading skeletons instead of replacing the entire screen with a crash page. |
| **P4** | **Routing / Architecture** | **Refactor App Routing with React Router Layout** | `frontend/src/App.tsx`, `frontend/src/pages/Dashboard.tsx` | Define proper `<Route path="/news" element={<NewsPage />} />` and shared sidebar layout so subpages do not execute redundant dashboard API queries. |
| **P5** | **Feedback States** | **Implement Global Toast Notification System & Remove `window.alert`** | `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/News.tsx`, `frontend/src/App.tsx` | Introduce an in-app toast component or notification banner (success/error/info) for FMR upload, password saving, and news pinning. |
| **P6** | **Feedback States** | **Add Button Loading Spinners & Auth Response Interceptor** | `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`, `frontend/src/api/client.ts` | Add `loading` state to Login and Register buttons. Add Axios 401 interceptor that clears token and redirects to `/login`. |
| **P7** | **Pakistani Retail UX** | **Improve Zakat Calculator with Nisab & Asset Breakdown** | `frontend/src/pages/Dashboard.tsx:805–858` | Display Nisab benchmark (e.g. Silver value reference in PKR), allow user to view asset breakdown, and explain Shariah calculation basis. |
| **P8** | **UI Polish** | **Replace Placeholder Icons (`Zap` for Close, Arrows for Eye)** | `frontend/src/pages/Dashboard.tsx:812, 1189` | Import `X`, `Eye`, `EyeOff` from `lucide-react` to replace rotated `Zap` and directional arrows. |

---

## 5. Verification Method

### How to Independently Verify These Findings:

1. **Verify Missing Statement Upload Hook:**
   - Run `grep_search` on `frontend/src` for `openFileDialog`, `saveFile`, or statement upload inputs.
   - Inspect `frontend/src/pages/Dashboard.tsx:436–440`. Observe that the only file input is linked to `handleFMRUpload` (`/api/performance/upload-fmr`).
2. **Verify Hardcoded Mock Table:**
   - Inspect `frontend/src/pages/Dashboard.tsx:754–758`. Observe literal string values `'2023-11-24'`, `'2023-11-22'`, `'2023-11-15'` embedded directly in the JSX render array.
   - Inspect `frontend/src/pages/Dashboard.tsx:738–740`. Observe `<button>` with no `onClick` attribute.
3. **Verify Premature Timeout Crash:**
   - Inspect `frontend/src/pages/Dashboard.tsx:81–83`. Observe `const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 5000));`.
4. **Verify Route Multiplexing & Redundant API Triggers:**
   - Inspect `frontend/src/App.tsx:12–19` and `frontend/src/pages/Dashboard.tsx:49, 78–141, 388–394`. Observe that navigating to `/news` mounts `Dashboard.tsx` and triggers `fetchData()` fetching summary, allocation, performance, and holdings simultaneously.
5. **Verify Blocking `window.alert` Invocations:**
   - Run `grep_search` with Query `alert(` on `frontend/src/pages/Dashboard.tsx` and `frontend/src/pages/News.tsx`.
