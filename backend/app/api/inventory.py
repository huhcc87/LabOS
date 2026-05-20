from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, InventoryItem, User, UserRole
from app.schemas.schemas import InventoryItemCreate, InventoryItemOut, InventoryItemUpdate, PaginatedResponse
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=PaginatedResponse[InventoryItemOut])
def list_inventory(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    category: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(InventoryItem)
    if search:
        q = q.filter(InventoryItem.name.ilike(f"%{search}%") | InventoryItem.lot_number.ilike(f"%{search}%"))
    if category:
        q = q.filter(InventoryItem.category == category)
    total = q.count()
    items = q.order_by(InventoryItem.name.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("", response_model=InventoryItemOut, status_code=201)
def create_inventory_item(
    body: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = InventoryItem(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "inventory", item.id, current_user, {"name": body.name})
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=InventoryItemOut)
def get_inventory_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.put("/{item_id}", response_model=InventoryItemOut)
def update_inventory_item(
    item_id: int,
    body: InventoryItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    changes = {}
    for fname in ("name", "category", "lot_number", "quantity", "unit", "reorder_threshold",
                  "storage_location", "barcode", "expires_on", "notes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(item, fname, val)
    write_audit(db, AuditAction.update, "inventory", item_id, current_user, changes)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_inventory_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    write_audit(db, AuditAction.delete, "inventory", item_id, current_user, {"name": item.name})
    db.delete(item)
    db.commit()
