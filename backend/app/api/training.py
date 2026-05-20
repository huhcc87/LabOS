from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, TrainingRecord, User, UserRole
from app.schemas.schemas import PaginatedResponse, TrainingRecordCreate, TrainingRecordOut, TrainingRecordUpdate
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/training", tags=["training"])


def _enrich(t: TrainingRecord) -> TrainingRecordOut:
    return TrainingRecordOut.model_validate({
        "id": t.id, "user_id": t.user_id,
        "user_name": t.user.full_name if t.user else None,
        "title": t.title,
        "instrument_id": t.instrument_id,
        "instrument_name": t.instrument.name if t.instrument else None,
        "protocol_id": t.protocol_id,
        "completed_on": t.completed_on, "expires_on": t.expires_on,
        "status": t.status, "notes": t.notes,
    })


@router.get("", response_model=PaginatedResponse[TrainingRecordOut])
def list_training(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(TrainingRecord)
    if search:
        q = q.filter(TrainingRecord.title.ilike(f"%{search}%"))
    if status:
        q = q.filter(TrainingRecord.status == status)
    total = q.count()
    items = q.order_by(TrainingRecord.expires_on.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(t) for t in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=TrainingRecordOut, status_code=201)
def create_training(
    body: TrainingRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    t = TrainingRecord(**body.model_dump())
    db.add(t)
    db.flush()
    write_audit(db, AuditAction.create, "training", t.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(t)
    return _enrich(t)


@router.get("/{record_id}", response_model=TrainingRecordOut)
def get_training(record_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Training record not found")
    return _enrich(t)


@router.put("/{record_id}", response_model=TrainingRecordOut)
def update_training(
    record_id: int,
    body: TrainingRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    t = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Training record not found")
    changes = {}
    for fname in ("user_id", "title", "instrument_id", "protocol_id", "completed_on", "expires_on", "status", "notes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(t, fname, val)
    write_audit(db, AuditAction.update, "training", record_id, current_user, changes)
    db.commit()
    db.refresh(t)
    return _enrich(t)


@router.delete("/{record_id}", status_code=204)
def delete_training(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    t = db.query(TrainingRecord).filter(TrainingRecord.id == record_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Training record not found")
    write_audit(db, AuditAction.delete, "training", record_id, current_user, {"title": t.title})
    db.delete(t)
    db.commit()
