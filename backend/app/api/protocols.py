from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Protocol, User, UserRole, WorkflowStep
from app.schemas.schemas import PaginatedResponse, ProtocolCreate, ProtocolOut, ProtocolUpdate
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/protocols", tags=["protocols"])


def _enrich(p: Protocol) -> dict:
    data = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    data["owner_name"] = p.owner.full_name if p.owner else None
    data["steps"] = p.steps
    return data


@router.get("", response_model=PaginatedResponse[ProtocolOut])
def list_protocols(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    field: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Protocol)
    if search:
        q = q.filter(Protocol.title.ilike(f"%{search}%") | Protocol.description.ilike(f"%{search}%"))
    if field:
        q = q.filter(Protocol.field == field)
    total = q.count()
    items = q.order_by(Protocol.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = []
    for p in items:
        out = ProtocolOut.model_validate({**{c.name: getattr(p, c.name) for c in p.__table__.columns},
                                          "owner_name": p.owner.full_name if p.owner else None,
                                          "steps": p.steps})
        enriched.append(out)
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=ProtocolOut, status_code=201)
def create_protocol(
    body: ProtocolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    protocol = Protocol(
        title=body.title,
        field=body.field,
        version=body.version,
        description=body.description,
        owner_id=body.owner_id,
        reminder_days_before=body.reminder_days_before,
    )
    db.add(protocol)
    db.flush()
    for step in body.steps:
        db.add(WorkflowStep(protocol_id=protocol.id, **step.model_dump()))
    write_audit(db, AuditAction.create, "protocol", protocol.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(protocol)
    return ProtocolOut.model_validate({**{c.name: getattr(protocol, c.name) for c in protocol.__table__.columns},
                                       "owner_name": protocol.owner.full_name if protocol.owner else None,
                                       "steps": protocol.steps})


@router.get("/{protocol_id}", response_model=ProtocolOut)
def get_protocol(protocol_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return ProtocolOut.model_validate({**{c.name: getattr(p, c.name) for c in p.__table__.columns},
                                       "owner_name": p.owner.full_name if p.owner else None,
                                       "steps": p.steps})


@router.put("/{protocol_id}", response_model=ProtocolOut)
def update_protocol(
    protocol_id: int,
    body: ProtocolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")
    changes = {}
    for field_name in ("title", "field", "version", "description", "owner_id", "reminder_days_before"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = val
            setattr(p, field_name, val)
    if body.steps is not None:
        for s in p.steps:
            db.delete(s)
        db.flush()
        for step in body.steps:
            db.add(WorkflowStep(protocol_id=p.id, **step.model_dump()))
    write_audit(db, AuditAction.update, "protocol", protocol_id, current_user, changes)
    db.commit()
    db.refresh(p)
    return ProtocolOut.model_validate({**{c.name: getattr(p, c.name) for c in p.__table__.columns},
                                       "owner_name": p.owner.full_name if p.owner else None,
                                       "steps": p.steps})


@router.delete("/{protocol_id}", status_code=204)
def delete_protocol(
    protocol_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")
    write_audit(db, AuditAction.delete, "protocol", protocol_id, current_user, {"title": p.title})
    db.delete(p)
    db.commit()


@router.get("/{protocol_id}/print")
def get_protocol_for_print(protocol_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Get protocol data formatted for printing"""
    p = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Protocol not found")

    # Format steps for printing
    steps_html = ""
    for i, step in enumerate(sorted(p.steps, key=lambda s: s.step_order), 1):
        signoff_marker = " [Requires Sign-off]" if step.requires_signoff else ""
        steps_html += f"""
        <div class="step">
            <div class="step-header">
                <strong>Step {i}:</strong> {step.title}{signoff_marker}
                <span class="time">Est. {step.estimated_minutes} min</span>
            </div>
            <div class="step-instructions">{step.instructions}</div>
            <div class="step-signoff">
                <span>Performed by: ________________</span>
                <span>Date: ________________</span>
                <span>Time: ________________</span>
            </div>
        </div>
        """

    print_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>{p.title} - Protocol</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
            .header {{ border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }}
            .header h1 {{ margin: 0; font-size: 24px; }}
            .meta {{ color: #666; font-size: 12px; margin-top: 5px; }}
            .meta span {{ margin-right: 20px; }}
            .description {{ background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }}
            .steps {{ }}
            .step {{ border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px; }}
            .step-header {{ display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }}
            .step-instructions {{ margin-bottom: 15px; white-space: pre-wrap; }}
            .step-signoff {{ display: flex; gap: 30px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; }}
            .time {{ color: #666; }}
            .footer {{ margin-top: 30px; padding-top: 20px; border-top: 2px solid #333; font-size: 12px; }}
            @media print {{
                body {{ padding: 0; }}
                .step {{ break-inside: avoid; }}
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{p.title}</h1>
            <div class="meta">
                <span><strong>Version:</strong> {p.version}</span>
                <span><strong>Field:</strong> {p.field}</span>
                <span><strong>Owner:</strong> {p.owner.full_name if p.owner else 'N/A'}</span>
            </div>
        </div>

        <div class="description">
            <strong>Description:</strong><br>
            {p.description}
        </div>

        <h2>Procedure Steps</h2>
        <div class="steps">
            {steps_html}
        </div>

        <div class="footer">
            <p><strong>Protocol ID:</strong> {p.id} | <strong>Created:</strong> {p.created_at.strftime('%Y-%m-%d')}</p>
            <p>Printed from LabOS v3</p>
        </div>
    </body>
    </html>
    """

    from fastapi.responses import HTMLResponse
    return HTMLResponse(content=print_html)


# ─── Version History ──────────────────────────────────────────────────────────

from app.models.models import ProtocolVersion
from pydantic import BaseModel as PydanticBaseModel
from typing import Optional as Opt
from datetime import datetime as Dt


class VersionCreate(PydanticBaseModel):
    version: str
    change_summary: str = ""


@router.get("/{protocol_id}/versions")
def list_versions(protocol_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    protocol = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    versions = db.query(ProtocolVersion).filter(
        ProtocolVersion.protocol_id == protocol_id
    ).order_by(ProtocolVersion.created_at.desc()).all()
    return [
        {
            "id": v.id,
            "version": v.version,
            "description": v.description,
            "change_summary": v.change_summary,
            "created_by": v.created_by.full_name if v.created_by else "System",
            "created_at": v.created_at.isoformat(),
        }
        for v in versions
    ]


@router.post("/{protocol_id}/versions", status_code=201)
def create_version(protocol_id: int, body: VersionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    protocol = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    v = ProtocolVersion(
        protocol_id=protocol_id,
        version=body.version,
        description=protocol.description,
        change_summary=body.change_summary,
        created_by_id=current_user.id,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "version": v.version, "created_at": v.created_at.isoformat()}
