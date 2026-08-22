# 🏦 Pakistan Fund Tracker
### BanoQabil × Alibaba Cloud Hackathon

> An AI-powered desktop application that automatically tracks Pakistani mutual fund investments, scrapes live NAV prices from MUFAP, and delivers intelligent financial insights — built for Meezan, HBL, Atlas, and Faysal fund investors.

---

## 📌 Table of Contents
1. [What This App Does](#-what-this-app-does)
2. [Tech Stack — Plain English](#-tech-stack--plain-english)
3. [Project Structure](#-project-structure)
4. [How The App Works Under The Hood](#-how-the-app-works-under-the-hood)
5. [Database Tables](#-database-tables)
6. [API Endpoints](#-api-endpoints-what-the-backend-exposes)
7. [Setup and Running Locally](#-setup--running-locally)
8. [GitHub Collaboration Guide](#-github-collaboration-guide-for-the-team)

---

## 🚀 What This App Does

This is a **local desktop app** (runs on your own PC — no cloud needed) that:

- 📄 **Auto-reads your PDF bank statements** — drop a statement PDF into a folder, and the app automatically extracts all your fund holdings
- 💹 **Scrapes live NAV prices daily from [MUFAP](https://mufap.com.pk)** — so your portfolio always shows today's value
- 🤖 **Uses Google Gemini AI** to parse complex Fund Manager Reports (FMRs) and extract fund metadata (risk level, asset allocation, fund type)
- 📊 **Shows a rich dashboard** — total net worth, gain/loss, historical charts, fund performance tables
- 📰 **Aggregates financial news** and uses AI to predict how world events might impact your funds
- 🔐 **Multi-user login** — each user only sees their own portfolios

**Target Users:** Pakistani investors holding units in Meezan, HBL, Atlas, and Faysal mutual funds.

---

## 🧰 Tech Stack — Plain English

> No jargon. Here is what each tool actually does in this project:

| Tool | What it is | Why we use it |
|------|-----------|--------------|
| **FastAPI** (Python) | The "brain" of the backend. Handles all requests from the frontend. | Fast, modern, auto-generates API docs |
| **SQLAlchemy** | A Python library that lets us talk to the database using Python code instead of raw SQL | Cleaner code, easier to change database structure |
| **SQLite** | A simple file-based database (`fundtracker.db`). Think of it like a spreadsheet that code can read/write. | No server needed, works offline |
| **Alembic** | A tool that manages database changes ("migrations") — like version control for your database schema | Team members can update their DB structure safely |
| **Playwright** | A browser automation tool — it opens a real browser in the background to scrape MUFAP's website | MUFAP requires JavaScript, so a normal HTTP request does not work |
| **Watchdog** | A library that watches a folder for new files | Lets us auto-detect when a new PDF is dropped into the data folder |
| **APScheduler** | Runs tasks on a schedule (like a cron job) | Triggers the MUFAP scraper every day at 6 PM PKT |
| **pdfplumber** | Extracts text from PDF files | Reads bank statement PDFs |
| **Google Gemini API** | Google AI model | Parses complex FMR PDFs that have inconsistent formatting |
| **React + TypeScript** | The frontend UI framework | Builds the interactive dashboard |
| **Vite** | A build tool that makes frontend development fast | Handles hot-reload during development |
| **Electron** | Wraps the React web app into a desktop exe | So users do not need a browser — it looks like a native app |
| **Tailwind CSS** | A CSS utility framework | Lets us style the UI quickly without writing custom CSS files |
| **ApexCharts** | A charting library | Draws the interactive line/area charts on the dashboard |
| **Framer Motion** | Animation library for React | Smooth transitions and micro-animations |
| **Axios** | HTTP client for the frontend | Makes API calls from the React app to the FastAPI backend |

---

## 📁 Project Structure

```
Fund Tracker Advanced/
│
├── backend/                          ← Python FastAPI server
│   ├── app/
│   │   ├── main.py                   ← App entry point. Starts background services.
│   │   ├── models.py                 ← Database table definitions (SQLAlchemy ORM)
│   │   ├── database.py               ← Database connection setup
│   │   ├── schemas.py                ← Data validation shapes (Pydantic)
│   │   ├── crud.py                   ← Reusable database read/write functions
│   │   ├── utils.py                  ← Helper utilities (token creation, etc.)
│   │   ├── routers/                  ← API route handlers (grouped by feature)
│   │   │   ├── auth.py               ← Login / token generation
│   │   │   ├── users.py              ← User registration and settings
│   │   │   ├── dashboard.py          ← Main dashboard data (net worth, charts, etc.)
│   │   │   ├── performance.py        ← Fund performance tables and NAV charts
│   │   │   └── news.py               ← Financial news and AI predictions
│   │   └── services/                 ← Background services (the "workers")
│   │       ├── watcher.py            ← Watches data folder for new PDFs
│   │       ├── scraper.py            ← Daily MUFAP NAV scraper (uses Playwright)
│   │       ├── pdf_parser.py         ← Parses bank statement PDFs
│   │       ├── fmr_parser.py         ← Parses Fund Manager Report PDFs using Gemini AI
│   │       ├── news_service.py       ← Fetches and aggregates financial news
│   │       └── news_ai_analyzer.py   ← AI analysis of news impact on assets
│   ├── alembic/                      ← Database migration files
│   ├── alembic.ini                   ← Alembic configuration
│   ├── requirements.txt              ← Python package list (pip install -r this)
│   └── .env.example                  ← Template for your secret keys — copy to .env
│
├── frontend/                         ← React + Electron desktop app
│   ├── src/
│   │   ├── main.tsx                  ← React entry point
│   │   ├── App.tsx                   ← Route definitions (Login to Dashboard)
│   │   ├── api/
│   │   │   └── client.ts             ← Axios setup (base URL, auth headers)
│   │   └── pages/
│   │       ├── Login.tsx             ← Login screen
│   │       ├── Register.tsx          ← Registration screen
│   │       ├── Dashboard.tsx         ← Main dashboard (charts, holdings, performance)
│   │       ├── News.tsx              ← Financial news feed
│   │       ├── AINews.tsx            ← AI-analyzed news and asset predictions
│   │       └── PortfolioSuggestions.tsx  ← AI portfolio recommendations
│   ├── electron/                     ← Electron desktop wrapper files
│   ├── package.json                  ← Node.js package list (npm install reads this)
│   └── vite.config.ts                ← Vite build configuration
│
├── Fund Tracker PDF Data/            ← [AUTO-CREATED] Drop your PDFs here — never commit this folder
│   ├── FMRs/                         ← Drop Fund Manager Report PDFs here (auto-deleted after AI parsing)
│   └── {your-username}/              ← Auto-created when you register — named after your login username
│       ├── meezan/                   ← Drop Meezan statement PDFs here
│       ├── hbl/                      ← Drop HBL statement PDFs here
│       ├── atlas/                    ← Drop Atlas statement PDFs here
│       └── faysal/                   ← Drop Faysal statement PDFs here
│
├── backend/app/config.py             ← Central path config — all folder paths defined here
├── start_app.bat                     ← One-click launcher for Windows (runs everything)
├── stop_app.bat                      ← Stops all running services
└── .gitignore                        ← Files Git should NOT track (DB, secrets, PDFs, etc.)
```

---

## 🔧 How The App Works Under The Hood

### The Big Picture

```
+-------------------------------------------------------------+
|                     USER'S COMPUTER                         |
|                                                             |
|  +--------------+    HTTP     +--------------------------+  |
|  |   Electron   | <-------->  |   FastAPI Backend        |  |
|  |   (Desktop   |  localhost  |   (Python, port 8001)   |  |
|  |    Window)   |  :8001      |                          |  |
|  |              |             |  +---------------------+ |  |
|  |  React App   |             |  |   SQLite Database   | |  |
|  |  (Dashboard) |             |  |   (fundtracker.db)  | |  |
|  +--------------+             |  +---------------------+ |  |
|                               |                          |  |
|                               |  Background Workers:     |  |
|                               |  - Watcher (PDF folder)  |  |
|                               |  - Scraper (MUFAP daily) |  |
|                               |  - News pipeline (6hrs)  |  |
|                               +--------------------------+  |
|                                         |                   |
|                                    +----+----+              |
|                                    | Internet|              |
|                                    | MUFAP   |              |
|                                    | Gemini  |              |
|                                    +---------+              |
+-------------------------------------------------------------+
```

### Step-by-Step Flow

1. **User starts the app** via `start_app.bat`
   - This opens two things: the Python backend server, and the Electron window (which loads the React UI)

2. **User logs in** — the frontend sends credentials to `POST /token`, gets back a token (like a session ID) that it includes in all future requests

3. **PDF Drop Auto-Ingestion** — a background thread (`watcher.py`) constantly monitors the `Fund Tracker PDF Data/` folder (inside the project):
   - Drop a file into `Fund Tracker PDF Data/FMRs/` → AI parses it as a Fund Manager Report, extracts metadata
   - Drop a file into `Fund Tracker PDF Data/jameel/meezan/` → system parses it as a personal bank statement and records your holdings

4. **Daily NAV Scraping** — every day at 6:00 PM PKT, the scraper automatically opens MUFAP in a hidden browser (Playwright), extracts NAV prices for all known funds, and saves them to the database

5. **Dashboard loads** — the React frontend calls several API endpoints, combines the data, and renders charts, tables, and insights

---

## 🗄 Database Tables

> Think of each table as a spreadsheet tab in a big Excel file

| Table | What it stores |
|-------|---------------|
| `users` | Login accounts (username + hashed password) |
| `banks` | List of fund houses: Meezan, HBL, Atlas, Faysal |
| `funds` | Every mutual fund we know about. Also stores AI-extracted risk and allocation info |
| `portfolios` | Links a user to a bank (e.g., "Jameel has a portfolio at Meezan") |
| `statements` | Raw parsed data from PDF statements — holdings, values, dates |
| `fund_nav_history` | Daily NAV price per fund (used to draw price charts) |
| `fund_performance_metrics` | Benchmark returns (1M, 6M, 1Y, YTD) scraped from MUFAP |
| `user_bank_configs` | Per-user settings — e.g., PDF password for encrypted Atlas statements |
| `news_articles` | Cached financial news articles (refreshed every 6 hours) |
| `asset_predictions` | AI-generated impact scores per asset class based on latest news |
| `world_context_entries` | Persistent macro/geopolitical events the AI keeps in memory |
| `news_metadata` | Tracks when news/AI last ran and whether it succeeded |
| `scraper_status` | Health status of the MUFAP scraper |

---

## 🌐 API Endpoints (What the Backend Exposes)

> When the backend is running, visit **http://localhost:8001/docs** to see all endpoints with an interactive UI (auto-generated by FastAPI).

### Authentication
| Method | URL | What it does |
|--------|-----|-------------|
| `POST` | `/token` | Login — returns a bearer token |
| `POST` | `/users/register` | Create a new user account |

### Dashboard
| Method | URL | What it does |
|--------|-----|-------------|
| `GET` | `/dashboard/summary` | Net worth, total invested, total gain/loss |
| `GET` | `/dashboard/holdings` | List of all your current fund holdings |
| `GET` | `/dashboard/performance` | Historical portfolio value (for the line chart) |
| `GET` | `/dashboard/allocation` | Asset category breakdown (for the pie chart) |
| `GET` | `/dashboard/insights` | AI-generated risk alerts and tips |

### Fund Performance
| Method | URL | What it does |
|--------|-----|-------------|
| `GET` | `/api/performance/bank/{name}` | All funds for a specific bank with their metrics |
| `GET` | `/api/performance/{id}/chart` | Full NAV history for one specific fund |
| `POST`| `/api/performance/upload-fmr` | Manually upload an FMR PDF to update fund metadata |

### News and AI
| Method | URL | What it does |
|--------|-----|-------------|
| `GET` | `/news/articles` | Latest financial news articles |
| `GET` | `/news/predictions` | AI predictions on how news affects each asset class |

---

## 🛠 Setup and Running Locally

### Prerequisites

Before you start, you need these installed on your PC:

1. **Python 3.11+** — [Download here](https://www.python.org/downloads/) *(Check "Add to PATH" during install!)*
2. **Node.js 20+** — [Download here](https://nodejs.org/)
3. **Git** — [Download here](https://git-scm.com/)
4. **A Google Gemini API Key** (free) — [Get one here](https://aistudio.google.com/apikey)

### First-Time Setup

#### Step 1 — Clone the repository
```bash
git clone https://github.com/YOUR_TEAM/fund-tracker.git
cd fund-tracker
```

#### Step 2 — Set up the Backend (Python)
```bash
# Go into the backend folder
cd backend

# Create an isolated Python environment
python -m venv venv

# Activate the virtual environment (Windows)
venv\Scripts\activate

# Install all required Python packages
pip install -r requirements.txt

# Install Playwright's browser (needed for the MUFAP scraper — run this once only)
playwright install chromium
```

#### Step 3 — Configure your Secret Keys
```bash
# Copy the example env file
copy backend\.env.example backend\.env

# Open backend\.env in any text editor and paste your real Gemini API key
# GEMINI_API_KEY=AIzaSy...your_real_key_here
```

#### Step 4 — Set up the Frontend (Node.js)
```bash
# Go to the frontend folder (in a new terminal)
cd frontend

# Install all Node.js packages
npm install
```

### Running the App

**Option A — One-click (recommended for Windows):**
```
Double-click start_app.bat
```
This starts the backend and opens the Electron desktop window automatically.

**Option B — Manual (for development/debugging):**
```bash
# Terminal 1 — Start the backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8001

# Terminal 2 — Start the frontend
cd frontend
npm run electron:dev
```

> 💡 **Tip:** After the backend starts, open `http://localhost:8001/docs` in your browser to see and test all API endpoints interactively — extremely useful when building new features!

---

## 🤝 GitHub Collaboration Guide (For The Team)

> This section explains how 3 people can work on this project at the same time without overwriting each other's work.

### The Core Concept: Branches

Think of Git branches like **parallel versions** of the project. The `main` branch is the "official" stable version. Each person creates their own branch to work on a feature, then merges it back into `main` when done.

```
main  ──────────────────────────────────────  (always stable, never break this)
         |               |               |
         v               v               v
   feature/          feature/        feature/
   jameel-news      ali-charts      sara-auth
   (your work)    (Ali's work)    (Sara's work)
```

### Daily Workflow — Follow This Every Day

```bash
# 1. Get the latest changes from teammates before you start
git checkout main
git pull origin main

# 2. Switch to your own feature branch (create it if first time)
git checkout -b feature/what-im-building     # creates new branch
# OR just switch to existing:
git checkout feature/what-im-building

# 3. Do your work — write code, test it

# 4. Save a snapshot of your progress
git add .
git commit -m "feat: added CSV export button on dashboard"

# 5. Push to GitHub so teammates can see your progress
git push origin feature/what-im-building

# 6. When the feature is complete, open a Pull Request on GitHub to merge into main
```

### Branch Naming — Keep It Clear

```
feature/ai-portfolio-suggestions   ← new feature
fix/pdf-parsing-atlas-bug          ← bug fix
ui/redesign-dashboard-cards        ← visual changes only
docs/update-readme                 ← documentation only
```

### Commit Messages — Write What You Did

```
feat: add Zakat calculator to dashboard
fix: MUFAP scraper now correctly handles pension fund NAVs
ui: improve chart colors for dark mode
docs: add setup steps for Mac users
```

### How To Avoid Merge Conflicts

A **merge conflict** happens when two people edit the exact same line in the same file. To avoid this:

1. **Split ownership of files** — if Jameel owns `Dashboard.tsx`, Ali should not touch it. Ali works on `News.tsx`, Sara works on `AINews.tsx`.
2. **Pull from main every morning** — `git pull origin main` — stay in sync
3. **Commit small and often** — 5 small commits are much safer than 1 huge commit

### If You Get a Merge Conflict

Your IDE (VS Code / Antigravity / Claude Code) will highlight the conflict like this:

```
<<<<<<< HEAD
your version of the code
=======
teammate's version of the code
>>>>>>> feature/their-branch
```

Just keep the version you want (or combine both), delete those `<<<`, `===`, `>>>` markers, then:

```bash
git add .
git commit -m "fix: resolve merge conflict in Dashboard.tsx"
```

### Suggested Work Division

| Person | Ownership Area |
|--------|---------------|
| **Person 1 (Backend)** | New API routes, PDF parsing improvements, AI prompt tuning |
| **Person 2 (Frontend)** | New UI pages, chart upgrades, animations, design polish |
| **Person 3 (Full-Stack)** | Features that need both backend and frontend (e.g., PDF export, new analytics) |

> 💡 **AI IDE Tip:** When you ask Antigravity, Claude Code, or Qoder to build something, always tell it: *"I am on branch `feature/my-branch`. Only modify files in the [backend/frontend] folder."* This stops the AI from accidentally editing your teammate's files.

### Creating a Pull Request (The Right Way to Merge)

1. Push your branch: `git push origin feature/your-feature`
2. Go to your GitHub repository
3. GitHub will show a yellow banner saying "Compare and pull request" — click it
4. Write a short description: what you built and why
5. Tag a teammate to review
6. Once they approve, click **Merge**

### Protect the `main` Branch (Do This Once on GitHub)

Go to: **GitHub Repo → Settings → Branches → Add branch rule for `main`**

Check these boxes:
- ✅ Require a pull request before merging
- ✅ Require 1 approving review

This prevents anyone from accidentally pushing broken code directly to `main`.

---

## ⚠️ Critical Reminders

| Rule | Why |
|------|-----|
| Never commit `.env` | It contains your Gemini API key — leaked keys get abused and charged |
| Never commit `fundtracker.db` | Contains personal investment data |
| Run `pip install -r requirements.txt` after pulling | Someone may have added a new Python package |
| Run `npm install` after pulling | Someone may have added a new frontend package |
| Run `playwright install chromium` once after setup | The scraper needs this browser binary to work |
