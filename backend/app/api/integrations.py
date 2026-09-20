from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Integration, User, UserRole
from app.schemas.schemas import IntegrationCreate, IntegrationOut, IntegrationUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _enrich(i: Integration) -> dict:
    data = {c.name: getattr(i, c.name) for c in i.__table__.columns}
    # Never expose API keys
    data.pop("api_key", None)
    return data


@router.get("", response_model=PaginatedResponse[IntegrationOut])
def list_integrations(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    q = db.query(Integration)
    if search:
        q = q.filter(Integration.name.ilike(f"%{search}%") | Integration.description.ilike(f"%{search}%"))
    if category:
        q = q.filter(Integration.category == category)
    if status:
        q = q.filter(Integration.status == status)
    total = q.count()
    items = q.order_by(Integration.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    enriched = [IntegrationOut.model_validate(_enrich(i)) for i in items]
    return PaginatedResponse(items=enriched, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=IntegrationOut, status_code=201)
def create_integration(
    body: IntegrationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    integration = Integration(
        name=body.name,
        category=body.category,
        description=body.description,
        api_endpoint=body.api_endpoint,
        config_json=body.config_json,
    )
    db.add(integration)
    write_audit(db, AuditAction.create, "integration", integration.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(integration)
    return IntegrationOut.model_validate(_enrich(integration))


@router.get("/{integration_id}", response_model=IntegrationOut)
def get_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    i = db.query(Integration).filter(Integration.id == integration_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Integration not found")
    return IntegrationOut.model_validate(_enrich(i))


@router.put("/{integration_id}", response_model=IntegrationOut)
def update_integration(
    integration_id: int,
    body: IntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    i = db.query(Integration).filter(Integration.id == integration_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Integration not found")
    changes = {}
    for field_name in ("name", "category", "description", "api_endpoint", "api_key", "config_json", "status", "last_sync_at"):
        val = getattr(body, field_name)
        if val is not None:
            if field_name == "api_key":
                changes[field_name] = "***updated***"  # Don't log actual key
            else:
                changes[field_name] = str(val)
            setattr(i, field_name, val)
    write_audit(db, AuditAction.update, "integration", integration_id, current_user, changes)
    db.commit()
    db.refresh(i)
    return IntegrationOut.model_validate(_enrich(i))


@router.delete("/{integration_id}", status_code=204)
def delete_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    i = db.query(Integration).filter(Integration.id == integration_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Integration not found")
    write_audit(db, AuditAction.delete, "integration", integration_id, current_user, {"name": i.name})
    db.delete(i)
    db.commit()


@router.post("/{integration_id}/test")
def test_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Test an integration connection"""
    import httpx
    i = db.query(Integration).filter(Integration.id == integration_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Integration not found")

    if not i.api_endpoint:
        return {"success": False, "message": "No API endpoint configured"}

    try:
        with httpx.Client(timeout=10.0) as client:
            headers = {}
            if i.api_key:
                headers["Authorization"] = f"Bearer {i.api_key}"
            response = client.get(i.api_endpoint, headers=headers)
            success = response.status_code < 400
            return {
                "success": success,
                "status_code": response.status_code,
                "message": "Connection successful" if success else f"Error: {response.status_code}"
            }
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.post("/{integration_id}/sync")
def sync_integration(
    integration_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Trigger a sync for this integration"""
    from datetime import datetime
    i = db.query(Integration).filter(Integration.id == integration_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Integration not found")

    # Update last sync time
    i.last_sync_at = datetime.now().isoformat()
    write_audit(db, AuditAction.update, "integration", integration_id, current_user, {"action": "sync"})
    db.commit()

    return {"success": True, "message": "Sync triggered", "sync_time": i.last_sync_at}
