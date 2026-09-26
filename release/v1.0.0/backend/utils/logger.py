"""
Ambika Trading - Logging Setup

Configures file-based logging for the application.
Logs are stored in %APPDATA%/AmbikaTrading/Logs/.
"""

import logging
import sys
from datetime import datetime
from pathlib import Path

from config import settings


def setup_logger(name: str = "ambika") -> logging.Logger:
    """
    Set up and return a logger that writes to both console and log file.

    Log file: <APP_DATA_DIR>/Logs/ambika_YYYYMMDD.log
    """
    settings.ensure_directories()

    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Prevent duplicate handlers on repeated calls
    if logger.handlers:
        return logger

    # Ensure stdout handles UTF-8 on Windows
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    # Console handler (INFO level)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_format = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    console_handler.setFormatter(console_format)

    # File handler (DEBUG level — captures everything)
    log_filename = f"ambika_{datetime.now().strftime('%Y%m%d')}.log"
    log_path = settings.LOG_DIR / log_filename
    file_handler = logging.FileHandler(str(log_path), encoding="utf-8")
    file_handler.setLevel(logging.DEBUG)
    file_format = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_format)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger


# Application-wide logger instance
logger = setup_logger()
