from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, SampleEvent, SampleRecord, User, UserRole
from app.schemas.schemas import (
    PaginatedResponse,
    SampleEventCreate, SampleEventOut, SampleEventUpdate,
    SampleRecordCreate, SampleRecordOut, SampleRecordUpdate,
)
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/samples", tags=["samples"])


def _enrich_sample(s: SampleRecord) -> SampleRecordOut:
    return SampleRecordOut.model_validate({
        "id": s.id, "sample_id": s.sample_id, "barcode": s.barcode,
        "sample_type": s.sample_type, "source": s.source,
        "project_id": s.project_id,
        "project_name": s.project.name if s.project else None,
        "protocol_id": s.protocol_id,
        "protocol_name": s.protocol.title if s.protocol else None,
        "storage_location": s.storage_location,
        "status": s.status, "received_on": s.received_on,
        "owner_id": s.owner_id,
        "owner_name": s.owner.full_name if s.owner else None,
        "notes": s.notes,
    })


def _enrich_event(e: SampleEvent) -> SampleEventOut:
    return SampleEventOut.model_validate({
        "id": e.id, "sample_record_id": e.sample_record_id,
        "event_type": e.event_type, "location": e.location, "status": e.status,
        "performed_by": e.performed_by,
        "performer_name": e.performer.full_name if e.performer else None,
        "timestamp": e.timestamp, "notes": e.notes,
    })


@router.get("", response_model=PaginatedResponse[SampleRecordOut])
def list_samples(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    sample_type: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SampleRecord)
    if search:
        q = q.filter(
            SampleRecord.sample_id.ilike(f"%{search}%") |
            SampleRecord.barcode.ilike(f"%{search}%") |
            SampleRecord.source.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(SampleRecord.status == status)
    if sample_type:
        q = q.filter(SampleRecord.sample_type == sample_type)
    total = q.count()
    items = q.order_by(SampleRecord.received_on.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich_sample(s) for s in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=SampleRecordOut, status_code=201)
def create_sample(
    body: SampleRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(SampleRecord).filter(SampleRecord.sample_id == body.sample_id).first():
        raise HTTPException(status_code=400, detail="Sample ID already exists")
    item = SampleRecord(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "sample", item.id, current_user, {"sample_id": body.sample_id})
    db.commit()
    db.refresh(item)
    return _enrich_sample(item)


@router.get("/{sample_id}", response_model=SampleRecordOut)
def get_sample(sample_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(SampleRecord).filter(SampleRecord.id == sample_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found")
    return _enrich_sample(s)


@router.put("/{sample_id}", response_model=SampleRecordOut)
def update_sample(
    sample_id: int,
    body: SampleRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    s = db.query(SampleRecord).filter(SampleRecord.id == sample_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found")
    changes = {}
    for fname in ("sample_id", "barcode", "sample_type", "source", "project_id", "protocol_id",
                  "storage_location", "status", "received_on", "owner_id", "notes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(s, fname, val)
    write_audit(db, AuditAction.update, "sample", sample_id, current_user, changes)
    db.commit()
    db.refresh(s)
    return _enrich_sample(s)


@router.delete("/{sample_id}", status_code=204)
def delete_sample(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    s = db.query(SampleRecord).filter(SampleRecord.id == sample_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sample not found")
    write_audit(db, AuditAction.delete, "sample", sample_id, current_user, {"sample_id": s.sample_id})
    db.delete(s)
    db.commit()


# ─── Sample Events ────────────────────────────────────────────────────────────

@router.get("/events/all", response_model=PaginatedResponse[SampleEventOut])
def list_sample_events(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SampleEvent)
    if search:
        q = q.filter(SampleEvent.event_type.ilike(f"%{search}%") | SampleEvent.location.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(SampleEvent.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich_event(e) for e in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("/events", response_model=SampleEventOut, status_code=201)
def create_sample_event(
    body: SampleEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not db.query(SampleRecord).filter(SampleRecord.id == body.sample_record_id).first():
        raise HTTPException(status_code=404, detail="Sample not found")
    e = SampleEvent(**body.model_dump())
    db.add(e)
    db.flush()
    write_audit(db, AuditAction.create, "sample_event", e.id, current_user, {"event_type": body.event_type})
    db.commit()
    db.refresh(e)
    return _enrich_event(e)


@router.put("/events/{event_id}", response_model=SampleEventOut)
def update_sample_event(
    event_id: int,
    body: SampleEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(SampleEvent).filter(SampleEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    changes = {}
    for fname in ("event_type", "location", "status", "performed_by", "timestamp", "notes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(e, fname, val)
    write_audit(db, AuditAction.update, "sample_event", event_id, current_user, changes)
    db.commit()
    db.refresh(e)
    return _enrich_event(e)


@router.delete("/events/{event_id}", status_code=204)
def delete_sample_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(SampleEvent).filter(SampleEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    write_audit(db, AuditAction.delete, "sample_event", event_id, current_user, {})
    db.delete(e)
    db.commit()
