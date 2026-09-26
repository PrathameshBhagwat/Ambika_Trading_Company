"""
Ambika Trading - Database Engine & Session Management

Configures SQLAlchemy engine with SQLite-specific pragmas (WAL mode,
foreign keys) and provides session dependency for FastAPI routes.
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator

from config import settings


# Ensure the data directory exists before creating the engine
settings.ensure_directories()

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection, connection_record):
    """Set SQLite pragmas on every new connection for performance and integrity."""
    cursor = dbapi_connection.cursor()
    cursor.execute(f"PRAGMA journal_mode={settings.SQLITE_PRAGMA_JOURNAL_MODE}")
    cursor.execute(f"PRAGMA foreign_keys={settings.SQLITE_PRAGMA_FOREIGN_KEYS}")
    cursor.execute(f"PRAGMA busy_timeout={settings.SQLITE_PRAGMA_BUSY_TIMEOUT}")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy ORM models."""
    pass


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
