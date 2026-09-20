from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, ComplianceLog, User, UserRole
from app.schemas.schemas import ComplianceLogCreate, ComplianceLogOut, ComplianceLogUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/compliance", tags=["compliance"])


def _enrich(c: ComplianceLog) -> ComplianceLogOut:
    return ComplianceLogOut.model_validate({
        "id": c.id, "title": c.title, "category": c.category, "details": c.details,
        "logged_by": c.logged_by,
        "logger_name": c.logger.full_name if c.logger else None,
        "created_at": c.created_at,
    })


@router.get("", response_model=PaginatedResponse[ComplianceLogOut])
def list_logs(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ComplianceLog)
    if search:
        q = q.filter(ComplianceLog.title.ilike(f"%{search}%") | ComplianceLog.details.ilike(f"%{search}%"))
    if category:
        q = q.filter(ComplianceLog.category == category)
    total = q.count()
    items = q.order_by(ComplianceLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(c) for c in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=ComplianceLogOut, status_code=201)
def create_log(
    body: ComplianceLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = ComplianceLog(**body.model_dump())
    db.add(log)
    db.flush()
    write_audit(db, AuditAction.create, "compliance", log.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(log)
    return _enrich(log)


@router.get("/{log_id}", response_model=ComplianceLogOut)
def get_log(log_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(ComplianceLog).filter(ComplianceLog.id == log_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compliance log not found")
    return _enrich(c)


@router.put("/{log_id}", response_model=ComplianceLogOut)
def update_log(
    log_id: int,
    body: ComplianceLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = db.query(ComplianceLog).filter(ComplianceLog.id == log_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compliance log not found")
    changes = {}
    for fname in ("title", "category", "details", "logged_by"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(c, fname, val)
    write_audit(db, AuditAction.update, "compliance", log_id, current_user, changes)
    db.commit()
    db.refresh(c)
    return _enrich(c)


@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    c = db.query(ComplianceLog).filter(ComplianceLog.id == log_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Compliance log not found")
    write_audit(db, AuditAction.delete, "compliance", log_id, current_user, {"title": c.title})
    db.delete(c)
    db.commit()
