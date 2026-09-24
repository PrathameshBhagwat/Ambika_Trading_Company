"""
Backup & Restore API router.

Handles manual backup, restore, and auto-backup operations.
Backup = copy SQLite file. Restore = validate + replace SQLite file.
"""

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from config import settings
from utils.logger import logger

router = APIRouter(prefix="/api/backup", tags=["Backup"])


class BackupResponse(BaseModel):
    message: str
    backup_path: str
    timestamp: str


class RestoreResponse(BaseModel):
    message: str
    restored_from: str


class BackupListResponse(BaseModel):
    backups: list[dict]
    total: int


def _validate_sqlite(filepath: Path) -> bool:
    """Check if a file is a valid SQLite database."""
    try:
        conn = sqlite3.connect(str(filepath))
        cursor = conn.cursor()
        cursor.execute("SELECT count(*) FROM sqlite_master")
        conn.close()
        return True
    except Exception:
        return False


@router.post("/create", response_model=BackupResponse)
def create_backup(
    backup_dir: str | None = Query(None, description="Custom backup directory path"),
):
    """
    Create a manual backup of the database.
    Copies the SQLite file to the backup directory with timestamp in filename.
    """
    settings.ensure_directories()

    target_dir = Path(backup_dir) if backup_dir else settings.BACKUP_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    db_path = settings.DATABASE_PATH
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database file not found")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"ambika_backup_{timestamp}.db"
    backup_path = target_dir / backup_filename

    try:
        shutil.copy2(str(db_path), str(backup_path))
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Backup failed. Please check disk space and permissions."
        )

    logger.info(f"Backup created: {backup_path}")

    return BackupResponse(
        message="Backup created successfully",
        backup_path=str(backup_path),
        timestamp=timestamp,
    )


def prune_old_backups(backup_dir: Path, max_keep: int = 30) -> list[str]:
    """
    Keep the latest max_keep automatic backups and delete older ones.
    Only called AFTER a successful new backup.
    Returns list of deleted filenames.
    """
    deleted = []
    auto_backups = sorted(
        backup_dir.glob("ambika_backup_*.db"),
        key=lambda f: f.stat().st_mtime,
        reverse=True
    )
    if len(auto_backups) > max_keep:
        to_delete = auto_backups[max_keep:]
        for f in to_delete:
            try:
                f.unlink()
                deleted.append(f.name)
                logger.info(f"Pruned older auto-backup: {f.name}")
            except Exception as e:
                logger.warning(f"Could not delete old backup {f.name}: {e}")
    return deleted


def perform_auto_backup() -> dict:
    """
    Perform an automated backup on application exit:
    1. Copies the SQLite database to %USERPROFILE%/AmbikaTrading/Backups/
    2. Format: ambika_backup_YYYYMMDD_HHMMSS.db
    3. Validates backup integrity
    4. Keeps latest 30 backups, deleting older ones only after successful new backup
    """
    settings.ensure_directories()
    backup_dir = settings.BACKUP_DIR
    backup_dir.mkdir(parents=True, exist_ok=True)

    db_path = settings.DATABASE_PATH
    if not db_path.exists():
        logger.warning(f"Auto-backup skipped: Database file does not exist at {db_path}")
        return {"success": False, "reason": "Database file not found"}

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"ambika_backup_{timestamp}.db"
    backup_path = backup_dir / backup_filename

    try:
        src = sqlite3.connect(str(db_path))
        dst = sqlite3.connect(str(backup_path))
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
    except Exception as e:
        logger.warning(f"Sqlite online backup failed, using copy2: {e}")
        try:
            shutil.copy2(str(db_path), str(backup_path))
        except Exception as copy_err:
            logger.error(f"Auto-backup copy failed: {copy_err}")
            return {"success": False, "reason": str(copy_err)}

    # Validate backup integrity
    if not _validate_sqlite(backup_path):
        logger.error(f"Auto-backup validation failed for {backup_path}")
        try:
            backup_path.unlink(missing_ok=True)
        except Exception:
            pass
        return {"success": False, "reason": "Backup verification failed"}

    # Rotate / prune older backups (keeping latest 30)
    pruned = prune_old_backups(backup_dir, max_keep=settings.MAX_AUTO_BACKUPS)

    logger.info(f"Auto-backup successfully created: {backup_path}. Pruned: {len(pruned)}")
    return {
        "success": True,
        "backup_path": str(backup_path),
        "backup_filename": backup_filename,
        "timestamp": timestamp,
        "pruned": pruned,
    }


@router.post("/auto-backup")
def trigger_auto_backup():
    """Trigger an automatic backup with 30-backup retention."""
    res = perform_auto_backup()
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("reason", "Auto-backup failed"))
    return res


@router.post("/restore", response_model=RestoreResponse)
def restore_backup(
    backup_path: str = Query(..., description="Path to the backup file to restore"),
):
    """
    Restore the database from a backup file.

    Steps:
    1. Validate the backup file is a valid SQLite database
    2. Create a safety backup of the current database
    3. Replace the current database with the backup
    """
    source = Path(backup_path)

    if not source.exists():
        raise HTTPException(status_code=404, detail="Backup file not found")

    if not _validate_sqlite(source):
        raise HTTPException(
            status_code=400,
            detail="Restore failed. Invalid or corrupted backup file."
        )

    # Safety backup before restore
    db_path = settings.DATABASE_PATH
    if db_path.exists():
        safety_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_path = settings.BACKUP_DIR / f"pre_restore_safety_{safety_timestamp}.db"
        try:
            shutil.copy2(str(db_path), str(safety_path))
            logger.info(f"Safety backup created: {safety_path}")
        except Exception as e:
            logger.error(f"Safety backup failed: {e}")
            raise HTTPException(
                status_code=500,
                detail="Could not create safety backup before restore."
            )

    # Perform restore
    try:
        shutil.copy2(str(source), str(db_path))
    except Exception as e:
        logger.error(f"Restore failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Restore failed. The previous database has been preserved as a safety backup."
        )

    logger.info(f"Database restored from: {source}")

    # Log audit entry in restored database
    try:
        from database import SessionLocal
        from services.audit_service import log_audit
        with SessionLocal() as db_session:
            log_audit(
                db=db_session,
                entity_type="Database",
                entity_id=0,
                action="RESTORE",
                old_values={"safety_backup": str(safety_path) if db_path.exists() else None},
                new_values={"restored_from": str(source)},
                performed_by="operator",
            )
            db_session.commit()
    except Exception as audit_err:
        logger.warning(f"Could not record audit log after restore: {audit_err}")

    return RestoreResponse(
        message="Database restored successfully. Please restart the application.",
        restored_from=str(source),
    )


@router.get("/list", response_model=BackupListResponse)
def list_backups():
    """List all available backup files in the default backup directory."""
    settings.ensure_directories()
    backup_dir = settings.BACKUP_DIR

    backups = []
    for f in sorted(backup_dir.glob("ambika_backup_*.db"), reverse=True):
        stat = f.stat()
        backups.append({
            "filename": f.name,
            "path": str(f),
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
        })

    return BackupListResponse(backups=backups, total=len(backups))
