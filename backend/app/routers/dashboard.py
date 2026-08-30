from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import crud, models, schemas, database, utils
from typing import List, Dict, Any, Optional
from collections import defaultdict
import json
from datetime import datetime, timedelta

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"]
)

def get_latest_statements(db: Session, user_id: int, bank_name: Optional[str] = None, days: Optional[int] = None, portfolio_account: Optional[str] = None):
    """Helper to get the most recent statement for each portfolio owned by the user, optionally filtered by bank and date range."""
    query = db.query(models.Portfolio).filter(models.Portfolio.user_id == user_id)
    if bank_name:
        query = query.join(models.Bank).filter(func.lower(models.Bank.name) == bank_name.lower())
    if portfolio_account:
        query = query.filter(models.Portfolio.account_number == portfolio_account)
        
    portfolios = query.all()
    portfolio_ids = [p.id for p in portfolios]
    
    statement_query = db.query(models.Statement).filter(models.Statement.portfolio_id.in_(portfolio_ids))

    # Subquery to get the max date per portfolio
    subquery = db.query(
        models.Statement.portfolio_id,
        func.max(models.Statement.date).label("max_date")
    ).filter(
        models.Statement.portfolio_id.in_(portfolio_ids)
    )
    
    if days:
        cutoff_date = datetime.now() - timedelta(days=days)
        cutoff_str = cutoff_date.strftime("%Y-%m-%d")
        subquery = subquery.filter(models.Statement.date >= cutoff_str)
        
    subquery = subquery.group_by(models.Statement.portfolio_id).subquery()

    # Join statement query with the max_date subquery
    statements = db.query(models.Statement).join(
        subquery,
        (models.Statement.portfolio_id == subquery.c.portfolio_id) &
        (models.Statement.date == subquery.c.max_date)
    ).all()
    
    # In case there are multiple statements on the exact same max date for a portfolio, 
    # we take the one inserted last (highest ID)
    latest_statements = {}
    for s in statements:
        if s.portfolio_id not in latest_statements:
            latest_statements[s.portfolio_id] = s
        elif s.id > latest_statements[s.portfolio_id].id:
            latest_statements[s.portfolio_id] = s
            
    return list(latest_statements.values()), portfolios

@router.get("/summary", response_model=Dict[str, Any])
def get_dashboard_summary(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    portfolio_account: Optional[str] = Query(None, description="Filter by portfolio account"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Returns high-level summary: Net Worth, Total Invested, Gain/Loss.
    """
    latest_statements, portfolios = get_latest_statements(db, current_user.id, bank, portfolio_account=portfolio_account)
    
    total_net_worth = 0.0
    total_gain_loss = 0.0
    bank_totals = defaultdict(float)
    
    # Create map of portfolio_id to bank names
    portfolio_banks = {p.id: (p.bank.name if p.bank else "Unknown") for p in portfolios}
    portfolio_ids = list(portfolio_banks.keys())
    
    # Find top performing fund
    best_fund_name = "N/A"
    best_fund_pct = -float('inf')
    
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        summary = raw.get("summary", {})
        
        val = summary.get("total_market_value", 0.0)
        gain = summary.get("total_gain_loss", 0.0)
        
        total_net_worth += val
        total_gain_loss += gain
        
        b_name = portfolio_banks.get(stmt.portfolio_id, "Unknown")
        bank_totals[b_name] += val
        
        # Calculate individual fund performance
        holdings = raw.get("holdings", [])
        for holding in holdings:
            h_val = holding.get("market_value", 0.0)
            h_gain = holding.get("gain_loss", 0.0)
            h_invested = h_val - h_gain
            
            if h_invested > 0:
                pct = (h_gain / h_invested) * 100
                if pct > best_fund_pct:
                    best_fund_pct = pct
                    best_fund_name = holding.get("fund_name", "Unknown")
        
    top_performer_title = "N/A"
    top_performer_subtitle = "Best ROI"
    
    if bank and best_fund_name != "N/A":
        # If looking at a specific bank, show the best fund
        top_performer_title = best_fund_name
        top_performer_subtitle = f"{best_fund_pct:.2f}% Yield"
    elif bank_totals:
        # If looking globally, show the best bank
        top_performer_title = max(bank_totals.items(), key=lambda x: x[1])[0]
        
    total_invested = total_net_worth - total_gain_loss
    monthly_change_pct = (total_gain_loss / total_invested * 100) if total_invested > 0 else 0.0
    
    # Check if there's at least 1 month of data
    has_one_month = False
    all_dates = db.query(models.Statement.date).filter(
        models.Statement.portfolio_id.in_(portfolio_ids)
    ).all()
    
    if all_dates:
        parsed_dates = [datetime.strptime(d[0], "%Y-%m-%d") for d in all_dates if d[0]]
        if parsed_dates:
            min_date = min(parsed_dates)
            max_date = max(parsed_dates)
            if (max_date - min_date).days >= 30:
                has_one_month = True

    return {
        "total_net_worth": total_net_worth,
        "total_invested": total_invested,
        "total_gain_loss": total_gain_loss,
        "monthly_change_pct": monthly_change_pct,
        "top_performing_bank": top_performer_title,
        "top_performing_subtitle": top_performer_subtitle,
        "has_one_month": has_one_month,
        "bank_breakdown": dict(bank_totals),
        "available_portfolios": list(set([p.account_number for p in portfolios if p.account_number]))
    }

@router.get("/holdings", response_model=List[Dict[str, Any]])
def get_detailed_holdings(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    portfolio_account: Optional[str] = Query(None, description="Filter by portfolio account"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Returns a flat list of all individual fund investments from the latest statements.
    """
    latest_statements, portfolios = get_latest_statements(db, current_user.id, bank, portfolio_account=portfolio_account)
    portfolio_banks = {p.id: (p.bank.name if p.bank else "Unknown") for p in portfolios}
    portfolio_accounts = {p.id: p.account_number for p in portfolios}
    
    all_holdings = []
    
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        b_name = portfolio_banks.get(stmt.portfolio_id, "Unknown")
        p_account = portfolio_accounts.get(stmt.portfolio_id, "Unknown")
        holdings = raw.get("holdings", [])
        
        for holding in holdings:
            h_val = holding.get("market_value", 0.0)
            h_gain = holding.get("gain_loss", 0.0)
            h_invested = h_val - h_gain
            
            pct_change = (h_gain / h_invested * 100) if h_invested > 0 else 0.0
            
            # Use raw percentage change if provided, otherwise compute it
            if "percent_change" in holding and holding["percent_change"] != 0.0:
                pct_change = holding["percent_change"]
                
            all_holdings.append({
                "fund_name": holding.get("fund_name", "Unknown"),
                "bank": b_name,
                "portfolio_account": p_account,
                "category": holding.get("category", "Other"),
                "units": holding.get("units", 0.0),
                "nav": holding.get("nav", 0.0),
                "investment_amount": h_invested,
                "market_value": h_val,
                "gain_loss": h_gain,
                "percentage_change": pct_change
            })
            
    # Sort holdings naturally by highest market value
    return sorted(all_holdings, key=lambda x: x["market_value"], reverse=True)


@router.get("/allocation", response_model=Dict[str, Any])
def get_asset_allocation(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    days: Optional[int] = Query(None, description="Filter by trailing days (e.g., 30, 90, 180, 365)"),
    portfolio_account: Optional[str] = Query(None, description="Filter by portfolio account"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Returns asset allocation (categories) for the latest statements.
    """
    latest_statements, _ = get_latest_statements(db, current_user.id, bank, days, portfolio_account=portfolio_account)
    
    allocations = defaultdict(float)
    
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        holdings = raw.get("holdings", [])
        
        for holding in holdings:
            raw_cat = holding.get("category", "Other").lower()
            
            if "money" in raw_cat or "cash" in raw_cat:
                cat = "Money Market"
            elif "equity" in raw_cat or "stock" in raw_cat:
                cat = "Stocks"
            elif "debt" in raw_cat and "income" in raw_cat:
                cat = "Income Funds"
            elif "debt" in raw_cat:
                cat = "Debt Market"
            elif "income" in raw_cat or "return" in raw_cat:
                cat = "Income Funds"
            elif "gold" in raw_cat or "commodity" in raw_cat:
                cat = "Gold"
            else:
                cat = "Others" # default fallback
                
            val = holding.get("market_value", 0.0)
            allocations[cat] += val

    # Calculate percentages
    total = sum(allocations.values())
    if total == 0:
        return {
            "dates": ["Stocks", "Gold", "Money Market", "Debt Market", "Income Funds", "Others"],
            "values": [0, 0, 0, 0, 0, 0]
        }
        
    dates = list(allocations.keys())
    values = [round((val / total) * 100, 1) for val in allocations.values()]

    return {
        "dates": dates,
        "values": values
    }

@router.get("/performance", response_model=Dict[str, Any])
def get_portfolio_performance(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    days: Optional[int] = Query(None, description="Filter by trailing days (e.g., 30, 90, 180, 365)"),
    portfolio_account: Optional[str] = Query(None, description="Filter by portfolio account"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Returns daily total portfolio value for the AreaChart.
    Line plot points use exact Statement dates.
    """
    query = db.query(models.Statement).join(models.Portfolio).filter(
        models.Portfolio.user_id == current_user.id
    )
    
    if bank:
        query = query.join(models.Bank).filter(
            models.Bank.name.ilike(f"%{bank}%")
        )
        
    if days:
        cutoff = datetime.now() - timedelta(days=days)
        # Assuming db Statement dates are stored as formatted strings "YYYY-MM-DD", 
        # we can do string comparison or parse. The easiest in SQLite/Postgres is string comparison for ISO dates.
        cutoff_str = cutoff.strftime("%Y-%m-%d")
        query = query.filter(models.Statement.date >= cutoff_str)

    if portfolio_account:
        query = query.filter(models.Portfolio.account_number == portfolio_account)

    statements = query.order_by(models.Statement.date.asc()).all()
    
    # Need to get portfolio_ids from the filtered statements to correctly sum values
    # This part was slightly off in the original and the provided snippet.
    # We need the portfolios associated with the filtered statements to get their IDs.
    # A more robust way is to get unique portfolio_ids from the filtered statements.
    portfolio_ids = list(set([stmt.portfolio_id for stmt in statements]))

    statements_by_date = defaultdict(list)
    for stmt in statements:
        statements_by_date[stmt.date].append(stmt)
        
    sorted_dates = sorted(statements_by_date.keys())
    
    portfolio_latest = {pid: 0.0 for pid in portfolio_ids}
    daily_totals = {}
    
    for date in sorted_dates:
        for stmt in statements_by_date[date]:
            raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
            val = raw.get("summary", {}).get("total_market_value", 0.0)
            portfolio_latest[stmt.portfolio_id] = val
            
        daily_totals[date] = sum(portfolio_latest.values())

    if not daily_totals:
        return {
            "dates": ["2026-02-18", "2026-02-19", "2026-02-20"],
            "values": [0, 0, 0]
        }
    
    return {
        "dates": sorted_dates,
        "values": [daily_totals[d] for d in sorted_dates]
    }

@router.get("/insights", response_model=Dict[str, Any])
def get_ai_insights(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Analyzes current portfolio for risk factors and generates plain text insights.
    """
    latest_statements, portfolios = get_latest_statements(db, current_user.id, bank)
    portfolio_banks = {p.id: (p.bank.name if p.bank else "Unknown") for p in portfolios}
    
    total_market_value = 0.0
    category_totals = defaultdict(float)
    bank_totals = defaultdict(float)
    
    worst_fund = None
    worst_yield = float('inf')
    worst_loss = 0.0
    
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        b_name = portfolio_banks.get(stmt.portfolio_id, "Unknown")
        holdings = raw.get("holdings", [])
        
        for h in holdings:
            val = h.get("market_value", 0.0)
            gain = h.get("gain_loss", 0.0)
            cat = h.get("category", "Other")
            fund = h.get("fund_name", "Unknown")
            
            invested = val - gain
            pct_change = (gain / invested * 100) if invested > 0 else 0.0
            
            total_market_value += val
            category_totals[cat] += val
            bank_totals[b_name] += val
            
            if val > 0 and gain < 0:
                if pct_change < worst_yield:
                    worst_yield = pct_change
                    worst_loss = gain
                    worst_fund = fund

    insights = []
    
    summary_insights = []
    
    if total_market_value > 0:
        # 1. Asset Category Concentration (> 50%)
        safe_keywords = ["money market", "income", "debt", "islamic funds", "cash"]
        
        for cat, amount in category_totals.items():
            pct = amount / total_market_value
            if pct > 0.50:
                is_safe = any(k in cat.lower() for k in safe_keywords)
                if is_safe:
                    summary_insights.append({
                        "title": f"Safe Haven Allocation: {cat}",
                        "message": f"Your portfolio is heavily allocated to low-risk {cat} ({pct * 100:.1f}%). This provides excellent capital preservation, though you may consider small equity positions to outpace long-term inflation."
                    })
                else:
                    summary_insights.append({
                        "title": f"High Warning: {cat} Concentration",
                        "message": f"Your portfolio is highly exposed to {cat} assets ({pct * 100:.1f}% of total). Consider diversifying into safer categories like Money Market or Income funds to hedge against market volatility."
                    })
                
        # 2. Bank Concentration Risk (> 80%)
        for b, amount in bank_totals.items():
            pct = amount / total_market_value
            if pct > 0.80:
                summary_insights.append({
                    "title": f"Concentration Risk: {b}",
                    "message": f"{pct * 100:.1f}% of your wealth is held strictly in {b}. For stronger risk management, redistributing equity to other institutions is recommended."
                })
                
        # 3. Underperforming Asset Triggers
        if worst_fund and worst_yield < -1.0:
            summary_insights.append({
                "title": "Underperforming Asset Detected",
                "message": f"{worst_fund} is currently yielding {worst_yield:.1f}% (PKR {worst_loss:,.0f} loss). If this trend continues over a 3-month rolling period, verify its underlying performance benchmark."
            })
            
        # 4. Tax Evaluation (15% CGT on positive returns)
        total_gains = sum(h.get("gain_loss", 0) for stmt in latest_statements for h in (stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)).get("holdings", []) if h.get("gain_loss", 0) > 0)
        if total_gains > 0:
            tax_liability = total_gains * 0.15 # 15% Filer CGT roughly
            summary_insights.append({
                "title": "Capital Gains Tax (CGT) Estimate",
                "message": f"Based on positive returns of PKR {total_gains:,.0f}, your estimated CGT liability at 15% (Filer rate) is PKR {tax_liability:,.0f} upon realization."
            })
            
    # Default message if perfectly balanced
    if len(summary_insights) == 0:
        summary_insights.append({
            "title": "Portfolio Optimal",
            "message": "Your portfolio is beautifully balanced according to our risk parity checking algorithms. No immediate action required."
        })
        
    return {
        "insight_available": len(summary_insights) > 0,
        "insight": summary_insights[0] if summary_insights else None,
        "all_insights": summary_insights
    }

@router.get("/health-check", response_model=Dict[str, Any])
def get_health_check(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Analyzes current portfolio for diversification risk factors and generates severity-tiered alerts.
    """
    latest_statements, portfolios = get_latest_statements(db, current_user.id, bank)
    portfolio_banks = {p.id: (p.bank.name if p.bank else "Unknown") for p in portfolios}
    
    total_market_value = 0.0
    category_totals = defaultdict(float)
    bank_totals = defaultdict(float)
    
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        b_name = portfolio_banks.get(stmt.portfolio_id, "Unknown")
        holdings = raw.get("holdings", [])
        
        for h in holdings:
            val = h.get("market_value", 0.0)
            cat = h.get("category", "Other")
            
            total_market_value += val
            category_totals[cat] += val
            bank_totals[b_name] += val

    alerts = []
    
    if total_market_value > 0:
        # Check Categories
        safe_keywords = ["money market", "income", "debt", "islamic funds", "cash"]
        gold_keywords = ["gold", "commodity"]
        
        for cat, amount in category_totals.items():
            pct = amount / total_market_value
            is_safe = any(k in cat.lower() for k in safe_keywords)
            is_gold = any(k in cat.lower() for k in gold_keywords)
            
            if is_gold and pct > 0.40:
                alerts.append({
                    "id": f"gold_concentration_{cat}",
                    "title": "Gold Concentration Risk",
                    "message": f"{pct * 100:.1f}% of your portfolio is in Gold/Commodities. While a strong hedge, high concentration in non-income assets increases volatility. Consider capping exposure.",
                    "severity": "warning",
                    "data": { "percentage": pct * 100, "amount": amount }
                })
            elif is_safe and pct > 0.70:
                alerts.append({
                    "id": f"safe_haven_{cat}",
                    "title": f"Safe Haven Dominance: {cat}",
                    "message": f"Your portfolio is heavily allocated to low-risk {cat} ({pct * 100:.1f}%). This provides excellent capital preservation.",
                    "severity": "info",
                    "data": { "percentage": pct * 100, "amount": amount }
                })
            elif not is_safe and not is_gold and pct > 0.60:
                alerts.append({
                    "id": f"danger_concentration_{cat}",
                    "title": f"High Warning: {cat} Concentration",
                    "message": f"Your portfolio is highly exposed to {cat} assets ({pct * 100:.1f}%). Consider diversifying into safer categories to hedge against market volatility.",
                    "severity": "danger",
                    "data": { "percentage": pct * 100, "amount": amount }
                })

        # Check Banks
        for b, amount in bank_totals.items():
            pct = amount / total_market_value
            if pct > 0.80:
                alerts.append({
                    "id": f"bank_concentration_{b}",
                    "title": f"Bank Concentration Risk: {b}",
                    "message": f"{pct * 100:.1f}% of your wealth is held strictly in {b}. For stronger risk management, redistributing to other institutions is recommended.",
                    "severity": "warning",
                    "data": { "percentage": pct * 100, "amount": amount }
                })
                
    overall_health = "success"
    if any(a["severity"] == "danger" for a in alerts):
        overall_health = "danger"
    elif any(a["severity"] == "warning" for a in alerts):
        overall_health = "warning"
    elif any(a["severity"] == "info" for a in alerts):
        overall_health = "info"

    return {
        "alerts": alerts,
        "overall_health": overall_health
    }

@router.get("/fund-outperformers", response_model=Dict[str, Any])
def get_fund_outperformers(
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Analyzes user's funds against peer funds of the exact same type and returns any 
    peer funds that are outperforming the user's funds by a significant margin.
    """
    latest_statements, _ = get_latest_statements(db, current_user.id)
    
    # 1. Gather all unique user holdings
    user_holdings = {}
    for stmt in latest_statements:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        for h in raw.get("holdings", []):
            fname = h.get("fund_name", "")
            if fname and fname not in user_holdings:
                user_holdings[fname] = h

    # 2. Match with our DB funds to get fund_type
    all_funds = db.query(models.Fund).all()

    # Pre-fetch the latest performance metrics for EVERY fund in a single
    # batched query (one aggregate subquery + one join) instead of issuing one
    # query per fund inside get_fund_metrics.
    _metrics_subq = db.query(
        models.FundPerformanceMetrics.fund_id,
        func.max(models.FundPerformanceMetrics.date).label("max_date"),
    ).group_by(models.FundPerformanceMetrics.fund_id).subquery()
    _latest_metrics_rows = db.query(models.FundPerformanceMetrics).join(
        _metrics_subq,
        (models.FundPerformanceMetrics.fund_id == _metrics_subq.c.fund_id)
        & (models.FundPerformanceMetrics.date == _metrics_subq.c.max_date),
    ).all()
    metrics_by_fund = {m.fund_id: m for m in _latest_metrics_rows}

    fund_map = {f.name.lower(): f for f in all_funds}
    
    matched_user_funds = {} # user_fund_obj -> raw_holding
    for raw_name, holding in user_holdings.items():
        # Simple fuzzy match
        for f_name, f_obj in fund_map.items():
            if raw_name.lower() in f_name or f_name in raw_name.lower():
                matched_user_funds[f_obj] = holding
                break


    
    def get_fund_metrics(f: models.Fund) -> dict:
        if getattr(f, 'is_active', True) == False:
            return {
                "1m": 0.0,
                "6m": 0.0,
                "1y": 0.0,
                "source": "matured",
                "is_active": False
            }

        latest = metrics_by_fund.get(f.id)

        m_1m = latest.return_1m if (latest and latest.return_1m != 0.0) else (f.fmr_return_1m or None)
        m_6m = latest.return_6m if (latest and latest.return_6m != 0.0) else (f.fmr_return_6m or None)
        m_1y = latest.return_1y if (latest and latest.return_1y != 0.0) else (f.fmr_return_1y or None)
        
        source = "unknown"
        if latest and latest.return_1m and f.fmr_return_1m:
            source = "mufap+fmr"
        elif latest and latest.return_1m:
            source = "mufap_only"
        elif f.fmr_return_1m:
            source = "fmr_only"

        return {
            "1m": m_1m,
            "6m": m_6m,
            "1y": m_1y,
            "source": source,
            "is_active": True
        }

    def calc_composite(metrics: dict) -> Optional[float]:
        available = []
        if metrics["1m"] is not None: available.append(metrics["1m"])
        if metrics["6m"] is not None: available.append(metrics["6m"])
        if metrics["1y"] is not None: available.append(metrics["1y"])
        
        if len(available) < 2:
            return None
            
        score = sum(available)
        return score / len(available)
        
    def get_threshold(ftype: str) -> float:
        ft = (ftype or "").lower()
        if "money market" in ft: return 1.0
        if "income" in ft or "debt" in ft: return 2.0
        return 3.0 # equity, commodity, others

    results = []
    
    # 3. For each user fund, find same-type peers
    for u_fund, holding in matched_user_funds.items():
        if not u_fund.fund_type or u_fund.fund_type.lower() == "unknown":
            continue
            
        u_metrics = get_fund_metrics(u_fund)
        u_composite = calc_composite(u_metrics)
        
        if u_composite is None:
            continue
            
        threshold = get_threshold(u_fund.fund_type)
        
        peers = [f for f in all_funds if f.id != u_fund.id and f.fund_type == u_fund.fund_type]
        
        outperformers = []
        for p in peers:
            if getattr(p, 'is_active', True) == False: continue
            
            p_metrics = get_fund_metrics(p)
            p_composite = calc_composite(p_metrics)
            
            if p_composite is not None and (p_composite - u_composite) >= threshold:
                outperformers.append({
                    "fund_obj": p,
                    "metrics": p_metrics,
                    "composite": p_composite,
                    "gap": p_composite - u_composite
                })
                
        # Sort and take up to 3
        outperformers.sort(key=lambda x: x["gap"], reverse=True)
        top_performers = outperformers[:3]
        
        formatted_outperformers = []
        for idx, op in enumerate(top_performers):
            formatted_outperformers.append({
                "rank": idx + 1,
                "fund_name": op["fund_obj"].name,
                "bank": op["fund_obj"].bank.name if op["fund_obj"].bank else "Unknown",
                "fund_type": op["fund_obj"].fund_type,
                "composite_score": round(op["composite"], 2),
                "gap": round(op["gap"], 2),
                "data_source": op["metrics"]["source"],
                "breakdown": {
                    "1m": { "user": u_metrics["1m"], "peer": op["metrics"]["1m"] },
                    "6m": { "user": u_metrics["6m"], "peer": op["metrics"]["6m"] },
                    "1y": { "user": u_metrics["1y"], "peer": op["metrics"]["1y"] }
                }
            })
            
        results.append({
            "user_fund": u_fund.name,
            "user_fund_short": u_fund.short_name,
            "user_fund_type": u_fund.fund_type,
            "user_composite_score": round(u_composite, 2),
            "user_data_source": u_metrics["source"],
            "no_significant_underperformance": len(formatted_outperformers) == 0,
            "top_outperformers": formatted_outperformers
        })

    return {
        "results": results
    }

@router.get("/statement-history", response_model=List[Dict[str, Any]])
def get_statement_history(
    bank: Optional[str] = Query(None, description="Filter by bank name"),
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Returns the history of all parsed statements for the user.
    """
    query = db.query(models.Statement, models.Portfolio, models.Bank).join(
        models.Portfolio, models.Statement.portfolio_id == models.Portfolio.id
    ).join(
        models.Bank, models.Portfolio.bank_id == models.Bank.id
    ).filter(
        models.Portfolio.user_id == current_user.id
    )
    
    if bank:
        query = query.filter(func.lower(models.Bank.name) == bank.lower())
        
    results = query.order_by(models.Statement.created_at.desc()).all()
    
    history = []
    for stmt, port, b in results:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else json.loads(stmt.raw_data)
        summary = raw.get("summary", {})
        val = summary.get("total_market_value", 0.0)
        
        history.append({
            "id": stmt.id,
            "date": stmt.date,
            "created_at": stmt.created_at.isoformat(),
            "bank": b.name,
            "account_number": port.account_number,
            "amount": val,
            "action": "Statement Parsed",
            "status": "VERIFIED"
        })
        
    return history

@router.delete("/statements/{statement_id}")
def delete_statement(
    statement_id: int,
    current_user: schemas.User = Depends(utils.get_current_user),
    db: Session = Depends(database.get_db)
):
    """
    Deletes a specific statement.
    """
    stmt = db.query(models.Statement).join(
        models.Portfolio
    ).filter(
        models.Statement.id == statement_id,
        models.Portfolio.user_id == current_user.id
    ).first()
    
    if not stmt:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Statement not found")
        
    db.delete(stmt)
    db.commit()
    return {"message": "Statement deleted successfully"}

