from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, JSON, Boolean, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    portfolios = relationship("Portfolio", back_populates="user")

class Bank(Base):
    __tablename__ = "banks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)  # Meezan, HBL, Atlas, Faysal

    funds = relationship("Fund", back_populates="bank")
    portfolios = relationship("Portfolio", back_populates="bank")

class Fund(Base):
    __tablename__ = "funds"

    id = Column(Integer, primary_key=True, index=True)
    bank_id = Column(Integer, ForeignKey("banks.id"), index=True)
    name = Column(String, index=True)
    short_name = Column(String, nullable=True) # E.g., MCF for Meezan Cash Fund
    category = Column(String)  # Equity, Gold, Money Market, etc.
    
    # Enriched FMR Metadata (Parsed via PDF uploads/folder watchers)
    risk_profile = Column(String, nullable=True)     # "Low", "Moderate", "High"
    asset_allocation = Column(String, nullable=True) # "80% Stocks, 20% Cash"
    fund_type = Column(String, nullable=True)        # "Money Market", "Equity", "Income"
    
    # Official FMR Historical Returns (Fallback for Pension Funds)
    fmr_return_1m = Column(Float, nullable=True)
    fmr_return_6m = Column(Float, nullable=True)
    fmr_return_1y = Column(Float, nullable=True)
    fmr_return_ytd = Column(Float, nullable=True)
    
    is_active = Column(Boolean, default=True)

    bank = relationship("Bank", back_populates="funds")

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    bank_id = Column(Integer, ForeignKey("banks.id"), index=True)
    account_number = Column(String, index=True) # Portfolio ID/Account Number
    holder_name = Column(String)

    user = relationship("User", back_populates="portfolios")
    bank = relationship("Bank", back_populates="portfolios")
    statements = relationship("Statement", back_populates="portfolio")

class Statement(Base):
    __tablename__ = "statements"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True)
    date = Column(String)  # YYYY-MM-DD
    file_path = Column(String)
    raw_data = Column(JSON) # Store parsed data as JSON
    created_at = Column(DateTime, default=datetime.utcnow)

    portfolio = relationship("Portfolio", back_populates="statements")

class FundNAVHistory(Base):
    __tablename__ = "fund_nav_history"

    id = Column(Integer, primary_key=True, index=True)
    fund_id = Column(Integer, ForeignKey("funds.id"), index=True)
    date = Column(String, index=True) # YYYY-MM-DD
    nav_price = Column(Float)

    fund = relationship("Fund", backref="nav_history")

    __table_args__ = (
        Index('ix_fund_nav_history_fund_date', 'fund_id', 'date'),
    )

class FundPerformanceMetrics(Base):
    __tablename__ = "fund_performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    fund_id = Column(Integer, ForeignKey("funds.id"), index=True)
    date = Column(String, index=True) # Date these metrics were scraped
    return_1m = Column(Float, nullable=True)
    return_6m = Column(Float, nullable=True)
    return_1y = Column(Float, nullable=True)
    return_ytd = Column(Float, nullable=True)

    fund = relationship("Fund", backref="performance_metrics")

    __table_args__ = (
        Index('ix_fund_perf_fund_date', 'fund_id', 'date'),
    )


class UserBankConfig(Base):
    """Stores per-user, per-bank settings such as PDF passwords for encrypted statements."""
    __tablename__ = "user_bank_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bank_name = Column(String, nullable=False)   # lowercase: "atlas", "meezan", etc.
    pdf_password = Column(String, nullable=True) # password to open encrypted PDF statements

    user = relationship("User", backref="bank_configs")


# ─── News Intelligence Tables ──────────────────────────────────────────────────

class NewsArticle(Base):
    """Cached news articles fetched from RSS feeds and APIs. Overwritten every 6-hour refresh cycle."""
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)
    source = Column(String, nullable=False)          # e.g. "Dawn Business", "Business Recorder"
    published_at = Column(DateTime, nullable=True, index=True)
    summary = Column(String, nullable=True)          # 2-5 sentence extracted summary
    tags = Column(JSON, nullable=True)               # e.g. ["PSX", "Gold", "SBP"]
    relevance_score = Column(Float, nullable=True)   # 0.0 – 1.0 keyword relevance
    scraped_at = Column(DateTime, default=datetime.utcnow)


class AssetPrediction(Base):
    """Gemini AI asset impact predictions — one row per asset class per refresh cycle."""
    __tablename__ = "asset_predictions"

    id = Column(Integer, primary_key=True, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)
    asset_class = Column(String, nullable=False)     # "PSX", "Gold", "Silver", "Money Market", etc.
    short_impact = Column(JSON, nullable=True)        # {"score": 6, "direction": "Negative", "reason": "..."}
    medium_impact = Column(JSON, nullable=True)
    long_impact = Column(JSON, nullable=True)
    reasoning = Column(String, nullable=True)        # One-sentence plain-language summary
    news_article_ids = Column(JSON, nullable=True)   # List of NewsArticle IDs used


class WorldContextEntry(Base):
    """Persistent long-term geopolitical/macro events. Never bulk-deleted — only updated by Gemini."""
    __tablename__ = "world_context_entries"

    id = Column(Integer, primary_key=True, index=True)
    fact = Column(String, nullable=False)            # e.g. "Russia-Ukraine war: ongoing energy disruption"
    category = Column(String, nullable=True)         # "Geopolitical", "Monetary Policy", "Commodities", etc.
    is_active = Column(Boolean, default=True, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    source_article_ids = Column(JSON, nullable=True) # IDs of NewsArticles that triggered this entry
    impact_scores = Column(JSON, nullable=True)      # {"PSX": {"direction": "Bearish"}, "Gold": {"direction": "Bullish"}}


class NewsMetadata(Base):
    """Single-row config table tracking the last refresh state. Checked before every fetch cycle."""
    __tablename__ = "news_metadata"

    id = Column(Integer, primary_key=True, index=True)
    last_refreshed_at = Column(DateTime, nullable=True) # for News
    refresh_status = Column(String, default="idle")     # for News
    error_message = Column(String, nullable=True)       # for News
    
    last_ai_refreshed_at = Column(DateTime, nullable=True) # for AI
    ai_status = Column(String, default="idle")             # "idle" | "analyzing" | "error"
    ai_error_message = Column(String, nullable=True)       # for AI


class ScraperStatus(Base):
    """Tracks the health of individual scrapers (e.g., MUFAP, SBP, IMF, Trading Economics)."""
    __tablename__ = "scraper_status"

    id = Column(Integer, primary_key=True, index=True)
    scraper_name = Column(String, unique=True, index=True, nullable=False) # e.g., "mufap_daily", "sbp_press"
    is_healthy = Column(Boolean, default=True)  # True if last run succeeded without AI fallback
    last_run_at = Column(DateTime, default=datetime.utcnow)
    error_message = Column(String, nullable=True) # Describes the failure or notes the use of AI fallback
    requires_maintenance = Column(Boolean, default=False) # Explicit flag for UI warnings
