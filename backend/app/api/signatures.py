"""
Electronic Signatures API — 21 CFR Part 11 compliance.
POST /api/signatures/sign        — sign a document (requires password re-entry)
GET  /api/signatures/{type}/{id} — get all signatures for a document
GET  /api/signatures/mine        — all signatures made by current user
GET  /api/signatures/admin/all   — admin: all signatures with filters
PUT  /api/signatures/{id}/invalidate — admin: invalidate a signature with reason
"""
import hashlib
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password
from app.models.models import AuditAction, ElectronicSignature, SignatureReason, User, UserRole
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/signatures", tags=["signatures"])


def _content_hash(entity_type: str, entity_id: int, content: str = "") -> str:
    data = f"{entity_type}:{entity_id}:{content}"
    return hashlib.sha256(data.encode()).hexdigest()


@router.post("/sign")
def sign_document(
    body: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sign a document. Body: {
      entity_type, entity_id, entity_title, reason, meaning, password, content
    }
    Password must be the user's current password (21 CFR Part 11 requirement).
    """
    password = body.get("password", "")
    if not verify_password(password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Password incorrect — signature denied")

    entity_type = body.get("entity_type", "")
    entity_id = int(body.get("entity_id", 0))
    reason_str = body.get("reason", "reviewed")

    try:
        reason = SignatureReason(reason_str)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid reason: {reason_str}")

    content = body.get("content", "")
    ch = _content_hash(entity_type, entity_id, content)

    sig = ElectronicSignature(
        entity_type=entity_type,
        entity_id=entity_id,
        entity_title=body.get("entity_title", ""),
        signer_id=current_user.id,
        signer_email=current_user.email,
        signer_name=current_user.full_name,
        reason=reason,
        meaning=body.get("meaning", ""),
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", "")[:500],
        content_hash=ch,
        signed_at=datetime.utcnow(),
    )
    db.add(sig)
    write_audit(db, AuditAction.create, "electronic_signature", entity_id, current_user,
                {"entity_type": entity_type, "reason": reason_str})
    db.commit()
    db.refresh(sig)

    return _sig_out(sig)


@router.get("/mine")
def my_signatures(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (db.query(ElectronicSignature)
         .filter(ElectronicSignature.signer_id == current_user.id)
         .order_by(ElectronicSignature.signed_at.desc()))
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "items": [_sig_out(s) for s in items]}


@router.get("/admin/all")
def admin_list_signatures(
    page: int = 1,
    per_page: int = 50,
    entity_type: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    q = db.query(ElectronicSignature).order_by(ElectronicSignature.signed_at.desc())
    if entity_type:
        q = q.filter(ElectronicSignature.entity_type == entity_type)
    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()
    return {"total": total, "items": [_sig_out(s) for s in items]}


@router.get("/{entity_type}/{entity_id}")
def get_document_signatures(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sigs = (db.query(ElectronicSignature)
            .filter(
                ElectronicSignature.entity_type == entity_type,
                ElectronicSignature.entity_id == entity_id,
            )
            .order_by(ElectronicSignature.signed_at.asc())
            .all())
    return [_sig_out(s) for s in sigs]


@router.put("/{sig_id}/invalidate")
def invalidate_signature(
    sig_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    sig = db.query(ElectronicSignature).filter(ElectronicSignature.id == sig_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    sig.is_valid = False
    sig.invalidated_reason = body.get("reason", "Invalidated by admin")
    write_audit(db, AuditAction.update, "electronic_signature", sig_id, current_user,
                {"invalidated": True, "reason": sig.invalidated_reason})
    db.commit()
    return _sig_out(sig)


def _sig_out(s: ElectronicSignature) -> dict:
    return {
        "id": s.id,
        "entity_type": s.entity_type,
        "entity_id": s.entity_id,
        "entity_title": s.entity_title,
        "signer_id": s.signer_id,
        "signer_email": s.signer_email,
        "signer_name": s.signer_name,
        "reason": s.reason.value,
        "meaning": s.meaning,
        "content_hash": s.content_hash,
        "signed_at": s.signed_at.isoformat(),
        "is_valid": s.is_valid,
        "invalidated_reason": s.invalidated_reason,
    }
