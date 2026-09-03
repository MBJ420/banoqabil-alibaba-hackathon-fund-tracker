import logging
import json
import os
from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext


logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(username=user.username, password_hash=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_portfolios(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Portfolio).filter(models.Portfolio.user_id == user_id).offset(skip).limit(limit).all()

def create_portfolio(db: Session, portfolio: schemas.PortfolioCreate, user_id: int):
    db_portfolio = models.Portfolio(**portfolio.dict(), user_id=user_id)
    db.add(db_portfolio)
    db.commit()
    db.refresh(db_portfolio)
    return db_portfolio

def get_or_create_bank(db: Session, bank_name: str) -> models.Bank:
    """Finds a bank by name or creates it if it doesn't exist."""
    bank = db.query(models.Bank).filter(models.Bank.name.ilike(bank_name)).first()
    if not bank:
        bank = models.Bank(name=bank_name.capitalize())
        db.add(bank)
        db.commit()
        db.refresh(bank)
    return bank

def save_statement(db: Session, user_id: int, parsed_data: dict, file_path: str) -> dict:
    """
    Saves parsed PDF statement data into the database.
    Creates Bank and Portfolio if they don't exist.
    Avoids duplicate inserts for the same portfolio and exact date.
    """
    bank_name = parsed_data.get("bank")
    if not bank_name:
        return {"error": "Missing bank name in parsed data"}
        
    portfolio_id_str = parsed_data.get("portfolio_id", "UNKNOWN")
    account_name = parsed_data.get("account_name", "UNKNOWN")
    date = parsed_data.get("statement_date")
    
    if not date:
        return {"error": "Missing statement date in parsed data"}
        
    bank = get_or_create_bank(db, bank_name)
    
    # Find or create portfolio
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.user_id == user_id,
        models.Portfolio.bank_id == bank.id,
        models.Portfolio.account_number == portfolio_id_str
    ).first()
    
    if not portfolio:
        portfolio = models.Portfolio(
            user_id=user_id,
            bank_id=bank.id,
            account_number=portfolio_id_str,
            holder_name=account_name
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
    
    # HEALING LOGIC: If we found a valid name in this PDF, update the portfolio 
    # and propagate it to other "UNKNOWN" or "Garbage" portfolios for the same user.
    if account_name and account_name != "UNKNOWN":
        # Check if the current portfolio name is garbage or unknown
        blacklist = ["GROSS DIVIDEND", "WHT", "ZAKAT", "PORTFOLIO NO", "UNKNOWN"]
        is_current_garbage = any(word in (portfolio.holder_name or "").upper() for word in blacklist)
        
        if is_current_garbage:
            logger.info(f"Healing portfolio {portfolio.account_number}: Current '{portfolio.holder_name}' -> New '{account_name}'")
            portfolio.holder_name = account_name
            db.commit()
            
            # Propagate to all other portfolios for this user that are also garbage
            other_portfolios = db.query(models.Portfolio).filter(models.Portfolio.user_id == user_id).all()
            for p in other_portfolios:
                if any(word in (p.holder_name or "").upper() for word in blacklist):
                    logger.info(f"Propagating consensus name to user {user_id}'s portfolio {p.account_number}")
                    p.holder_name = account_name
            db.commit()
        
    # Check if this exact physical PDF file was already parsed previously
    if file_path and file_path != "MANUAL_ENTRY":
        existing_by_file = db.query(models.Statement).filter(
            models.Statement.file_path == file_path
        ).first()
        if existing_by_file:
            existing_by_file.portfolio_id = portfolio.id
            existing_by_file.date = date
            existing_by_file.raw_data = parsed_data
            db.commit()
            return {"status": "updated", "message": f"Statement updated for file {file_path}", "statement_id": existing_by_file.id}

    # Check for duplicate statement on exact date in this portfolio
    existing_statement = db.query(models.Statement).filter(
        models.Statement.portfolio_id == portfolio.id,
        models.Statement.date == date
    ).first()
    
    if existing_statement:
        # Update rather than skip, so parser logic changes can heal old entries
        existing_statement.raw_data = parsed_data
        existing_statement.file_path = file_path
        db.commit()
        return {"status": "updated", "message": f"Statement updated for date {date}", "statement_id": existing_statement.id}

        
    statement = models.Statement(
        portfolio_id=portfolio.id,
        date=date,
        file_path=file_path,
        raw_data=parsed_data
    )
    db.add(statement)
    db.commit()
    db.refresh(statement)
    
    return {"status": "success", "statement_id": statement.id}

def delete_statement(db: Session, file_path: str) -> bool:
    """
    Deletes a statement from the database based on the file path.
    Called when the Watchdog detects a file deletion.
    """
    statement = db.query(models.Statement).filter(models.Statement.file_path == file_path).first()
    if statement:
        db.delete(statement)
        db.commit()
        return True
    return False


def get_bank_config(db: Session, user_id: int, bank_name: str) -> models.UserBankConfig | None:
    """Returns the bank config (incl. pdf_password) for a given user+bank."""
    return db.query(models.UserBankConfig).filter(
        models.UserBankConfig.user_id == user_id,
        models.UserBankConfig.bank_name == bank_name.lower()
    ).first()


def upsert_bank_config(db: Session, user_id: int, bank_name: str, pdf_password: str | None) -> models.UserBankConfig:
    """Creates or updates the PDF password for a user's bank."""
    config = get_bank_config(db, user_id, bank_name)
    if config:
        config.pdf_password = pdf_password
    else:
        config = models.UserBankConfig(
            user_id=user_id,
            bank_name=bank_name.lower(),
            pdf_password=pdf_password
        )
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


def get_all_bank_configs(db: Session, user_id: int) -> list[models.UserBankConfig]:
    """Returns all bank configs for a user."""
    return db.query(models.UserBankConfig).filter(
        models.UserBankConfig.user_id == user_id
    ).all()


def get_user_statements(db: Session, user_id: int, limit: int = 50) -> list[models.Statement]:
    """Returns a user's saved statements ordered by date (newest first)."""
    return (
        db.query(models.Statement)
        .join(models.Portfolio, models.Statement.portfolio_id == models.Portfolio.id)
        .filter(models.Portfolio.user_id == user_id)
        .order_by(models.Statement.date.desc(), models.Statement.created_at.desc())
        .limit(limit)
        .all()
    )


# ─── Data Manager & Manual Entry CRUD ──────────────────────────────────────────

def get_detailed_user_statements(db: Session, user_id: int) -> list[dict]:
    """Returns all statements for a user with fully parsed holdings and metadata."""
    rows = (
        db.query(models.Statement, models.Portfolio, models.Bank)
        .join(models.Portfolio, models.Statement.portfolio_id == models.Portfolio.id)
        .join(models.Bank, models.Portfolio.bank_id == models.Bank.id)
        .filter(models.Portfolio.user_id == user_id)
        .order_by(models.Statement.date.desc(), models.Statement.created_at.desc())
        .all()
    )

    statements = []
    for stmt, port, bank in rows:
        raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else (json.loads(stmt.raw_data) if stmt.raw_data else {})
        summary = raw.get("summary", {}) if isinstance(raw.get("summary"), dict) else {}
        holdings_raw = raw.get("holdings", []) or []

        holdings = []
        for idx, h in enumerate(holdings_raw):
            val = float(h.get("market_value", 0.0) or 0.0)
            gain = float(h.get("gain_loss", 0.0) or 0.0)
            holdings.append({
                "index": idx,
                "fund_name": h.get("fund_name", "Unknown Fund"),
                "category": h.get("category", "Other"),
                "market_value": val,
                "gain_loss": gain,
                "units": float(h.get("units", 0.0) or 0.0),
                "nav": float(h.get("nav", 0.0) or 0.0),
                "percent_change": float(h.get("percent_change", 0.0) or 0.0),
            })

        is_manual = (stmt.file_path or "").upper() == "MANUAL_ENTRY"
        tot_val = summary.get("total_market_value", sum(h["market_value"] for h in holdings))
        tot_gain = summary.get("total_gain_loss", sum(h["gain_loss"] for h in holdings))

        statements.append({
            "id": stmt.id,
            "portfolio_id": port.id,
            "date": stmt.date,
            "created_at": stmt.created_at.isoformat() if stmt.created_at else None,
            "bank": bank.name,
            "account_number": port.account_number,
            "holder_name": port.holder_name,
            "file_path": stmt.file_path,
            "is_manual": is_manual,
            "summary": {
                "total_market_value": float(tot_val),
                "total_gain_loss": float(tot_gain),
                "total_investment": float(tot_val - tot_gain),
            },
            "holdings": holdings,
            "holdings_count": len(holdings),
        })

    return statements


def get_statement_by_id_and_user(db: Session, statement_id: int, user_id: int) -> models.Statement | None:
    """Finds a statement by ID ensuring it belongs to the given user."""
    return (
        db.query(models.Statement)
        .join(models.Portfolio, models.Statement.portfolio_id == models.Portfolio.id)
        .filter(models.Statement.id == statement_id, models.Portfolio.user_id == user_id)
        .first()
    )


def update_statement_holdings(
    db: Session,
    statement_id: int,
    user_id: int,
    payload: schemas.StatementUpdateSchema
) -> dict:
    """
    Updates an existing statement: date, institution/bank, account number,
    and replaces holdings in raw_data, automatically recomputing total valuation and gain/loss.
    """
    stmt = get_statement_by_id_and_user(db, statement_id, user_id)
    if not stmt:
        return {"error": "Statement not found or does not belong to current user."}

    port = stmt.portfolio
    if payload.bank and payload.bank.strip():
        bank = get_or_create_bank(db, payload.bank.strip())
        port.bank_id = bank.id

    if payload.account_number and payload.account_number.strip():
        port.account_number = payload.account_number.strip()

    if payload.date and payload.date.strip():
        stmt.date = payload.date.strip()

    # Reconstruct holdings and recalculate summary totals
    new_holdings = []
    tot_market_value = 0.0
    tot_gain_loss = 0.0

    for h in payload.holdings:
        mv = float(h.market_value)
        gl = float(h.gain_loss or 0.0)
        tot_market_value += mv
        tot_gain_loss += gl
        pct = round((gl / (mv - gl) * 100), 2) if (mv - gl) > 0 else 0.0

        new_holdings.append({
            "fund_name": h.fund_name.strip(),
            "category": h.category.strip() if h.category else "Other",
            "market_value": mv,
            "gain_loss": gl,
            "units": float(h.units or 0.0),
            "nav": float(h.nav or 0.0),
            "percent_change": pct,
        })

    raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else (json.loads(stmt.raw_data) if stmt.raw_data else {})
    raw["statement_date"] = stmt.date
    raw["statement_month"] = stmt.date[:7] if len(stmt.date) >= 7 else ""
    raw["holdings"] = new_holdings
    raw["summary"] = {
        "total_market_value": round(tot_market_value, 2),
        "total_gain_loss": round(tot_gain_loss, 2),
    }

    from sqlalchemy.orm.attributes import flag_modified
    stmt.raw_data = dict(raw)
    flag_modified(stmt, "raw_data")

    db.commit()
    db.refresh(stmt)
    db.refresh(port)

    return {
        "status": "success",
        "message": "Statement updated successfully.",
        "statement_id": stmt.id,
        "holdings_count": len(new_holdings),
        "total_market_value": round(tot_market_value, 2),
    }


def delete_statement_holding(
    db: Session,
    statement_id: int,
    user_id: int,
    holding_index: int
) -> dict:
    """Removes a single holding from a statement's raw_data and recalculates summary totals."""
    stmt = get_statement_by_id_and_user(db, statement_id, user_id)
    if not stmt:
        return {"error": "Statement not found."}

    raw = stmt.raw_data if isinstance(stmt.raw_data, dict) else (json.loads(stmt.raw_data) if stmt.raw_data else {})
    holdings = list(raw.get("holdings", []))

    if holding_index < 0 or holding_index >= len(holdings):
        return {"error": f"Invalid holding index {holding_index}. Statement has {len(holdings)} holdings."}

    removed = holdings.pop(holding_index)

    tot_market_value = sum(float(h.get("market_value", 0.0) or 0.0) for h in holdings)
    tot_gain_loss = sum(float(h.get("gain_loss", 0.0) or 0.0) for h in holdings)

    raw["holdings"] = holdings
    raw["summary"] = {
        "total_market_value": round(tot_market_value, 2),
        "total_gain_loss": round(tot_gain_loss, 2),
    }

    from sqlalchemy.orm.attributes import flag_modified
    stmt.raw_data = dict(raw)
    flag_modified(stmt, "raw_data")

    db.commit()
    db.refresh(stmt)

    return {
        "status": "success",
        "message": f"Removed '{removed.get('fund_name', 'holding')}' successfully.",
        "remaining_holdings": len(holdings),
        "total_market_value": round(tot_market_value, 2),
    }


def create_manual_statement(
    db: Session,
    user_id: int,
    payload: schemas.ManualStatementCreateSchema
) -> dict:
    """
    Creates a new manual statement record in the database, allowing users
    to record months/holdings without requiring a PDF file.
    """
    bank_name = (payload.bank or "").strip()
    if not bank_name:
        return {"error": "Institution/Bank name is required."}

    date_str = (payload.date or "").strip()
    if not date_str:
        return {"error": "Statement date is required (YYYY-MM-DD)."}

    bank = get_or_create_bank(db, bank_name)
    account_number = (payload.account_number or "MANUAL-001").strip()

    # Find or create portfolio for user + bank + account_number
    portfolio = db.query(models.Portfolio).filter(
        models.Portfolio.user_id == user_id,
        models.Portfolio.bank_id == bank.id,
        models.Portfolio.account_number == account_number
    ).first()

    if not portfolio:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        holder_name = user.username if user else "Investor"
        portfolio = models.Portfolio(
            user_id=user_id,
            bank_id=bank.id,
            account_number=account_number,
            holder_name=holder_name
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)

    # Reconstruct holdings & summary
    holdings = []
    tot_market_value = 0.0
    tot_gain_loss = 0.0

    for h in payload.holdings:
        mv = float(h.market_value)
        gl = float(h.gain_loss or 0.0)
        tot_market_value += mv
        tot_gain_loss += gl
        pct = round((gl / (mv - gl) * 100), 2) if (mv - gl) > 0 else 0.0

        holdings.append({
            "fund_name": h.fund_name.strip(),
            "category": h.category.strip() if h.category else "Other",
            "market_value": mv,
            "gain_loss": gl,
            "units": float(h.units or 0.0),
            "nav": float(h.nav or 0.0),
            "percent_change": pct,
        })

    raw_data = {
        "bank": bank.name,
        "portfolio_id": account_number,
        "account_name": portfolio.holder_name,
        "statement_date": date_str,
        "statement_month": date_str[:7] if len(date_str) >= 7 else "",
        "holdings": holdings,
        "summary": {
            "total_market_value": round(tot_market_value, 2),
            "total_gain_loss": round(tot_gain_loss, 2),
        }
    }

    # Check if a statement already exists on this exact date for this portfolio
    existing = db.query(models.Statement).filter(
        models.Statement.portfolio_id == portfolio.id,
        models.Statement.date == date_str
    ).first()

    if existing:
        from sqlalchemy.orm.attributes import flag_modified
        existing.raw_data = raw_data
        flag_modified(existing, "raw_data")
        db.commit()
        db.refresh(existing)
        return {
            "status": "updated",
            "message": f"Updated existing manual entry for date {date_str}.",
            "statement_id": existing.id,
            "total_market_value": round(tot_market_value, 2),
        }

    stmt = models.Statement(
        portfolio_id=portfolio.id,
        date=date_str,
        file_path="MANUAL_ENTRY",
        raw_data=raw_data
    )
    db.add(stmt)
    db.commit()
    db.refresh(stmt)

    return {
        "status": "success",
        "message": f"Manual statement created for {date_str}.",
        "statement_id": stmt.id,
        "total_market_value": round(tot_market_value, 2),
    }


def delete_user_statement_with_file_option(
    db: Session,
    statement_id: int,
    user_id: int,
    delete_file: bool = False
) -> dict:
    """
    Deletes a statement from the database. If delete_file is True, also safely removes
    the source PDF file on disk so the folder watcher does not re-detect it.
    """
    stmt = get_statement_by_id_and_user(db, statement_id, user_id)
    if not stmt:
        return {"error": "Statement not found."}

    file_removed = False
    if delete_file and stmt.file_path and stmt.file_path.upper() != "MANUAL_ENTRY":
        try:
            if os.path.exists(stmt.file_path):
                os.remove(stmt.file_path)
                file_removed = True
                logger.info(f"Removed physical PDF statement on user deletion: {stmt.file_path}")
        except Exception as e:
            logger.warning(f"Could not delete physical statement file {stmt.file_path}: {e}")

    portfolio_id = stmt.portfolio_id
    db.delete(stmt)
    db.commit()

    # If the portfolio now has 0 statements and was a manual entry portfolio, keep or clean
    remaining = db.query(models.Statement).filter(models.Statement.portfolio_id == portfolio_id).count()

    return {
        "status": "success",
        "message": "Statement deleted successfully.",
        "file_removed": file_removed,
        "remaining_for_portfolio": remaining,
    }


