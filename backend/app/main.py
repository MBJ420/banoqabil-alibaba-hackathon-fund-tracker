from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, users, dashboard, performance, news
from .database import engine, Base
from apscheduler.schedulers.background import BackgroundScheduler
from .services.watcher import Watcher
from .services.scraper import scrape_mufap_data
from .services.news_service import run_news_pipeline
from .config import PDF_DATA_DIR
import logging
import os
import threading
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models import ScraperStatus

logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fund Tracker API")

# Initialize Watcher and Scheduler
# PDF_DATA_DIR points to "Fund Tracker PDF Data/" inside the project root.
# This works on any machine — no C:\Users\... paths needed.
data_directory = str(PDF_DATA_DIR)
watcher = Watcher(data_directory)
scheduler = BackgroundScheduler()

# Add the daily MUFAP scraping job to run every day at 18:00 (6:00 PM)
# Adjust hour and minute as necessary depending on server timezone vs PKT
scheduler.add_job(
    scrape_mufap_data, 
    'cron', 
    hour=18, 
    minute=0, 
    id='daily_mufap_scrape', 
    replace_existing=True
)

# Run the news pipeline every 6 hours (cache check is inside the pipeline itself)
scheduler.add_job(
    run_news_pipeline,
    'interval',
    hours=6,
    id='news_pipeline',
    replace_existing=True
)

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8001",
    "http://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(dashboard.router)
app.include_router(performance.router)
app.include_router(news.router)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting background services...")
    watcher.start_background()
    scheduler.start()
    logger.info("Background services started.")
    
    # Check if scraper needs to run immediately
    db = SessionLocal()
    try:
        status = db.query(ScraperStatus).filter(ScraperStatus.scraper_name == "mufap_daily").first()
        last_run = status.last_run_at if status else None
        if last_run and last_run.tzinfo is not None:
            last_run = last_run.replace(tzinfo=None)
        if not status or not last_run or (datetime.utcnow() - last_run) > timedelta(hours=24):
            logger.info("MUFAP scraper hasn't run in over 24 hours. Triggering immediately in background...")
            threading.Thread(target=scrape_mufap_data, daemon=True).start()
    except Exception as e:
        logger.error(f"Failed to check scraper status on startup: {e}")
    finally:
        db.close()

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Stopping background services...")
    watcher.stop()
    scheduler.shutdown()
    logger.info("Background services stopped.")

@app.get("/")
def read_root():
    return {"message": "Welcome to Fund Tracker API"}
