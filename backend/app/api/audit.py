import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditLog, AuditAction, User, UserRole
from app.schemas.schemas import AuditLogOut, PaginatedResponse
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/audit", tags=["audit"])


def log_action(db: Session, action: str, entity_type: str, entity_id: int, user: User, changes: dict = None):
    """Log an action to the audit log."""
    action_enum = AuditAction(action) if action in [e.value for e in AuditAction] else AuditAction.update
    log = AuditLog(
        action=action_enum,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user.id if user else None,
        user_email=user.email if user else "system",
        changes_json=json.dumps(changes) if changes else "{}",
    )
    db.add(log)
    db.commit()


@router.get("", response_model=PaginatedResponse[AuditLogOut])
def list_audit_logs(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    entity_type: str = "",
    action: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    q = db.query(AuditLog)
    if search:
        q = q.filter(
            AuditLog.entity_type.ilike(f"%{search}%") |
            AuditLog.user_email.ilike(f"%{search}%")
        )
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    items = q.order_by(AuditLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/chain/verify")
def verify_chain(
    limit: int = 1000,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Verify the SHA-256 hash chain of the audit log. Returns first tampered entry if found."""
    import hashlib

    entries = db.query(AuditLog).order_by(AuditLog.id.asc()).limit(limit).all()
    if not entries:
        return {"valid": True, "entries_checked": 0, "message": "No audit entries found."}

    tampered = []
    prev_hash = "0" * 64

    for entry in entries:
        if not entry.chain_hash:
            # Legacy entry without hash — skip gracefully
            prev_hash = entry.chain_hash or prev_hash
            continue

        payload = f"{entry.prev_hash or prev_hash}|{entry.action}|{entry.entity_type}|{entry.entity_id}|{entry.user_email}|{entry.changes_json}|{entry.timestamp.isoformat()}"
        expected = hashlib.sha256(payload.encode()).hexdigest()

        if expected != entry.chain_hash:
            tampered.append({
                "id": entry.id,
                "timestamp": entry.timestamp.isoformat(),
                "entity_type": entry.entity_type,
                "expected_hash": expected,
                "stored_hash": entry.chain_hash,
            })

        prev_hash = entry.chain_hash

    return {
        "valid": len(tampered) == 0,
        "entries_checked": len(entries),
        "tampered_entries": tampered,
        "message": "Chain integrity verified — no tampering detected." if not tampered else f"{len(tampered)} tampered entry/entries detected.",
    }
