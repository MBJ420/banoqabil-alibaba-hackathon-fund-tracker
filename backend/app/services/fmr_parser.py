import os
import json
import logging
import fitz
from sqlalchemy.orm import Session
from app.models import Fund, Bank
from app.services.llm_service import generate_json, get_active_ai_provider

logger = logging.getLogger(__name__)

def extract_text_from_pdf(file_path: str) -> str:
    """Extracts structured text from all pages of an FMR PDF using PyMuPDF."""
    doc = fitz.open(file_path)
    pages_text = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text.strip():
            pages_text.append(f"--- PAGE {page_num + 1} ---\n{text}")
    return "\n\n".join(pages_text)

def parse_fmr_pdf_with_ai(file_path: str, db: Session):
    """
    Parses a Fund Manager Report PDF using Alibaba Cloud Qwen (Model Studio)
    with Gemini fallback via unified llm_service.
    Extracts Risk Profile, Asset Allocation, and official performance returns for each fund.
    """
    active_ai = get_active_ai_provider()
    if active_ai.get("status") == "missing_keys":
        logger.error("No AI API key found (Neither DASHSCOPE_API_KEY nor GEMINI_API_KEY). Cannot parse FMR.")
        return 0
        
    funds = db.query(Fund).all()
    
    logger.info(f"Extracting text from FMR PDF: {file_path} using PyMuPDF...")
    
    try:
        pdf_text = extract_text_from_pdf(file_path)
        if not pdf_text.strip():
            logger.warning(f"No text extracted from FMR PDF: {file_path}")
            return 0
            
        logger.info(f"FMR text extracted ({len(pdf_text)} characters). Requesting extraction via {active_ai.get('provider')} ({active_ai.get('model')})...")
        
        system_prompt = (
            "You are an expert financial analyst. You will be provided with text extracted from a monthly "
            "Pakistani mutual fund Fund Manager Report (FMR). Extract structured data for all funds mentioned."
        )
        
        prompt = f"""Attached is the extracted content from a monthly Fund Manager Report (FMR) PDF. 
Your goal is to find and extract information for EVERY single fund mentioned in this report.

Also extract the Asset Management Company (AMC) or Bank name that generated this report (e.g., "Al Meezan Investment Management", "HBL Asset Management", "Atlas", "Faysal").

For every fund found in the document, extract:
1. "fund_name": The full name of the fund.
2. "short_name": The initials or short abbreviation of the fund (e.g., "MCF" for "Meezan Cash Fund" or "HBL-IF" for "HBL Income Fund").
3. "risk_profile": The official risk rating assigned to the fund (e.g. "Low", "Moderate", "Medium", "High").
4. "asset_allocation": A concise string summarizing the actual asset allocation percentages mentioned for the fund (e.g. "Equities: 65%, Cash: 20%, Sukuks: 15%"). Keep it brief but accurate.
5. "fund_type": The fundamental underlying asset category the fund predominantly invests in. STRICTLY choose ONE of the following: "Equity", "Money Market", "Income", "Asset Allocation", or "Commodity". Do NOT output generic terms like "Pension Scheme". If it is a pension sub-fund, determine its type (e.g., an "Equity sub Fund" is "Equity").
6. "return_1m": The 1-month historical return percentage of the fund mentioned in the report (as a float, e.g. 5.5). If not mentioned, output null.
7. "return_6m": The 6-month historical return percentage of the fund. If not mentioned, output null.
8. "return_1y": The 1-year historical return percentage of the fund. If not mentioned, output null.
9. "return_ytd": The Year-to-Date (YTD) historical return percentage of the fund. If not mentioned, output null.

Return the result strictly as a valid JSON object.
Format:
{{
    "bank_name": "Al Meezan Investment Management",
    "funds": [
        {{
            "fund_name": "Meezan Islamic Fund",
            "short_name": "MIF",
            "risk_profile": "High",
            "asset_allocation": "Equities: 90%, Cash: 10%",
            "fund_type": "Equity",
            "return_1m": 1.2,
            "return_6m": -0.5,
            "return_1y": 15.4,
            "return_ytd": 8.0
        }}
    ]
}}

DOCUMENT CONTENT:
{pdf_text[:60000]}
"""
        extracted_data = generate_json(prompt, system_prompt=system_prompt, temperature=0.1)
        if not extracted_data or not isinstance(extracted_data, dict):
            logger.error("AI returned invalid data structure for FMR extraction.")
            return 0
            
        extracted_bank_name = extracted_data.get("bank_name", "")
        extracted_funds = extracted_data.get("funds", [])
        
        # Fuzzy match extracted bank name to our canonical banks
        banks = db.query(Bank).all()
        target_bank = None
        for b in banks:
            # e.g., "Meezan" in "Al Meezan Investment Management"
            if b.name.lower() in extracted_bank_name.lower():
                target_bank = b
                break
                
        if not target_bank:
            # Fallback: check filename
            from pathlib import Path
            filename_lower = Path(file_path).name.lower()
            for b in banks:
                if b.name.lower() in filename_lower:
                    target_bank = b
                    break
                    
        if not target_bank and extracted_bank_name:
            logger.info(f"Creating new Bank entry for {extracted_bank_name}")
            target_bank = Bank(name=extracted_bank_name.strip())
            db.add(target_bank)
            db.commit()
            db.refresh(target_bank)
        
        # Map back to DB objects
        fund_map = {f.name.lower().strip(): f for f in funds}
        updated_count = 0
        
        def parse_optional_float(val):
            if val is None: return None
            try:
                if isinstance(val, str):
                    v = val.replace('%', '').replace(',', '').strip()
                    return float(v) if v else None
                return float(val)
            except:
                return None
                
        import re
        def normalize_name(s):
            return re.sub(r'[^a-z0-9]', '', s.lower().replace('sub fund', '').replace('sub-fund', '').replace('fund', '').replace('index', '').replace('tracker', '').replace('plan', ''))
            
        for item in extracted_funds:
            f_name = item.get("fund_name", "").strip()
            if not f_name:
                continue
            f_name_lower = f_name.lower()
            norm_f_name = normalize_name(f_name)
            norm_short_name = normalize_name(item.get("short_name", "")) if item.get("short_name") else ""
            
            matched_fund_obj = None
            for db_name_lower, f_obj in fund_map.items():
                db_norm = normalize_name(db_name_lower)
                db_short_norm = normalize_name(f_obj.short_name) if f_obj.short_name else ""
                
                if db_norm == norm_f_name:
                    matched_fund_obj = f_obj
                    break
                    
                if norm_short_name and db_short_norm and (norm_short_name == db_short_norm or norm_short_name in db_short_norm):
                    matched_fund_obj = f_obj
                    break
                    
                if db_short_norm and db_short_norm == norm_f_name:
                    matched_fund_obj = f_obj
                    break
            
            if matched_fund_obj:
                fund_obj = matched_fund_obj
                fund_obj.risk_profile = item.get("risk_profile", "Unknown").capitalize()
                fund_obj.asset_allocation = item.get("asset_allocation", "Unknown")
                fund_obj.fund_type = item.get("fund_type", "Unknown").title()
                
                short_name = item.get("short_name", "")
                if short_name:
                    fund_obj.short_name = short_name.strip()
                    
                fund_obj.fmr_return_1m = parse_optional_float(item.get("return_1m"))
                fund_obj.fmr_return_6m = parse_optional_float(item.get("return_6m"))
                fund_obj.fmr_return_1y = parse_optional_float(item.get("return_1y"))
                fund_obj.fmr_return_ytd = parse_optional_float(item.get("return_ytd"))
                    
                if target_bank and not fund_obj.bank_id:
                    fund_obj.bank_id = target_bank.id
                updated_count += 1
            else:
                if target_bank:
                    logger.info(f"Discovered new fund '{f_name}' for bank '{target_bank.name}'. Adding to database.")
                    new_fund = Fund(
                        name=f_name,
                        bank_id=target_bank.id,
                        short_name=item.get("short_name", "").strip() or None,
                        category=item.get("fund_type", "Unknown").title(),  # Using fund_type as category fallback
                        risk_profile=item.get("risk_profile", "Unknown").capitalize(),
                        asset_allocation=item.get("asset_allocation", "Unknown"),
                        fund_type=item.get("fund_type", "Unknown").title(),
                        fmr_return_1m=parse_optional_float(item.get("return_1m")),
                        fmr_return_6m=parse_optional_float(item.get("return_6m")),
                        fmr_return_1y=parse_optional_float(item.get("return_1y")),
                        fmr_return_ytd=parse_optional_float(item.get("return_ytd"))
                    )
                    db.add(new_fund)
                    db.flush() # flush to get ID without committing entire transaction yet
                    fund_map[f_name.lower()] = new_fund
                    updated_count += 1
                
        if updated_count > 0:
            db.commit()
            logger.info(f"Successfully enriched/created {updated_count} funds from AI FMR Parsing.")
            
        return updated_count
    except Exception as e:
        logger.error(f"Failed to parse FMR PDF with AI: {e}")
        return 0
