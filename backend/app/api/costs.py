from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, CostEntry, CostStatus, User, UserRole
from app.schemas.schemas import CostEntryCreate, CostEntryOut, CostEntryUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/costs", tags=["costs"])


def _enrich(c: CostEntry) -> dict:
    data = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    data["submitter_name"] = c.submitter.full_name if c.submitter else None
    data["approver_name"] = c.approver.full_name if c.approver else None
    return data


@router.get("", response_model=PaginatedResponse[CostEntryOut])
def list_costs(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    status: str = "",
    project: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CostEntry)
    if search:
        q = q.filter(CostEntry.description.ilike(f"%{search}%") | CostEntry.vendor.ilike(f"%{search}%"))
    if category:
        q = q.filter(CostEntry.category == category)
    if status:
        q = q.filter(CostEntry.status == status)
    if project:
        q = q.filter(CostEntry.project.ilike(f"%{project}%"))
    total = q.count()
    items = q.order_by(CostEntry.date.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [CostEntryOut.model_validate(_enrich(c)) for c in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/summary")
def get_cost_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.manager)),
):
    """Get cost summary by category and project"""
    # By category
    by_category = db.query(
        CostEntry.category,
        func.sum(CostEntry.amount).label("total")
    ).filter(CostEntry.status != CostStatus.rejected).group_by(CostEntry.category).all()

    # By project
    by_project = db.query(
        CostEntry.project,
        func.sum(CostEntry.amount).label("total")
    ).filter(CostEntry.status != CostStatus.rejected, CostEntry.project != "").group_by(CostEntry.project).all()

    # Monthly totals (current year)
    monthly = db.query(
        func.strftime("%Y-%m", CostEntry.date).label("month"),
        func.sum(CostEntry.amount).label("total")
    ).filter(CostEntry.status != CostStatus.rejected).group_by("month").order_by("month").all()

    # Status breakdown
    by_status = db.query(
        CostEntry.status,
        func.count(CostEntry.id).label("count"),
        func.sum(CostEntry.amount).label("total")
    ).group_by(CostEntry.status).all()

    return {
        "by_category": {str(cat): float(total) for cat, total in by_category},
        "by_project": {proj: float(total) for proj, total in by_project},
        "monthly": [{"month": m, "total": float(t)} for m, t in monthly],
        "by_status": {str(s): {"count": c, "total": float(t) if t else 0} for s, c, t in by_status},
    }


@router.post("", response_model=CostEntryOut, status_code=201)
def create_cost(
    body: CostEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    cost = CostEntry(
        category=body.category,
        description=body.description,
        amount=body.amount,
        project=body.project,
        vendor=body.vendor,
        date=body.date,
        submitted_by=body.submitted_by or current_user.id,
        receipt_path=body.receipt_path,
        notes=body.notes,
    )
    db.add(cost)
    write_audit(db, AuditAction.create, "cost_entry", cost.id, current_user, {"description": body.description, "amount": str(body.amount)})
    db.commit()
    db.refresh(cost)
    return CostEntryOut.model_validate(_enrich(cost))


@router.get("/{cost_id}", response_model=CostEntryOut)
def get_cost(cost_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    c = db.query(CostEntry).filter(CostEntry.id == cost_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    return CostEntryOut.model_validate(_enrich(c))


@router.put("/{cost_id}", response_model=CostEntryOut)
def update_cost(
    cost_id: int,
    body: CostEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    c = db.query(CostEntry).filter(CostEntry.id == cost_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    changes = {}
    for field_name in ("category", "description", "amount", "project", "vendor",
                       "date", "status", "approved_by", "approved_date", "receipt_path", "notes"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = str(val)
            setattr(c, field_name, val)
    write_audit(db, AuditAction.update, "cost_entry", cost_id, current_user, changes)
    db.commit()
    db.refresh(c)
    return CostEntryOut.model_validate(_enrich(c))


@router.delete("/{cost_id}", status_code=204)
def delete_cost(
    cost_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    c = db.query(CostEntry).filter(CostEntry.id == cost_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    write_audit(db, AuditAction.delete, "cost_entry", cost_id, current_user, {"description": c.description})
    db.delete(c)
    db.commit()


@router.post("/{cost_id}/approve", response_model=CostEntryOut)
def approve_cost(
    cost_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    from datetime import datetime
    c = db.query(CostEntry).filter(CostEntry.id == cost_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    c.status = CostStatus.approved
    c.approved_by = current_user.id
    c.approved_date = datetime.now().strftime("%Y-%m-%d")
    write_audit(db, AuditAction.update, "cost_entry", cost_id, current_user, {"status": "approved"})
    db.commit()
    db.refresh(c)
    return CostEntryOut.model_validate(_enrich(c))


@router.post("/{cost_id}/reject", response_model=CostEntryOut)
def reject_cost(
    cost_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    c = db.query(CostEntry).filter(CostEntry.id == cost_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cost entry not found")
    c.status = CostStatus.rejected
    c.approved_by = current_user.id
    write_audit(db, AuditAction.update, "cost_entry", cost_id, current_user, {"status": "rejected"})
    db.commit()
    db.refresh(c)
    return CostEntryOut.model_validate(_enrich(c))
