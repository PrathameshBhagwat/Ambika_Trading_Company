"""
Ambika Trading - Application Configuration

Centralizes all application settings including paths, database configuration,
and business defaults. Uses pydantic-settings for environment variable support.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide settings."""

    # Application metadata
    APP_NAME: str = "Ambika Trading - Farmer Settlement Management System"
    APP_VERSION: str = "1.0.0"

    # Paths
    APP_DATA_DIR: Path = Path(os.environ.get(
        "APPDATA",
        os.path.expanduser("~")
    )) / "AmbikaTrading"
    
    DB_FILENAME: str = "ambika_trading.db"
    LOG_DIR_NAME: str = "Logs"
    BACKUP_DIR_NAME: str = "Backups"

    # Database
    SQLITE_PRAGMA_JOURNAL_MODE: str = "wal"
    SQLITE_PRAGMA_FOREIGN_KEYS: str = "ON"
    SQLITE_PRAGMA_BUSY_TIMEOUT: int = 5000

    # Server
    API_HOST: str = "127.0.0.1"
    API_PORT: int = 8741

    # Business defaults
    BILL_NUMBER_PREFIX: str = "AT"
    CURRENCY_SYMBOL: str = "₹"
    CURRENCY_CODE: str = "INR"
    RATE_UNIT_KG: int = 10  # Rate is always per 10 KG
    DECIMAL_PRECISION: int = 2

    # Backup
    MAX_AUTO_BACKUPS: int = 30
    AUTO_BACKUP_ON_EXIT: bool = True

    @property
    def DATABASE_URL(self) -> str:
        db_path = self.APP_DATA_DIR / self.DB_FILENAME
        return f"sqlite:///{db_path}"

    @property
    def DATABASE_PATH(self) -> Path:
        return self.APP_DATA_DIR / self.DB_FILENAME

    @property
    def LOG_DIR(self) -> Path:
        return self.APP_DATA_DIR / self.LOG_DIR_NAME

    @property
    def BACKUP_DIR(self) -> Path:
        return self.APP_DATA_DIR / self.BACKUP_DIR_NAME

    def ensure_directories(self) -> None:
        """Create all required application directories if they don't exist."""
        self.APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    class Config:
        env_prefix = "AMBIKA_"


settings = Settings()
