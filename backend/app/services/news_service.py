"""
news_service.py
────────────────
Core news orchestrator for Fund Tracker.

Pipeline (runs every 6 hours, or on-demand via POST /news/refresh):
  1. Cache check → skip if last refresh < 6 hours ago
  2. Fetch RSS feeds (Dawn, Business Recorder, The News, Reuters)
  3. Call NewsData.io API (200 req/day free tier)
  4. Call Alpha Vantage Market News API (25 req/day free tier)
  5. Scrape Trading Economics summaries (BeautifulSoup)
  6. Deduplicate by URL hash
  7. Keyword filter (Pakistan finance relevance)
  8. Persist cleaned articles to DB (overwrite NewsArticle table)
  9. Pass to news_ai_analyzer.py → overwrite AssetPrediction table
 10. Update NewsMetadata.last_refreshed_at
"""

import os
import hashlib
import logging
import requests
import feedparser
import json
import socket
from datetime import datetime, timedelta, timezone

# Set global socket timeout (e.g., 20s) to prevent feedparser from hanging indefinitely
socket.setdefaulttimeout(20)
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.database import SessionLocal
from app.models import NewsArticle, NewsMetadata, ScraperStatus
from app.services.news_ai_analyzer import run_gemini_analysis

load_dotenv()
logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────

NEWSDATA_API_KEY  = os.environ.get("NEWSDATA_API_KEY", "")
ALPHA_VANTAGE_KEY = os.environ.get("ALPHA_VANTAGE_KEY", "")

REFRESH_INTERVAL_HOURS = 6

RSS_FEEDS = [
    {"url": "https://www.brecorder.com/feeds/",             "source": "Business Recorder"},
    {"url": "https://www.dawn.com/feeds/business-finance",  "source": "Dawn Business"},
    {"url": "https://www.thenews.com.pk/rss/1/5",           "source": "The News International"},
    {"url": "https://feeds.reuters.com/reuters/businessNews","source": "Reuters Markets"},
]

KEYWORDS = [
    "pakistan", "psx", "kse", "karachi stock", "sbp", "mufap", "rupee",
    "inflation", "interest rate", "policy rate", "gold", "silver", "mining",
    "commodities", "mutual fund", "asset management", "amc", "equity fund",
    "money market", "conflict", "war", "sanctions", "oil price",
    "middle east", "russia", "cpec", "imf", "forex", "dollar",
    "middle east oil", "maritime security", "cpec security", "regional conflict", 
    "central bank", "t-bill auction"
]

TRADING_ECONOMICS_PAGES = [
    {"url": "https://tradingeconomics.com/pakistan/interest-rate", "label": "Pakistan Interest Rate"},
    {"url": "https://tradingeconomics.com/commodity/gold",          "label": "Gold Price"},
    {"url": "https://tradingeconomics.com/commodity/silver",        "label": "Silver Price"},
]

def _set_scraper_status(db: Session, name: str, is_healthy: bool, error_msg: str = None, fix_req: bool = False):
    try:
        status = db.query(ScraperStatus).filter(ScraperStatus.scraper_name == name).first()
        if not status:
            status = ScraperStatus(scraper_name=name)
            db.add(status)
        status.is_healthy = is_healthy
        status.error_message = error_msg
        status.requires_maintenance = fix_req
        status.last_run_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        logger.error(f"Failed to update ScraperStatus for {name}: {e}")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _url_hash(url: str) -> str:
    return hashlib.md5(url.strip().encode()).hexdigest()

def _strip_html(text: str) -> str:
    if not text: return ""
    try:
        return BeautifulSoup(text, "html.parser").get_text(separator=" ", strip=True)
    except Exception:
        return text.strip()


def _is_relevant(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in KEYWORDS)


def _is_within_7_days(dt: datetime | None) -> bool:
    if dt is None:
        return True  # keep if no date (better to include than exclude)
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    # Handle timezone-naive datetimes
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt >= cutoff


def _extract_tags(text: str) -> list[str]:
    """Return a list of matched keyword tags for pill badges in the frontend."""
    tag_map = {
        "psx": "PSX", "kse": "PSX", "karachi stock": "PSX",
        "sbp": "SBP", "state bank": "SBP",
        "gold": "Gold", "silver": "Silver",
        "rupee": "Rupee", "forex": "Forex", "dollar": "Forex",
        "inflation": "Inflation", "interest rate": "Interest Rate",
        "oil": "Oil", "commodities": "Commodities",
        "imf": "IMF", "cpec": "CPEC",
        "mutual fund": "Mutual Fund", "mufap": "MUFAP",
        "equity fund": "Equity", "money market": "Money Market",
        "war": "Geopolitical", "conflict": "Geopolitical", "sanctions": "Sanctions",
        "pakistan": "Pakistan",
    }
    t = text.lower()
    found = []
    for kw, tag in tag_map.items():
        if kw in t and tag not in found:
            found.append(tag)
    return found[:6]  # cap at 6 tags per article


def _safe_parse_date(entry: dict) -> datetime | None:
    import time as _time
    try:
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
    except Exception:
        pass
    return None


def _scrape_article_fallback(url: str) -> str | None:
    """Scrape first 3 paragraphs from an article if RSS description is too short."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; FundTrackerBot/1.0)"}
        r = requests.get(url, timeout=8, headers=headers)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        paragraphs = soup.find_all("p")
        text_parts = []
        for p in paragraphs[:5]:
            t = p.get_text(strip=True)
            if len(t) > 40:
                text_parts.append(t)
            if len(text_parts) >= 3:
                break
        return " ".join(text_parts) if text_parts else None
    except Exception:
        return None


# ─── Fetchers ─────────────────────────────────────────────────────────────────

def _fetch_rss(seen_urls: set) -> list[dict]:
    articles = []
    for feed_cfg in RSS_FEEDS:
        try:
            feed = feedparser.parse(feed_cfg["url"])
            for entry in feed.entries:
                url = getattr(entry, "link", "").strip()
                if not url or url in seen_urls:
                    continue

                title   = getattr(entry, "title", "").strip()
                desc    = getattr(entry, "summary", "") or getattr(entry, "description", "") or ""
                pub_dt  = _safe_parse_date(entry)

                if not _is_within_7_days(pub_dt):
                    continue
                if not _is_relevant(title + " " + desc):
                    continue

                # 2-tier extraction: fallback to scrape if description is thin
                summary = _strip_html(desc)
                if len(summary) < 80:
                    scraped = _scrape_article_fallback(url)
                    if scraped:
                        summary = scraped

                seen_urls.add(url)
                title_clean = _strip_html(title)
                articles.append({
                    "title":        title_clean,
                    "url":          url,
                    "source":       feed_cfg["source"],
                    "published_at": pub_dt,
                    "summary":      summary[:1200],
                    "tags":         _extract_tags(title_clean + " " + summary),
                    "relevance_score": 1.0 if _is_relevant(title_clean) else 0.6,
                })
        except Exception as e:
            logger.warning(f"RSS fetch failed for {feed_cfg['source']}: {e}")
    return articles


def _fetch_newsdata(seen_urls: set) -> list[dict]:
    if not NEWSDATA_API_KEY:
        logger.info("NewsData.io key not set — skipping.")
        return []
    articles = []
    try:
        params = {
            "apikey":   NEWSDATA_API_KEY,
            "q":        "Pakistan finance OR PSX OR gold OR rupee OR SBP",
            "language": "en",
            "category": "business",
        }
        r = requests.get("https://newsdata.io/api/1/news", params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        for item in data.get("results", []):
            url = (item.get("link") or "").strip()
            if not url or url in seen_urls:
                continue
            title   = _strip_html((item.get("title") or "").strip())
            content = _strip_html((item.get("content") or item.get("description") or "").strip())
            summary = content[:600]  # cap at 300 words ~ 600 chars
            pub_str = item.get("pubDate", "")
            try:
                pub_dt = datetime.strptime(pub_str[:19], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except Exception:
                pub_dt = None

            if not _is_within_7_days(pub_dt):
                continue
            if not _is_relevant(title + " " + summary):
                continue

            seen_urls.add(url)
            articles.append({
                "title":        title,
                "url":          url,
                "source":       "NewsData.io",
                "published_at": pub_dt,
                "summary":      summary,
                "tags":         _extract_tags(title + " " + summary),
                "relevance_score": 0.9,
            })
    except Exception as e:
        logger.warning(f"NewsData.io fetch failed: {e}")
    return articles


def _fetch_alpha_vantage(seen_urls: set) -> list[dict]:
    if not ALPHA_VANTAGE_KEY:
        logger.info("Alpha Vantage key not set — skipping.")
        return []
    articles = []
    try:
        params = {
            "function": "NEWS_SENTIMENT",
            "topics":   "finance,economy_fiscal,gold,commodities",
            "apikey":   ALPHA_VANTAGE_KEY,
            "limit":    10,
        }
        r = requests.get("https://www.alphavantage.co/query", params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        for item in data.get("feed", []):
            url = (item.get("url") or "").strip()
            if not url or url in seen_urls:
                continue
            title   = _strip_html((item.get("title") or "").strip())
            summary = _strip_html((item.get("summary") or "").strip())[:600]
            pub_str = item.get("time_published", "")
            try:
                pub_dt = datetime.strptime(pub_str[:15], "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
            except Exception:
                pub_dt = None

            if not _is_within_7_days(pub_dt):
                continue
            if not _is_relevant(title + " " + summary):
                continue

            seen_urls.add(url)
            articles.append({
                "title":        title,
                "url":          url,
                "source":       "Alpha Vantage",
                "published_at": pub_dt,
                "summary":      summary,
                "tags":         _extract_tags(title + " " + summary),
                "relevance_score": 0.85,
            })
    except Exception as e:
        logger.warning(f"Alpha Vantage fetch failed: {e}")
    return articles


import re

def _scrape_trading_economics(db: Session) -> list[str]:
    """
    Scrape expert economic summaries from Trading Economics for use as
    supplementary context in the Gemini prompt (labeled [Expert Analysis]).
    """
    summaries = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; FundTrackerBot/1.0)"}
    for page in TRADING_ECONOMICS_PAGES:
        try:
            r = requests.get(page["url"], timeout=12, headers=headers)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            # Trading Economics renders summary text in <p> tags in the main article
            paragraphs = soup.find_all("p")
            text_parts = []
            for p in paragraphs[:4]:
                t = p.get_text(strip=True)
                if len(t) > 60:
                    text_parts.append(t)
                if len(text_parts) >= 2:
                    break
            if text_parts:
                combined = " ".join(text_parts)[:500]
                summaries.append(f"[Expert Analysis] {page['label']}: {combined}")
        except Exception as e:
            logger.warning(f"Trading Economics scrape failed for {page['label']}: {e}")
            _set_scraper_status(db, f"trading_economics_{page['label'].split()[0].lower()}", False, str(e), fix_req=True)
            continue
        _set_scraper_status(db, f"trading_economics_{page['label'].split()[0].lower()}", True)
    return summaries


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def run_news_pipeline(force: bool = False):
    """
    News fetch pipeline. Scrapes web sources and updates DB.
    Designed to be called from a background thread.
    """
    db: Session = SessionLocal()
    try:
        # 1. Cache check
        meta = db.query(NewsMetadata).first()
        if not meta:
            meta = NewsMetadata(refresh_status="idle", ai_status="idle")
            db.add(meta)
            db.commit()
            db.refresh(meta)

        if not force and meta.last_refreshed_at:
            age = datetime.utcnow() - meta.last_refreshed_at
            if age < timedelta(hours=REFRESH_INTERVAL_HOURS):
                logger.info(f"News cache is fresh ({age}). Skipping pipeline.")
                return

        meta.refresh_status = "refreshing"
        meta.error_message = None
        db.commit()

        logger.info("Starting news pipeline...")

        # 2-4. Fetch from all sources
        seen_urls: set = set()
        all_articles: list[dict] = []
        all_articles.extend(_fetch_rss(seen_urls))
        all_articles.extend(_fetch_newsdata(seen_urls))
        all_articles.extend(_fetch_alpha_vantage(seen_urls))

        logger.info(f"Fetched {len(all_articles)} unique relevant articles.")

        # Overwrite NewsArticle table (keep WorldContextEntry untouched)
        db.query(NewsArticle).delete()
        db.commit()

        committed_articles = []
        for art in all_articles:
            try:
                article_obj = NewsArticle(
                    title=art["title"],
                    url=art["url"],
                    source=art["source"],
                    published_at=art.get("published_at"),
                    summary=art.get("summary"),
                    tags=art.get("tags", []),
                    relevance_score=art.get("relevance_score", 0.5),
                )
                db.add(article_obj)
                db.flush()
                committed_articles.append(article_obj)
            except Exception as e:
                logger.warning(f"Skipping duplicate article: {art.get('url')} — {e}")
                db.rollback()

        db.commit()

        # Update metadata
        meta.last_refreshed_at = datetime.utcnow()
        meta.refresh_status = "idle"
        db.commit()
        logger.info("News pipeline completed successfully.")

    except Exception as e:
        logger.error(f"News pipeline failed: {e}", exc_info=True)
        try:
            meta = db.query(NewsMetadata).first()
            if meta:
                meta.refresh_status = "error"
                meta.error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def run_ai_pipeline():
    """
    AI specific pipeline. Reads DB articles, scrapes Trading Economics, calls Gemini.
    """
    db: Session = SessionLocal()
    try:
        meta = db.query(NewsMetadata).first()
        if not meta:
            meta = NewsMetadata(refresh_status="idle", ai_status="idle")
            db.add(meta)
            db.commit()
            db.refresh(meta)

        meta.ai_status = "analyzing"
        meta.ai_error_message = None
        db.commit()

        logger.info("Starting AI pipeline...")

        # Scrape Trading Economics expert context
        te_summaries = _scrape_trading_economics(db)
        logger.info(f"Scraped {len(te_summaries)} Trading Economics summaries.")

        articles = db.query(NewsArticle).order_by(NewsArticle.published_at.desc()).all()

        if articles:
            run_gemini_analysis(db, articles, te_summaries)
        else:
            logger.warning("No articles found in DB — skipping Gemini analysis.")

        # Update metadata
        meta.last_ai_refreshed_at = datetime.utcnow()
        meta.ai_status = "idle"
        db.commit()
        logger.info("AI pipeline completed successfully.")

    except Exception as e:
        logger.error(f"AI pipeline failed: {e}", exc_info=True)
        try:
            meta = db.query(NewsMetadata).first()
            if meta:
                meta.ai_status = "error"
                meta.ai_error_message = str(e)[:500]
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
