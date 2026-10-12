"""Local SQLite store, separate from every LabOS database.

Records are append-only: each revision is a new (id, version) row, so version
history is kept and nothing is overwritten. Job checkpoints let long agent
pipelines resume after a crash.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import TypeVar

from .models import RECORD_TYPES, Record

R = TypeVar("R", bound=Record)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    id         TEXT    NOT NULL,
    version    INTEGER NOT NULL,
    type       TEXT    NOT NULL,
    created_at TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    PRIMARY KEY (id, version)
);
CREATE INDEX IF NOT EXISTS records_type ON records(type);
CREATE TABLE IF NOT EXISTS checkpoints (
    job_id     TEXT PRIMARY KEY,
    step       TEXT NOT NULL,
    state      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


class Store:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._path = db_path
        with closing(self._connect()) as conn, conn:
            conn.executescript(_SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.execute("PRAGMA journal_mode=WAL")   # crash-safe, readers don't block writers
        return conn

    # ── records ──────────────────────────────────────────────────────────────

    def save(self, record: Record) -> None:
        """Insert a record version. Re-saving an existing (id, version) is an error."""
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "INSERT INTO records (id, version, type, created_at, body) VALUES (?, ?, ?, ?, ?)",
                (record.id, record.version, type(record).__name__,
                 record.created_at.isoformat(), record.model_dump_json()),
            )

    def get(self, record_id: str, version: int | None = None) -> Record | None:
        sql = "SELECT type, body FROM records WHERE id = ?"
        params: tuple = (record_id,)
        if version is not None:
            sql += " AND version = ?"
            params += (version,)
        sql += " ORDER BY version DESC LIMIT 1"
        with closing(self._connect()) as conn:
            row = conn.execute(sql, params).fetchone()
        return self._load(*row) if row else None

    def history(self, record_id: str) -> list[Record]:
        with closing(self._connect()) as conn:
            rows = conn.execute(
                "SELECT type, body FROM records WHERE id = ? ORDER BY version", (record_id,)
            ).fetchall()
        return [self._load(*r) for r in rows]

    def list(self, cls: type[R]) -> list[R]:
        """Latest version of every record of one type."""
        with closing(self._connect()) as conn:
            rows = conn.execute(
                """SELECT type, body FROM records r
                   WHERE type = ? AND version = (SELECT MAX(version) FROM records WHERE id = r.id)
                   ORDER BY created_at""",
                (cls.__name__,),
            ).fetchall()
        return [self._load(*r) for r in rows]  # type: ignore[misc]

    @staticmethod
    def _load(type_name: str, body: str) -> Record:
        return RECORD_TYPES[type_name].model_validate_json(body)

    # ── checkpoints ──────────────────────────────────────────────────────────

    def checkpoint(self, job_id: str, step: str, state: dict) -> None:
        with closing(self._connect()) as conn, conn:
            conn.execute(
                """INSERT INTO checkpoints (job_id, step, state, updated_at) VALUES (?, ?, ?, ?)
                   ON CONFLICT(job_id) DO UPDATE SET step = excluded.step,
                   state = excluded.state, updated_at = excluded.updated_at""",
                (job_id, step, json.dumps(state), datetime.now(timezone.utc).isoformat()),
            )

    def resume(self, job_id: str) -> tuple[str, dict] | None:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT step, state FROM checkpoints WHERE job_id = ?", (job_id,)
            ).fetchone()
        return (row[0], json.loads(row[1])) if row else None
