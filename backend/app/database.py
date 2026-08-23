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
