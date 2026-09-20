from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, LabSettings, User, UserRole
from app.schemas.schemas import LabSettingCreate, LabSettingOut, LabSettingUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=PaginatedResponse[LabSettingOut])
def list_settings(
    page: int = 1,
    per_page: int = 100,
    category: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    q = db.query(LabSettings)
    if category:
        q = q.filter(LabSettings.category == category)
    total = q.count()
    items = q.order_by(LabSettings.category, LabSettings.key).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [LabSettingOut.model_validate({c.name: getattr(s, c.name) for c in s.__table__.columns}) for s in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.get("/by-category")
def get_settings_by_category(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Get all settings grouped by category"""
    settings = db.query(LabSettings).order_by(LabSettings.category, LabSettings.key).all()
    result = {}
    for s in settings:
        if s.category not in result:
            result[s.category] = {}
        result[s.category][s.key] = s.value
    return result


@router.get("/key/{key}")
def get_setting_by_key(
    key: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get a single setting by key"""
    s = db.query(LabSettings).filter(LabSettings.key == key).first()
    if not s:
        raise HTTPException(status_code=404, detail="Setting not found")
    return {"key": s.key, "value": s.value, "category": s.category}


@router.post("", response_model=LabSettingOut, status_code=201)
def create_setting(
    body: LabSettingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    # Check if key already exists
    existing = db.query(LabSettings).filter(LabSettings.key == body.key).first()
    if existing:
        raise HTTPException(status_code=400, detail="Setting with this key already exists")

    setting = LabSettings(
        key=body.key,
        value=body.value,
        category=body.category,
        description=body.description,
    )
    db.add(setting)
    write_audit(db, AuditAction.create, "lab_setting", setting.id, current_user, {"key": body.key, "value": body.value})
    db.commit()
    db.refresh(setting)
    return LabSettingOut.model_validate({c.name: getattr(setting, c.name) for c in setting.__table__.columns})


@router.put("/key/{key}", response_model=LabSettingOut)
def update_setting_by_key(
    key: str,
    body: LabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    s = db.query(LabSettings).filter(LabSettings.key == key).first()
    if not s:
        raise HTTPException(status_code=404, detail="Setting not found")
    changes = {}
    for field_name in ("value", "category", "description"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = val
            setattr(s, field_name, val)
    write_audit(db, AuditAction.update, "lab_setting", s.id, current_user, changes)
    db.commit()
    db.refresh(s)
    return LabSettingOut.model_validate({c.name: getattr(s, c.name) for c in s.__table__.columns})


@router.put("/{setting_id}", response_model=LabSettingOut)
def update_setting(
    setting_id: int,
    body: LabSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    s = db.query(LabSettings).filter(LabSettings.id == setting_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Setting not found")
    changes = {}
    for field_name in ("value", "category", "description"):
        val = getattr(body, field_name)
        if val is not None:
            changes[field_name] = val
            setattr(s, field_name, val)
    write_audit(db, AuditAction.update, "lab_setting", setting_id, current_user, changes)
    db.commit()
    db.refresh(s)
    return LabSettingOut.model_validate({c.name: getattr(s, c.name) for c in s.__table__.columns})


@router.delete("/{setting_id}", status_code=204)
def delete_setting(
    setting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    s = db.query(LabSettings).filter(LabSettings.id == setting_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Setting not found")
    write_audit(db, AuditAction.delete, "lab_setting", setting_id, current_user, {"key": s.key})
    db.delete(s)
    db.commit()


@router.post("/bulk", response_model=list[LabSettingOut])
def bulk_update_settings(
    settings: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Bulk update multiple settings"""
    updated = []
    for item in settings:
        key = item.get("key")
        value = item.get("value")
        if not key:
            continue
        s = db.query(LabSettings).filter(LabSettings.key == key).first()
        if s:
            s.value = value
            write_audit(db, AuditAction.update, "lab_setting", s.id, current_user, {"key": key, "value": value})
            updated.append(s)
        else:
            # Create new setting
            new_s = LabSettings(
                key=key,
                value=value,
                category=item.get("category", "general"),
                description=item.get("description", ""),
            )
            db.add(new_s)
            db.flush()
            write_audit(db, AuditAction.create, "lab_setting", new_s.id, current_user, {"key": key, "value": value})
            updated.append(new_s)
    db.commit()
    return [LabSettingOut.model_validate({c.name: getattr(s, c.name) for c in s.__table__.columns}) for s in updated]
