from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditLog, User, UserRole
from app.schemas.schemas import ActivityTimelineItem, PaginatedResponse
from app.services.auth import get_current_user, require_role

router = APIRouter(prefix="/activity", tags=["activity"])


def _get_entity_name(db: Session, entity_type: str, entity_id: int) -> str:
    """Get a human-readable name for an entity"""
    if not entity_id:
        return "Unknown"

    # Import here to avoid circular imports
    from app.models.models import (
        Protocol,
        Instrument,
        Task,
        SampleRecord,
        InventoryItem,
        IncidentReport,
        StudyWorkspace,
        SOP,
        MaintenanceLog,
        CostEntry,
        DocumentTemplate,
    )

    entity_map = {
        "protocol": (Protocol, "title"),
        "instrument": (Instrument, "name"),
        "task": (Task, "title"),
        "sample": (SampleRecord, "sample_id"),
        "sample_record": (SampleRecord, "sample_id"),
        "inventory": (InventoryItem, "name"),
        "inventory_item": (InventoryItem, "name"),
        "incident": (IncidentReport, "title"),
        "incident_report": (IncidentReport, "title"),
        "workspace": (StudyWorkspace, "name"),
        "study_workspace": (StudyWorkspace, "name"),
        "sop": (SOP, "title"),
        "maintenance_log": (MaintenanceLog, "title"),
        "cost_entry": (CostEntry, "description"),
        "template": (DocumentTemplate, "name"),
        "user": (User, "full_name"),
    }

    if entity_type.lower() in entity_map:
        model, field = entity_map[entity_type.lower()]
        obj = db.query(model).filter(model.id == entity_id).first()
        if obj:
            return getattr(obj, field, f"#{entity_id}")
    return f"#{entity_id}"


@router.get("", response_model=PaginatedResponse[ActivityTimelineItem])
def get_activity_timeline(
    page: int = 1,
    per_page: int = 50,
    entity_type: str = "",
    user_id: int = None,
    action: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get activity timeline from audit logs"""
    q = db.query(AuditLog)

    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action:
        q = q.filter(AuditLog.action == action)

    total = q.count()
    items = q.order_by(AuditLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1

    # Get user names for all user_ids
    user_ids = list(set(a.user_id for a in items if a.user_id))
    users = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    enriched = []
    for log in items:
        entity_name = _get_entity_name(db, log.entity_type, log.entity_id)
        enriched.append(ActivityTimelineItem(
            id=log.id,
            action=log.action.value if hasattr(log.action, 'value') else str(log.action),
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            entity_name=entity_name,
            user_id=log.user_id,
            user_name=users.get(log.user_id, log.user_email),
            timestamp=log.timestamp,
            details=log.changes_json,
        ))

    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/recent")
def get_recent_activity(
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get recent activity (last N entries)"""
    items = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()

    user_ids = list(set(a.user_id for a in items if a.user_id))
    users = {u.id: u.full_name for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    result = []
    for log in items:
        entity_name = _get_entity_name(db, log.entity_type, log.entity_id)
        result.append({
            "id": log.id,
            "action": log.action.value if hasattr(log.action, 'value') else str(log.action),
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "entity_name": entity_name,
            "user_id": log.user_id,
            "user_name": users.get(log.user_id, log.user_email),
            "timestamp": log.timestamp.isoformat(),
            "details": log.changes_json,
        })

    return result


@router.get("/my-activity")
def get_my_activity(
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get current user's activity"""
    q = db.query(AuditLog).filter(AuditLog.user_id == current_user.id)
    total = q.count()
    items = q.order_by(AuditLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1

    result = []
    for log in items:
        entity_name = _get_entity_name(db, log.entity_type, log.entity_id)
        result.append({
            "id": log.id,
            "action": log.action.value if hasattr(log.action, 'value') else str(log.action),
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "entity_name": entity_name,
            "timestamp": log.timestamp.isoformat(),
            "details": log.changes_json,
        })

    return {"items": result, "total": total, "page": page, "per_page": per_page, "pages": pages}


@router.get("/stats")
def get_activity_stats(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.manager)),
):
    """Get activity statistics"""
    from sqlalchemy import func
    from datetime import datetime, timedelta

    # Activity by action type
    by_action = db.query(
        AuditLog.action,
        func.count(AuditLog.id).label("count")
    ).group_by(AuditLog.action).all()

    # Activity by entity type
    by_entity = db.query(
        AuditLog.entity_type,
        func.count(AuditLog.id).label("count")
    ).group_by(AuditLog.entity_type).all()

    # Activity by user (top 10)
    by_user = db.query(
        AuditLog.user_id,
        AuditLog.user_email,
        func.count(AuditLog.id).label("count")
    ).group_by(AuditLog.user_id, AuditLog.user_email).order_by(func.count(AuditLog.id).desc()).limit(10).all()

    # Daily activity for last 30 days
    thirty_days_ago = datetime.now() - timedelta(days=30)
    daily = db.query(
        func.date(AuditLog.timestamp).label("date"),
        func.count(AuditLog.id).label("count")
    ).filter(AuditLog.timestamp >= thirty_days_ago).group_by("date").order_by("date").all()

    return {
        "by_action": {str(a): c for a, c in by_action},
        "by_entity": {e: c for e, c in by_entity},
        "by_user": [{"user_id": uid, "email": email, "count": c} for uid, email, c in by_user],
        "daily": [{"date": str(d), "count": c} for d, c in daily],
        "total": db.query(func.count(AuditLog.id)).scalar(),
    }
