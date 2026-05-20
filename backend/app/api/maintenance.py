from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Instrument, MaintenanceLog, MaintenanceStatus, User, UserRole
from app.schemas.schemas import MaintenanceLogCreate, MaintenanceLogOut, MaintenanceLogUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


def _enrich(m: MaintenanceLog) -> dict:
    data = {c.name: getattr(m, c.name) for c in m.__table__.columns}
    data["instrument_name"] = m.instrument.name if m.instrument else None
    data["technician_name"] = m.technician.full_name if m.technician else None
    return data


@router.get("", response_model=PaginatedResponse[MaintenanceLogOut])
def list_maintenance_logs(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    instrument_id: int = None,
    status: str = "",
    maintenance_type: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(MaintenanceLog)
    if search:
        q = q.filter(MaintenanceLog.title.ilike(f"%{search}%") | MaintenanceLog.description.ilike(f"%{search}%"))
    if instrument_id:
        q = q.filter(MaintenanceLog.instrument_id == instrument_id)
    if status:
        q = q.filter(MaintenanceLog.status == status)
    if maintenance_type:
        q = q.filter(MaintenanceLog.type == maintenance_type)
    total = q.count()
    items = q.order_by(MaintenanceLog.scheduled_date.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [MaintenanceLogOut.model_validate(_enrich(m)) for m in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=MaintenanceLogOut, status_code=201)
def create_maintenance_log(
    body: MaintenanceLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    instrument = db.query(Instrument).filter(Instrument.id == body.instrument_id).first()
    if not instrument:
        raise HTTPException(status_code=404, detail="Instrument not found")

    log = MaintenanceLog(
        instrument_id=body.instrument_id,
        type=body.type,
        title=body.title,
        description=body.description,
        scheduled_date=body.scheduled_date,
        performed_by=body.performed_by or current_user.id,
        parts_replaced=body.parts_replaced,
        cost=body.cost,
        notes=body.notes,
    )
    db.add(log)
    write_audit(db, AuditAction.create, "maintenance_log", log.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(log)
    return MaintenanceLogOut.model_validate(_enrich(log))


@router.get("/{log_id}", response_model=MaintenanceLogOut)
def get_maintenance_log(log_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    return MaintenanceLogOut.model_validate(_enrich(m))


@router.put("/{log_id}", response_model=MaintenanceLogOut)
def update_maintenance_log(
    log_id: int,
    body: MaintenanceLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    m = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    changes = {}
    for field_name in ("instrument_id", "type", "status", "title", "description",
                       "scheduled_date", "completed_date", "performed_by",
                       "parts_replaced", "cost", "notes"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = str(val)
            setattr(m, field_name, val)
    write_audit(db, AuditAction.update, "maintenance_log", log_id, current_user, changes)
    db.commit()
    db.refresh(m)
    return MaintenanceLogOut.model_validate(_enrich(m))


@router.delete("/{log_id}", status_code=204)
def delete_maintenance_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    m = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    write_audit(db, AuditAction.delete, "maintenance_log", log_id, current_user, {"title": m.title})
    db.delete(m)
    db.commit()


@router.post("/{log_id}/complete", response_model=MaintenanceLogOut)
def complete_maintenance(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    from datetime import datetime
    m = db.query(MaintenanceLog).filter(MaintenanceLog.id == log_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Maintenance log not found")
    m.status = MaintenanceStatus.completed
    m.completed_date = datetime.now().strftime("%Y-%m-%d")
    write_audit(db, AuditAction.update, "maintenance_log", log_id, current_user, {"status": "completed"})
    db.commit()
    db.refresh(m)
    return MaintenanceLogOut.model_validate(_enrich(m))
