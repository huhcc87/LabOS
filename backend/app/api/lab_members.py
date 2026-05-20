"""Lab membership API — PI can invite, approve, and revoke lab access.

Permission rules (enforced in each endpoint):
- Only the PI of a lab (LabUnit.pi_user_id) — or an admin/superadmin — can
  approve, invite, or revoke memberships in that lab.
- Any authenticated user can REQUEST to join a lab (creates a pending record).
- A user can leave a lab they belong to themselves (sets status=revoked).
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    LabMembership, LabMembershipStatus, LabUnit, User, UserRole
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/lab-members", tags=["lab-members"])


# ─── Pydantic ────────────────────────────────────────────────────────────────
class MembershipOut(BaseModel):
    id: int
    user_id: Optional[int]
    lab_id: int
    lab_name: str
    lab_role: str
    status: str
    invite_email: str
    invited_by: Optional[int]
    approved_by: Optional[int]
    approved_at: Optional[str]
    revoked_at: Optional[str]
    user_email: Optional[str]
    user_name: Optional[str]
    notes: str
    created_at: str


class InviteIn(BaseModel):
    lab_id: int
    email: EmailStr
    lab_role: str = "member"
    notes: str = ""


class JoinRequestIn(BaseModel):
    lab_id: int
    notes: str = ""


class UpdateRoleIn(BaseModel):
    lab_role: str  # member, manager, observer


# ─── Helpers ────────────────────────────────────────────────────────────────
def _to_out(m: LabMembership, db: Session) -> dict:
    lab = db.query(LabUnit).filter(LabUnit.id == m.lab_id).first()
    user = db.query(User).filter(User.id == m.user_id).first() if m.user_id else None
    return {
        "id": m.id,
        "user_id": m.user_id,
        "lab_id": m.lab_id,
        "lab_name": lab.name if lab else "(unknown lab)",
        "lab_role": m.lab_role,
        "status": m.status.value,
        "invite_email": m.invite_email,
        "invited_by": m.invited_by,
        "approved_by": m.approved_by,
        "approved_at": m.approved_at.isoformat() if m.approved_at else None,
        "revoked_at": m.revoked_at.isoformat() if m.revoked_at else None,
        "user_email": user.email if user else m.invite_email,
        "user_name": user.full_name if user else "",
        "notes": m.notes,
        "created_at": m.created_at.isoformat() if m.created_at else "",
    }


def _can_manage_lab(user: User, lab: LabUnit) -> bool:
    if user.role in (UserRole.superadmin, UserRole.admin):
        return True
    if lab.pi_user_id == user.id:
        return True
    return False


def _require_pi(db: Session, user: User, lab_id: int) -> LabUnit:
    lab = db.query(LabUnit).filter(LabUnit.id == lab_id).first()
    if not lab:
        raise HTTPException(404, "Lab not found")
    if not _can_manage_lab(user, lab):
        raise HTTPException(403, "Only the PI of this lab (or an admin) can do that")
    return lab


# ─── Endpoints ──────────────────────────────────────────────────────────────
@router.get("/lab/{lab_id}", response_model=List[MembershipOut])
def list_members(lab_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List all memberships for a lab. The PI sees everyone; members see other approved members."""
    lab = db.query(LabUnit).filter(LabUnit.id == lab_id).first()
    if not lab:
        raise HTTPException(404, "Lab not found")
    is_pi = _can_manage_lab(user, lab)
    q = db.query(LabMembership).filter(LabMembership.lab_id == lab_id)
    if not is_pi:
        # Regular member can only see approved members
        q = q.filter(LabMembership.status == LabMembershipStatus.approved)
    return [_to_out(m, db) for m in q.order_by(LabMembership.created_at.desc()).all()]


@router.get("/my")
def list_my_memberships(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """All labs this user is in (any status)."""
    rows = db.query(LabMembership).filter(LabMembership.user_id == user.id).all()
    return [_to_out(m, db) for m in rows]


@router.get("/my/pending-approvals")
def pending_approvals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Memberships waiting on this user (as PI) to approve."""
    my_labs = db.query(LabUnit).filter(LabUnit.pi_user_id == user.id).all()
    if not my_labs and user.role not in (UserRole.admin, UserRole.superadmin):
        return []
    lab_ids = [l.id for l in my_labs]
    q = db.query(LabMembership).filter(LabMembership.status == LabMembershipStatus.pending)
    if user.role not in (UserRole.admin, UserRole.superadmin):
        q = q.filter(LabMembership.lab_id.in_(lab_ids))
    return [_to_out(m, db) for m in q.all()]


@router.post("/invite", status_code=201)
def invite(body: InviteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """PI invites a user (by email) to join their lab."""
    lab = _require_pi(db, user, body.lab_id)
    # Find user by email if they exist
    target = db.query(User).filter(User.email == body.email).first()
    # Check for existing membership
    existing = db.query(LabMembership).filter(
        LabMembership.lab_id == lab.id,
        ((LabMembership.user_id == target.id) if target else (LabMembership.invite_email == body.email))
    ).first()
    if existing:
        if existing.status == LabMembershipStatus.revoked:
            # Re-invite
            existing.status = LabMembershipStatus.invited
            existing.invited_by = user.id
            existing.revoked_at = None
            existing.revoke_reason = ""
            db.commit()
            return _to_out(existing, db)
        raise HTTPException(409, f"Membership already exists with status: {existing.status.value}")
    m = LabMembership(
        user_id=target.id if target else None,
        lab_id=lab.id,
        lab_role=body.lab_role,
        status=LabMembershipStatus.invited if target else LabMembershipStatus.invited,
        invited_by=user.id,
        invite_email=body.email,
        notes=body.notes,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m, db)


@router.post("/request-join", status_code=201)
def request_join(body: JoinRequestIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Authenticated user requests to join a lab. PI will see it in pending-approvals."""
    lab = db.query(LabUnit).filter(LabUnit.id == body.lab_id).first()
    if not lab:
        raise HTTPException(404, "Lab not found")
    existing = db.query(LabMembership).filter(
        LabMembership.lab_id == body.lab_id,
        LabMembership.user_id == user.id,
    ).first()
    if existing:
        if existing.status in (LabMembershipStatus.approved, LabMembershipStatus.pending, LabMembershipStatus.invited):
            return _to_out(existing, db)
        # Re-request after revoke
        existing.status = LabMembershipStatus.pending
        existing.notes = body.notes
        existing.revoked_at = None
        db.commit()
        return _to_out(existing, db)
    m = LabMembership(
        user_id=user.id,
        lab_id=body.lab_id,
        lab_role="member",
        status=LabMembershipStatus.pending,
        notes=body.notes,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m, db)


@router.post("/{membership_id}/approve")
def approve(membership_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(LabMembership).filter(LabMembership.id == membership_id).first()
    if not m:
        raise HTTPException(404)
    lab = _require_pi(db, user, m.lab_id)
    m.status = LabMembershipStatus.approved
    m.approved_by = user.id
    m.approved_at = datetime.utcnow()
    db.commit()
    return _to_out(m, db)


@router.post("/{membership_id}/accept-invite")
def accept_invite(membership_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Invited user accepts the invite from the PI."""
    m = db.query(LabMembership).filter(LabMembership.id == membership_id).first()
    if not m:
        raise HTTPException(404)
    if m.status != LabMembershipStatus.invited:
        raise HTTPException(400, "Membership is not in invited state")
    if m.user_id and m.user_id != user.id:
        raise HTTPException(403, "This invite is for a different user")
    # Link user if it was email-only
    if not m.user_id:
        if m.invite_email != user.email:
            raise HTTPException(403, "Email does not match invite")
        m.user_id = user.id
    m.status = LabMembershipStatus.approved
    m.approved_at = datetime.utcnow()
    db.commit()
    return _to_out(m, db)


@router.post("/{membership_id}/revoke")
def revoke(membership_id: int, reason: str = "",
           db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(LabMembership).filter(LabMembership.id == membership_id).first()
    if not m:
        raise HTTPException(404)
    # PI can revoke anyone, member can revoke themselves
    lab = db.query(LabUnit).filter(LabUnit.id == m.lab_id).first()
    if not lab:
        raise HTTPException(404, "Lab not found")
    if not (_can_manage_lab(user, lab) or m.user_id == user.id):
        raise HTTPException(403, "Only the PI or the member themselves can revoke")
    m.status = LabMembershipStatus.revoked
    m.revoked_at = datetime.utcnow()
    m.revoke_reason = reason
    db.commit()
    return _to_out(m, db)


@router.patch("/{membership_id}/role")
def update_role(membership_id: int, body: UpdateRoleIn,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = db.query(LabMembership).filter(LabMembership.id == membership_id).first()
    if not m:
        raise HTTPException(404)
    _require_pi(db, user, m.lab_id)
    m.lab_role = body.lab_role
    db.commit()
    return _to_out(m, db)


@router.get("/can-i-manage/{lab_id}")
def can_i_manage(lab_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Helper for the frontend to know whether to show PI controls."""
    lab = db.query(LabUnit).filter(LabUnit.id == lab_id).first()
    if not lab:
        return {"can_manage": False}
    return {
        "can_manage": _can_manage_lab(user, lab),
        "is_pi": lab.pi_user_id == user.id,
        "is_admin": user.role in (UserRole.admin, UserRole.superadmin),
    }
