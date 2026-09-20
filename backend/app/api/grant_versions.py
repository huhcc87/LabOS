import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import GrantVersion, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/grant-versions", tags=["grant-versions"])


class VersionCreate(BaseModel):
    grant_id: str
    grant_title: str = ""
    version_label: str = ""
    changes: list = []
    notes: str = ""
    content: dict = {}


def _to_out(v: GrantVersion) -> dict:
    return {
        "id": v.id,
        "grant_id": v.grant_id,
        "grant_title": v.grant_title,
        "version_label": v.version_label,
        "created_by": v.created_by,
        "created_at": v.created_at.isoformat() if v.created_at else "",
        "changes": json.loads(v.changes_json or "[]"),
        "notes": v.notes,
        "content": json.loads(v.content_json or "{}"),
    }


@router.get("/all")
def list_all_versions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    versions = db.query(GrantVersion).order_by(GrantVersion.created_at.desc()).limit(200).all()
    return [_to_out(v) for v in versions]


@router.get("/{grant_id}")
def list_versions(grant_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    versions = db.query(GrantVersion).filter(
        GrantVersion.grant_id == grant_id
    ).order_by(GrantVersion.created_at.desc()).all()
    return [_to_out(v) for v in versions]


@router.post("", status_code=201)
def create_version(body: VersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    v = GrantVersion(
        grant_id=body.grant_id,
        grant_title=body.grant_title,
        version_label=body.version_label,
        created_by=user.email,
        changes_json=json.dumps(body.changes),
        notes=body.notes,
        content_json=json.dumps(body.content),
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _to_out(v)


@router.delete("/{version_id}", status_code=204)
def delete_version(version_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    v = db.query(GrantVersion).filter(GrantVersion.id == version_id).first()
    if not v:
        raise HTTPException(404)
    db.delete(v)
    db.commit()
