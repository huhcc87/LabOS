"""
Professional database migration runner for LabOS.

Features:
  - Auto-detects untracked databases (created via create_all) and stamps them
  - Applies pending migrations on startup with full error reporting
  - Provides status, history, upgrade, downgrade, and stamp operations
  - All operations are safe to call from FastAPI startup or CLI
"""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

logger = logging.getLogger(__name__)

# Path to alembic.ini relative to this file (backend/app/core/ → backend/)
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
_ALEMBIC_INI = os.path.join(_BACKEND_ROOT, "alembic.ini")


# ── Config helpers ─────────────────────────────────────────────────────────

def _alembic_cfg(db_url: Optional[str] = None) -> Config:
    cfg = Config(_ALEMBIC_INI)
    if db_url:
        cfg.set_main_option("sqlalchemy.url", db_url)
    elif url := os.environ.get("DATABASE_URL"):
        cfg.set_main_option("sqlalchemy.url", url)
    return cfg


def _engine(db_url: Optional[str] = None):
    from app.core.database import engine as default_engine
    if db_url:
        from sqlalchemy import create_engine as _ce
        args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        return _ce(db_url, connect_args=args)
    return default_engine


# ── Core inspection ────────────────────────────────────────────────────────

def get_current_revision(db_url: Optional[str] = None) -> Optional[str]:
    """Return the revision currently recorded in the DB, or None if untracked."""
    eng = _engine(db_url)
    try:
        with eng.connect() as conn:
            ctx = MigrationContext.configure(conn)
            return ctx.get_current_revision()
    except Exception:
        return None


def get_head_revision(db_url: Optional[str] = None) -> Optional[str]:
    """Return the latest migration revision (head)."""
    cfg = _alembic_cfg(db_url)
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    return heads[0] if heads else None


def get_pending_revisions(db_url: Optional[str] = None) -> list[str]:
    """Return list of revision IDs not yet applied to the DB."""
    cfg = _alembic_cfg(db_url)
    script = ScriptDirectory.from_config(cfg)
    current = get_current_revision(db_url)
    head = get_head_revision(db_url)

    if current == head:
        return []

    # Walk from head back to current, collecting revisions not yet applied
    applied: set[str] = set()
    if current:
        try:
            for rev in script.iterate_revisions(current, "base"):
                applied.add(rev.revision)
            applied.add(current)
        except Exception:
            pass

    pending = []
    try:
        for rev in script.walk_revisions():
            if rev.revision not in applied:
                pending.append(rev.revision)
    except Exception:
        pass
    return list(reversed(pending))


def is_db_untracked(db_url: Optional[str] = None) -> bool:
    """Return True if alembic_version table does not exist."""
    eng = _engine(db_url)
    with eng.connect() as conn:
        insp = inspect(eng)
        return "alembic_version" not in insp.get_table_names()


def db_has_data(db_url: Optional[str] = None) -> bool:
    """Return True if the DB already has app tables (created via create_all)."""
    eng = _engine(db_url)
    insp = inspect(eng)
    tables = insp.get_table_names()
    return "users" in tables


# ── Migration operations ───────────────────────────────────────────────────

def upgrade(target: str = "head", db_url: Optional[str] = None) -> dict:
    """Apply migrations up to target revision. Returns result dict."""
    cfg = _alembic_cfg(db_url)
    before = get_current_revision(db_url)
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        command.upgrade(cfg, target)
        after = get_current_revision(db_url)
        logger.info("Migration upgrade %s → %s", before, after)
        return {
            "success": True,
            "from_revision": before,
            "to_revision": after,
            "target": target,
            "started_at": started_at,
        }
    except Exception as exc:
        logger.error("Migration upgrade failed: %s", exc)
        return {
            "success": False,
            "from_revision": before,
            "to_revision": None,
            "target": target,
            "started_at": started_at,
            "error": str(exc),
        }


def downgrade(target: str = "-1", db_url: Optional[str] = None) -> dict:
    """Roll back to target revision. Returns result dict."""
    cfg = _alembic_cfg(db_url)
    before = get_current_revision(db_url)
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        command.downgrade(cfg, target)
        after = get_current_revision(db_url)
        logger.info("Migration downgrade %s → %s", before, after)
        return {
            "success": True,
            "from_revision": before,
            "to_revision": after,
            "target": target,
            "started_at": started_at,
        }
    except Exception as exc:
        logger.error("Migration downgrade failed: %s", exc)
        return {
            "success": False,
            "from_revision": before,
            "to_revision": None,
            "target": target,
            "started_at": started_at,
            "error": str(exc),
        }


def stamp(revision: str, db_url: Optional[str] = None) -> dict:
    """Mark the DB at revision without running any migration SQL."""
    cfg = _alembic_cfg(db_url)
    try:
        command.stamp(cfg, revision)
        actual = get_current_revision(db_url)
        logger.info("DB stamped at %s", actual)
        return {"success": True, "stamped_revision": actual}
    except Exception as exc:
        logger.error("Stamp failed: %s", exc)
        return {"success": False, "error": str(exc)}


def create_revision(message: str, autogenerate: bool = False, db_url: Optional[str] = None) -> dict:
    """Generate a new migration file, optionally with autogenerated diff."""
    cfg = _alembic_cfg(db_url)
    try:
        rev = command.revision(cfg, message=message, autogenerate=autogenerate)
        return {"success": True, "revision": getattr(rev, "revision", str(rev))}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


# ── Status & history ───────────────────────────────────────────────────────

def get_history(db_url: Optional[str] = None) -> list[dict]:
    """Return all migration revisions with applied/pending status."""
    cfg = _alembic_cfg(db_url)
    script = ScriptDirectory.from_config(cfg)
    current = get_current_revision(db_url)

    # Build set of applied revisions (iterate from current DOWN to base)
    applied: set[str] = set()
    if current:
        for rev in script.iterate_revisions(current, "base"):
            applied.add(rev.revision)

    history = []
    for rev in script.walk_revisions():
        history.append({
            "revision": rev.revision,
            "down_revision": rev.down_revision,
            "description": rev.doc or "",
            "is_current": rev.revision == current,
            "is_applied": rev.revision in applied,
            "branch_labels": list(rev.branch_labels) if rev.branch_labels else [],
        })
    return history


def get_status(db_url: Optional[str] = None) -> dict:
    """Return comprehensive migration status."""
    current = get_current_revision(db_url)
    head = get_head_revision(db_url)
    pending = get_pending_revisions(db_url)
    untracked = is_db_untracked(db_url)

    return {
        "current_revision": current,
        "head_revision": head,
        "is_up_to_date": current == head and not untracked,
        "is_untracked": untracked,
        "pending_count": len(pending),
        "pending_revisions": pending,
        "history": get_history(db_url),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Startup runner ─────────────────────────────────────────────────────────

def auto_migrate(db_url: Optional[str] = None) -> None:
    """
    Smart startup migration runner. Call this instead of Base.metadata.create_all().

    Logic:
      1. If alembic_version table is missing AND the DB already has app tables
         → DB was created by create_all without Alembic. Stamp at head so
           future migrations are tracked correctly.
      2. If alembic_version table is missing AND the DB is empty
         → Fresh install. Run all migrations from scratch.
      3. If alembic_version exists and there are pending migrations
         → Apply them automatically.
      4. If already up to date → do nothing.
    """
    logger.info("LabOS migration check starting...")

    try:
        if is_db_untracked(db_url):
            if db_has_data(db_url):
                # Existing DB created by create_all — stamp without running SQL
                logger.warning(
                    "Untracked database detected (previously created via create_all). "
                    "Stamping at head revision to enable future migration tracking."
                )
                result = stamp("head", db_url)
                if result["success"]:
                    logger.info(
                        "✅ DB stamped at %s — future schema changes will use migrations.",
                        result["stamped_revision"],
                    )
                else:
                    logger.error("❌ Failed to stamp DB: %s", result.get("error"))
            else:
                # Truly fresh DB — run all migrations
                logger.info("Fresh database detected. Running all migrations...")
                result = upgrade("head", db_url)
                if result["success"]:
                    logger.info("✅ Fresh install complete at %s", result["to_revision"])
                else:
                    raise RuntimeError(f"Initial migration failed: {result['error']}")
        else:
            pending = get_pending_revisions(db_url)
            if pending:
                logger.info(
                    "Found %d pending migration(s): %s — applying now...",
                    len(pending), pending,
                )
                result = upgrade("head", db_url)
                if result["success"]:
                    logger.info(
                        "✅ Migrations applied: %s → %s",
                        result["from_revision"], result["to_revision"],
                    )
                else:
                    raise RuntimeError(f"Migration failed: {result['error']}")
            else:
                logger.info("✅ Database is up to date at revision %s", get_current_revision(db_url))

    except RuntimeError:
        raise
    except Exception as exc:
        logger.error("Migration check encountered an unexpected error: %s", exc)
        raise RuntimeError(f"Migration system error: {exc}") from exc
