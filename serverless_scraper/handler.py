"""
handler.py — Alibaba Cloud Function Compute 3.0 Entry Point
─────────────────────────────────────────────────────────────
Runs daily (Mon–Fri 6:30 PM PKT via Timer Trigger) to:
  1. Scrape all 185+ mutual fund NAVs from MUFAP.com.pk using Playwright
  2. Upload the result as `nav-feed/latest.json` to Alibaba Cloud OSS

Local FundTracker clients then fetch this JSON in ~200ms instead of
running a 20-second headless browser locally.

Environment Variables (set in Function Compute console):
  OSS_ACCESS_KEY_ID       — Alibaba Cloud RAM user Access Key ID
  OSS_ACCESS_KEY_SECRET   — Alibaba Cloud RAM user Access Key Secret
  OSS_BUCKET_NAME         — Your OSS bucket name (e.g. fundtracker-navs)
  OSS_ENDPOINT            — Your OSS endpoint (e.g. oss-ap-southeast-1.aliyuncs.com)
"""

import os
import json
import logging
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
import oss2

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MUFAP_URL = "https://mufap.com.pk/Industry/IndustryStatDaily?tab=1"
OSS_OBJECT_KEY = "nav-feed/latest.json"


def scrape_mufap_navs() -> list:
    """
    Uses Playwright headless Chromium to extract the full NAV table
    from MUFAP and returns a list of fund dicts.
    """
    logger.info("Launching Playwright headless Chromium...")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        page = context.new_page()

        logger.info(f"Navigating to {MUFAP_URL}")
        try:
            page.goto(MUFAP_URL, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            logger.warning(f"Page load warning: {e}")

        # Wait up to 30s for the DataTable to populate
        for _ in range(15):
            page.wait_for_timeout(2000)
            try:
                text = page.locator("#table_id").inner_text()
                if len(text) > 500:
                    break
            except Exception:
                pass

        # Extract table rows
        try:
            table_text = page.locator("#table_id").inner_text()
        except Exception as e:
            logger.error(f"Could not read table: {e}")
            browser.close()
            return results

        browser.close()

    # Parse tab-separated text into fund records
    lines = table_text.strip().split("\n")
    headers = []
    for line in lines:
        cols = [c.strip() for c in line.split("\t")]
        if "Fund Name" in cols and "NAV" in cols:
            headers = cols
            continue
        if not headers or len(cols) < 5:
            continue
        try:
            name_idx = headers.index("Fund Name")
            nav_idx  = headers.index("NAV")
            fund_name = cols[name_idx].strip()
            nav_str   = cols[nav_idx].strip()
            if not fund_name or not nav_str or nav_str == "N/A":
                continue

            def safe_float(s):
                try:
                    return float(s.replace("%", "").replace(",", "").replace("(", "-").replace(")", "").strip())
                except Exception:
                    return None

            results.append({
                "fund_name":  fund_name,
                "nav":        safe_float(nav_str),
                "return_1m":  safe_float(cols[headers.index("MTD")])    if "MTD"      in headers else None,
                "return_6m":  safe_float(cols[headers.index("180 Days")])if "180 Days" in headers else None,
                "return_1y":  safe_float(cols[headers.index("365 Days")])if "365 Days" in headers else None,
                "return_ytd": safe_float(cols[headers.index("YTD")])    if "YTD"      in headers else None,
            })
        except Exception as e:
            logger.warning(f"Skipping row: {e}")
            continue

    logger.info(f"Scraped {len(results)} fund NAV records from MUFAP.")
    return results


def upload_to_oss(data: dict) -> None:
    """Uploads the NAV JSON payload to Alibaba Cloud OSS."""
    access_key_id     = os.environ["OSS_ACCESS_KEY_ID"]
    access_key_secret = os.environ["OSS_ACCESS_KEY_SECRET"]
    bucket_name       = os.environ["OSS_BUCKET_NAME"]
    endpoint          = os.environ.get("OSS_ENDPOINT", "oss-ap-southeast-1.aliyuncs.com")

    auth   = oss2.Auth(access_key_id, access_key_secret)
    bucket = oss2.Bucket(auth, f"https://{endpoint}", bucket_name)

    json_bytes = json.dumps(data, ensure_ascii=False).encode("utf-8")
    bucket.put_object(
        OSS_OBJECT_KEY,
        json_bytes,
        headers={"Content-Type": "application/json", "Cache-Control": "no-cache"}
    )
    logger.info(f"Uploaded {len(data['funds'])} fund records to OSS: {OSS_OBJECT_KEY}")


def handler(event, context):
    """
    Alibaba Cloud Function Compute 3.0 invocation handler.
    Called by the Timer Trigger on schedule.
    """
    logger.info("=== FundTracker MUFAP Scraper (Alibaba Cloud FC 3.0) ===")
    logger.info(f"Triggered at: {datetime.now(timezone.utc).isoformat()}")

    # 1. Scrape MUFAP
    funds = scrape_mufap_navs()
    if not funds:
        return {"statusCode": 500, "body": "Scraping failed — no NAV data extracted."}

    # 2. Build payload
    payload = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source":    "mufap.com.pk",
        "fund_count": len(funds),
        "funds":     funds
    }

    # 3. Upload to Alibaba Cloud OSS
    upload_to_oss(payload)

    result = {
        "statusCode":    200,
        "funds_scraped": len(funds),
        "timestamp":     payload["timestamp"],
        "oss_key":       OSS_OBJECT_KEY
    }
    logger.info(f"Success: {result}")
    return result


# Local test: python handler.py
if __name__ == "__main__":
    result = handler({}, {})
    print(json.dumps(result, indent=2))
