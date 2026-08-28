"""
oss_nav_sync.py
────────────────
Alibaba Cloud OSS + Local Playwright Dual-Engine NAV Sync.

Priority:
  1. Attempt fast cloud sync from Alibaba Cloud OSS (200ms, no browser needed).
     The OSS bucket is populated daily by the Alibaba Cloud Function Compute
     serverless scraper running on a cron trigger.

  2. If cloud data is stale (older than today) OR the OSS request fails (offline,
     network error, bucket not configured), automatically fall back to the
     local Playwright scraper.

This means:
  - Users who are online get today's MUFAP NAVs in <1 second.
  - Users who are offline still get data via the local headless browser.
  - Financial data never leaves the user's machine (portfolio stays private).
"""

import os
import json
import logging
import httpx
from datetime import datetime, timezone, date
from pathlib import Path
from dotenv import load_dotenv

# Load .env from multiple candidate paths
for p in [Path.cwd() / ".env", Path(__file__).resolve().parent.parent.parent / ".env"]:
    if p.exists():
        load_dotenv(p)

logger = logging.getLogger(__name__)

# ─── Alibaba Cloud OSS Configuration ──────────────────────────────────────────
# Format: https://<bucket>.oss-<region>.aliyuncs.com/<object-key>
# This is the PUBLIC READ URL your Function Compute writes to daily.
OSS_NAV_URL = os.environ.get(
    "ALIBABA_OSS_NAV_URL",
    ""   # Set this in .env after you create the OSS bucket
)
OSS_SYNC_TIMEOUT_SECONDS = 5  # fast — fail fast if cloud is unreachable

# ─── Sync Status Keys ─────────────────────────────────────────────────────────
SYNC_SOURCE_CLOUD  = "alibaba_cloud_oss"
SYNC_SOURCE_LOCAL  = "local_playwright"
SYNC_SOURCE_CACHED = "cached_local_db"


def _is_data_fresh(timestamp_str: str) -> bool:
    """
    Returns True if the cloud NAV feed was generated today (PKT / UTC+5).
    """
    try:
        feed_date = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        today_utc = datetime.now(timezone.utc).date()
        return feed_date.date() >= today_utc
    except Exception:
        return False


def _apply_cloud_navs_to_db(nav_data: list, db) -> int:
    """
    Upserts NAV and performance metrics from the cloud feed into local SQLite.
    Returns the count of funds updated.
    """
    from app.models import Fund, FundNAVHistory, FundPerformanceMetrics
    import re

    today = date.today().strftime("%Y-%m-%d")
    tracked_funds = {f.name.lower(): f.id for f in db.query(Fund).all()}
    processed = 0

    def normalize(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", s.lower())

    for record in nav_data:
        fund_name_lower = record.get("fund_name", "").lower().strip()
        nav_val = record.get("nav")
        if not fund_name_lower or nav_val is None:
            continue

        # Match fund name against local DB (exact first, then normalized)
        matched_id = tracked_funds.get(fund_name_lower)
        if not matched_id:
            for db_name, db_id in tracked_funds.items():
                if normalize(db_name) == normalize(fund_name_lower):
                    matched_id = db_id
                    break

        if not matched_id:
            continue

        try:
            nav_price = float(str(nav_val).replace(",", ""))

            # Upsert NAV history
            existing_nav = db.query(FundNAVHistory).filter(
                FundNAVHistory.fund_id == matched_id,
                FundNAVHistory.date == today
            ).first()
            if not existing_nav:
                db.add(FundNAVHistory(fund_id=matched_id, date=today, nav_price=nav_price))

            # Upsert performance metrics if present in cloud feed
            if any(k in record for k in ["return_1m", "return_6m", "return_1y"]):
                existing_perf = db.query(FundPerformanceMetrics).filter(
                    FundPerformanceMetrics.fund_id == matched_id,
                    FundPerformanceMetrics.date == today
                ).first()
                if not existing_perf:
                    db.add(FundPerformanceMetrics(
                        fund_id=matched_id,
                        date=today,
                        return_1m=record.get("return_1m", 0.0),
                        return_6m=record.get("return_6m", 0.0),
                        return_1y=record.get("return_1y", 0.0),
                        return_ytd=record.get("return_ytd", 0.0),
                    ))

            processed += 1
        except Exception as e:
            logger.warning(f"Skipping {fund_name_lower}: {e}")

    if processed:
        db.commit()

    return processed


def sync_nav_data(db) -> dict:
    """
    Main entry point. Called by the dashboard startup.

    Returns a dict describing what happened:
    {
        "source":   "alibaba_cloud_oss" | "local_playwright" | "cached_local_db",
        "funds_updated": 42,
        "feed_timestamp": "2026-08-28T13:30:00Z",
        "message": "Synced 42 funds from Alibaba Cloud OSS in 0.31s"
    }
    """

    # ── Step 1: Try Alibaba Cloud OSS ────────────────────────────────────────
    if OSS_NAV_URL:
        try:
            logger.info(f"Checking Alibaba Cloud OSS NAV feed: {OSS_NAV_URL}")
            t0 = datetime.now()

            with httpx.Client(timeout=OSS_SYNC_TIMEOUT_SECONDS) as client:
                resp = client.get(OSS_NAV_URL)
                resp.raise_for_status()
                feed = resp.json()

            elapsed = (datetime.now() - t0).total_seconds()
            feed_ts = feed.get("timestamp", "")
            nav_data = feed.get("funds", [])

            if nav_data and _is_data_fresh(feed_ts):
                logger.info(f"Cloud feed is fresh ({feed_ts}). Applying {len(nav_data)} NAV records...")
                count = _apply_cloud_navs_to_db(nav_data, db)
                return {
                    "source": SYNC_SOURCE_CLOUD,
                    "funds_updated": count,
                    "feed_timestamp": feed_ts,
                    "message": f"Synced {count} funds from Alibaba Cloud OSS in {elapsed:.2f}s"
                }
            else:
                logger.info(f"Cloud feed is stale ({feed_ts}). Falling back to local scraper.")

        except httpx.TimeoutException:
            logger.warning("Alibaba Cloud OSS request timed out. Falling back to local scraper.")
        except httpx.HTTPStatusError as e:
            logger.warning(f"OSS HTTP error {e.response.status_code}. Falling back to local scraper.")
        except Exception as e:
            logger.warning(f"OSS sync failed ({e}). Falling back to local scraper.")
    else:
        logger.info("ALIBABA_OSS_NAV_URL not configured. Skipping cloud sync, running local scraper.")

    # ── Step 2: Local Playwright Fallback ─────────────────────────────────────
    try:
        logger.info("Launching local Playwright scraper (fallback)...")
        from app.services.scraper import scrape_mufap_data
        scrape_mufap_data()
        return {
            "source": SYNC_SOURCE_LOCAL,
            "funds_updated": -1,  # scrape_mufap_data updates DB directly
            "feed_timestamp": datetime.utcnow().isoformat() + "Z",
            "message": "NAVs refreshed via local Playwright scraper"
        }
    except Exception as e:
        logger.error(f"Local scraper also failed: {e}")
        return {
            "source": SYNC_SOURCE_CACHED,
            "funds_updated": 0,
            "feed_timestamp": None,
            "message": f"Both cloud sync and local scraper failed: {e}. Using cached database values."
        }


def get_sync_status() -> dict:
    """Returns the current configuration state of the sync engine."""
    oss_configured = bool(OSS_NAV_URL)
    return {
        "cloud_sync_enabled": oss_configured,
        "oss_url": OSS_NAV_URL if oss_configured else None,
        "provider": "Alibaba Cloud OSS" if oss_configured else "Local Only",
        "fallback": "Local Playwright Scraper"
    }
