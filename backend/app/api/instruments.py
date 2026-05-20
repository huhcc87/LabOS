from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Booking, BookingStatus, Instrument, User, UserRole
from app.schemas.schemas import (
    BookingCreate, BookingOut, BookingUpdate,
    InstrumentCreate, InstrumentOut, InstrumentUpdate,
    PaginatedResponse,
)
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/instruments", tags=["instruments"])


def _enrich_booking(b: Booking) -> BookingOut:
    return BookingOut.model_validate({
        "id": b.id,
        "instrument_id": b.instrument_id,
        "instrument_name": b.instrument.name if b.instrument else None,
        "user_id": b.user_id,
        "user_name": b.user.full_name if b.user else None,
        "purpose": b.purpose,
        "start_time": b.start_time,
        "end_time": b.end_time,
        "status": b.status,
    })


@router.get("", response_model=PaginatedResponse[InstrumentOut])
def list_instruments(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Instrument)
    if search:
        q = q.filter(Instrument.name.ilike(f"%{search}%") | Instrument.category.ilike(f"%{search}%"))
    if status:
        q = q.filter(Instrument.status == status)
    total = q.count()
    items = q.order_by(Instrument.name).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=InstrumentOut, status_code=201)
def create_instrument(
    body: InstrumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    inst = Instrument(**body.model_dump())
    db.add(inst)
    db.flush()
    write_audit(db, AuditAction.create, "instrument", inst.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(inst)
    return inst


@router.get("/{instrument_id}", response_model=InstrumentOut)
def get_instrument(instrument_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    inst = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    return inst


@router.put("/{instrument_id}", response_model=InstrumentOut)
def update_instrument(
    instrument_id: int,
    body: InstrumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    inst = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    changes = {}
    for fname in ("name", "category", "location", "maintenance_frequency_days", "next_maintenance_date", "status", "notes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = val
            setattr(inst, fname, val)
    write_audit(db, AuditAction.update, "instrument", instrument_id, current_user, changes)
    db.commit()
    db.refresh(inst)
    return inst


@router.delete("/{instrument_id}", status_code=204)
def delete_instrument(
    instrument_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    inst = db.query(Instrument).filter(Instrument.id == instrument_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Instrument not found")
    write_audit(db, AuditAction.delete, "instrument", instrument_id, current_user, {"name": inst.name})
    db.delete(inst)
    db.commit()


# ─── Bookings ────────────────────────────────────────────────────────────────

@router.get("/bookings/all", response_model=PaginatedResponse[BookingOut])
def list_bookings(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Booking)
    if search:
        q = q.filter(Booking.purpose.ilike(f"%{search}%"))
    if status:
        q = q.filter(Booking.status == status)
    total = q.count()
    items = q.order_by(Booking.start_time.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(
        items=[_enrich_booking(b) for b in items],
        total=total, page=page, per_page=per_page, pages=pages
    )


@router.post("/bookings", response_model=BookingOut, status_code=201)
def create_booking(
    body: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    overlapping = (
        db.query(Booking)
        .filter(Booking.instrument_id == body.instrument_id)
        .filter(Booking.status.in_([BookingStatus.reserved, BookingStatus.active]))
        .filter(Booking.start_time < body.end_time)
        .filter(Booking.end_time > body.start_time)
        .first()
    )
    if overlapping:
        raise HTTPException(status_code=400, detail="Instrument already booked for that time range")
    b = Booking(**body.model_dump())
    db.add(b)
    db.flush()
    write_audit(db, AuditAction.create, "booking", b.id, current_user, {"instrument_id": body.instrument_id})
    db.commit()
    db.refresh(b)
    return _enrich_booking(b)


@router.put("/bookings/{booking_id}", response_model=BookingOut)
def update_booking(
    booking_id: int,
    body: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    changes = {}
    for fname in ("instrument_id", "user_id", "purpose", "start_time", "end_time", "status"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(b, fname, val)
    write_audit(db, AuditAction.update, "booking", booking_id, current_user, changes)
    db.commit()
    db.refresh(b)
    return _enrich_booking(b)


@router.delete("/bookings/{booking_id}", status_code=204)
def delete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    b = db.query(Booking).filter(Booking.id == booking_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    write_audit(db, AuditAction.delete, "booking", booking_id, current_user, {})
    db.delete(b)
    db.commit()
