from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Dict, Any
import os
import shutil

from ..database import get_db
from ..models import Fund, FundNAVHistory, FundPerformanceMetrics
from ..services.fmr_parser import parse_fmr_pdf_with_ai
from ..config import FMR_DIR

router = APIRouter(
    prefix="/api/performance",
    tags=["performance"]
)

@router.post("/upload-fmr")
async def upload_fmr(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accepts an FMR PDF upload from the Admin/Settings UI, saves it locally,
    and processes it using the Gemini AI extractor to enrich fund metadata.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # FMR_DIR resolves to "Fund Tracker PDF Data/FMRs/" inside the project folder.
    upload_dir = str(FMR_DIR)
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    updated_count = parse_fmr_pdf_with_ai(file_path, db)
    
    return {
        "status": "success",
        "message": f"FMR processed. Enriched {updated_count} tracked funds.",
        "funds_updated": updated_count
    }

@router.get("/{fund_id}/metrics")
def get_latest_metrics(fund_id: int, db: Session = Depends(get_db)):
    """
    Returns the latest pre-calculated performance metrics (1M, 6M, 1Y, YTD)
    and the latest daily NAV change for the banner.
    """
    # 1. Verify existence
    fund = db.query(Fund).filter(Fund.id == fund_id).first()
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found")

    # 2. Get the latest pre-calculated metrics row
    latest_metrics = db.query(FundPerformanceMetrics).filter(
        FundPerformanceMetrics.fund_id == fund_id
    ).order_by(desc(FundPerformanceMetrics.date)).first()

    # 3. Get the latest NAV daily change row
    latest_nav = db.query(FundNAVHistory).filter(
        FundNAVHistory.fund_id == fund_id
    ).order_by(desc(FundNAVHistory.date)).first()

    return {
        "fund_name": fund.name,
        "latest_nav": latest_nav.nav_price if latest_nav else None,
        "latest_date": latest_nav.date if latest_nav else None,
        "metrics": {
            "return_1m": latest_metrics.return_1m if latest_metrics else 0,
            "return_6m": latest_metrics.return_6m if latest_metrics else 0,
            "return_1y": latest_metrics.return_1y if latest_metrics else 0,
            "return_ytd": latest_metrics.return_ytd if latest_metrics else 0,
            "last_updated": latest_metrics.date if latest_metrics else None
        }
    }

@router.get("/{fund_id}/chart")
def get_historical_chart_data(fund_id: int, db: Session = Depends(get_db)):
    """
    Returns the historical NAV array for plotting charts (e.g. recharts).
    Currently returns all available history (up to newest scraper rows)
    so the frontend can implement 1W/1M/1Y filtering locally or we can paginate later.
    """
    history = db.query(FundNAVHistory).filter(
        FundNAVHistory.fund_id == fund_id
    ).order_by(FundNAVHistory.date.asc()).all()

    return [
        {
            "date": str(row.date),
            "nav_price": row.nav_price
        }
        for row in history
    ]

@router.get("/bank/{bank_name}")
def get_bank_performance(bank_name: str, db: Session = Depends(get_db)):
    """
    Returns the performance metrics and historical charts for all funds
    that belong to the specified bank.
    """
    from ..models import Bank
    
    # Simple case-insensitive match for the bank name
    bank = db.query(Bank).filter(Bank.name.ilike(f"%{bank_name}%")).first()
    if not bank:
        raise HTTPException(status_code=404, detail=f"Bank {bank_name} not found")

    funds = db.query(Fund).filter(Fund.bank_id == bank.id).all()
    if not funds:
        return []

    fund_ids = [f.id for f in funds]

    # Batch-fetch the latest performance metrics for every fund in this bank
    # with a single aggregate subquery + join (was one query per fund before).
    metrics_subq = db.query(
        FundPerformanceMetrics.fund_id,
        func.max(FundPerformanceMetrics.date).label("max_date"),
    ).filter(FundPerformanceMetrics.fund_id.in_(fund_ids)).group_by(
        FundPerformanceMetrics.fund_id
    ).subquery()
    latest_metrics_rows = db.query(FundPerformanceMetrics).join(
        metrics_subq,
        (FundPerformanceMetrics.fund_id == metrics_subq.c.fund_id)
        & (FundPerformanceMetrics.date == metrics_subq.c.max_date),
    ).all()
    metrics_by_fund = {m.fund_id: m for m in latest_metrics_rows}

    # Batch-fetch the full NAV history for all funds in one query, then group
    # in memory (was one query per fund for history + one for latest nav).
    nav_rows = db.query(FundNAVHistory).filter(
        FundNAVHistory.fund_id.in_(fund_ids)
    ).order_by(FundNAVHistory.date.asc()).all()
    nav_by_fund: Dict[int, list] = {}
    for r in nav_rows:
        nav_by_fund.setdefault(r.fund_id, []).append(r)
    latest_nav_by_fund = {fid: rows[-1] for fid, rows in nav_by_fund.items()}

    result = []
    for fund in funds:
        latest_metrics = metrics_by_fund.get(fund.id)
        latest_nav = latest_nav_by_fund.get(fund.id)
        history_rows = nav_by_fund.get(fund.id, [])
        chart_data = [
            {"date": str(r.date), "nav_price": r.nav_price} for r in history_rows
        ]

        result.append({
            "fund_id": fund.id,
            "fund_name": fund.name,
            "short_name": fund.short_name,
            "risk_profile": fund.risk_profile,
            "asset_allocation": fund.asset_allocation,
            "fund_type": fund.fund_type,
            "latest_nav": latest_nav.nav_price if latest_nav else None,
            "latest_date": latest_nav.date if latest_nav else None,
            "metrics": {
                "return_1m": latest_metrics.return_1m if (latest_metrics and latest_metrics.return_1m != 0.0) else (fund.fmr_return_1m or 0.0),
                "return_6m": latest_metrics.return_6m if (latest_metrics and latest_metrics.return_6m != 0.0) else (fund.fmr_return_6m or 0.0),
                "return_1y": latest_metrics.return_1y if (latest_metrics and latest_metrics.return_1y != 0.0) else (fund.fmr_return_1y or 0.0),
                "return_ytd": latest_metrics.return_ytd if (latest_metrics and latest_metrics.return_ytd != 0.0) else (fund.fmr_return_ytd or 0.0),
                "last_updated": latest_metrics.date if latest_metrics else None
            },
            "chart": chart_data
        })

    return result
