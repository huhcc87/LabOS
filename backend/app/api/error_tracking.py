"""
Built-in error tracking — zero cost, no external service.

- Frontend errors POST to /api/errors/client → logged server-side
- Backend errors caught by global exception handler → logged + stored
- Recent errors queryable via /api/errors (admin only)
- Errors stored in-memory (last 500) + written to log file
"""
import logging
import traceback
from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.api.auth import get_current_user, require_role

logger = logging.getLogger("labos.errors")

router = APIRouter(prefix="/errors", tags=["Error Tracking"])

# ─── In-memory error store (last 500 errors, no DB needed) ──────────────

_errors: deque = deque(maxlen=500)
_lock = Lock()


class ClientErrorReport(BaseModel):
    message: str
    stack: Optional[str] = None
    component: Optional[str] = None
    url: Optional[str] = None
    user_agent: Optional[str] = None
    extra: Optional[dict] = None


class ErrorRecord(BaseModel):
    id: str
    source: str            # "client" | "server"
    message: str
    stack: Optional[str] = None
    url: Optional[str] = None
    component: Optional[str] = None
    user_id: Optional[int] = None
    ip: Optional[str] = None
    timestamp: str
    extra: Optional[dict] = None


def record_error(
    source: str,
    message: str,
    stack: Optional[str] = None,
    url: Optional[str] = None,
    component: Optional[str] = None,
    user_id: Optional[int] = None,
    ip: Optional[str] = None,
    extra: Optional[dict] = None,
) -> ErrorRecord:
    """Store an error record and log it."""
    record = ErrorRecord(
        id=uuid4().hex[:12],
        source=source,
        message=message,
        stack=stack,
        url=url,
        component=component,
        user_id=user_id,
        ip=ip,
        timestamp=datetime.now(timezone.utc).isoformat(),
        extra=extra,
    )
    with _lock:
        _errors.appendleft(record)

    # Log to file/stdout (structured for log aggregators)
    log_msg = f"[{source.upper()}] {message}"
    if url:
        log_msg += f" | url={url}"
    if component:
        log_msg += f" | component={component}"
    if user_id:
        log_msg += f" | user={user_id}"

    logger.error(log_msg)
    if stack:
        logger.debug("Stack trace:\n%s", stack)

    return record


# ─── Client error endpoint (frontend → backend) ─────────────────────────

@router.post("/client", status_code=201)
async def report_client_error(report: ClientErrorReport, request: Request):
    """
    Receive error reports from the frontend.
    No auth required — we want to catch errors even for logged-out users.
    Rate-limited by the global rate limiter.
    """
    ip = request.client.host if request.client else "unknown"
    record = record_error(
        source="client",
        message=report.message,
        stack=report.stack,
        url=report.url,
        component=report.component,
        ip=ip,
        extra=report.extra,
    )
    return {"id": record.id, "recorded": True}


# ─── Admin: view recent errors ──────────────────────────────────────────

@router.get("")
async def list_errors(
    source: Optional[str] = None,
    limit: int = 50,
    current_user=Depends(require_role("admin")),
):
    """View recent errors (admin only). Filter by source: 'client' or 'server'."""
    with _lock:
        errors = list(_errors)
    if source:
        errors = [e for e in errors if e.source == source]
    return {"errors": [e.model_dump() for e in errors[:limit]], "total": len(errors)}


@router.delete("")
async def clear_errors(current_user=Depends(require_role("admin"))):
    """Clear all stored errors (admin only)."""
    with _lock:
        _errors.clear()
    return {"cleared": True}
