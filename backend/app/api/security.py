"""
Security management API — TOTP MFA, session management, clearance levels, security event log.
"""
import hashlib
import io
import json
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.models.models import (
    SecurityClearance, SecurityEvent, SecurityEventSeverity, SecurityEventType,
    User, UserRole, UserSession, ROLE_DEFAULT_CLEARANCE,
)
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/security", tags=["security"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _ua_hint(user_agent: str) -> str:
    ua = user_agent or ""
    browser = "Unknown"
    os_hint = "Unknown"
    for b in ("Chrome", "Firefox", "Safari", "Edge", "Opera"):
        if b in ua:
            browser = b
            break
    for o in ("Windows", "macOS", "Linux", "Android", "iOS", "iPhone", "iPad"):
        if o in ua:
            os_hint = "macOS" if o == "macOS" else o
            break
    return f"{browser} / {os_hint}"


def log_security_event(
    db: Session,
    event_type: SecurityEventType,
    severity: SecurityEventSeverity = SecurityEventSeverity.info,
    user: Optional[User] = None,
    ip_address: str = "",
    user_agent: str = "",
    details: dict = None,
) -> SecurityEvent:
    evt = SecurityEvent(
        event_type=event_type,
        severity=severity,
        user_id=user.id if user else None,
        user_email=user.email if user else "",
        ip_address=ip_address,
        user_agent=user_agent,
        details=json.dumps(details or {}),
    )
    db.add(evt)
    return evt


def create_session(
    db: Session,
    user: User,
    token: str,
    request: Request,
    ttl_hours: int = 8,
) -> UserSession:
    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    session = UserSession(
        user_id=user.id,
        token_hash=_hash_token(token),
        ip_address=ip,
        user_agent=ua[:500],
        device_hint=_ua_hint(ua),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    )
    db.add(session)
    return session


# ─── Session Management ───────────────────────────────────────────────────────

@router.get("/sessions")
def list_my_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(UserSession)
        .filter(UserSession.user_id == current_user.id, UserSession.is_revoked == False)
        .order_by(UserSession.last_active_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "device_hint": s.device_hint,
            "ip_address": s.ip_address,
            "created_at": s.created_at.isoformat(),
            "last_active_at": s.last_active_at.isoformat(),
            "expires_at": s.expires_at.isoformat(),
            "is_expired": datetime.now(timezone.utc) > s.expires_at,
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(UserSession).filter(
        UserSession.id == session_id,
        UserSession.user_id == current_user.id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_revoked = True
    log_security_event(db, SecurityEventType.session_revoked, user=current_user,
                       details={"session_id": session_id})
    db.commit()


@router.delete("/sessions", status_code=204)
def revoke_all_other_sessions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revoke all sessions except the current one."""
    current_token = request.headers.get("authorization", "").removeprefix("Bearer ")
    current_hash = _hash_token(current_token) if current_token else None

    q = db.query(UserSession).filter(
        UserSession.user_id == current_user.id,
        UserSession.is_revoked == False,
    )
    if current_hash:
        q = q.filter(UserSession.token_hash != current_hash)
    revoked = q.count()
    q.update({"is_revoked": True}, synchronize_session=False)
    log_security_event(db, SecurityEventType.session_revoked, user=current_user,
                       details={"revoked_count": revoked, "reason": "sign_out_all"})
    db.commit()


# ─── TOTP MFA ─────────────────────────────────────────────────────────────────

@router.post("/mfa/setup")
def setup_mfa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new TOTP secret and return a QR code URI for the authenticator app."""
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")

    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="LabOS")

    current_user.totp_secret = secret
    db.commit()

    return {
        "secret": secret,
        "uri": uri,
        "instructions": "Scan the QR code with Google Authenticator, Authy, or any TOTP app. Then confirm with a code.",
    }


@router.get("/mfa/qr")
def get_mfa_qr(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a QR code PNG for the current pending TOTP secret."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /mfa/setup first")

    totp = pyotp.TOTP(current_user.totp_secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="LabOS")

    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")


@router.post("/mfa/confirm")
def confirm_mfa(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirm TOTP setup by verifying a code. Generates 8 one-time backup codes."""
    code = str(body.get("code", "")).strip()
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Run /mfa/setup first")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(code, valid_window=1):
        log_security_event(db, SecurityEventType.mfa_failed,
                           severity=SecurityEventSeverity.warning,
                           user=current_user,
                           ip_address=request.client.host if request.client else "",
                           details={"step": "confirm"})
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid TOTP code")

    # Generate backup codes
    raw_codes = [secrets.token_hex(4).upper() for _ in range(8)]
    hashed_codes = [get_password_hash(c) for c in raw_codes]

    current_user.mfa_enabled = True
    current_user.mfa_backup_codes = json.dumps(hashed_codes)
    log_security_event(db, SecurityEventType.mfa_enabled, user=current_user,
                       ip_address=request.client.host if request.client else "",
                       details={"method": "totp"})
    db.commit()

    return {
        "enabled": True,
        "backup_codes": raw_codes,
        "message": "MFA enabled. Save these backup codes — they won't be shown again.",
    }


@router.post("/mfa/verify")
def verify_mfa(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a TOTP code or backup code. Used during login when MFA is required."""
    code = str(body.get("code", "")).strip()
    if not current_user.mfa_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA not enabled")

    ip = request.client.host if request.client else ""

    # Try TOTP first
    totp = pyotp.TOTP(current_user.totp_secret)
    if totp.verify(code, valid_window=1):
        log_security_event(db, SecurityEventType.mfa_success, user=current_user,
                           ip_address=ip, details={"method": "totp"})
        db.commit()
        return {"verified": True}

    # Try backup codes
    stored = json.loads(current_user.mfa_backup_codes or "[]")
    for i, hashed in enumerate(stored):
        if verify_password(code, hashed):
            stored.pop(i)
            current_user.mfa_backup_codes = json.dumps(stored)
            log_security_event(db, SecurityEventType.mfa_success, user=current_user,
                               ip_address=ip, details={"method": "backup_code",
                                                        "remaining": len(stored)})
            db.commit()
            return {"verified": True, "backup_code_used": True, "remaining_backup_codes": len(stored)}

    log_security_event(db, SecurityEventType.mfa_failed,
                       severity=SecurityEventSeverity.warning,
                       user=current_user, ip_address=ip,
                       details={"method": "unknown"})
    db.commit()
    raise HTTPException(status_code=400, detail="Invalid code")


@router.delete("/mfa", status_code=204)
def disable_mfa(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable MFA. Requires password confirmation."""
    pw = body.get("password", "")
    if not verify_password(pw, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    current_user.mfa_enabled = False
    current_user.totp_secret = None
    current_user.mfa_backup_codes = "[]"
    log_security_event(db, SecurityEventType.mfa_disabled, user=current_user,
                       severity=SecurityEventSeverity.warning,
                       ip_address=request.client.host if request.client else "")
    db.commit()


# ─── Security Clearance ───────────────────────────────────────────────────────

@router.get("/clearance")
def my_clearance(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role.value,
        "security_clearance": current_user.security_clearance.value,
        "mfa_enabled": current_user.mfa_enabled,
    }


@router.get("/clearance/users")
def list_user_clearances(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    users = db.query(User).filter(User.is_active == True).order_by(User.full_name).all()
    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role.value,
            "security_clearance": u.security_clearance.value,
            "mfa_enabled": u.mfa_enabled,
        }
        for u in users
    ]


@router.put("/clearance/{user_id}")
def set_clearance(
    user_id: int,
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_level = body.get("security_clearance")
    try:
        clearance = SecurityClearance(new_level)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid clearance level: {new_level}")

    old_level = user.security_clearance.value
    user.security_clearance = clearance
    log_security_event(
        db, SecurityEventType.clearance_changed,
        severity=SecurityEventSeverity.warning,
        user=current_user,
        ip_address=request.client.host if request.client else "",
        details={"target_user_id": user_id, "from": old_level, "to": new_level},
    )
    db.commit()
    return {"user_id": user_id, "security_clearance": clearance.value}


# ─── Security Events ──────────────────────────────────────────────────────────

@router.get("/events")
def list_security_events(
    page: int = 1,
    per_page: int = 50,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    q = db.query(SecurityEvent).order_by(SecurityEvent.timestamp.desc())
    if event_type:
        try:
            q = q.filter(SecurityEvent.event_type == SecurityEventType(event_type))
        except ValueError:
            pass
    if severity:
        try:
            q = q.filter(SecurityEvent.severity == SecurityEventSeverity(severity))
        except ValueError:
            pass
    if user_id:
        q = q.filter(SecurityEvent.user_id == user_id)

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page or 1,
        "items": [
            {
                "id": e.id,
                "event_type": e.event_type.value,
                "severity": e.severity.value,
                "user_id": e.user_id,
                "user_email": e.user_email,
                "ip_address": e.ip_address,
                "details": json.loads(e.details or "{}"),
                "timestamp": e.timestamp.isoformat(),
            }
            for e in items
        ],
    }


@router.get("/events/summary")
def security_events_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    """24-hour summary counts by severity."""
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    events = db.query(SecurityEvent).filter(SecurityEvent.timestamp >= since).all()

    counts = {"info": 0, "warning": 0, "critical": 0, "total": len(events)}
    by_type = {}
    for e in events:
        counts[e.severity.value] = counts.get(e.severity.value, 0) + 1
        by_type[e.event_type.value] = by_type.get(e.event_type.value, 0) + 1

    failed_logins = by_type.get("login_failed", 0)
    lockouts = by_type.get("login_locked", 0)

    return {
        "period_hours": 24,
        "counts": counts,
        "by_type": by_type,
        "failed_logins": failed_logins,
        "lockouts": lockouts,
        "alerts": [
            {"level": "critical", "message": f"{lockouts} account lockout(s) in the last 24h"}
            for _ in [1] if lockouts > 0
        ] + [
            {"level": "warning", "message": f"{failed_logins} failed login attempt(s) in the last 24h"}
            for _ in [1] if failed_logins >= 5
        ],
    }


# ─── Admin: all sessions ──────────────────────────────────────────────────────

@router.get("/admin/sessions")
def list_all_sessions(
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    q = (
        db.query(UserSession)
        .filter(UserSession.is_revoked == False)
        .order_by(UserSession.last_active_at.desc())
    )
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "items": [
            {
                "id": s.id,
                "user_id": s.user_id,
                "device_hint": s.device_hint,
                "ip_address": s.ip_address,
                "created_at": s.created_at.isoformat(),
                "last_active_at": s.last_active_at.isoformat(),
                "expires_at": s.expires_at.isoformat(),
                "is_expired": datetime.now(timezone.utc) > s.expires_at,
            }
            for s in items
        ],
    }


@router.delete("/admin/sessions/{session_id}", status_code=204)
def admin_revoke_session(
    session_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    session = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_revoked = True
    log_security_event(db, SecurityEventType.session_revoked,
                       severity=SecurityEventSeverity.warning,
                       user=current_user,
                       ip_address=request.client.host if request.client else "",
                       details={"target_session_id": session_id,
                                "target_user_id": session.user_id, "action": "admin_revoke"})
    db.commit()
