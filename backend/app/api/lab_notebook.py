from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, LabNotebookEntry, User, UserRole
from app.schemas.schemas import (
    LabNotebookEntryCreate, LabNotebookEntryOut, LabNotebookEntryUpdate, PaginatedResponse,
)
from app.services.auth import get_current_user, write_audit

router = APIRouter(prefix="/notebook", tags=["notebook"])


def _enrich(e: LabNotebookEntry) -> LabNotebookEntryOut:
    return LabNotebookEntryOut.model_validate({
        **{c.name: getattr(e, c.name) for c in e.__table__.columns},
        "author_name": e.author.full_name if e.author else None,
    })


@router.get("", response_model=PaginatedResponse[LabNotebookEntryOut])
def list_entries(
    page: int = 1, per_page: int = 20, search: str = "",
    experiment_type: str = "", archived: bool = False,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    q = db.query(LabNotebookEntry).filter(LabNotebookEntry.is_archived == archived)
    if search:
        q = q.filter(LabNotebookEntry.title.ilike(f"%{search}%") | LabNotebookEntry.content.ilike(f"%{search}%"))
    if experiment_type:
        q = q.filter(LabNotebookEntry.experiment_type == experiment_type)
    # Researchers see own entries; managers/admin see all
    from app.models.models import ROLE_HIERARCHY
    if ROLE_HIERARCHY.get(current_user.role, 0) < ROLE_HIERARCHY.get(UserRole.manager, 0):
        q = q.filter(LabNotebookEntry.author_id == current_user.id)
    total = q.count()
    items = q.order_by(LabNotebookEntry.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(e) for e in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=LabNotebookEntryOut, status_code=201)
def create_entry(
    body: LabNotebookEntryCreate, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = LabNotebookEntry(**body.model_dump(), author_id=current_user.id)
    db.add(entry)
    db.flush()
    write_audit(db, AuditAction.create, "lab_notebook", entry.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(entry)
    return _enrich(entry)


@router.get("/{entry_id}", response_model=LabNotebookEntryOut)
def get_entry(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    return _enrich(e)


@router.put("/{entry_id}", response_model=LabNotebookEntryOut)
def update_entry(
    entry_id: int, body: LabNotebookEntryUpdate,
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    e = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    if e.signed_at:
        raise HTTPException(400, "Cannot edit a signed entry")
    changes = {}
    for f in ("title", "content", "experiment_type", "tags", "linked_sample_id", "linked_protocol_id", "is_archived"):
        val = getattr(body, f)
        if val is not None:
            changes[f] = str(val)
            setattr(e, f, val)
    write_audit(db, AuditAction.update, "lab_notebook", entry_id, current_user, changes)
    db.commit()
    db.refresh(e)
    return _enrich(e)


@router.post("/{entry_id}/sign", response_model=LabNotebookEntryOut)
def sign_entry(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    if e.author_id != current_user.id:
        raise HTTPException(403, "Only the author can sign this entry")
    e.signed_at = datetime.now(timezone.utc).isoformat()
    write_audit(db, AuditAction.update, "lab_notebook", entry_id, current_user, {"action": "signed"})
    db.commit()
    db.refresh(e)
    return _enrich(e)


@router.post("/{entry_id}/witness", response_model=LabNotebookEntryOut)
def witness_entry(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    if not e.signed_at:
        raise HTTPException(400, "Entry must be signed before it can be witnessed")
    if e.author_id == current_user.id:
        raise HTTPException(400, "Author cannot witness their own entry")
    e.witnessed_by_id = current_user.id
    e.witnessed_at = datetime.now(timezone.utc).isoformat()
    write_audit(db, AuditAction.update, "lab_notebook", entry_id, current_user, {"action": "witnessed"})
    db.commit()
    db.refresh(e)
    return _enrich(e)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    e = db.query(LabNotebookEntry).filter(LabNotebookEntry.id == entry_id).first()
    if not e:
        raise HTTPException(404, "Entry not found")
    write_audit(db, AuditAction.delete, "lab_notebook", entry_id, current_user, {"title": e.title})
    db.delete(e)
    db.commit()
