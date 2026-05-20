"""
Consent Management API — GDPR Art. 6/7
Users can view, grant, and revoke their consent for specific data-processing purposes.
Admins can view all consent records and publish new policy versions.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    AuditAction,
    ConsentPurpose,
    ConsentRecord,
    ConsentStatus,
    PrivacyPolicyVersion,
    User,
    UserRole,
)
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/consent", tags=["consent"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ConsentUpdate(BaseModel):
    purpose: ConsentPurpose
    granted: bool
    notes: str = ""


class PolicyVersionCreate(BaseModel):
    version: str
    effective_date: str
    summary: str
    content: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

PURPOSE_LABELS = {
    ConsentPurpose.data_processing:   "Essential Data Processing",
    ConsentPurpose.research_use:      "Research & Analytics Use",
    ConsentPurpose.marketing:         "Communications & Updates",
    ConsentPurpose.analytics:         "Usage Analytics",
    ConsentPurpose.third_party_share: "Third-Party Data Sharing",
    ConsentPurpose.phi_access:        "Protected Health Information (PHI) Access",
}

PURPOSE_DESCRIPTIONS = {
    ConsentPurpose.data_processing:   "Processing your data to operate the lab management system. Required for service delivery.",
    ConsentPurpose.research_use:      "Using anonymised data to improve research workflows and system performance.",
    ConsentPurpose.marketing:         "Sending system update announcements and lab newsletters to your email.",
    ConsentPurpose.analytics:         "Collecting aggregated usage statistics to improve the system.",
    ConsentPurpose.third_party_share: "Sharing data with authorised third-party integrations (e.g. sequencing providers).",
    ConsentPurpose.phi_access:        "Accessing and processing Protected Health Information in compliance with HIPAA.",
}

REQUIRED_PURPOSES = {ConsentPurpose.data_processing}


def _consent_dict(record: ConsentRecord) -> dict:
    return {
        "id": record.id,
        "purpose": record.purpose.value,
        "label": PURPOSE_LABELS.get(record.purpose, record.purpose.value),
        "description": PURPOSE_DESCRIPTIONS.get(record.purpose, ""),
        "required": record.purpose in REQUIRED_PURPOSES,
        "status": record.status.value,
        "granted_at": record.granted_at.isoformat() if record.granted_at else None,
        "revoked_at": record.revoked_at.isoformat() if record.revoked_at else None,
        "version": record.version,
        "notes": record.notes,
    }


def _ensure_all_consents(user: User, db: Session) -> list[ConsentRecord]:
    """Create missing consent rows (default pending) for all purposes."""
    existing = {r.purpose for r in db.query(ConsentRecord).filter(ConsentRecord.user_id == user.id).all()}
    for purpose in ConsentPurpose:
        if purpose not in existing:
            db.add(ConsentRecord(user_id=user.id, purpose=purpose, status=ConsentStatus.pending))
    db.commit()
    return db.query(ConsentRecord).filter(ConsentRecord.user_id == user.id).all()


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/my")
def my_consents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = _ensure_all_consents(current_user, db)
    return {
        "user_id": current_user.id,
        "consents": [_consent_dict(r) for r in sorted(records, key=lambda r: r.purpose.value)],
    }


@router.put("/my")
def update_consent(
    body: ConsentUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.purpose in REQUIRED_PURPOSES and not body.granted:
        raise HTTPException(
            status_code=400,
            detail=f"'{PURPOSE_LABELS[body.purpose]}' consent is required for system operation and cannot be revoked.",
        )

    record = db.query(ConsentRecord).filter(
        ConsentRecord.user_id == current_user.id,
        ConsentRecord.purpose == body.purpose,
    ).first()

    if not record:
        record = ConsentRecord(user_id=current_user.id, purpose=body.purpose)
        db.add(record)

    policy = db.query(PrivacyPolicyVersion).filter(PrivacyPolicyVersion.is_current == True).first()
    now = datetime.now(timezone.utc)

    if body.granted:
        record.status = ConsentStatus.granted
        record.granted_at = now
        record.revoked_at = None
        record.version = policy.version if policy else "1.0"
        record.ip_address = request.client.host if request.client else ""
        record.notes = body.notes
    else:
        record.status = ConsentStatus.revoked
        record.revoked_at = now
        record.notes = body.notes

    write_audit(
        db, AuditAction.update, "consent", record.id, current_user,
        {"purpose": body.purpose.value, "granted": body.granted},
    )
    db.commit()
    db.refresh(record)
    return _consent_dict(record)


@router.get("/all")
def all_consents(
    user_id: int | None = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    q = db.query(ConsentRecord)
    if user_id:
        q = q.filter(ConsentRecord.user_id == user_id)
    records = q.order_by(ConsentRecord.user_id, ConsentRecord.purpose).all()
    return [
        {**_consent_dict(r), "user_email": r.user.email if r.user else ""}
        for r in records
    ]


# ─── Privacy Policy Versions ──────────────────────────────────────────────────

@router.get("/policy")
def get_current_policy(db: Session = Depends(get_db)):
    policy = db.query(PrivacyPolicyVersion).filter(PrivacyPolicyVersion.is_current == True).first()
    if not policy:
        return {
            "version": "1.0",
            "effective_date": "2024-01-01",
            "summary": "LabOS collects and processes lab operational data to provide laboratory management services.",
            "content": DEFAULT_POLICY_TEXT,
            "is_current": True,
        }
    return {
        "id": policy.id,
        "version": policy.version,
        "effective_date": policy.effective_date,
        "summary": policy.summary,
        "content": policy.content,
        "published_at": policy.published_at.isoformat(),
        "is_current": policy.is_current,
    }


@router.get("/policy/versions")
def list_policy_versions(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    versions = db.query(PrivacyPolicyVersion).order_by(PrivacyPolicyVersion.published_at.desc()).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "effective_date": v.effective_date,
            "summary": v.summary,
            "is_current": v.is_current,
            "published_at": v.published_at.isoformat(),
        }
        for v in versions
    ]


@router.post("/policy", status_code=201)
def publish_policy(
    body: PolicyVersionCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    # Unset current flag on all existing versions
    db.query(PrivacyPolicyVersion).update({"is_current": False})
    policy = PrivacyPolicyVersion(
        version=body.version,
        effective_date=body.effective_date,
        summary=body.summary,
        content=body.content,
        published_by_id=current_user.id,
        is_current=True,
    )
    db.add(policy)
    write_audit(db, AuditAction.create, "privacy_policy", None, current_user, {"version": body.version})
    db.commit()
    db.refresh(policy)
    return {"id": policy.id, "version": policy.version, "effective_date": policy.effective_date}


DEFAULT_POLICY_TEXT = """
# LabOS Privacy Policy

**Effective Date:** 2024-01-01  |  **Version:** 1.0

## 1. Introduction
LabOS ("the System") is operated by your research institution to manage laboratory operations, samples, protocols, instruments, and compliance records. This policy explains how we collect, use, and protect your data.

## 2. Data We Collect
- **Account information:** Name, email address, role, department
- **Operational data:** Samples, protocols, experiment notes, bookings
- **Security logs:** Login timestamps, IP addresses, failed login attempts
- **Usage data:** Page interactions (anonymised)

## 3. Legal Basis for Processing (GDPR)
We process your data under the following lawful bases:
- **Contractual necessity** — to provide laboratory management services
- **Legitimate interests** — for system security and audit trails
- **Legal obligation** — for regulatory compliance (GLP, 21 CFR Part 11, HIPAA where applicable)
- **Consent** — for optional analytics and communications (revocable at any time)

## 4. Data Retention
| Data Type | Retention Period |
|---|---|
| User accounts | Duration of employment + 7 years |
| Audit logs | 10 years (regulatory requirement) |
| Experiment records | 10 years |
| Session logs | 90 days |
| Deleted user data | 30 days then anonymised |

## 5. Your Rights (GDPR / CCPA)
You have the right to:
- **Access** your personal data
- **Rectify** inaccurate data
- **Erase** your data (where not required for legal/regulatory purposes)
- **Portability** — export your data in machine-readable format
- **Restrict** processing
- **Object** to processing based on legitimate interests
- **Withdraw consent** at any time (without affecting prior processing)

## 6. HIPAA Compliance
For facilities handling Protected Health Information (PHI):
- PHI is processed under HIPAA Business Associate Agreements
- Access is restricted to authorised personnel with documented training
- All PHI access is logged in the immutable audit trail
- Breach notification procedures are in place per 45 CFR §164.400

## 7. Security Measures
- Passwords hashed with bcrypt (minimum 8 characters, complexity required)
- JWT tokens expire after 2 hours
- Account lockout after 5 failed login attempts
- TLS encryption in transit (production deployments)
- Role-based access control (6-tier hierarchy)
- Immutable audit trail for all data modifications

## 8. Data Sharing
We do not sell your data. Data may be shared with:
- Authorised system administrators within your institution
- Third-party integrations you explicitly enable
- Regulatory bodies when legally required

## 9. Contact
For privacy requests or concerns, contact your institutional Data Protection Officer or system administrator.
""".strip()
