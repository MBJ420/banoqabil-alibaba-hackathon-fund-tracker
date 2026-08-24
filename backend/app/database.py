from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# UPDATED: Use SQLite in the project root to ensure consistency with root tools
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
default_db_path = os.path.join(project_root, "fundtracker.db")
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Enable Write-Ahead Logging so background writers (MUFAP scraper, PDF watcher,
# news updater) no longer block concurrent API reads with exclusive locks.
# busy_timeout lets readers wait instead of failing with "database is locked",
# and foreign_keys=ON enforces referential integrity at the connection level.
@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA busy_timeout=5000;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_indexes() -> None:
    """Create performance indexes if they don't already exist.

    SQLAlchemy's ``create_all`` only creates missing *tables*, not indexes on
    tables that already exist, so newly added indexes must be applied
    explicitly. Safe to call on every startup (CREATE INDEX IF NOT EXISTS is a
    no-op when the index is already present).
    """
    from sqlalchemy import text

    indexes = [
        ("ix_funds_bank_id", "funds", "bank_id"),
        ("ix_portfolios_user_id", "portfolios", "user_id"),
        ("ix_portfolios_bank_id", "portfolios", "bank_id"),
        ("ix_statements_portfolio_id", "statements", "portfolio_id"),
        ("ix_news_articles_published_at", "news_articles", "published_at"),
        ("ix_fund_nav_history_fund_date", "fund_nav_history", "fund_id, date"),
        ("ix_fund_perf_fund_date", "fund_performance_metrics", "fund_id, date"),
    ]
    with engine.connect() as conn:
        for name, table, cols in indexes:
            conn.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({cols})"))
        conn.commit()
