from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.models.models import GrantSubmission, GrantSubmissionStatus, User
from app.schemas.schemas import PaginatedResponse
from app.services.auth import get_current_user

router = APIRouter(prefix="/grant-submissions", tags=["grant-submissions"])


class SubmissionCreate(BaseModel):
    grant_number: str = ""
    title: str
    agency: str = "NIH"
    institute: str = ""
    grant_type: str = "R01"
    submitted_at: str = ""
    status: GrantSubmissionStatus = GrantSubmissionStatus.submitted
    score: Optional[float] = None
    percentile: Optional[float] = None
    total_amount: float = 0.0
    revision_number: int = 0
    notes: str = ""


class SubmissionUpdate(BaseModel):
    title: Optional[str] = None
    status: Optional[GrantSubmissionStatus] = None
    score: Optional[float] = None
    percentile: Optional[float] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None
    submitted_at: Optional[str] = None


def _to_out(s: GrantSubmission) -> dict:
    return {
        "id": s.id,
        "grant_number": s.grant_number,
        "title": s.title,
        "agency": s.agency,
        "institute": s.institute,
        "grant_type": s.grant_type,
        "submitted_at": s.submitted_at,
        "status": s.status.value if hasattr(s.status, "value") else s.status,
        "score": s.score,
        "percentile": s.percentile,
        "total_amount": s.total_amount,
        "revision_number": s.revision_number,
        "notes": s.notes,
        "created_at": s.created_at.isoformat() if s.created_at else "",
    }


@router.get("")
def list_submissions(
    page: int = 1, per_page: int = 20, status: str = "", agency: str = "", grant_type: str = "",
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    q = db.query(GrantSubmission).filter(GrantSubmission.user_id == user.id)
    if status:
        q = q.filter(GrantSubmission.status == status)
    if agency:
        q = q.filter(GrantSubmission.agency.ilike(f"%{agency}%"))
    if grant_type:
        q = q.filter(GrantSubmission.grant_type == grant_type)
    total = q.count()
    items = q.order_by(GrantSubmission.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    return PaginatedResponse(
        items=[_to_out(s) for s in items],
        total=total, page=page, per_page=per_page,
        pages=(total + per_page - 1) // per_page or 1,
    )


@router.post("", status_code=201)
def create_submission(body: SubmissionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = GrantSubmission(user_id=user.id, **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.patch("/{sub_id}")
def update_submission(
    sub_id: int, body: SubmissionUpdate,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    s = db.query(GrantSubmission).filter(GrantSubmission.id == sub_id, GrantSubmission.user_id == user.id).first()
    if not s:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _to_out(s)


@router.delete("/{sub_id}", status_code=204)
def delete_submission(sub_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(GrantSubmission).filter(GrantSubmission.id == sub_id, GrantSubmission.user_id == user.id).first()
    if s:
        db.delete(s)
        db.commit()


@router.get("/analytics/summary")
def get_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    subs = db.query(GrantSubmission).filter(GrantSubmission.user_id == user.id).all()
    total = len(subs)
    funded = [s for s in subs if s.status == GrantSubmissionStatus.funded]
    scored = [s for s in subs if s.score is not None]
    by_status = {}
    for st in GrantSubmissionStatus:
        by_status[st.value] = sum(1 for s in subs if s.status == st)
    by_type: dict[str, dict] = {}
    for s in subs:
        t = s.grant_type or "Other"
        if t not in by_type:
            by_type[t] = {"submitted": 0, "funded": 0}
        by_type[t]["submitted"] += 1
        if s.status == GrantSubmissionStatus.funded:
            by_type[t]["funded"] += 1
    return {
        "total_submitted": total,
        "total_funded": len(funded),
        "success_rate": round(len(funded) / total * 100, 1) if total else 0,
        "total_funding": sum(s.total_amount for s in funded),
        "avg_score": round(sum(s.score for s in scored) / len(scored), 1) if scored else None,
        "by_status": by_status,
        "by_type": by_type,
    }
