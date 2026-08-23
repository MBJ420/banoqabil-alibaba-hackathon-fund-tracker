import os
import sys
import asyncio
import logging
from datetime import datetime
from playwright.sync_api import sync_playwright

# Add parent directory to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.database import SessionLocal, engine
from app.models import Base, Fund, FundNAVHistory, FundPerformanceMetrics, ScraperStatus
from sqlalchemy.orm import Session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MUFAP_URL = "https://mufap.com.pk/nav-returns.php"

def init_db():
    Base.metadata.create_all(bind=engine)

def scrape_mufap_data():
    """
    Scrapes the daily NAV and performance metrics from MUFAP and updates our DB.
    """
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    logger.info("Starting background scrape of MUFAP Daily NAVs...")
    init_db()
    db = SessionLocal()

    def _set_status(healthy: bool, error_msg: str = None):
        try:
            status = db.query(ScraperStatus).filter(ScraperStatus.scraper_name == "mufap_daily").first()
            if not status:
                status = ScraperStatus(scraper_name="mufap_daily")
                db.add(status)
            status.is_healthy = healthy
            status.error_message = error_msg
            status.requires_maintenance = not healthy
            status.last_run_at = datetime.utcnow()
            db.commit()
        except:
            pass

    try:
        # 1. Fetch the data using Playwright to bypass Cloudflare and wait for JS DataTables
        table_text = ""
        vps_text = ""
        
        for attempt in range(3):
            logger.info(f"Scrape attempt {attempt + 1}")
            try:
                with sync_playwright() as p:
                    browser = p.chromium.launch(
                        headless=True,
                        args=[
                            "--disable-blink-features=AutomationControlled",
                            "--no-sandbox",
                            "--disable-setuid-sandbox"
                        ]
                    )
                    try:
                        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
                        page = context.new_page()
                        
                        target_url = "https://mufap.com.pk/Industry/IndustryStatDaily?tab=1"
                        logger.info(f"Navigating to {target_url}")
                        try:
                            page.goto(target_url, wait_until='domcontentloaded', timeout=60000)
                        except Exception as e:
                            logger.warning(f"Navigation timeout/error: {e}")
                        
                        for _ in range(15):
                            page.wait_for_timeout(2000)
                            try:
                                if len(page.locator('#table_id').inner_text()) > 500:
                                    break
                            except Exception:
                                pass
                        
                        try:
                            table_text = page.locator('#table_id').inner_text()
                        except Exception as e:
                            logger.error(f"Could not locate #table_id: {e}")
                            table_text = ""
    
                        if table_text and len(table_text) > 500:
                            try:
                                try:
                                    page.goto("https://mufap.com.pk/WebPost/WebPostById?title=VoluntryPansionFund(VPS)", wait_until='domcontentloaded', timeout=60000)
                                except Exception as e:
                                    logger.warning(f"VPS navigation timeout/error: {e}")
                                page.wait_for_timeout(3000)
                                vps_tables = page.locator('table')
                                for i in range(vps_tables.count()):
                                    tmp_text = vps_tables.nth(i).inner_text()
                                    if "Offer Price" in tmp_text and "NAV" in tmp_text and "Category" in tmp_text:
                                        vps_text = tmp_text
                                        break
                                logger.info("Successfully extracted VPS text.")
                            except Exception as e:
                                logger.error(f"Failed to extract VPS table: {e}")
                            break # Break out of retry loop if successful
                        else:
                            # Save diagnostic screenshot and HTML on failure
                            logger.warning("Scraped table text is empty or invalid. Saving diagnostic dump.")
                            from ..config import SCRAPER_LOGS_DIR
                            dump_dir = str(SCRAPER_LOGS_DIR)
                            os.makedirs(dump_dir, exist_ok=True)
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            try:
                                page.screenshot(path=os.path.join(dump_dir, f"mufap_fail_{timestamp}.png"))
                                with open(os.path.join(dump_dir, f"mufap_fail_{timestamp}.html"), "w", encoding="utf-8") as f:
                                    f.write(page.content())
                            except Exception as dump_err:
                                logger.error(f"Failed to save diagnostic dump: {dump_err}")
                    finally:
                        browser.close()
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {e}")
                import time
                time.sleep(5)
                
        if not table_text or len(table_text) < 500:
            err = "Scraped table text is empty or invalid after retries."
            logger.error(err)
            _set_status(False, err)
            return
        
        try:
            tracked_funds = {f.name.lower(): f.id for f in db.query(Fund).all()}
            if not tracked_funds:
                 logger.info("No funds tracked in DB. Exiting.")
                 return
                 
            today = datetime.now().strftime("%Y-%m-%d")
            processed_count = 0
            
            lines = table_text.split('\n')
            
            # Identify columns dynamically just in case standard layout shifts.
            # Typical headers: Fund Name, Rating, Validity Date, NAV, YTD, MTD, 1 Day, 15 Days, 30 Days, 90 Days, 180 Days, 270 Days, 365 Days
            headers = []
            extracted_records = []
            
            for line in lines:
                cols = line.split('\t')
                
                # Capture headers when found
                if 'Fund Name' in cols and 'NAV' in cols:
                    headers = [c.strip() for c in cols]
                    continue
                    
                # Skip category headers or malformed lines
                if len(cols) < 5 or not headers:
                    continue
                    
                fund_name = cols[headers.index('Fund Name')].strip()
                nav_str = cols[headers.index('NAV')].strip()
                
                # If there's missing data or it's a sub-header, skip
                if not nav_str or nav_str == 'N/A':
                    continue
                    
                # Store extracted record
                extracted_records.append({
                    "name": fund_name.lower().strip(),
                    "nav": nav_str,
                    "cat": "",
                    "1_day": cols[headers.index('1 Day')].strip() if '1 Day' in headers else None,
                    "mtd": cols[headers.index('MTD')].strip() if 'MTD' in headers else None,
                    "180_days": cols[headers.index('180 Days')].strip() if '180 Days' in headers else None,
                    "365_days": cols[headers.index('365 Days')].strip() if '365 Days' in headers else None,
                    "ytd": cols[headers.index('YTD')].strip() if 'YTD' in headers else None,
                })

            # Process VPS Text using robust card separation
            if vps_text:
                cards = vps_text.split('VIEW DETAILS')
                for card in cards:
                    lines = [l.strip() for l in card.split('\n') if l.strip()]
                    if not lines: continue
                    
                    fund_name = lines[0]
                    nav = '0'
                    cat = 'Unknown'
                    
                    for i, line in enumerate(lines):
                        if line == 'NAV' and i > 0:
                            nav = lines[i-1]
                        elif line == 'Category' and i > 0:
                            cat = lines[i-1]
                            
                    if nav != '0' and cat != 'Unknown':
                        extracted_records.append({
                            "name": f"{fund_name.lower()} {cat.lower()}",
                            "nav": nav,
                            "cat": cat,
                            "1_day": None, "mtd": None, "180_days": None, "365_days": None, "ytd": None
                        })


            # Now map against tracking funds
            for row in extracted_records:
                # Fuzzy matching function to find the right tracked fund
                matched_db_name = None
                mapped_fund_id = None
                row_search_text = row["name"].replace('vps-shariah compliant', '').replace('vps-', '')
                
                for db_fund_name, db_fund_id in tracked_funds.items():
                    db_search_text = db_fund_name.replace('sub fund', '').replace('sub-fund', '')
                    
                    # Exact Match
                    if db_fund_name == row["name"]:
                        mapped_fund_id = db_fund_id
                        break
                    
                    # Pension Sub-Fund Match
                    if ('mtpf' in db_fund_name or 'pension' in db_fund_name) and 'pension' in row["name"]:
                        # Strict Islamic/Conventional check
                        is_db_islamic = any(k in db_fund_name for k in ['islamic', 'shariah', 'mtpf', 'meezan', 'alhamra', 'al ameen'])
                        is_row_islamic = any(k in row["name"] for k in ['islamic', 'shariah', 'mtpf', 'meezan', 'alhamra', 'al ameen'])
                        
                        if is_db_islamic == is_row_islamic:
                            # check if bank matches
                            if ('meezan' in row["name"] and 'mtpf' in db_fund_name) or ('meezan' in db_fund_name and 'meezan' in row["name"]) or ('hbl' in db_fund_name and 'hbl' in row["name"]) or ('atlas' in db_fund_name and 'atlas' in row["name"]) or ('faysal' in db_fund_name.replace('faysal','faysal') and 'faysal' in row["name"]):
                                # check if category matches
                                if ('equity' in row_search_text and 'equity' in db_search_text) or ('debt' in row_search_text and 'debt' in db_search_text) or ('money market' in row_search_text and 'money market' in db_search_text):
                                    mapped_fund_id = db_fund_id
                                    break
                    
                    import re
                    def normalize_name(s):
                        return re.sub(r'[^a-z0-9]', '', s.lower().replace('sub fund', '').replace('sub-fund', '').replace('fund', '').replace('index', '').replace('tracker', '').replace('plan', ''))
                    
                    # For normal funds fallback
                    if normalize_name(db_fund_name) == normalize_name(row["name"]) or db_fund_name in row["name"] or row["name"] in db_fund_name:
                        # only if it's very close or normalized match
                        if len(db_fund_name) > 5 and len(row["name"]) > 5:
                            mapped_fund_id = db_fund_id
                            break
                
                if mapped_fund_id:
                    try:
                        nav_price = float(row['nav'].replace(',', ''))
                        
                        yesterday_entry = db.query(FundNAVHistory).filter(
                            FundNAVHistory.fund_id == mapped_fund_id
                        ).order_by(FundNAVHistory.date.desc()).first()
                        
                        def parse_percentage(val_str):
                            try:
                                val = val_str.replace('%', '').replace(',', '').replace('(', '-').replace(')', '').strip() if val_str else None
                                return float(val) if val and val != 'N/A' else 0.0
                            except:
                                return 0.0

                        mapped_fund = db.query(Fund).filter(Fund.id == mapped_fund_id).first()
                        fund_cat = mapped_fund.category.lower() if mapped_fund and mapped_fund.category else ""
                        is_equity_type = any(k in fund_cat for k in ['equity', 'stock', 'gold', 'asset'])
                        
                        # Check to prevent duplicate daily entries
                        existing = db.query(FundNAVHistory).filter(
                             FundNAVHistory.fund_id == mapped_fund_id, 
                             FundNAVHistory.date == today
                        ).first()
                        
                        if not existing:
                            nav_entry = FundNAVHistory(
                                fund_id=mapped_fund_id,
                                date=today,
                                nav_price=nav_price
                            )
                            db.add(nav_entry)
                        
                        existing_metrics = db.query(FundPerformanceMetrics).filter(
                            FundPerformanceMetrics.fund_id == mapped_fund_id,
                            FundPerformanceMetrics.date == today
                        ).first()
                        
                        if not existing_metrics:        
                            perf_entry = FundPerformanceMetrics(
                                 fund_id=mapped_fund_id,
                                 date=today,
                                 return_1m=parse_percentage(row['mtd']),
                                 return_6m=parse_percentage(row['180_days']),
                                 return_1y=parse_percentage(row['365_days']),
                                 return_ytd=parse_percentage(row['ytd'])
                            )
                            db.add(perf_entry)
                        
                        processed_count += 1
                    except Exception as e:
                        logger.error(f"Error parsing row for {fund_name}: {e}")

            if processed_count > 0:
                db.commit()
                logger.info(f"Successfully scraped and updated {processed_count} funds.")
                
                # Update is_active for stale/matured funds
                try:
                    from datetime import timedelta
                    stale_cutoff = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
                    all_funds_db = db.query(Fund).filter(Fund.is_active == True).all()
                    for fb in all_funds_db:
                        latest_nav = db.query(FundNAVHistory).filter(FundNAVHistory.fund_id == fb.id).order_by(FundNAVHistory.date.desc()).first()
                        if latest_nav and latest_nav.date < stale_cutoff:
                            logger.info(f"Marking fund {fb.name} as inactive (last seen {latest_nav.date})")
                            fb.is_active = False
                    db.commit()
                except Exception as e:
                    logger.error(f"Error marking inactive funds: {e}")
                _set_status(True, None)
            else:
                logger.warning("No new matching funds were processed today.")
                _set_status(True, "No matching funds processed.")
                
        finally:
             db.close()
             
    except Exception as e:
        logger.error(f"Failed to scrape MUFAP: {e}")
        _set_status(False, str(e))
        db.close()
        
if __name__ == "__main__":
    scrape_mufap_data()

