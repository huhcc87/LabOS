from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, StudyWorkspace, User, UserRole
from app.schemas.schemas import PaginatedResponse, StudyWorkspaceCreate, StudyWorkspaceOut, StudyWorkspaceUpdate
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _enrich(w: StudyWorkspace) -> StudyWorkspaceOut:
    return StudyWorkspaceOut.model_validate({
        "id": w.id, "name": w.name, "field": w.field,
        "lead_id": w.lead_id,
        "lead_name": w.lead.full_name if w.lead else None,
        "milestone": w.milestone, "status": w.status, "description": w.description,
    })


@router.get("", response_model=PaginatedResponse[StudyWorkspaceOut])
def list_workspaces(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(StudyWorkspace)
    if search:
        q = q.filter(StudyWorkspace.name.ilike(f"%{search}%") | StudyWorkspace.field.ilike(f"%{search}%"))
    if status:
        q = q.filter(StudyWorkspace.status == status)
    total = q.count()
    items = q.order_by(StudyWorkspace.name.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(w) for w in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=StudyWorkspaceOut, status_code=201)
def create_workspace(
    body: StudyWorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = StudyWorkspace(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "workspace", item.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(item)
    return _enrich(item)


@router.get("/{workspace_id}", response_model=StudyWorkspaceOut)
def get_workspace(workspace_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    w = db.query(StudyWorkspace).filter(StudyWorkspace.id == workspace_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return _enrich(w)


@router.put("/{workspace_id}", response_model=StudyWorkspaceOut)
def update_workspace(
    workspace_id: int,
    body: StudyWorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    w = db.query(StudyWorkspace).filter(StudyWorkspace.id == workspace_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    changes = {}
    for fname in ("name", "field", "lead_id", "milestone", "status", "description"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(w, fname, val)
    write_audit(db, AuditAction.update, "workspace", workspace_id, current_user, changes)
    db.commit()
    db.refresh(w)
    return _enrich(w)


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    w = db.query(StudyWorkspace).filter(StudyWorkspace.id == workspace_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")
    write_audit(db, AuditAction.delete, "workspace", workspace_id, current_user, {"name": w.name})
    db.delete(w)
    db.commit()
