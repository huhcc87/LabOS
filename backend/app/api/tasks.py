from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Task, TaskStatus, User, UserRole
from app.schemas.schemas import PaginatedResponse, TaskCreate, TaskOut, TaskUpdate
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _enrich(t: Task) -> TaskOut:
    return TaskOut.model_validate({
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "due_date": t.due_date,
        "status": t.status,
        "assigned_to": t.assigned_to,
        "assignee_name": t.assignee.full_name if t.assignee else None,
        "reminder_type": t.reminder_type,
        "related_protocol_id": t.related_protocol_id,
        "priority": t.priority or "medium",
        "subtasks": t.subtasks or "[]",
        "comments": t.comments or "[]",
    })


@router.get("", response_model=PaginatedResponse[TaskOut])
def list_tasks(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    priority: str = "",
    assigned_to: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # auto-overdue
    today = datetime.now(timezone.utc).date().isoformat()
    db.query(Task).filter(
        Task.status.notin_([TaskStatus.completed, TaskStatus.overdue]),
        Task.due_date < today,
    ).update({"status": TaskStatus.overdue})
    db.commit()

    q = db.query(Task)
    if search:
        q = q.filter(Task.title.ilike(f"%{search}%") | Task.description.ilike(f"%{search}%"))
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if assigned_to:
        q = q.filter(Task.assigned_to == assigned_to)
    total = q.count()
    items = q.order_by(Task.due_date.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich(t) for t in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = Task(**body.model_dump())
    db.add(t)
    db.flush()
    write_audit(db, AuditAction.create, "task", t.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(t)
    return _enrich(t)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return _enrich(t)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    changes = {}
    for fname in ("title", "description", "due_date", "status", "assigned_to",
                  "reminder_type", "related_protocol_id", "priority", "subtasks", "comments"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(t, fname, val)
    write_audit(db, AuditAction.update, "task", task_id, current_user, changes)
    db.commit()
    db.refresh(t)
    return _enrich(t)


@router.post("/{task_id}/bulk-done", status_code=200)
def bulk_done(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    t.status = TaskStatus.completed
    db.commit()
    return {"ok": True}


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    t = db.query(Task).filter(Task.id == task_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    write_audit(db, AuditAction.delete, "task", task_id, current_user, {"title": t.title})
    db.delete(t)
    db.commit()
