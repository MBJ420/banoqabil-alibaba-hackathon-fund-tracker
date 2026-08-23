from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
import os
import shutil

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
