"""Stripe payment methods endpoint. Gracefully gates when Stripe is
not configured (STRIPE_SECRET_KEY env var)."""
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import ReagentCartItem, User
from app.services.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["payments"])


def _stripe():
    key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not key:
        return None
    try:
        import stripe  # type: ignore
        stripe.api_key = key
        return stripe
    except ImportError:
        return None


def _customer_id_for(user: User) -> Optional[str]:
    """Look up or lazily create a Stripe Customer for this user. Stored on
    the user model under `stripe_customer_id` once that column exists; for now
    we use a simple in-memory map keyed by user id."""
    s = _stripe()
    if not s:
        return None
    cache = _customer_id_for.__dict__.setdefault("_cache", {})
    if user.id in cache:
        return cache[user.id]
    # Search by email metadata
    try:
        existing = s.Customer.list(email=user.email, limit=1)
        if existing.data:
            cid = existing.data[0].id
            cache[user.id] = cid
            return cid
        cust = s.Customer.create(email=user.email, name=getattr(user, "full_name", "") or user.email)
        cache[user.id] = cust.id
        return cust.id
    except Exception:
        return None


@router.get("/status")
def status():
    s = _stripe()
    return {
        "configured": s is not None,
        "mode": "test" if s and os.environ.get("STRIPE_SECRET_KEY", "").startswith("sk_test_") else
                "live" if s else
                "none",
    }


@router.get("/methods")
def list_methods(user: User = Depends(get_current_user)):
    s = _stripe()
    if not s:
        return []
    cid = _customer_id_for(user)
    if not cid:
        return []
    try:
        methods = s.PaymentMethod.list(customer=cid, type="card")
        cust = s.Customer.retrieve(cid)
        default_id = (cust.invoice_settings or {}).get("default_payment_method", "")
        return [{
            "id": m.id,
            "brand": m.card.brand,
            "last4": m.card.last4,
            "exp_month": m.card.exp_month,
            "exp_year": m.card.exp_year,
            "is_default": m.id == default_id,
        } for m in methods.data]
    except Exception as e:
        raise HTTPException(500, str(e))


class SetupIntentResponse(BaseModel):
    client_secret: str


@router.post("/setup-intent", response_model=SetupIntentResponse)
def create_setup_intent(user: User = Depends(get_current_user)):
    s = _stripe()
    if not s:
        raise HTTPException(503, "Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env to enable in-app payments.")
    cid = _customer_id_for(user)
    if not cid:
        raise HTTPException(500, "Could not create Stripe customer")
    intent = s.SetupIntent.create(customer=cid, payment_method_types=["card"])
    return {"client_secret": intent.client_secret}


@router.delete("/methods/{pm_id}", status_code=204)
def delete_method(pm_id: str, user: User = Depends(get_current_user)):
    s = _stripe()
    if not s:
        raise HTTPException(503, "Stripe not configured")
    try:
        s.PaymentMethod.detach(pm_id)
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/methods/{pm_id}/default")
def set_default(pm_id: str, user: User = Depends(get_current_user)):
    s = _stripe()
    if not s:
        raise HTTPException(503, "Stripe not configured")
    cid = _customer_id_for(user)
    if not cid:
        raise HTTPException(500, "No Stripe customer")
    try:
        s.Customer.modify(cid, invoice_settings={"default_payment_method": pm_id})
        return {"ok": True}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/orders")
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(ReagentCartItem).filter(
        ReagentCartItem.user_id == user.id,
        ReagentCartItem.stripe_charge_id != ""
    ).order_by(ReagentCartItem.ordered_at.desc())
    return [{
        "id": i.id,
        "name": i.name,
        "vendor": i.vendor,
        "amount": (i.unit_price or 0) * (i.quantity or 1),
        "ordered_at": i.ordered_at.isoformat() if i.ordered_at else None,
        "stripe_charge_id": i.stripe_charge_id,
    } for i in q.all()]
