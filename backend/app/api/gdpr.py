"""
GDPR Compliance API
- Art. 15: Right of Access — export all personal data as JSON
- Art. 17: Right to Erasure — request account + personal data deletion
- Art. 20: Right to Data Portability — structured data export
- Art. 33: Breach notification log (admin only)
- Data retention enforcement (admin only)
"""
import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    AuditAction,
    AuditLog,
    Booking,
    ComplianceLog,
    ConsentRecord,
    DataErasureRequest,
    DataExportRequest,
    ErasureStatus,
    Feedback,
    IncidentReport,
    InventoryItem,
    LabNotebookEntry,
    SampleEvent,
    SampleRecord,
    Task,
    TrainingRecord,
    User,
    UserRole,
)
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/gdpr", tags=["gdpr"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ErasureRequestCreate(BaseModel):
    reason: str = ""


class ErasureReview(BaseModel):
    status: ErasureStatus
    rejection_reason: str = ""


# ─── Art. 15 / 20 — Data Access & Export ─────────────────────────────────────

@router.post("/export", status_code=202)
def request_data_export(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit a data-export request. Returns all personal data immediately."""
    req = DataExportRequest(
        user_id=current_user.id,
        requested_at=datetime.now(timezone.utc),
        status="ready",
        completed_at=datetime.now(timezone.utc),
    )
    db.add(req)
    db.flush()

    export = _collect_user_data(current_user, db)
    req.status = "downloaded"
    write_audit(db, AuditAction.create, "gdpr_export", req.id, current_user, {"type": "data_export"})
    db.commit()

    return JSONResponse(
        content={
            "request_id": req.id,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "data": export,
        }
    )


def _collect_user_data(user: User, db: Session) -> dict:
    """Gather all personal data associated with a user (GDPR Art. 15)."""
    tasks = db.query(Task).filter(Task.assigned_to == user.id).all()
    bookings = db.query(Booking).filter(Booking.user_id == user.id).all()
    training = db.query(TrainingRecord).filter(TrainingRecord.user_id == user.id).all()
    samples = db.query(SampleRecord).filter(SampleRecord.owner_id == user.id).all()
    compliance = db.query(ComplianceLog).filter(ComplianceLog.logged_by == user.id).all()
    feedback = db.query(Feedback).filter(Feedback.submitted_by == user.id).all()
    incidents = db.query(IncidentReport).filter(IncidentReport.reported_by == user.id).all()
    notebooks = db.query(LabNotebookEntry).filter(LabNotebookEntry.author_id == user.id).all()
    consents = db.query(ConsentRecord).filter(ConsentRecord.user_id == user.id).all()
    audit_logs = db.query(AuditLog).filter(AuditLog.user_id == user.id).limit(500).all()

    return {
        "profile": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role.value,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        },
        "consents": [
            {
                "purpose": c.purpose.value,
                "status": c.status.value,
                "granted_at": c.granted_at.isoformat() if c.granted_at else None,
                "revoked_at": c.revoked_at.isoformat() if c.revoked_at else None,
            }
            for c in consents
        ],
        "tasks": [
            {"id": t.id, "title": t.title, "status": t.status.value, "due_date": t.due_date}
            for t in tasks
        ],
        "bookings": [
            {"id": b.id, "instrument_id": b.instrument_id, "start": b.start_time, "end": b.end_time, "status": b.status.value}
            for b in bookings
        ],
        "training_records": [
            {"id": t.id, "title": t.title, "completed_on": t.completed_on, "expires_on": t.expires_on, "status": t.status.value}
            for t in training
        ],
        "samples_owned": [
            {"id": s.id, "sample_id": s.sample_id, "barcode": s.barcode, "status": s.status.value}
            for s in samples
        ],
        "compliance_logs": [
            {"id": c.id, "title": c.title, "category": c.category, "created_at": c.created_at.isoformat()}
            for c in compliance
        ],
        "feedback_submitted": [
            {"id": f.id, "subject": f.subject, "created_at": f.created_at.isoformat()}
            for f in feedback
        ],
        "incidents_reported": [
            {"id": i.id, "title": i.title, "severity": i.severity.value, "created_at": i.created_at.isoformat()}
            for i in incidents
        ],
        "lab_notebook_entries": [
            {"id": n.id, "title": n.title, "created_at": n.created_at.isoformat()}
            for n in notebooks
        ],
        "audit_trail": [
            {
                "id": a.id,
                "action": a.action.value,
                "entity_type": a.entity_type,
                "timestamp": a.timestamp.isoformat(),
            }
            for a in audit_logs
        ],
    }


# ─── Art. 17 — Right to Erasure ───────────────────────────────────────────────

@router.post("/erasure-request", status_code=201)
def submit_erasure_request(
    body: ErasureRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(DataErasureRequest).filter(
        DataErasureRequest.user_id == current_user.id,
        DataErasureRequest.status.in_(["pending", "in_review"]),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="An erasure request is already pending.")

    req = DataErasureRequest(
        user_id=current_user.id,
        reason=body.reason,
    )
    db.add(req)
    write_audit(db, AuditAction.create, "gdpr_erasure", None, current_user, {"reason": body.reason})
    db.commit()
    db.refresh(req)
    return {
        "id": req.id,
        "status": req.status.value,
        "requested_at": req.requested_at.isoformat(),
        "message": (
            "Your erasure request has been received. "
            "An admin will review it within 30 days. "
            "Note: data required for legal or regulatory compliance may be retained."
        ),
    }


@router.get("/erasure-request/my")
def my_erasure_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    requests = db.query(DataErasureRequest).filter(
        DataErasureRequest.user_id == current_user.id
    ).order_by(DataErasureRequest.requested_at.desc()).all()
    return [
        {
            "id": r.id,
            "status": r.status.value,
            "reason": r.reason,
            "requested_at": r.requested_at.isoformat(),
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            "rejection_reason": r.rejection_reason,
        }
        for r in requests
    ]


@router.get("/erasure-requests")
def list_erasure_requests(
    status: str | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    q = db.query(DataErasureRequest)
    if status:
        q = q.filter(DataErasureRequest.status == status)
    requests = q.order_by(DataErasureRequest.requested_at.desc()).all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "user_email": r.user.email if r.user else "",
            "status": r.status.value,
            "reason": r.reason,
            "requested_at": r.requested_at.isoformat(),
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "rejection_reason": r.rejection_reason,
        }
        for r in requests
    ]


@router.put("/erasure-requests/{req_id}")
def review_erasure_request(
    req_id: int,
    body: ErasureReview,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    req = db.query(DataErasureRequest).filter(DataErasureRequest.id == req_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    now = datetime.now(timezone.utc)
    req.status = body.status
    req.reviewed_by_id = current_user.id
    req.reviewed_at = now
    req.rejection_reason = body.rejection_reason

    if body.status == ErasureStatus.completed:
        req.completed_at = now
        _anonymise_user(req.user_id, db)

    write_audit(
        db, AuditAction.update, "gdpr_erasure", req_id, current_user,
        {"status": body.status.value, "target_user_id": req.user_id},
    )
    db.commit()
    return {"id": req.id, "status": req.status.value}


def _anonymise_user(user_id: int, db: Session) -> None:
    """Replace PII with anonymised placeholders (soft erasure preserving audit integrity)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    anon_tag = f"[ERASED-{user_id}]"
    user.full_name = anon_tag
    user.email = f"erased_{user_id}@deleted.invalid"
    user.hashed_password = "ERASED"
    user.is_active = False
    # Anonymise feedback
    for fb in db.query(Feedback).filter(Feedback.submitted_by == user_id).all():
        fb.message = anon_tag
    # Anonymise lab notebook entries content
    for nb in db.query(LabNotebookEntry).filter(LabNotebookEntry.author_id == user_id).all():
        nb.content = anon_tag


# ─── Data Retention Report (admin) ────────────────────────────────────────────

@router.get("/retention-report")
def retention_report(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    cutoffs = {
        "audit_logs_10yr":   now - timedelta(days=3650),
        "session_logs_90d":  now - timedelta(days=90),
        "feedback_2yr":      now - timedelta(days=730),
    }

    old_audit = db.query(AuditLog).filter(AuditLog.timestamp < cutoffs["audit_logs_10yr"]).count()
    old_feedback = db.query(Feedback).filter(Feedback.created_at < cutoffs["feedback_2yr"]).count()
    pending_erasures = db.query(DataErasureRequest).filter(DataErasureRequest.status == "pending").count()
    pending_exports = db.query(DataExportRequest).filter(DataExportRequest.status == "pending").count()

    return {
        "generated_at": now.isoformat(),
        "retention_policy": {
            "audit_logs": "10 years",
            "session_logs": "90 days",
            "user_accounts": "Duration of employment + 7 years",
            "experiment_records": "10 years",
            "feedback": "2 years",
        },
        "action_required": {
            "audit_logs_past_retention": old_audit,
            "feedback_past_retention": old_feedback,
            "pending_erasure_requests": pending_erasures,
            "pending_export_requests": pending_exports,
        },
        "total_users": db.query(User).count(),
        "active_users": db.query(User).filter(User.is_active == True).count(),
        "consent_records": db.query(ConsentRecord).count(),
    }
