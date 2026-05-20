from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Feedback, User
from app.schemas.schemas import FeedbackCreate, FeedbackOut, FeedbackUpdate, PaginatedResponse
from app.services.auth import get_current_user, write_audit

router = APIRouter(prefix="/feedback", tags=["feedback"])


def _enrich(f: Feedback) -> FeedbackOut:
    return FeedbackOut.model_validate({
        "id": f.id, "subject": f.subject, "message": f.message, "module": f.module,
        "submitted_by": f.submitted_by,
        "submitter_name": f.submitter.full_name if f.submitter else None,
        "status": f.status, "created_at": f.created_at,
    })


@router.get("", response_model=PaginatedResponse[FeedbackOut])
def list_feedback(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Feedback)
    if search:
        q = q.filter(Feedback.subject.ilike(f"%{search}%") | Feedback.message.ilike(f"%{search}%"))
    if status:
        q = q.filter(Feedback.status == status)
    total = q.count()
    items = q.order_by(Feedback.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(f) for f in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=FeedbackOut, status_code=201)
def create_feedback(
    body: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = Feedback(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "feedback", item.id, current_user, {"subject": body.subject})
    db.commit()
    db.refresh(item)
    return _enrich(item)


@router.get("/{feedback_id}", response_model=FeedbackOut)
def get_feedback(feedback_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    f = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return _enrich(f)


@router.put("/{feedback_id}", response_model=FeedbackOut)
def update_feedback(
    feedback_id: int,
    body: FeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    changes = {}
    for fname in ("subject", "message", "module", "status"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(f, fname, val)
    write_audit(db, AuditAction.update, "feedback", feedback_id, current_user, changes)
    db.commit()
    db.refresh(f)
    return _enrich(f)


@router.delete("/{feedback_id}", status_code=204)
def delete_feedback(
    feedback_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    f = db.query(Feedback).filter(Feedback.id == feedback_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="Feedback not found")
    write_audit(db, AuditAction.delete, "feedback", feedback_id, current_user, {"subject": f.subject})
    db.delete(f)
    db.commit()
