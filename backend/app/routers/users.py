from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import crud, models, schemas, database
from ..utils import get_current_user
from ..config import PDF_DATA_DIR

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

import os
from pathlib import Path
from pydantic import BaseModel

class BankConfigRequest(BaseModel):
    bank_name: str
    pdf_password: str | None = None

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create User in DB
    new_user = crud.create_user(db=db, user=user)

    # Create Folder Structure inside the project's "Fund Tracker PDF Data/" directory.
    # This ensures PDFs never get scattered into C:\Users\... on any machine.
    try:
        user_data_path = PDF_DATA_DIR / user.username
        
        banks = ["meezan", "hbl", "faysal", "atlas"]
        
        for bank in banks:
            (user_data_path / bank).mkdir(parents=True, exist_ok=True)
            
        print(f"Created folders at: {user_data_path}")
    except Exception as e:
        print(f"Failed to create folders: {e}")
        # Note: We don't rollback user creation if folder creation fails, but we log it.

    return new_user

@router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: schemas.User = Depends(get_current_user)):
    return current_user

@router.get("/bank-config")
def get_bank_configs(
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Returns all bank PDF password configs for the current user."""
    configs = crud.get_all_bank_configs(db, current_user.id)
    return [
        {"bank_name": c.bank_name, "has_password": bool(c.pdf_password)}
        for c in configs
    ]

@router.post("/bank-config")
def save_bank_config(
    req: BankConfigRequest,
    current_user: schemas.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Saves (creates or updates) a PDF password for one of the user's banks."""
    crud.upsert_bank_config(db, current_user.id, req.bank_name, req.pdf_password)
    
    # Trigger re-scan of the user's bank folder so new PDFs get parsed with the new password
    try:
        from ..services.watcher import PDFHandler
        handler = PDFHandler()
        bank_dir = PDF_DATA_DIR / current_user.username / req.bank_name.lower()
        if bank_dir.exists():
            for f in bank_dir.glob("*.pdf"):
                handler.process_file(str(f))
    except Exception as e:
        print(f"Re-scan after password save failed: {e}")

    return {"status": "ok", "message": f"Password saved for {req.bank_name}."}

