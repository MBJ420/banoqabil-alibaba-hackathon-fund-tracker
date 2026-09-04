from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil
import json


from ..database import get_db
from .. import crud, utils, models, schemas
from ..services.pdf_parser import parser as pdf_parser
from ..config import PDF_DATA_DIR

router = APIRouter(
    prefix="/api/statements",
    tags=["statements"],
)

ALLOWED_BANKS = {"meezan", "hbl", "atlas", "faysal"}


@router.post("/upload")
async def upload_statement(
    bank: str = Form(...),
    file: UploadFile = File(...),
    current_user: models.User = Depends(utils.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts a personal bank statement PDF (Meezan, HBL, Atlas, Faysal) from the
    logged-in user, saves it under Fund Tracker PDF Data/{username}/{bank}/,
    parses it, and stores the holdings in the database.
    """
    bank = (bank or "").strip().lower()
    if bank not in ALLOWED_BANKS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported bank. Use meezan, hbl, atlas, or faysal.",
        )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Save into the watched folder so the watcher can also re-process it later.
    bank_dir = PDF_DATA_DIR / current_user.username / bank
    os.makedirs(str(bank_dir), exist_ok=True)
    file_path = os.path.join(str(bank_dir), file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    parsed = pdf_parser.parse_statement(file_path, bank, password=None)

    if "error" in parsed:
        return {
            "status": "error",
            "bank": bank,
            "message": parsed.get("message", parsed.get("error", "Failed to parse statement.")),
        }

    result = crud.save_statement(
        db, user_id=current_user.id, parsed_data=parsed, file_path=file_path
    )

    holdings = parsed.get("holdings", [])
    summary = parsed.get("summary", {})

    return {
        "status": result.get("status", "success"),
        "bank": bank,
        "statement_date": parsed.get("statement_date"),
        "holdings_count": len(holdings),
        "total_market_value": summary.get("total_market_value", 0.0),
        "message": f"Processed {len(holdings)} holdings.",
    }


@router.get("")
async def list_statements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
    limit: int = 50,
):
    """Returns the logged-in user's saved statements (newest first) for the history view."""
    statements = crud.get_user_statements(db, user_id=current_user.id, limit=limit)
    result = []
    for s in statements:
        raw = s.raw_data if isinstance(s.raw_data, dict) else {}
        summary = raw.get("summary", {}) if isinstance(raw.get("summary"), dict) else {}
        bank_name = "Unknown"
        if s.portfolio and s.portfolio.bank:
            bank_name = s.portfolio.bank.name
        result.append({
            "id": s.id,
            "date": s.date,
            "bank": bank_name,
            "portfolio_account": s.portfolio.account_number if s.portfolio else None,
            "total_value": summary.get("total_market_value", 0.0),
            "holdings_count": len(raw.get("holdings", []) or []),
            "status": "VERIFIED",
        })
    return result


# ─── Data Manager GUI Endpoints ───────────────────────────────────────────────

@router.get("/manage")
async def get_manage_statements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Returns all statements for the logged in user with fully detailed holdings."""
    return crud.get_detailed_user_statements(db, user_id=current_user.id)


@router.get("/meta")
async def get_data_manager_meta(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Returns available institutions, categories, and portfolios for user dropdowns."""
    banks = db.query(models.Bank).all()
    user_portfolios = db.query(models.Portfolio).join(
        models.Statement, models.Statement.portfolio_id == models.Portfolio.id
    ).filter(models.Portfolio.user_id == current_user.id).distinct().all()
    
    standard_categories = [
        "Money Market",
        "Equity",
        "Islamic Income",
        "Debt Market",
        "Gold",
        "Commodities",
        "Other"
    ]

    return {
        "institutions": sorted(list(set([b.name for b in banks] + ["Meezan", "HBL", "Atlas", "Faysal"]))),
        "categories": standard_categories,
        "existing_accounts": [
            {
                "id": p.id,
                "account_number": p.account_number,
                "bank": p.bank.name if p.bank else "Unknown",
                "holder_name": p.holder_name
            }
            for p in user_portfolios
        ]
    }


@router.get("/{statement_id}/details")
async def get_statement_details(
    statement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Fetches full statement details for editing."""
    stmt = crud.get_statement_by_id_and_user(db, statement_id, current_user.id)
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found.")
    
    raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else (json.loads(stmt.raw_data) if stmt.raw_data else {})
    holdings_raw = raw.get("holdings", []) or []
    
    return {
        "id": stmt.id,
        "date": stmt.date,
        "bank": stmt.portfolio.bank.name if stmt.portfolio and stmt.portfolio.bank else "Unknown",
        "account_number": stmt.portfolio.account_number if stmt.portfolio else "UNKNOWN",
        "holder_name": stmt.portfolio.holder_name if stmt.portfolio else "Investor",
        "is_manual": (stmt.file_path or "").upper() == "MANUAL_ENTRY",
        "file_path": stmt.file_path,
        "summary": raw.get("summary", {}),
        "holdings": holdings_raw,
    }


@router.put("/{statement_id}")
async def update_statement(
    statement_id: int,
    payload: schemas.StatementUpdateSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Updates a statement and replaces its holdings list, recalculating summary."""
    result = crud.update_statement_holdings(db, statement_id, current_user.id, payload)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{statement_id}")
async def delete_statement_endpoint(
    statement_id: int,
    delete_file: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Deletes a statement, with optional physical file cleanup from disk."""
    result = crud.delete_user_statement_with_file_option(db, statement_id, current_user.id, delete_file=delete_file)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.delete("/{statement_id}/holdings/{holding_index}")
async def delete_single_holding_endpoint(
    statement_id: int,
    holding_index: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Deletes a single holding row from a statement."""
    result = crud.delete_statement_holding(db, statement_id, current_user.id, holding_index)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/manual")
async def create_manual_statement_endpoint(
    payload: schemas.ManualStatementCreateSchema,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(utils.get_current_user),
):
    """Creates a new manual monthly statement entry without requiring a PDF."""
    result = crud.create_manual_statement(db, current_user.id, payload)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

