from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, InventoryItem, ReagentDisposalLog, User
from app.schemas.schemas import DisposalLogCreate, DisposalLogOut, PaginatedResponse
from app.services.auth import get_current_user, write_audit

router = APIRouter(prefix="/reagents", tags=["reagents"])


@router.get("/expiry-alerts")
def expiry_alerts(
    days: int = 90,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    today = date.today()
    cutoff = today + timedelta(days=days)
    today_str = today.isoformat()
    cutoff_str = cutoff.isoformat()
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.expires_on.isnot(None))
        .filter(InventoryItem.expires_on != "")
        .all()
    )
    expired, critical, warning, upcoming = [], [], [], []
    for item in items:
        exp = item.expires_on
        if exp <= today_str:
            expired.append(item)
        elif exp <= (today + timedelta(days=30)).isoformat():
            critical.append(item)
        elif exp <= (today + timedelta(days=60)).isoformat():
            warning.append(item)
        elif exp <= cutoff_str:
            upcoming.append(item)

    def _fmt(items_list):
        return [
            {
                "id": i.id, "name": i.name, "category": i.category,
                "lot_number": i.lot_number, "expires_on": i.expires_on,
                "quantity": i.quantity, "unit": i.unit,
                "storage_location": i.storage_location,
                "hazard_class": i.hazard_class, "cas_number": i.cas_number,
            }
            for i in items_list
        ]

    return {
        "expired": _fmt(expired),
        "critical": _fmt(critical),
        "warning": _fmt(warning),
        "upcoming": _fmt(upcoming),
        "total_expiring": len(expired) + len(critical) + len(warning) + len(upcoming),
    }


@router.get("/sds-status")
def sds_status(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items = db.query(InventoryItem).filter(
        InventoryItem.hazard_class != ""
    ).all()
    with_sds, without_sds = [], []
    for item in items:
        entry = {
            "id": item.id, "name": item.name, "cas_number": item.cas_number,
            "hazard_class": item.hazard_class, "sds_url": item.sds_url,
            "msds_available": item.msds_available, "storage_temp": item.storage_temp,
            "storage_location": item.storage_location,
        }
        if item.sds_url or item.msds_available:
            with_sds.append(entry)
        else:
            without_sds.append(entry)
    return {
        "with_sds": with_sds,
        "without_sds": without_sds,
        "compliance_pct": round(len(with_sds) / max(len(items), 1) * 100),
    }


@router.get("/disposal-log", response_model=PaginatedResponse[DisposalLogOut])
def list_disposal_logs(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(ReagentDisposalLog).order_by(ReagentDisposalLog.disposed_at.desc())
    total = q.count()
    logs = q.offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=logs, total=total, page=page, per_page=per_page, pages=pages)


@router.post("/disposal-log", response_model=DisposalLogOut, status_code=201)
def create_disposal_log(
    body: DisposalLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = ReagentDisposalLog(
        **body.model_dump(),
        disposed_by=current_user.id,
    )
    db.add(log)
    db.flush()
    write_audit(db, AuditAction.create, "reagent_disposal", log.id, current_user,
                {"reagent": body.reagent_name, "method": body.disposal_method})
    db.commit()
    db.refresh(log)
    return log


@router.delete("/disposal-log/{log_id}", status_code=204)
def delete_disposal_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(ReagentDisposalLog).filter(ReagentDisposalLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    write_audit(db, AuditAction.delete, "reagent_disposal", log_id, current_user, {})
    db.delete(log)
    db.commit()
