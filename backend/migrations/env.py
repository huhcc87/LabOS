"""Alembic migration environment — production-grade configuration."""

import logging
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

from app.core.database import Base
from app.models import models  # noqa: F401 — registers all ORM classes

target_metadata = Base.metadata


def get_url() -> str:
    """Prefer DATABASE_URL env var; fall back to alembic.ini."""
    return os.environ.get("DATABASE_URL") or config.get_main_option("sqlalchemy.url")


def include_object(object, name, type_, reflected, compare_to):
    """Exclude SQLite internal tables from autogenerate."""
    return not (type_ == "table" and name.startswith("sqlite_"))


CONTEXT_KWARGS = dict(
    target_metadata=target_metadata,
    render_as_batch=True,         # SQLite-safe: rewrites tables for ALTER ops
    compare_type=True,            # Detect column type changes
    compare_server_default=True,  # Detect server default changes
    include_object=include_object,
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    },
)


def run_migrations_offline() -> None:
    """Generate SQL script without a live DB (for CI review or dry-run)."""
    logger.info("Running migrations OFFLINE (SQL generation mode)")
    context.configure(
        url=get_url(),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **CONTEXT_KWARGS,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Apply migrations against a live DB connection."""
    logger.info("Running migrations ONLINE")
    cfg = dict(config.get_section(config.config_ini_section) or {})
    cfg["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, **CONTEXT_KWARGS)
        with context.begin_transaction():
            context.run_migrations()
    logger.info("Migration run complete")


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
