"""Reagent Cart API — receives captures from the browser extension and
serves them to the LabOS app. Designed to work whether or not Stripe
is configured."""
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import ReagentCartItem, ReagentCartItemStatus, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/reagent-cart", tags=["reagent-cart"])


class CartItemIn(BaseModel):
    vendor: str = ""
    name: str
    catalog: str = ""
    size: str = ""
    unit_price: Optional[float] = None
    quantity: int = 1
    currency: str = "USD"
    url: str = ""
    image_url: str = ""
    cas: str = ""
    purity: str = ""
    notes: str = ""
    captured_at: Optional[datetime] = None


class CartItemUpdate(BaseModel):
    quantity: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[ReagentCartItemStatus] = None


class CheckoutIn(BaseModel):
    item_ids: List[int]
    payment_method_id: Optional[str] = None


def _to_out(item: ReagentCartItem) -> dict:
    return {
        "id": item.id,
        "vendor": item.vendor,
        "name": item.name,
        "catalog": item.catalog,
        "size": item.size,
        "unit_price": item.unit_price,
        "quantity": item.quantity,
        "currency": item.currency,
        "url": item.url,
        "image_url": item.image_url,
        "cas": item.cas,
        "purity": item.purity,
        "notes": item.notes,
        "status": item.status.value,
        "captured_at": item.captured_at.isoformat() if item.captured_at else None,
        "ordered_at": item.ordered_at.isoformat() if item.ordered_at else None,
    }


@router.get("/health")
def health():
    return {"ok": True}


@router.get("")
def list_items(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ReagentCartItem).filter(
        (ReagentCartItem.user_id == user.id) | (ReagentCartItem.user_id.is_(None))
    ).order_by(ReagentCartItem.captured_at.desc()).limit(500)
    return [_to_out(i) for i in q.all()]


@router.post("", status_code=201)
def create_item(body: CartItemIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = ReagentCartItem(
        user_id=user.id,
        vendor=body.vendor,
        name=body.name,
        catalog=body.catalog,
        size=body.size,
        unit_price=body.unit_price,
        quantity=body.quantity,
        currency=body.currency,
        url=body.url,
        image_url=body.image_url,
        cas=body.cas,
        purity=body.purity,
        notes=body.notes,
        captured_at=body.captured_at or datetime.now(timezone.utc),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.patch("/{item_id}")
def update_item(item_id: int, body: CartItemUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
    if not item:
        raise HTTPException(404)
    if body.quantity is not None:
        item.quantity = body.quantity
    if body.notes is not None:
        item.notes = body.notes
    if body.status is not None:
        item.status = body.status
    db.commit()
    db.refresh(item)
    return _to_out(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
    if not item:
        raise HTTPException(404)
    db.delete(item)
    db.commit()


@router.post("/checkout")
def checkout(body: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Mark items as ordered. If Stripe is configured, charge the saved
    payment method. Otherwise just mark the items as 'approved' and
    let the user process them externally."""
    items = db.query(ReagentCartItem).filter(ReagentCartItem.id.in_(body.item_ids)).all()
    if not items:
        raise HTTPException(404, "No items found for given IDs")

    total = sum((i.unit_price or 0) * (i.quantity or 1) for i in items)

    # Stripe path (graceful skip if not configured)
    import os
    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
    charge_id = ""
    if stripe_key and body.payment_method_id:
        try:
            import stripe  # type: ignore
            stripe.api_key = stripe_key
            intent = stripe.PaymentIntent.create(
                amount=int(total * 100),
                currency="usd",
                payment_method=body.payment_method_id,
                confirm=True,
                off_session=True,
                description=f"LabOS reagent order: {len(items)} item(s)",
            )
            charge_id = intent.get("latest_charge") or intent.get("id", "")
        except Exception as e:
            raise HTTPException(402, f"Payment failed: {e}")

    now = datetime.now(timezone.utc)
    for it in items:
        it.status = ReagentCartItemStatus.ordered
        it.ordered_at = now
        if charge_id:
            it.stripe_charge_id = charge_id
    db.commit()

    return {
        "ok": True,
        "ordered_count": len(items),
        "total_amount": total,
        "stripe_charge_id": charge_id,
        "mode": "stripe" if charge_id else "manual",
    }
