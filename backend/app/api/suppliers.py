"""Suppliers and Purchase Orders API"""

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    Supplier, InventoryItem, PurchaseOrder, SupplierReview,
    User, UserRole, PurchaseOrderStatus
)
from app.services.auth import get_current_user, require_role
from app.api.audit import log_action


router = APIRouter(prefix="/suppliers", tags=["suppliers"])


# --------------- Pydantic Schemas ---------------

class SupplierCreate(BaseModel):
    supplier_id: str
    company: str
    category: str
    subcategory: str = ""
    description: str = ""
    market_segment: str = "Both"
    research_use: bool = True
    clinical_use: bool = False
    primary_offerings: str = ""
    common_applications: str = ""
    ai_recommendation_tags: str = ""
    workflow_examples: str = ""
    procurement_priority: str = "Medium"
    approval_status: str = "Review"
    is_preferred: bool = False
    website: str = ""
    internal_notes: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    quote_tracking: str = "Not requested"
    contract_status: str = "Unknown"
    budget_tier: str = "Mid-market"
    country_region: str = "Global"


class SupplierUpdate(BaseModel):
    company: str | None = None
    category: str | None = None
    subcategory: str | None = None
    description: str | None = None
    market_segment: str | None = None
    research_use: bool | None = None
    clinical_use: bool | None = None
    primary_offerings: str | None = None
    common_applications: str | None = None
    ai_recommendation_tags: str | None = None
    workflow_examples: str | None = None
    procurement_priority: str | None = None
    approval_status: str | None = None
    is_preferred: bool | None = None
    website: str | None = None
    internal_notes: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    quote_tracking: str | None = None
    contract_status: str | None = None
    budget_tier: str | None = None
    country_region: str | None = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    items: list[dict[str, Any]]  # [{inventory_id, quantity, unit_price, name}]
    notes: str = ""
    urgency: str = "normal"
    project_code: str = ""
    expected_delivery: str | None = None


class PurchaseOrderUpdate(BaseModel):
    status: str | None = None
    tracking_number: str | None = None
    notes: str | None = None
    expected_delivery: str | None = None


class SupplierReviewCreate(BaseModel):
    supplier_id: int
    rating: int
    delivery_rating: int = 0
    quality_rating: int = 0
    support_rating: int = 0
    comment: str = ""
    order_reference: str = ""


# --------------- Suppliers Endpoints ---------------

@router.get("")
def list_suppliers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = "",
    category: str = "",
    priority: str = "",
    approval_status: str = "",
    preferred_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all suppliers with filtering"""
    q = db.query(Supplier)

    if search:
        q = q.filter(or_(
            Supplier.company.ilike(f"%{search}%"),
            Supplier.description.ilike(f"%{search}%"),
            Supplier.ai_recommendation_tags.ilike(f"%{search}%"),
            Supplier.primary_offerings.ilike(f"%{search}%"),
        ))

    if category:
        q = q.filter(Supplier.category.ilike(f"%{category}%"))

    if priority:
        q = q.filter(Supplier.procurement_priority == priority)

    if approval_status:
        q = q.filter(Supplier.approval_status == approval_status)

    if preferred_only:
        q = q.filter(Supplier.is_preferred == True)

    total = q.count()
    items = q.order_by(Supplier.company).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [_supplier_to_dict(s) for s in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/categories")
def get_supplier_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all unique supplier categories with counts"""
    results = db.query(
        Supplier.category,
        func.count(Supplier.id)
    ).group_by(Supplier.category).all()

    return [{"category": cat, "count": count} for cat, count in results]


@router.get("/ai-recommend")
def ai_recommend_suppliers(
    query: str = Query(..., description="What you're looking for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-powered supplier recommendation based on search query"""
    # Search across multiple fields
    q = db.query(Supplier).filter(or_(
        Supplier.ai_recommendation_tags.ilike(f"%{query}%"),
        Supplier.common_applications.ilike(f"%{query}%"),
        Supplier.primary_offerings.ilike(f"%{query}%"),
        Supplier.workflow_examples.ilike(f"%{query}%"),
        Supplier.description.ilike(f"%{query}%"),
    ))

    # Prefer approved and high priority suppliers
    suppliers = q.all()

    # Score and sort suppliers
    scored = []
    query_lower = query.lower()
    for s in suppliers:
        score = 0
        # Exact match in tags = high score
        if query_lower in s.ai_recommendation_tags.lower():
            score += 50
        if query_lower in s.common_applications.lower():
            score += 30
        if query_lower in s.primary_offerings.lower():
            score += 20

        # Bonus for preferred vendors
        if s.is_preferred:
            score += 25

        # Bonus for high priority
        if s.procurement_priority == "High":
            score += 20

        # Bonus for approved status
        if s.approval_status == "approved":
            score += 15

        # Bonus for good ratings
        score += s.rating * 3

        scored.append((s, score))

    # Sort by score descending
    scored.sort(key=lambda x: x[1], reverse=True)

    # Return top 10 with explanation
    results = []
    for s, score in scored[:10]:
        results.append({
            **_supplier_to_dict(s),
            "relevance_score": score,
            "match_reason": _get_match_reason(s, query_lower)
        })

    return {
        "query": query,
        "recommendations": results,
        "total_matches": len(scored)
    }


def _get_match_reason(supplier: Supplier, query: str) -> str:
    """Generate explanation for why supplier matched"""
    reasons = []
    if query in supplier.ai_recommendation_tags.lower():
        reasons.append(f"Tagged for: {query}")
    if query in supplier.common_applications.lower():
        reasons.append("Matches common applications")
    if query in supplier.primary_offerings.lower():
        reasons.append("In primary offerings")
    if supplier.is_preferred:
        reasons.append("Preferred vendor")
    if supplier.procurement_priority == "High":
        reasons.append("High priority supplier")
    return "; ".join(reasons) if reasons else "General match"


@router.get("/stats")
def get_supplier_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get supplier statistics"""
    total = db.query(Supplier).count()
    preferred = db.query(Supplier).filter(Supplier.is_preferred == True).count()
    approved = db.query(Supplier).filter(Supplier.approval_status == "approved").count()
    pending_review = db.query(Supplier).filter(Supplier.approval_status == "Review").count()

    # Category breakdown
    categories = db.query(
        Supplier.category,
        func.count(Supplier.id)
    ).group_by(Supplier.category).all()

    # Priority breakdown
    priorities = db.query(
        Supplier.procurement_priority,
        func.count(Supplier.id)
    ).group_by(Supplier.procurement_priority).all()

    # Budget tier breakdown
    tiers = db.query(
        Supplier.budget_tier,
        func.count(Supplier.id)
    ).group_by(Supplier.budget_tier).all()

    return {
        "total": total,
        "preferred": preferred,
        "approved": approved,
        "pending_review": pending_review,
        "by_category": [{"name": c, "value": n} for c, n in categories],
        "by_priority": [{"name": p, "value": n} for p, n in priorities],
        "by_budget_tier": [{"name": t, "value": n} for t, n in tiers],
    }


@router.get("/{supplier_id}")
def get_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single supplier with related data"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Get inventory items from this supplier
    items = db.query(InventoryItem).filter(InventoryItem.supplier_id == supplier_id).all()

    # Get purchase orders for this supplier
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.supplier_id == supplier_id).order_by(
        PurchaseOrder.created_at.desc()
    ).limit(10).all()

    # Get reviews
    reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == supplier_id).all()

    return {
        **_supplier_to_dict(supplier),
        "inventory_items": [{"id": i.id, "name": i.name, "quantity": i.quantity} for i in items],
        "recent_orders": [_order_to_dict(o) for o in orders],
        "reviews": [_review_to_dict(r) for r in reviews],
    }


@router.post("")
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    """Create a new supplier"""
    existing = db.query(Supplier).filter(Supplier.supplier_id == data.supplier_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Supplier ID already exists")

    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    log_action(db, "create", "supplier", supplier.id, current_user, data.model_dump())

    return _supplier_to_dict(supplier)


@router.put("/{supplier_id}")
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    """Update a supplier"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    changes = {}
    for key, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            changes[key] = {"old": getattr(supplier, key), "new": val}
            setattr(supplier, key, val)

    db.commit()
    db.refresh(supplier)

    log_action(db, "update", "supplier", supplier.id, current_user, changes)

    return _supplier_to_dict(supplier)


@router.delete("/{supplier_id}")
def delete_supplier(
    supplier_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
):
    """Delete a supplier"""
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Check if supplier has inventory items linked
    items_count = db.query(InventoryItem).filter(InventoryItem.supplier_id == supplier_id).count()
    if items_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {items_count} inventory items linked")

    log_action(db, "delete", "supplier", supplier.id, current_user, {"company": supplier.company})

    db.delete(supplier)
    db.commit()

    return {"success": True}


# --------------- Purchase Orders Endpoints ---------------

@router.get("/orders/all")
def list_purchase_orders(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = "",
    supplier_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all purchase orders"""
    q = db.query(PurchaseOrder)

    if status:
        q = q.filter(PurchaseOrder.status == status)

    if supplier_id:
        q = q.filter(PurchaseOrder.supplier_id == supplier_id)

    total = q.count()
    items = q.order_by(PurchaseOrder.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [_order_to_dict(o) for o in items],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/orders/stats")
def get_order_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get purchase order statistics"""
    total = db.query(PurchaseOrder).count()
    pending = db.query(PurchaseOrder).filter(PurchaseOrder.status == PurchaseOrderStatus.pending_approval).count()
    ordered = db.query(PurchaseOrder).filter(PurchaseOrder.status == PurchaseOrderStatus.ordered).count()
    received = db.query(PurchaseOrder).filter(PurchaseOrder.status == PurchaseOrderStatus.received).count()

    # Total spend (received orders)
    total_spend = db.query(func.sum(PurchaseOrder.total)).filter(
        PurchaseOrder.status == PurchaseOrderStatus.received
    ).scalar() or 0

    return {
        "total_orders": total,
        "pending_approval": pending,
        "in_transit": ordered,
        "received_this_month": received,
        "total_spend": total_spend,
    }


@router.post("/orders")
def create_purchase_order(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new purchase order"""
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    # Generate PO number
    count = db.query(PurchaseOrder).count()
    po_number = f"PO-{datetime.now().strftime('%Y%m')}-{count + 1:04d}"

    # Calculate totals
    subtotal = sum(item.get("quantity", 0) * item.get("unit_price", 0) for item in data.items)
    tax = int(subtotal * 0.08)  # 8% tax
    shipping = 0  # Can be calculated based on supplier
    total = subtotal + tax + shipping

    order = PurchaseOrder(
        po_number=po_number,
        supplier_id=data.supplier_id,
        items_json=json.dumps(data.items),
        subtotal=subtotal,
        tax=tax,
        shipping=shipping,
        total=total,
        requested_by_id=current_user.id,
        notes=data.notes,
        urgency=data.urgency,
        project_code=data.project_code,
        expected_delivery=data.expected_delivery,
        status=PurchaseOrderStatus.draft,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    log_action(db, "create", "purchase_order", order.id, current_user, {"po_number": po_number, "total": total})

    return _order_to_dict(order)


@router.put("/orders/{order_id}")
def update_purchase_order(
    order_id: int,
    data: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a purchase order"""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    changes = {}
    for key, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            if key == "status":
                val = PurchaseOrderStatus(val)
            changes[key] = {"old": str(getattr(order, key)), "new": str(val)}
            setattr(order, key, val)

    db.commit()
    db.refresh(order)

    log_action(db, "update", "purchase_order", order.id, current_user, changes)

    return _order_to_dict(order)


@router.post("/orders/{order_id}/approve")
def approve_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    """Approve a purchase order"""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status != PurchaseOrderStatus.pending_approval and order.status != PurchaseOrderStatus.draft:
        raise HTTPException(status_code=400, detail="Order cannot be approved in current status")

    order.status = PurchaseOrderStatus.approved
    order.approved_by_id = current_user.id
    order.approved_at = datetime.now().isoformat()

    db.commit()
    db.refresh(order)

    log_action(db, "update", "purchase_order", order.id, current_user, {"action": "approved"})

    return _order_to_dict(order)


@router.post("/orders/{order_id}/receive")
def receive_purchase_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a purchase order as received and update inventory"""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in [PurchaseOrderStatus.ordered, PurchaseOrderStatus.shipped]:
        raise HTTPException(status_code=400, detail="Order cannot be received in current status")

    order.status = PurchaseOrderStatus.received
    order.received_at = datetime.now().isoformat()

    # Update inventory quantities
    items = json.loads(order.items_json)
    for item in items:
        if "inventory_id" in item:
            inv_item = db.query(InventoryItem).filter(InventoryItem.id == item["inventory_id"]).first()
            if inv_item:
                inv_item.quantity += item.get("quantity", 0)
                inv_item.last_ordered = datetime.now().strftime("%Y-%m-%d")

    # Update supplier stats
    supplier = db.query(Supplier).filter(Supplier.id == order.supplier_id).first()
    if supplier:
        supplier.total_orders += 1

    db.commit()
    db.refresh(order)

    log_action(db, "update", "purchase_order", order.id, current_user, {"action": "received"})

    return _order_to_dict(order)


# --------------- Reviews Endpoints ---------------

@router.post("/reviews")
def create_review(
    data: SupplierReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a supplier review"""
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")

    review = SupplierReview(
        **data.model_dump(),
        user_id=current_user.id,
    )
    db.add(review)

    # Update supplier average rating
    reviews = db.query(SupplierReview).filter(SupplierReview.supplier_id == data.supplier_id).all()
    avg_rating = sum(r.rating for r in reviews) / (len(reviews) + 1) if reviews else data.rating
    supplier.rating = int(round(avg_rating))

    db.commit()
    db.refresh(review)

    return _review_to_dict(review)


# --------------- Helper Functions ---------------

def _supplier_to_dict(s: Supplier) -> dict:
    return {
        "id": s.id,
        "supplier_id": s.supplier_id,
        "company": s.company,
        "category": s.category,
        "subcategory": s.subcategory,
        "description": s.description,
        "market_segment": s.market_segment,
        "research_use": s.research_use,
        "clinical_use": s.clinical_use,
        "primary_offerings": s.primary_offerings,
        "common_applications": s.common_applications,
        "ai_recommendation_tags": s.ai_recommendation_tags,
        "workflow_examples": s.workflow_examples,
        "procurement_priority": s.procurement_priority,
        "approval_status": s.approval_status,
        "is_preferred": s.is_preferred,
        "website": s.website,
        "internal_notes": s.internal_notes,
        "contact_email": s.contact_email,
        "contact_phone": s.contact_phone,
        "quote_tracking": s.quote_tracking,
        "contract_status": s.contract_status,
        "budget_tier": s.budget_tier,
        "country_region": s.country_region,
        "rating": s.rating,
        "total_orders": s.total_orders,
        "average_delivery_days": s.average_delivery_days,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


def _order_to_dict(o: PurchaseOrder) -> dict:
    return {
        "id": o.id,
        "po_number": o.po_number,
        "supplier_id": o.supplier_id,
        "supplier_name": o.supplier.company if o.supplier else None,
        "status": o.status.value,
        "items": json.loads(o.items_json),
        "subtotal": o.subtotal,
        "tax": o.tax,
        "shipping": o.shipping,
        "total": o.total,
        "requested_by": o.requested_by.full_name if o.requested_by else None,
        "approved_by": o.approved_by.full_name if o.approved_by else None,
        "approved_at": o.approved_at,
        "ordered_at": o.ordered_at,
        "expected_delivery": o.expected_delivery,
        "received_at": o.received_at,
        "tracking_number": o.tracking_number,
        "notes": o.notes,
        "urgency": o.urgency,
        "project_code": o.project_code,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


def _review_to_dict(r: SupplierReview) -> dict:
    return {
        "id": r.id,
        "supplier_id": r.supplier_id,
        "user_name": r.user.full_name if r.user else None,
        "rating": r.rating,
        "delivery_rating": r.delivery_rating,
        "quality_rating": r.quality_rating,
        "support_rating": r.support_rating,
        "comment": r.comment,
        "order_reference": r.order_reference,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }
