from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, IncidentReport, User, UserRole
from app.schemas.schemas import IncidentReportCreate, IncidentReportOut, IncidentReportUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _enrich(i: IncidentReport) -> IncidentReportOut:
    return IncidentReportOut.model_validate({
        "id": i.id, "title": i.title, "area": i.area, "severity": i.severity,
        "description": i.description, "corrective_action": i.corrective_action,
        "status": i.status, "reported_by": i.reported_by,
        "reporter_name": i.reporter.full_name if i.reporter else None,
        "created_at": i.created_at,
    })


@router.get("", response_model=PaginatedResponse[IncidentReportOut])
def list_incidents(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    severity: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(IncidentReport)
    if search:
        q = q.filter(IncidentReport.title.ilike(f"%{search}%") | IncidentReport.area.ilike(f"%{search}%"))
    if severity:
        q = q.filter(IncidentReport.severity == severity)
    if status:
        q = q.filter(IncidentReport.status == status)
    total = q.count()
    items = q.order_by(IncidentReport.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(i) for i in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=IncidentReportOut, status_code=201)
def create_incident(
    body: IncidentReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = IncidentReport(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "incident", item.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(item)
    return _enrich(item)


@router.get("/{incident_id}", response_model=IncidentReportOut)
def get_incident(incident_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    i = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _enrich(i)


@router.put("/{incident_id}", response_model=IncidentReportOut)
def update_incident(
    incident_id: int,
    body: IncidentReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Incident not found")
    changes = {}
    for fname in ("title", "area", "severity", "description", "corrective_action", "status", "reported_by"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(i, fname, val)
    write_audit(db, AuditAction.update, "incident", incident_id, current_user, changes)
    db.commit()
    db.refresh(i)
    return _enrich(i)


@router.delete("/{incident_id}", status_code=204)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    i = db.query(IncidentReport).filter(IncidentReport.id == incident_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Incident not found")
    write_audit(db, AuditAction.delete, "incident", incident_id, current_user, {"title": i.title})
    db.delete(i)
    db.commit()
