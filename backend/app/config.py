"""
config.py — Central configuration for Fund Tracker.

All shared paths and settings live here so that changing one value
propagates everywhere automatically. Never hardcode paths in individual files.
"""

import os
from pathlib import Path

# ─── Project Root ──────────────────────────────────────────────────────────────
# This resolves to the "Fund Tracker Advanced/" folder regardless of which
# machine or Windows username is running the app.
#
# __file__ is: .../Fund Tracker Advanced/backend/app/config.py
# .parent      → .../Fund Tracker Advanced/backend/app/
# .parent      → .../Fund Tracker Advanced/backend/
# .parent      → .../Fund Tracker Advanced/           ← PROJECT_ROOT
PROJECT_ROOT = Path(__file__).parent.parent.parent

# ─── PDF Drop Folder ───────────────────────────────────────────────────────────
# This is the folder users drop their PDF statements and FMR files into.
# It lives inside the project directory — no C:\Users\... paths needed.
#
# Structure inside this folder:
#   Fund Tracker PDF Data/
#   ├── FMRs/                    ← Drop Fund Manager Report PDFs here
#   └── {username}/
#       ├── meezan/              ← Drop Meezan statement PDFs here
#       ├── hbl/                 ← Drop HBL statement PDFs here
#       ├── atlas/               ← Drop Atlas statement PDFs here
#       └── faysal/              ← Drop Faysal statement PDFs here
PDF_DATA_DIR = PROJECT_ROOT / "Fund Tracker PDF Data"

# ─── FMR Sub-folder ────────────────────────────────────────────────────────────
# The watcher looks for this folder name to identify FMR uploads vs. personal statements.
FMR_FOLDER_NAME = "FMRs"
FMR_DIR = PDF_DATA_DIR / FMR_FOLDER_NAME

# ─── Scraper Logs ──────────────────────────────────────────────────────────────
# Diagnostic screenshots and HTML dumps saved here when the MUFAP scraper fails.
SCRAPER_LOGS_DIR = PDF_DATA_DIR / "logs" / "scraper_failures"
