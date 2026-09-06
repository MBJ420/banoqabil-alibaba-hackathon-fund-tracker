"""
portfolio_ai_service.py
────────────────────────
Assembles a privacy-safe portfolio snapshot and feeds it to Qwen 2.5
for a structured AI diagnostic: risk score, narrative, and rebalancing recs.

Privacy contract enforced here (not in prompt):
  ✅ Sent:  % allocations, fund names, category names, bank names, % returns,
            username (self-chosen login handle), live macro context
  ❌ Never: absolute PKR amounts, holder_name from PDF, account_number, net worth
"""

import json
import logging
from collections import defaultdict
from sqlalchemy.orm import Session

from app.models import (
    Portfolio, Statement, WorldContextEntry, AssetPrediction
)
from app.services.llm_service import generate_json, generate_text, get_active_ai_provider

logger = logging.getLogger(__name__)

# ── Macro context asset class map (matches AssetPrediction.asset_class values)
PORTFOLIO_TO_PREDICTION_MAP = {
    "money market":   "Money Market",
    "income funds":   "Income Funds",
    "debt market":    "Income Funds",
    "stocks":         "PSX Stocks (Equity Funds)",
    "equity":         "PSX Stocks (Equity Funds)",
    "gold":           "Gold",
    "silver":         "Silver",
}


def _get_latest_statements(db: Session, user_id: int):
    """Pull the most recent statement per portfolio for this user."""
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == user_id).all()
    if not portfolios:
        return [], []

    portfolio_ids = [p.id for p in portfolios]
    all_stmts = db.query(Statement).filter(
        Statement.portfolio_id.in_(portfolio_ids)
    ).all()

    latest: dict[int, Statement] = {}
    for stmt in all_stmts:
        pid = stmt.portfolio_id
        if pid not in latest or stmt.date > latest[pid].date:
            latest[pid] = stmt

    portfolio_map = {p.id: p for p in portfolios}
    return list(latest.values()), portfolio_map


def _categorize(raw_cat: str) -> str:
    c = raw_cat.lower()
    if "money" in c or "cash" in c:
        return "Money Market"
    if "equity" in c or "stock" in c:
        return "Equity"
    if "debt" in c and "income" in c:
        return "Income Funds"
    if "debt" in c:
        return "Income Funds"
    if "income" in c or "return" in c:
        return "Income Funds"
    if "gold" in c or "commodity" in c:
        return "Gold"
    return "Other"


def build_portfolio_payload(db: Session, user_id: int, username: str) -> dict | None:
    """
    Reads the user's latest statements and returns the sanitized payload
    to be fed to Qwen 2.5. Returns None if no portfolio data exists.
    """
    statements, portfolio_map = _get_latest_statements(db, user_id)
    if not statements:
        return None

    # ── Aggregate % values only — no absolute amounts ever leave this function
    total_value = 0.0
    bank_totals: dict[str, float]     = defaultdict(float)
    category_totals: dict[str, float] = defaultdict(float)
    holdings_raw: list[dict]          = []

    for stmt in statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        portfolio = portfolio_map.get(stmt.portfolio_id)
        bank_name = portfolio.bank.name if portfolio and portfolio.bank else "Unknown"

        for h in raw.get("holdings", []):
            val   = h.get("market_value", 0.0)
            gain  = h.get("gain_loss", 0.0)
            invested = val - gain
            cat   = _categorize(h.get("category", "Other"))

            total_value         += val
            bank_totals[bank_name] += val
            category_totals[cat]   += val

            holdings_raw.append({
                "fund_name":    h.get("fund_name", "Unknown"),
                "bank":         bank_name,
                "category":     cat,
                "_value":       val,     # temporary — stripped before AI call
                "_invested":    max(invested, 0.0),
                "_gain":        gain,
                "return_1m_pct":  h.get("percent_change", 0.0),  # from statement
                "return_6m_pct":  None,
                "return_1y_pct":  None,
            })

    if total_value == 0:
        return None

    # ── Convert to % allocations
    bank_concentration = [
        {"bank": b, "allocation_pct": round(v / total_value * 100, 1)}
        for b, v in sorted(bank_totals.items(), key=lambda x: -x[1])
    ]
    category_allocation = [
        {"category": c, "allocation_pct": round(v / total_value * 100, 1)}
        for c, v in sorted(category_totals.items(), key=lambda x: -x[1])
    ]

    holdings_for_ai = []
    for h in holdings_raw:
        alloc_pct = round(h["_value"] / total_value * 100, 1) if total_value else 0
        invested  = h["_invested"]
        gain      = h["_gain"]
        gain_pct  = round(gain / invested * 100, 1) if invested > 0 else 0.0
        holdings_for_ai.append({
            "fund_name":      h["fund_name"],
            "bank":           h["bank"],
            "category":       h["category"],
            "allocation_pct": alloc_pct,
            "gain_loss_pct":  gain_pct,
            "return_1m_pct":  h["return_1m_pct"],
        })
    # Sort by largest allocation first
    holdings_for_ai.sort(key=lambda x: -x["allocation_pct"])

    overall_gain_pct = 0.0
    total_invested = sum(max(h["_invested"], 0) for h in holdings_raw)
    total_gain     = sum(h["_gain"] for h in holdings_raw)
    if total_invested > 0:
        overall_gain_pct = round(total_gain / total_invested * 100, 2)

    categories = {c["category"].lower() for c in category_allocation}

    # ── Live macro context from WorldContextEntry + AssetPrediction ─────────
    macro_context = _build_macro_context(db, categories)

    return {
        "username": username,
        "portfolio_snapshot": {
            "bank_concentration":   bank_concentration,
            "category_allocation":  category_allocation,
            "holdings":             holdings_for_ai,
            "overall_gain_loss_pct": overall_gain_pct,
            "fund_count":           len(holdings_for_ai),
            "bank_count":           len(bank_concentration),
            "has_equity":           any("equity" in c["category"].lower() or "stock" in c["category"].lower() for c in category_allocation),
            "has_islamic":          any("islamic" in h["fund_name"].lower() or "meezan" in h["bank"].lower() for h in holdings_for_ai),
        },
        "market_context": macro_context,
    }


def _build_macro_context(db: Session, user_categories: set) -> dict:
    """
    Pulls live macro intelligence from:
      - WorldContextEntry: active macro facts (SBP rate, geopolitics, etc.)
      - AssetPrediction:   latest AI impact scores per asset class
    """
    # Active world context entries
    world_facts = db.query(WorldContextEntry).filter(
        WorldContextEntry.is_active == True
    ).order_by(WorldContextEntry.added_at.desc()).limit(10).all()

    facts = [f"{e.category or 'General'}: {e.fact}" for e in world_facts]

    # Latest asset predictions for asset classes the user actually holds
    relevant_asset_classes = set()
    for cat in user_categories:
        mapped = PORTFOLIO_TO_PREDICTION_MAP.get(cat)
        if mapped:
            relevant_asset_classes.add(mapped)

    predictions = []
    if relevant_asset_classes:
        all_preds = db.query(AssetPrediction).filter(
            AssetPrediction.asset_class.in_(relevant_asset_classes)
        ).order_by(AssetPrediction.generated_at.desc()).limit(20).all()

        seen = set()
        for p in all_preds:
            if p.asset_class not in seen:
                seen.add(p.asset_class)
                short  = p.short_impact  or {}
                medium = p.medium_impact or {}
                predictions.append({
                    "asset_class":       p.asset_class,
                    "short_direction":   short.get("direction", "Neutral"),
                    "short_score":       short.get("score"),
                    "medium_direction":  medium.get("direction", "Neutral"),
                    "reasoning":         p.reasoning or "",
                })

    return {
        "active_world_context": facts if facts else ["No active macro context entries yet."],
        "asset_predictions":    predictions,
        "note": "Context sourced from live AI news intelligence module.",
    }


# ── System prompt ────────────────────────────────────────────────────────────

DIAGNOSTIC_SYSTEM_PROMPT = """You are an expert Pakistani mutual fund portfolio analyst.
You will receive a sanitized portfolio snapshot (% allocations only — no absolute amounts) and live macro market context.

Analyze the portfolio and return a JSON object with this EXACT schema:
{
  "risk_score": <integer 0-100, higher = riskier>,
  "risk_label": <"Conservative" | "Moderate" | "Moderate-High" | "High">,
  "risk_color": <"success" | "info" | "warning" | "danger">,
  "summary": "<2-3 sentence plain English narrative about the portfolio's overall health and risk profile>",
  "recommendations": [
    {
      "priority": <1 = most urgent>,
      "type": <"rebalance" | "diversify" | "reduce_risk" | "increase_growth" | "tax_note">,
      "title": "<short title>",
      "detail": "<2-3 sentences with specific, contextual advice referencing the user's actual fund names and the current macro environment>",
      "suggested_allocation_pct": <target % or null>
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "disclaimer": "AI-generated analysis. Not certified financial advice."
}

Rules:
- reference fund names, bank names, and categories from the snapshot specifically
- keep recommendations actionable and Pakistan-mutual-fund-specific
- recommendations array: 2-4 items max
- strengths array: 1-3 items
- Do NOT output anything outside the JSON object
"""


def run_ai_diagnostic(db: Session, user_id: int, username: str) -> dict:
    """
    Main entry point called by the dashboard endpoint.
    Returns structured AI diagnostic + provider metadata.
    """
    payload = build_portfolio_payload(db, user_id, username)
    if payload is None:
        raise ValueError("No portfolio data found. Please upload at least one statement first.")

    user_message = f"""Analyze this portfolio for the user '{payload['username']}':

PORTFOLIO SNAPSHOT:
{json.dumps(payload['portfolio_snapshot'], indent=2)}

LIVE MARKET CONTEXT:
{json.dumps(payload['market_context'], indent=2)}

Return only the JSON diagnostic object."""

    result = generate_json(
        prompt=user_message,
        system_prompt=DIAGNOSTIC_SYSTEM_PROMPT,
        temperature=0.4,
    )

    if not isinstance(result, dict):
        raise ValueError(f"AI returned unexpected format: {type(result)}")

    # Validate required keys
    required = {"risk_score", "risk_label", "risk_color", "summary", "recommendations", "strengths"}
    missing  = required - result.keys()
    if missing:
        raise ValueError(f"AI response missing keys: {missing}")

    provider = get_active_ai_provider()
    result["ai_provider"] = provider.get("provider", "Unknown")
    result["ai_model"]    = provider.get("model", "Unknown")

    return result


# ─── BILINGUAL AI FINANCIAL COPILOT (ALIBABA CLOUD QWEN 2.5) ──────────────────

COPILOT_ROMAN_URDU_SYSTEM_PROMPT = """You are 'Maliyati Mashweer' (AI Financial Copilot) in Pakistan Fund Tracker, an expert, warm, and highly practical mutual funds mentor designed specifically for Pakistani retail investors.

You must communicate in clear, natural, everyday **Roman Urdu** (Urdu written in the English/Latin alphabet, exactly as educated Pakistanis write on WhatsApp/SMS, e.g., "Aapka portfolio bohot mutawazin (balanced) hai...", "Yeh fund inflation yani mehngai k samnay...", "Zakat k mamlay mein...").

Context about the user:
- You have access to the user's sanitized portfolio snapshot (holdings, % allocations, returns, bank names) and live Pakistani market/macro context (SBP policy rate, PSX sentiment, inflation).
- PRIVACY: You do not know and must NEVER ask for personal identification (CNIC, bank account numbers, exact salary, or home address).

Guidelines for your answers:
1. Warm & Respectful: Start with a natural Pakistani financial greeting (e.g., "Assalam-o-Alaikum!", "Khushamdeed!").
2. Plain Financial Language: Explain jargon simply in Roman Urdu. If you use a term like "NAV", explain it as "unit ki qeemat"; "Expense Ratio" as "management fee"; "Inflation" as "mehngai ka asar"; "Capital Gains Tax" as "munafay par tax".
3. Localized to Pakistani Reality: Specifically reference Pakistani institutions (Meezan Bank, HBL Funds, Atlas Funds, Faysal Funds, SBP, FBR, MUFAP, PSX).
4. Balanced & Objective: Acknowledge that all investments carry market risk. Never promise guaranteed future returns, but guide on smart asset allocation (Money Market vs. Equity vs. VPS Pension funds).
5. Formatting: Use bullet points, bold text for key fund names or numbers, and keep responses concise, engaging, and easy to read.
"""

COPILOT_ENGLISH_SYSTEM_PROMPT = """You are the AI Financial Copilot in Pakistan Fund Tracker, an expert, objective, and empathetic mutual fund advisor for Pakistani retail investors.

Context about the user:
- You have access to the user's sanitized portfolio snapshot (holdings, % allocations, returns, bank names) and live Pakistani market/macro context (SBP policy rate, PSX sentiment, inflation).
- PRIVACY: You do not know and must NEVER ask for personal identification (CNIC, bank account numbers, or address).

Guidelines for your answers:
1. Direct, actionable, and educational financial advice aligned with SECP NBFC regulations and Pakistani mutual funds (Meezan, HBL, Atlas, Faysal, etc.).
2. Relate fund returns to real-world Pakistani macroeconomic benchmarks (SBP policy rate, CPI inflation, KSE-100 / KMI-30 indices, and Section 37A/63 tax rules).
3. Use clean formatting with bullet points and bold highlights for readability.
"""


def run_copilot_chat(
    db: Session,
    user_id: int,
    username: str,
    message: str,
    language: str = "ur",
    history: list = None
) -> dict:
    """
    Handles conversational financial inquiries from the user in either Roman Urdu or English.
    Grounds answers in the user's real portfolio allocations and live Pakistani macro context.
    """
    payload = build_portfolio_payload(db, user_id, username)
    is_roman_urdu = (language or "").lower() in ["ur", "roman_urdu", "urdu"]

    system_prompt = COPILOT_ROMAN_URDU_SYSTEM_PROMPT if is_roman_urdu else COPILOT_ENGLISH_SYSTEM_PROMPT

    portfolio_context_str = ""
    if payload:
        portfolio_context_str = f"""USER'S CURRENT PORTFOLIO SNAPSHOT (PRIVACY-PRESERVED):
- Bank Concentration: {json.dumps(payload['portfolio_snapshot']['bank_concentration'])}
- Category Allocation: {json.dumps(payload['portfolio_snapshot']['category_allocation'])}
- Fund Holdings: {json.dumps(payload['portfolio_snapshot']['holdings'])}
- Overall Return: {payload['portfolio_snapshot']['overall_gain_loss_pct']}%
- Has Equity Exposure: {payload['portfolio_snapshot']['has_equity']}
- Has Islamic Fund Exposure: {payload['portfolio_snapshot']['has_islamic']}

LIVE PAKISTANI MARKET & MACRO CONTEXT:
{json.dumps(payload['market_context'], indent=2)}
"""
    else:
        portfolio_context_str = "USER PORTFOLIO STATUS: No statement uploaded yet. (Politely invite them to upload their first statement from Meezan, HBL, Atlas, or Faysal, while answering their general financial query)."

    # Format history turns if provided
    history_str = ""
    if history and isinstance(history, list):
        formatted_turns = []
        for turn in history[-6:]: # keep last 6 turns for context
            sender = "User" if turn.get("role") == "user" else "Copilot"
            text = turn.get("content", "")
            if text:
                formatted_turns.append(f"{sender}: {text}")
        if formatted_turns:
            history_str = "PREVIOUS CONVERSATION CONTEXT:\n" + "\n".join(formatted_turns) + "\n\n"

    final_user_prompt = f"""{portfolio_context_str}

{history_str}USER QUESTION:
{message}

Please respond to the user based on their question and portfolio context."""

    response_text = generate_text(
        prompt=final_user_prompt,
        system_prompt=system_prompt,
        temperature=0.4,
    )

    provider = get_active_ai_provider()
    return {
        "response": response_text,
        "language": "roman_urdu" if is_roman_urdu else "en",
        "ai_provider": provider.get("provider", "Alibaba Cloud Model Studio"),
        "ai_model": provider.get("model", "Qwen 2.5"),
    }

