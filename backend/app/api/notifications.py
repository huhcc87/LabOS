from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, NotificationRule, User, UserRole
from app.schemas.schemas import NotificationRuleCreate, NotificationRuleOut, NotificationRuleUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=PaginatedResponse[NotificationRuleOut])
def list_notification_rules(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.manager)),
):
    q = db.query(NotificationRule)
    if search:
        q = q.filter(NotificationRule.title.ilike(f"%{search}%") | NotificationRule.trigger_event.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(NotificationRule.title.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=NotificationRuleOut, status_code=201)
def create_notification_rule(
    body: NotificationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = NotificationRule(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "notification_rule", item.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(item)
    return item


@router.get("/{rule_id}", response_model=NotificationRuleOut)
def get_notification_rule(rule_id: int, db: Session = Depends(get_db), _: User = Depends(require_role(UserRole.manager))):
    item = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification rule not found")
    return item


@router.put("/{rule_id}", response_model=NotificationRuleOut)
def update_notification_rule(
    rule_id: int,
    body: NotificationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification rule not found")
    changes = {}
    for fname in ("title", "trigger_event", "channel", "recipient_role", "lead_time_hours", "is_active"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(item, fname, val)
    write_audit(db, AuditAction.update, "notification_rule", rule_id, current_user, changes)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{rule_id}", status_code=204)
def delete_notification_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    item = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification rule not found")
    write_audit(db, AuditAction.delete, "notification_rule", rule_id, current_user, {"title": item.title})
    db.delete(item)
    db.commit()
