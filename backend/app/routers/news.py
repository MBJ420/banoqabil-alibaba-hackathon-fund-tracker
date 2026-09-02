"""
routers/news.py
────────────────
FastAPI router for all news intelligence endpoints.

Endpoints:
  GET  /news/feed              → Cached NewsArticle rows (7-day window)
  GET  /news/prediction        → Latest AssetPrediction rows per asset class
  GET  /news/status            → {status, last_refreshed_at}
  GET  /news/context           → Active WorldContextEntry rows
  POST /news/refresh           → Triggers background refresh (non-blocking, < 1ms response)
  DELETE /news/context/{id}    → Admin: manually deactivate a context entry
"""

import threading
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session


from app.database import get_db
from app.models import NewsArticle, AssetPrediction, WorldContextEntry, NewsMetadata, ScraperStatus
from app.services.news_service import run_news_pipeline, run_ai_pipeline
from app.services.llm_service import generate_json, get_active_ai_provider
import os
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/news", tags=["News Intelligence"])

# Live background thread tracking
_news_thread: threading.Thread | None = None
_ai_thread: threading.Thread | None = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_create_meta(db: Session) -> NewsMetadata:
    meta = db.query(NewsMetadata).first()
    if not meta:
        meta = NewsMetadata(refresh_status="idle", ai_status="idle")
        db.add(meta)
        db.commit()
        db.refresh(meta)
    return meta


def _format_dt(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


@router.get("/status")
def get_news_status(db: Session = Depends(get_db)):
    """Returns the current refresh status and timestamp."""
    global _news_thread, _ai_thread
    meta = _get_or_create_meta(db)

    # Sync live thread status
    is_news_running = _news_thread is not None and _news_thread.is_alive()
    is_ai_running = _ai_thread is not None and _ai_thread.is_alive()

    # If background thread is running, guarantee status reflects it
    if is_ai_running:
        ai_stat = "analyzing"
    elif meta.ai_status == "analyzing":
        # Thread has finished or died, sync DB back to idle
        meta.ai_status = "idle"
        db.commit()
        ai_stat = "idle"
    else:
        ai_stat = meta.ai_status

    if is_news_running:
        news_stat = "refreshing"
    elif meta.refresh_status == "refreshing":
        meta.refresh_status = "idle"
        db.commit()
        news_stat = "idle"
    else:
        news_stat = meta.refresh_status

    return {
        "status":            news_stat,
        "last_refreshed_at": _format_dt(meta.last_refreshed_at),
        "error_message":     meta.error_message,
        "ai_status":         ai_stat,
        "last_ai_refreshed_at": _format_dt(meta.last_ai_refreshed_at),
        "ai_error_message":  meta.ai_error_message,
    }




# ─── GET /news/scrapers/status ────────────────────────────────────────────────

@router.get("/scrapers/status")
def get_scraper_health(db: Session = Depends(get_db)):
    """Returns the health status of all tracked scrapers in the system."""
    scrapers = db.query(ScraperStatus).all()
    return [
        {
            "scraper_name":         s.scraper_name,
            "is_healthy":           s.is_healthy,
            "requires_maintenance": s.requires_maintenance,
            "last_run_at":          _format_dt(s.last_run_at),
            "error_message":        s.error_message,
        }
        for s in scrapers
    ]


# ─── GET /news/feed ───────────────────────────────────────────────────────────

@router.get("/feed")
def get_news_feed(
    tag: str | None = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Returns cached news articles sorted by published_at descending.
    Optionally filter by ?tag=PSX (case-insensitive).
    """
    query = db.query(NewsArticle).order_by(NewsArticle.published_at.desc())
    articles = query.all()

    if tag:
        tag_lower = tag.lower()
        articles = [a for a in articles if a.tags and any(t.lower() == tag_lower for t in a.tags)]

    articles = articles[:limit]

    return [
        {
            "id":           a.id,
            "title":        a.title,
            "url":          a.url,
            "source":       a.source,
            "published_at": _format_dt(a.published_at),
            "summary":      a.summary,
            "tags":         a.tags or [],
            "relevance_score": a.relevance_score,
            "scraped_at":   _format_dt(a.scraped_at),
        }
        for a in articles
    ]


# ─── GET /news/prediction ─────────────────────────────────────────────────────

@router.get("/prediction")
def get_news_predictions(db: Session = Depends(get_db)):
    """
    Returns the latest Gemini predictions for all asset classes.
    Grouped by asset_class in a dict for easy frontend consumption.
    """
    # Get the most recent generated_at timestamp
    latest_pred = db.query(AssetPrediction).order_by(AssetPrediction.generated_at.desc()).first()
    if not latest_pred:
        return {"generated_at": None, "predictions": {}}

    latest_time = latest_pred.generated_at

    # Fetch all predictions from that batch
    preds = db.query(AssetPrediction).filter(
        AssetPrediction.generated_at == latest_time
    ).all()

    result = {}
    for p in preds:
        result[p.asset_class] = {
            "short":    p.short_impact,
            "medium":   p.medium_impact,
            "long":     p.long_impact,
            "reasoning": p.reasoning,
        }

    return {
        "generated_at": _format_dt(latest_time),
        "predictions":  result,
        "ai_provider":  get_active_ai_provider(),
    }


# ─── GET /news/provider ───────────────────────────────────────────────────────

@router.get("/provider")
def get_ai_provider_info():
    """Returns active AI provider details (Alibaba Cloud Model Studio / Gemini)."""
    return get_active_ai_provider()


# ─── GET /news/context ────────────────────────────────────────────────────────

@router.get("/context")
def get_world_context(db: Session = Depends(get_db)):
    """Returns all active WorldContextEntry rows (Gemini's background knowledge)."""
    entries = db.query(WorldContextEntry)\
        .filter(WorldContextEntry.is_active == True)\
        .order_by(WorldContextEntry.added_at.desc())\
        .all()

    return [
        {
            "id":           e.id,
            "fact":         e.fact,
            "category":     e.category,
            "is_active":    e.is_active,
            "added_at":     _format_dt(e.added_at),
            "impact_scores": e.impact_scores or {},
        }
        for e in entries
    ]


# ─── POST /news/refresh ───────────────────────────────────────────────────────

@router.post("/refresh")
def trigger_news_refresh(force: bool = False, db: Session = Depends(get_db)):
    """
    Spawns a background thread to run the web scraping news pipeline.
    Returns immediately (< 1ms) — never blocks the FastAPI event loop.
    Poll GET /news/status to detect completion.
    """
    global _news_thread
    meta = _get_or_create_meta(db)

    is_running = _news_thread is not None and _news_thread.is_alive()
    if is_running and not force:
        return {"status": "already_refreshing", "message": "A refresh is already in progress."}

    meta.refresh_status = "refreshing"
    meta.error_message = None
    db.commit()

    def _bg_refresh():
        run_news_pipeline(force=force)

    _news_thread = threading.Thread(target=_bg_refresh, daemon=True)
    _news_thread.start()

    logger.info("News refresh triggered in background thread.")
    return {"status": "refreshing", "message": "News refresh started. Poll /news/status for updates."}


# ─── POST /news/refresh-ai ────────────────────────────────────────────────────

@router.post("/refresh-ai")
def trigger_ai_refresh(force: bool = False, db: Session = Depends(get_db)):
    """
    Spawns a background thread to run the AI analysis (Qwen 2.5 / Gemini).
    Returns immediately.
    Poll GET /news/status for ai_status.
    """
    global _ai_thread
    meta = _get_or_create_meta(db)

    is_running = _ai_thread is not None and _ai_thread.is_alive()
    if is_running and not force:
        return {"status": "already_analyzing", "message": "AI analysis is already in progress."}

    meta.ai_status = "analyzing"
    meta.ai_error_message = None
    db.commit()

    def _bg_ai_refresh():
        run_ai_pipeline()

    _ai_thread = threading.Thread(target=_bg_ai_refresh, daemon=True)
    _ai_thread.start()

    logger.info("AI pipeline triggered in background thread.")
    return {"status": "analyzing", "message": "AI analysis started."}




# ─── DELETE /news/context/{id} ────────────────────────────────────────────────

@router.delete("/context/{entry_id}")
def deactivate_context_entry(entry_id: int, db: Session = Depends(get_db)):
    """Admin: manually deactivate (resolve) a World Context entry."""
    entry = db.query(WorldContextEntry).filter(WorldContextEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"WorldContextEntry {entry_id} not found.")

    entry.is_active = False
    entry.resolved_at = datetime.utcnow()
    db.commit()

    return {"status": "success", "message": f"Entry {entry_id} deactivated."}


# ─── POST /news/context/pin/{article_id} ──────────────────────────────────────

@router.post("/context/pin/{article_id}")
def pin_article_to_context(article_id: int, db: Session = Depends(get_db)):
    """User-Curated Context: Force an article into the World Context using Gemini."""
    provider = get_active_ai_provider()
    if provider["status"] == "missing_keys":
        raise HTTPException(status_code=500, detail="AI API Key (DASHSCOPE_API_KEY or GEMINI_API_KEY) missing.")

    article = db.query(NewsArticle).filter(NewsArticle.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found.")

    prompt = f"""
    You are extracting a permanent "World Context" fact from this specific pinned article.
    TITLE: {article.title}
    SUMMARY: {article.summary}
    SOURCE: {article.source}
    
    Provide a concise one-sentence description of the underlying long-term event and guess its impact on PSX.
    Return ONLY a valid JSON object in this format:
    {{
      "fact": "...",
      "category": "Geopolitical | Monetary Policy | Commodities | Trade | Other",
      "impact_scores": {{"PSX": {{"direction": "Bearish/Bullish/Neutral"}}}}
    }}
    """
    try:
        data = generate_json(prompt, temperature=0.2)
        
        wce = WorldContextEntry(
            fact=data.get("fact", article.title),
            category=data.get("category", "Pinned"),
            impact_scores=data.get("impact_scores", {}),
            is_active=True,
            source_article_ids=[article.id]
        )
        db.add(wce)
        db.commit()
        return {"status": "success", "message": "Pinned to World Context."}
    except Exception as e:
        logger.error(f"Failed to pin article {article_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
