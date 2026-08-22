"""
news_ai_analyzer.py
────────────────────
Gemini AI analysis for fund-relevant news using a 2-pass architecture:

  Pass 1 — World Context Manager:
    Gemini reviews existing active WorldContextEntry rows + new articles.
    Decides: KEEP / AMEND (update text) / RESOLVE (mark inactive) / ADD (new entry).

  Pass 2 — Asset Impact Analysis:
    Gemini receives: World Context + today's filtered news + Trading Economics expert data.
    Outputs: Per-asset (PSX, Gold, Silver, Money Market, Equity, Bonds, Debt)
             × 3 time horizons (short, medium, long)
             × { score: 0-10, direction: Bullish|Bearish|Neutral, reason: str }
"""

import os
import json
import time
import logging
from datetime import datetime
import google.generativeai as genai
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.models import AssetPrediction, WorldContextEntry, NewsArticle

load_dotenv()
logger = logging.getLogger(__name__)

genai.configure(api_key=os.environ.get("GEMINI_API_KEY", ""))

ASSET_CLASSES = ["Money Market", "Income Funds", "Gold", "Silver", "PSX Stocks (Equity Funds)"]


def _format_articles_for_prompt(articles: list) -> str:
    """Format article list into compact, token-efficient prompt blocks."""
    blocks = []
    for i, art in enumerate(articles[:20], 1):  # cap at 20 articles per call to stay within free-tier limits
        pub = art.published_at.strftime("%Y-%m-%d") if art.published_at else "Unknown date"
        block = (
            f"[{i}] SOURCE: {art.source} | DATE: {pub}\n"
            f"TITLE: {art.title}\n"
            f"SUMMARY: {(art.summary or 'No summary available.')[:400]}"
        )
        blocks.append(block)
    return "\n\n".join(blocks)


def _format_world_context_for_prompt(entries: list) -> str:
    """Format active WorldContextEntry rows into a compact prompt section."""
    if not entries:
        return "No active world context entries yet."
    lines = []
    for e in entries:
        lines.append(f"[ID:{e.id}] [{e.category or 'General'}] {e.fact}")
    return "\n".join(lines)


def _clean_json(text: str) -> str:
    """Strip markdown code fences if Gemini ignored formatting instructions."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


# ─── Pass 1: World Context Manager ────────────────────────────────────────────

def _run_world_context_pass(db: Session, articles: list, model) -> None:
    """
    Ask Gemini to review existing PWC entries + new articles.
    Returns update instructions and applies them to WorldContextEntry table.
    """
    active_entries = db.query(WorldContextEntry).filter(WorldContextEntry.is_active == True).all()

    prompt = f"""You are a geopolitical and macroeconomic expert advising Pakistani mutual fund investors.

CURRENT WORLD CONTEXT (active long-term events):
{_format_world_context_for_prompt(active_entries)}

NEW ARTICLES (published in the last 7 days):
{_format_articles_for_prompt(articles)}

Your task:
1. For each active context entry (by ID), you MUST critically evaluate if the new articles change the situation. Decide:
   - "KEEP" — the event is still ongoing exactly as described, and the new articles add NO major new information.
   - "AMEND" — the new articles provide a major update, escalation, or shift regarding this event. You MUST provide the updated, synthesized text.
   - "RESOLVE" — the new articles indicate this event has concluded, stabilized, or is no longer a major market driver.

   CRITICAL RULE for existing context: DO NOT passively "KEEP" events if the situation has fundamentally changed, escalated, or resolved in the new articles. Aggressively AMEND or RESOLVE them.

2. From the new articles, identify any NEW long-term events that qualify as persistent World Context.
   A qualifying event must satisfy ALL of these:
   - Have market impact lasting more than 30 days
   - Affect commodity prices, interest rates, or Pakistan's political risk premium
   - Be a concrete policy/event (not a single-day market move or opinion)
   
   CRITICAL PRIORITY:
   - Always prioritize articles labeled as "SOURCE: State Bank of Pakistan" or "SOURCE: IMF Pakistan". These are Source-of-Truth.
   - For geopolitical events (e.g., Middle East, Oil shocks, regional conflict), evaluate them strictly on how they affect Pakistan's balance of payments, inflation, or trade routes.
   - For regular news (Dawn, Reuters, etc.), do NOT create a new context entry unless the exact same systemic event is mentioned in at least 2 different articles (Cross-Verification rule to prevent noise).

Return ONLY a valid JSON object in this exact format (no markdown, no extra text):
{{
  "updates": [
    {{"id": 1, "action": "KEEP"}},
    {{"id": 2, "action": "AMEND", "new_fact": "Updated text here reflecting the newest developments"}},
    {{"id": 3, "action": "RESOLVE"}}
  ],
  "new_entries": [
    {{
      "fact": "Concise one-sentence description of the new long-term event",
      "category": "Geopolitical | Monetary Policy | Commodities | Trade | Other",
      "impact_scores": {{
        "PSX": {{"direction": "Bearish"}},
        "Gold": {{"direction": "Bullish"}},
        "Silver": {{"direction": "Neutral"}}
      }}
    }}
  ]
}}"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(temperature=0.2)
        )
        data = json.loads(_clean_json(response.text))

        # Apply updates
        for upd in data.get("updates", []):
            entry_id = upd.get("id")
            action = upd.get("action", "KEEP")
            entry = db.query(WorldContextEntry).filter(WorldContextEntry.id == entry_id).first()
            if not entry:
                continue
            if action == "AMEND":
                entry.fact = upd.get("new_fact", entry.fact)
                # Bump the added_at timestamp so the UI shows it as recently updated
                entry.added_at = datetime.utcnow()
            elif action == "RESOLVE":
                entry.is_active = False
                entry.resolved_at = datetime.utcnow()

        # Add new entries
        for new_e in data.get("new_entries", []):
            fact = new_e.get("fact", "").strip()
            if not fact:
                continue
            wce = WorldContextEntry(
                fact=fact,
                category=new_e.get("category"),
                impact_scores=new_e.get("impact_scores"),
                is_active=True,
            )
            db.add(wce)

        db.commit()
        logger.info("World Context Manager pass complete.")

    except Exception as e:
        logger.error(f"World Context Manager pass failed: {e}")


# ─── Pass 2: Asset Impact Analysis ────────────────────────────────────────────

def _run_asset_analysis_pass(db: Session, articles: list, te_summaries: list[str], model) -> None:
    """
    Ask Gemini to rate the impact of current news on each asset class.
    Stores results in the AssetPrediction table (overwrites previous batch).
    """
    active_context = db.query(WorldContextEntry).filter(WorldContextEntry.is_active == True).all()
    asset_list_str = ", ".join(ASSET_CLASSES)
    expert_data_str = "\n".join(te_summaries) if te_summaries else "No expert data available."

    prompt = f"""You are a senior Pakistan investment analyst advising retail mutual fund investors.

WORLD CONTEXT (persistent long-term events affecting markets):
{_format_world_context_for_prompt(active_context)}

TODAY'S NEWS ARTICLES:
{_format_articles_for_prompt(articles)}

EXPERT ECONOMIC DATA:
{expert_data_str}

Your task:
For EACH of the following asset classes: {asset_list_str}

Provide:
1. SHORT-TERM impact (next few days): score -10 to 10, direction (Bullish/Bearish/Neutral), detailed 3-4 sentence elaboration
2. MEDIUM-TERM impact (1-3 months): score -10 to 10, direction, detailed 3-4 sentence elaboration  
3. LONG-TERM impact (1+ year): score -10 to 10, direction, detailed 3-4 sentence elaboration

Score guide: Negative score (-1 to -10) = negative impact, 0 = neutral, Positive score (1 to 10) = positive impact. The greater the magnitude, the greater the severity of the impact.
Direction = Bullish means positive for investors, Bearish means negative, Neutral means mixed/unclear

Return ONLY a valid JSON object (no markdown, no extra text):
{{
  "PSX Stocks (Equity Funds)": {{
    "short": {{"score": -6, "direction": "Bearish", "reason": "Rising interest rate expectations materially reduce equity valuations as the discount rate climbs. This makes fixed-income alternatives substantially more attractive to institutional and retail investors alike. The resulting capital flight will likely depress stock prices over the next few days. Investors should prepare for heightened market volatility and downward pressure."}},
    "medium": {{"score": 0, "direction": "Neutral", "reason": "The rate hike cycle is widely expected to peak within the next three months stabilizing market jitters. Corporate earnings may begin to adjust to the higher cost of capital reducing bearish momentum. Market sentiment will largely depend on forward-looking inflation indicators. Consequently, equities are likely to trade sideways."}},
    "long": {{"score": 8, "direction": "Bullish", "reason": "Economic stabilization and eventual monetary easing typically follow strict rate normalization policies. Lower future rates will massively boost corporate profitability and expand equity multiples. Institutional investors will rotate back into growth assets. This creates a highly favorable environment for stock accumulation over a horizon longer than a year."}}
  }},
  "Money Market": {{
    "short": {{"score": 7, "direction": "Bullish", "reason": "Abnormally high interest rates immediately benefit money market returns without capital risk. Funds invested in these short-term instruments will capture peak yields immediately. Liquidity remains paramount in an uncertain economic environment. This is the optimal safe haven for the immediate term."}},
    "medium": {{"score": 7, "direction": "Bullish", "reason": "Rates are projected to remain elevated, providing sustained and virtually risk-free high yields. Inflationary pressures dictate that central banks cannot cut rates prematurely. Compounding interest during this period will significantly boost total returns. Investors should heavily overweight this asset class."}},
    "long": {{"score": 4, "direction": "Bullish", "reason": "Eventual rate cuts will predictably lower absolute yields as macroeconomic conditions normalize. However, the asset class retains its core appeal for capital preservation and liquidity. Reinvestment risk will rise, meaning future yields won't match current peaks. It remains a positive holding but with diminishing relative returns."}}
  }}
}}
CRITICAL: You MUST include ALL {len(ASSET_CLASSES)} asset classes exactly as named here: {asset_list_str}. Do not omit any asset class from the final JSON."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                response_mime_type="application/json"
            )
        )
        data = json.loads(response.text)

        # Overwrite previous predictions
        db.query(AssetPrediction).delete()
        db.commit()

        article_ids = [a.id for a in articles]
        now = datetime.utcnow()

        for asset_class in ASSET_CLASSES:
            asset_data = data.get(asset_class)
            if not asset_data:
                logger.warning(f"No prediction returned for {asset_class}")
                continue

            short_data  = asset_data.get("short", {})
            medium_data = asset_data.get("medium", {})
            long_data   = asset_data.get("long", {})

            prediction = AssetPrediction(
                asset_class=asset_class,
                generated_at=now,
                short_impact=short_data,
                medium_impact=medium_data,
                long_impact=long_data,
                reasoning=short_data.get("reason", ""),
                news_article_ids=article_ids,
            )
            db.add(prediction)

        db.commit()
        logger.info(f"Asset impact predictions saved for {len(ASSET_CLASSES)} asset classes.")

    except Exception as e:
        logger.error(f"Asset Analysis pass failed: {e}")


# ─── Public Entry Point ────────────────────────────────────────────────────────

def run_gemini_analysis(db: Session, articles: list, te_summaries: list[str]) -> None:
    """
    Runs both Gemini passes sequentially:
    Pass 1 → World Context Manager
    Pass 2 → Asset Impact Analysis
    """
    if not os.environ.get("GEMINI_API_KEY"):
        logger.error("GEMINI_API_KEY not set — skipping Gemini analysis.")
        return

    if not articles:
        logger.info("No articles to analyze — skipping Gemini.")
        return

    logger.info(f"Starting Gemini analysis on {len(articles)} articles...")

    model = genai.GenerativeModel(model_name="gemini-flash-latest")

    # Pass max 15 articles to World Context to prevent API hangs
    _run_world_context_pass(db, articles[:15], model)

    # To avoid '429 ResourceExhausted' tokens-per-minute limits on the free tier, pause briefly
    logger.info("Pausing 15 seconds to respect Gemini API rate limits...")
    time.sleep(15)

    _run_asset_analysis_pass(db, articles, te_summaries, model)

    logger.info("Gemini 2-pass analysis complete.")
