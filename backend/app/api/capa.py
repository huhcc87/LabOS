from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, CapaRecord, CapaStatus, User
from app.schemas.schemas import CapaCreate, CapaOut, CapaUpdate, PaginatedResponse
from app.services.auth import get_current_user, write_audit
from app.services.email import send_capa_assignment

router = APIRouter(prefix="/capa", tags=["capa"])


@router.get("", response_model=PaginatedResponse[CapaOut])
def list_capas(
    page: int = 1,
    per_page: int = 20,
    status: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CapaRecord).order_by(CapaRecord.created_at.desc())
    if status:
        q = q.filter(CapaRecord.status == status)
    if severity:
        q = q.filter(CapaRecord.severity == severity)
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=CapaOut, status_code=201)
def create_capa(
    body: CapaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = CapaRecord(
        **{k: v for k, v in body.model_dump().items() if k != "notes"},
        created_by=current_user.id,
    )
    db.add(record)
    db.flush()
    write_audit(db, AuditAction.create, "capa", record.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(record)
    if body.assigned_to:
        assignee = db.query(User).filter(User.id == body.assigned_to).first()
        if assignee and assignee.email:
            send_capa_assignment(assignee.email, body.title, record.id, body.due_date)
    return record


@router.get("/{capa_id}", response_model=CapaOut)
def get_capa(
    capa_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    record = db.query(CapaRecord).filter(CapaRecord.id == capa_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CAPA not found")
    return record


@router.patch("/{capa_id}", response_model=CapaOut)
def update_capa(
    capa_id: int,
    body: CapaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(CapaRecord).filter(CapaRecord.id == capa_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CAPA not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(record, field, value)
    if body.status == CapaStatus.closed and not record.closed_at:
        record.closed_at = datetime.utcnow()
    write_audit(db, AuditAction.update, "capa", capa_id, current_user, body.model_dump(exclude_none=True))
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{capa_id}", status_code=204)
def delete_capa(
    capa_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = db.query(CapaRecord).filter(CapaRecord.id == capa_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="CAPA not found")
    write_audit(db, AuditAction.delete, "capa", capa_id, current_user, {})
    db.delete(record)
    db.commit()


@router.get("/stats/summary")
def capa_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    all_records = db.query(CapaRecord).all()
    by_status: dict[str, int] = {}
    by_severity: dict[str, int] = {}
    overdue = 0
    today = datetime.utcnow().date().isoformat()
    for r in all_records:
        by_status[r.status] = by_status.get(r.status, 0) + 1
        by_severity[r.severity] = by_severity.get(r.severity, 0) + 1
        if r.due_date and r.due_date < today and r.status not in ("closed", "cancelled"):
            overdue += 1
    return {
        "total": len(all_records),
        "by_status": by_status,
        "by_severity": by_severity,
        "overdue": overdue,
    }
