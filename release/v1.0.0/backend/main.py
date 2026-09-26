"""
Ambika Trading - FastAPI Application Entry Point

Starts the embedded API server on localhost:8741.
Creates database tables on startup if they don't exist.
Registers all routers and CORS middleware.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from utils.logger import logger

# Import all models so Base.metadata knows about them
import models  # noqa: F401

from routers import farmers, vegetables, transactions, payments, reports, backup, audit
from utils.seed_data import seed_initial_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    settings.ensure_directories()

    # Create all tables if they don't exist
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database ready: {settings.DATABASE_PATH}")

    # Ensure buyer_name column exists in transactions table (migration for existing DBs)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            columns = [row[1] for row in conn.execute(text("PRAGMA table_info(transactions)")).fetchall()]
            if "buyer_name" not in columns:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN buyer_name VARCHAR(100)"))
                conn.commit()
                logger.info("Migrated transactions table: added buyer_name column")
    except Exception as e:
        logger.warning(f"Column check for buyer_name skipped/handled: {e}")

    # Seed initial masters if fresh DB
    seed_initial_data()

    yield

    # Shutdown
    logger.info("Application shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Farmer settlement management system for vegetable brokers/traders",
    lifespan=lifespan,
)

# CORS — allow requests from the Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Electron renderer runs on a different port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(farmers.router)
app.include_router(vegetables.router)
app.include_router(transactions.router)
app.include_router(payments.router)
app.include_router(reports.router)
app.include_router(backup.router)
app.include_router(audit.router)


@app.get("/api/health", tags=["System"])
def health_check():
    """Health check endpoint for Electron to verify backend is running."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=False,
        log_level="info",
    )
