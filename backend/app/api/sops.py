from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, SOP, SOPStatus, User, UserRole
from app.schemas.schemas import PaginatedResponse, SOPCreate, SOPOut, SOPUpdate
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/sops", tags=["sops"])


def _enrich(s: SOP) -> dict:
    data = {c.name: getattr(s, c.name) for c in s.__table__.columns}
    data["author_name"] = s.author.full_name if s.author else None
    data["approver_name"] = s.approver.full_name if s.approver else None
    return data


@router.get("", response_model=PaginatedResponse[SOPOut])
def list_sops(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(SOP)
    if search:
        q = q.filter(SOP.title.ilike(f"%{search}%") | SOP.code.ilike(f"%{search}%"))
    if category:
        q = q.filter(SOP.category == category)
    if status:
        q = q.filter(SOP.status == status)
    total = q.count()
    items = q.order_by(SOP.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [SOPOut.model_validate(_enrich(s)) for s in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=SOPOut, status_code=201)
def create_sop(
    body: SOPCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    sop = SOP(
        title=body.title,
        code=body.code,
        category=body.category,
        version=body.version,
        description=body.description,
        content=body.content,
        effective_date=body.effective_date,
        review_date=body.review_date,
        author_id=body.author_id or current_user.id,
        approver_id=body.approver_id,
    )
    db.add(sop)
    write_audit(db, AuditAction.create, "sop", sop.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(sop)
    return SOPOut.model_validate(_enrich(sop))


@router.get("/{sop_id}", response_model=SOPOut)
def get_sop(sop_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    s = db.query(SOP).filter(SOP.id == sop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="SOP not found")
    return SOPOut.model_validate(_enrich(s))


@router.put("/{sop_id}", response_model=SOPOut)
def update_sop(
    sop_id: int,
    body: SOPUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    s = db.query(SOP).filter(SOP.id == sop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="SOP not found")
    changes = {}
    for field_name in ("title", "code", "category", "version", "status", "description",
                       "content", "effective_date", "review_date", "author_id", "approver_id"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = str(val)
            setattr(s, field_name, val)
    write_audit(db, AuditAction.update, "sop", sop_id, current_user, changes)
    db.commit()
    db.refresh(s)
    return SOPOut.model_validate(_enrich(s))


@router.delete("/{sop_id}", status_code=204)
def delete_sop(
    sop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    s = db.query(SOP).filter(SOP.id == sop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="SOP not found")
    write_audit(db, AuditAction.delete, "sop", sop_id, current_user, {"title": s.title})
    db.delete(s)
    db.commit()


@router.post("/{sop_id}/approve", response_model=SOPOut)
def approve_sop(
    sop_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    s = db.query(SOP).filter(SOP.id == sop_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="SOP not found")
    s.status = SOPStatus.approved
    s.approver_id = current_user.id
    write_audit(db, AuditAction.update, "sop", sop_id, current_user, {"status": "approved"})
    db.commit()
    db.refresh(s)
    return SOPOut.model_validate(_enrich(s))
