"""Advanced procurement features built on top of the reagent cart.

Covers:
  - Cross-vendor price comparison (read)
  - Approval workflow (pending_approval → approved/rejected)
  - Budget guardrails
  - Restricted-chemicals (hazard scanning)
  - RFQ / quote-requests
  - Group-buy detection
  - Lab-to-lab borrow requests
  - Recurring orders / scheduled re-buy
  - PunchOut OCI XML export
"""
import json
import os
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.models import (
    ReagentCartItem, CartItemMeta, LabBudget, ApprovalRule, RestrictedChemical,
    BorrowRequest, User, InventoryItem, LabUnit,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/procurement", tags=["procurement"])


# ─── Helpers ────────────────────────────────────────────────────────────────
def get_or_create_meta(db: Session, item_id: int) -> CartItemMeta:
    m = db.query(CartItemMeta).filter(CartItemMeta.item_id == item_id).first()
    if not m:
        m = CartItemMeta(item_id=item_id)
        db.add(m)
        db.flush()
    return m


def meta_to_dict(m: CartItemMeta) -> dict:
    return {
        "approval_status": m.approval_status,
        "approved_by": m.approved_by,
        "approved_at": m.approved_at.isoformat() if m.approved_at else None,
        "rejection_reason": m.rejection_reason,
        "sds_url": m.sds_url,
        "hazard_codes": json.loads(m.hazard_codes_json or "[]"),
        "budget_code": m.budget_code,
        "grant_id": m.grant_id,
        "recurrence_pattern": m.recurrence_pattern,
        "next_reorder_at": m.next_reorder_at.isoformat() if m.next_reorder_at else None,
        "auto_reorder": m.auto_reorder,
        "alt_prices": json.loads(m.alt_prices_json or "[]"),
        "rfq_status": m.rfq_status,
        "rfq_quote_url": m.rfq_quote_url,
        "lab_id": m.lab_id,
    }


# ─── Feature 1: Cross-vendor price comparison ───────────────────────────────
class AltPrice(BaseModel):
    vendor: str
    unit_price: float
    url: str = ""
    available: bool = True
    notes: str = ""


@router.post("/{item_id}/alt-prices")
def set_alt_prices(item_id: int, prices: List[AltPrice], db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    m.alt_prices_json = json.dumps([p.dict() for p in prices])
    db.commit()
    return {"ok": True, "count": len(prices)}


@router.get("/{item_id}/alt-prices")
def get_alt_prices(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    return json.loads(m.alt_prices_json or "[]")


@router.post("/{item_id}/swap-vendor")
def swap_vendor(item_id: int, vendor: str, unit_price: float, url: str = "", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
    if not item:
        raise HTTPException(404)
    old_vendor, old_price = item.vendor, item.unit_price or 0
    item.vendor = vendor
    item.unit_price = unit_price
    if url:
        item.url = url
    db.commit()
    return {
        "ok": True,
        "saved": (old_price - unit_price) * (item.quantity or 1),
        "from": old_vendor,
        "to": vendor,
    }


# ─── Feature 2: Approval workflow ───────────────────────────────────────────
class ApproveBody(BaseModel):
    item_ids: List[int]
    reason: str = ""


@router.get("/approvals/pending")
def list_pending_approvals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = (
        db.query(ReagentCartItem, CartItemMeta)
        .join(CartItemMeta, CartItemMeta.item_id == ReagentCartItem.id)
        .filter(CartItemMeta.approval_status == "pending")
    )
    out = []
    for item, meta in q.all():
        out.append({
            "id": item.id,
            "name": item.name,
            "vendor": item.vendor,
            "catalog": item.catalog,
            "unit_price": item.unit_price,
            "quantity": item.quantity,
            "requester_id": item.user_id,
            "meta": meta_to_dict(meta),
        })
    return out


@router.post("/approvals/approve")
def approve_items(body: ApproveBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if (user.role or "").lower() not in ("admin", "pi", "manager", "staff"):
        raise HTTPException(403, "Approver role required")
    now = datetime.utcnow()
    for iid in body.item_ids:
        m = get_or_create_meta(db, iid)
        m.approval_status = "approved"
        m.approved_by = user.id
        m.approved_at = now
    db.commit()
    return {"ok": True, "approved": len(body.item_ids)}


@router.post("/approvals/reject")
def reject_items(body: ApproveBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    for iid in body.item_ids:
        m = get_or_create_meta(db, iid)
        m.approval_status = "rejected"
        m.approved_by = user.id
        m.approved_at = now
        m.rejection_reason = body.reason
    db.commit()
    return {"ok": True, "rejected": len(body.item_ids)}


class ApprovalRuleIn(BaseModel):
    name: str
    over_amount: Optional[float] = None
    hazardous: bool = False
    vendor_match: str = ""
    role_required: str = "staff"
    is_active: bool = True


@router.get("/approvals/rules")
def list_rules(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [{"id": r.id, "name": r.name, "over_amount": r.over_amount, "hazardous": r.hazardous,
             "vendor_match": r.vendor_match, "role_required": r.role_required, "is_active": r.is_active}
            for r in db.query(ApprovalRule).all()]


@router.post("/approvals/rules", status_code=201)
def create_rule(body: ApprovalRuleIn, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = ApprovalRule(**body.dict())
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id}


@router.delete("/approvals/rules/{rid}", status_code=204)
def delete_rule(rid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(ApprovalRule).filter(ApprovalRule.id == rid).first()
    if r:
        db.delete(r)
        db.commit()


# ─── Feature 5: Hazard scanning / restricted chemicals ──────────────────────
class RestrictedIn(BaseModel):
    name: str
    cas: str = ""
    category: str = "Restricted"
    severity: str = "warn"
    notes: str = ""


@router.get("/restricted")
def list_restricted(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [{"id": r.id, "name": r.name, "cas": r.cas, "category": r.category, "severity": r.severity, "notes": r.notes}
            for r in db.query(RestrictedChemical).order_by(RestrictedChemical.name).all()]


@router.post("/restricted", status_code=201)
def add_restricted(body: RestrictedIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = RestrictedChemical(**body.dict(), added_by=user.id)
    db.add(r)
    db.commit()
    db.refresh(r)
    return {"id": r.id}


@router.delete("/restricted/{rid}", status_code=204)
def del_restricted(rid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    r = db.query(RestrictedChemical).filter(RestrictedChemical.id == rid).first()
    if r:
        db.delete(r)
        db.commit()


@router.get("/scan")
def scan_chemical(name: str = "", cas: str = "", db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Public endpoint the extension calls to scan a candidate item."""
    q = db.query(RestrictedChemical)
    matches = []
    if cas:
        matches += q.filter(RestrictedChemical.cas == cas).all()
    if name:
        matches += q.filter(RestrictedChemical.name.ilike(f"%{name}%")).all()
    seen = set()
    out = []
    for r in matches:
        if r.id in seen:
            continue
        seen.add(r.id)
        out.append({"id": r.id, "name": r.name, "category": r.category, "severity": r.severity, "notes": r.notes})
    return {"matches": out, "blocked": any(m["severity"] == "block" for m in out)}


# ─── Feature 6: Budget guardrails ───────────────────────────────────────────
class BudgetIn(BaseModel):
    name: str
    budget_code: str
    grant_id: Optional[int] = None
    lab_id: Optional[int] = None
    total_amount: float
    fiscal_year: str = ""
    notes: str = ""


@router.get("/budgets")
def list_budgets(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [{
        "id": b.id, "name": b.name, "budget_code": b.budget_code,
        "total_amount": b.total_amount, "spent_amount": b.spent_amount,
        "remaining": b.total_amount - b.spent_amount,
        "percent_used": (b.spent_amount / b.total_amount * 100) if b.total_amount else 0,
        "fiscal_year": b.fiscal_year, "notes": b.notes,
    } for b in db.query(LabBudget).all()]


@router.post("/budgets", status_code=201)
def create_budget(body: BudgetIn, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    b = LabBudget(**body.dict())
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id}


@router.delete("/budgets/{bid}", status_code=204)
def delete_budget(bid: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    b = db.query(LabBudget).filter(LabBudget.id == bid).first()
    if b:
        db.delete(b)
        db.commit()


@router.post("/budgets/{bid}/check")
def check_budget(bid: int, amount: float, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    b = db.query(LabBudget).filter(LabBudget.id == bid).first()
    if not b:
        raise HTTPException(404)
    remaining = b.total_amount - b.spent_amount
    return {
        "ok": amount <= remaining,
        "remaining": remaining,
        "amount": amount,
        "would_be_remaining": remaining - amount,
    }


# ─── Feature 9: RFQ (quote requests) ────────────────────────────────────────
class RFQIn(BaseModel):
    notes: str = ""


@router.post("/{item_id}/request-quote")
def request_quote(item_id: int, body: RFQIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    m.rfq_status = "requested"
    item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
    db.commit()
    # In production we'd send an email to the vendor's sales rep here.
    return {
        "ok": True,
        "rfq_status": "requested",
        "would_email": f"sales@{(item.vendor or 'unknown').lower().replace(' ', '')}.com" if item else None,
    }


@router.post("/{item_id}/record-quote")
def record_quote(item_id: int, quote_url: str = "", new_price: Optional[float] = None,
                 db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    m.rfq_status = "received"
    m.rfq_quote_url = quote_url
    if new_price is not None:
        item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
        if item:
            item.unit_price = new_price
    db.commit()
    return {"ok": True}


# ─── Feature 10: Group-buy detection ───────────────────────────────────────
@router.get("/group-buy")
def detect_group_buy(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Items appearing in >=2 distinct users' carts in the past 14 days."""
    cutoff = datetime.utcnow() - timedelta(days=14)
    rows = (
        db.query(ReagentCartItem)
        .filter(ReagentCartItem.captured_at >= cutoff)
        .filter(ReagentCartItem.status.in_(["pending", "approved"]))
        .all()
    )
    by_key: dict = {}
    for it in rows:
        key = (it.catalog or it.name or "").lower().strip()
        if not key:
            continue
        by_key.setdefault(key, []).append(it)
    out = []
    for key, items in by_key.items():
        users = {it.user_id for it in items}
        if len(users) >= 2:
            total_qty = sum(it.quantity or 1 for it in items)
            sample = items[0]
            out.append({
                "key": key,
                "name": sample.name,
                "catalog": sample.catalog,
                "vendor": sample.vendor,
                "labs": list(users),
                "lab_count": len(users),
                "total_quantity": total_qty,
                "potential_savings_pct": min(15 + (len(users) - 2) * 3, 35),  # heuristic
                "item_ids": [it.id for it in items],
            })
    out.sort(key=lambda x: x["lab_count"], reverse=True)
    return out


# ─── Feature 15: Lab-to-lab borrow ─────────────────────────────────────────
class BorrowIn(BaseModel):
    inventory_item_id: Optional[int] = None
    cart_item_id: Optional[int] = None
    requested_quantity: str = ""
    purpose: str = ""


@router.get("/borrow")
def list_borrow_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(BorrowRequest).order_by(BorrowRequest.created_at.desc()).limit(200).all()
    return [{
        "id": b.id, "requester_id": b.requester_id, "lender_id": b.lender_id,
        "inventory_item_id": b.inventory_item_id, "cart_item_id": b.cart_item_id,
        "requested_quantity": b.requested_quantity, "purpose": b.purpose,
        "status": b.status, "created_at": b.created_at.isoformat() if b.created_at else None,
    } for b in rows]


@router.post("/borrow", status_code=201)
def create_borrow(body: BorrowIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    b = BorrowRequest(
        requester_id=user.id,
        inventory_item_id=body.inventory_item_id,
        cart_item_id=body.cart_item_id,
        requested_quantity=body.requested_quantity,
        purpose=body.purpose,
        status="pending",
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return {"id": b.id}


@router.post("/borrow/{bid}/respond")
def respond_borrow(bid: int, approve: bool, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    b = db.query(BorrowRequest).filter(BorrowRequest.id == bid).first()
    if not b:
        raise HTTPException(404)
    b.status = "approved" if approve else "rejected"
    b.lender_id = user.id
    b.responded_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "status": b.status}


@router.get("/borrow/find-lender")
def find_lender(cas: str = "", catalog: str = "", name: str = "",
                db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Look for inventory items in other users' inventories that match. Used by
    the extension before checkout to suggest borrowing."""
    q = db.query(InventoryItem)
    if cas:
        q = q.filter(InventoryItem.notes.ilike(f"%{cas}%"))  # CAS often kept in notes
    elif catalog:
        q = q.filter(InventoryItem.catalog_number == catalog)
    elif name:
        q = q.filter(InventoryItem.name.ilike(f"%{name}%"))
    else:
        return []
    items = q.limit(10).all()
    return [{
        "id": i.id, "name": i.name, "catalog": getattr(i, "catalog_number", ""),
        "quantity": getattr(i, "quantity", None),
        "location": getattr(i, "location", ""),
        "owner_id": getattr(i, "owner_id", None),
    } for i in items]


# ─── Feature 14: PunchOut OCI XML export ───────────────────────────────────
@router.get("/punchout/{item_id}")
def punchout_oci(item_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(ReagentCartItem).filter(ReagentCartItem.id == item_id).first()
    if not item:
        raise HTTPException(404)
    # OCI 4.0 — line item POST format (institutions like Penn, UCSF, MIT use this)
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<NEW_ITEM-LINE>
  <NEW_ITEM-DESCRIPTION>{item.name}</NEW_ITEM-DESCRIPTION>
  <NEW_ITEM-MATNR>{item.catalog}</NEW_ITEM-MATNR>
  <NEW_ITEM-VENDOR>{item.vendor}</NEW_ITEM-VENDOR>
  <NEW_ITEM-VENDORMAT>{item.catalog}</NEW_ITEM-VENDORMAT>
  <NEW_ITEM-QUANTITY>{item.quantity}</NEW_ITEM-QUANTITY>
  <NEW_ITEM-PRICE>{item.unit_price or 0}</NEW_ITEM-PRICE>
  <NEW_ITEM-CURRENCY>{item.currency or 'USD'}</NEW_ITEM-CURRENCY>
  <NEW_ITEM-EXT_PRODUCT_ID>{item.url}</NEW_ITEM-EXT_PRODUCT_ID>
</NEW_ITEM-LINE>"""
    return Response(content=xml, media_type="application/xml")


@router.get("/punchout-bulk")
def punchout_bulk(item_ids: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    ids = [int(x) for x in item_ids.split(",") if x.strip().isdigit()]
    items = db.query(ReagentCartItem).filter(ReagentCartItem.id.in_(ids)).all()
    lines = []
    for item in items:
        lines.append(f"""  <NEW_ITEM-LINE>
    <NEW_ITEM-DESCRIPTION>{item.name}</NEW_ITEM-DESCRIPTION>
    <NEW_ITEM-MATNR>{item.catalog}</NEW_ITEM-MATNR>
    <NEW_ITEM-VENDOR>{item.vendor}</NEW_ITEM-VENDOR>
    <NEW_ITEM-QUANTITY>{item.quantity}</NEW_ITEM-QUANTITY>
    <NEW_ITEM-PRICE>{item.unit_price or 0}</NEW_ITEM-PRICE>
    <NEW_ITEM-CURRENCY>{item.currency or 'USD'}</NEW_ITEM-CURRENCY>
  </NEW_ITEM-LINE>""")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<PunchOutOrderMessage>
  <BuyerCookie>LABOS-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}</BuyerCookie>
  <PunchOutOrderMessageHeader>
    <Total><Money currency="USD">{sum((i.unit_price or 0) * (i.quantity or 1) for i in items):.2f}</Money></Total>
  </PunchOutOrderMessageHeader>
{chr(10).join(lines)}
</PunchOutOrderMessage>"""
    return Response(content=xml, media_type="application/xml")


# ─── Feature 8: Recurring orders / Feature 4: SDS ───────────────────────────
class RecurrenceIn(BaseModel):
    pattern: str  # "weekly", "monthly", "30d", ""
    auto_reorder: bool = False


@router.post("/{item_id}/recurrence")
def set_recurrence(item_id: int, body: RecurrenceIn, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    m.recurrence_pattern = body.pattern
    m.auto_reorder = body.auto_reorder
    if body.pattern:
        days = {"weekly": 7, "monthly": 30, "biweekly": 14, "quarterly": 90}.get(body.pattern, 30)
        m.next_reorder_at = datetime.utcnow() + timedelta(days=days)
    else:
        m.next_reorder_at = None
    db.commit()
    return {"ok": True, "next_reorder_at": m.next_reorder_at.isoformat() if m.next_reorder_at else None}


@router.post("/{item_id}/sds")
def set_sds(item_id: int, sds_url: str = "", hazards: List[str] = [],
            db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = get_or_create_meta(db, item_id)
    m.sds_url = sds_url
    m.hazard_codes_json = json.dumps(hazards)
    db.commit()
    return {"ok": True}


# ─── Feature 7: Receive-on-arrival (barcode scan) ───────────────────────────
class ReceiveBody(BaseModel):
    barcode: str
    received_quantity: Optional[int] = None


@router.post("/receive")
def receive_by_barcode(body: ReceiveBody, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Mark a cart item as received by scanning its catalog # / barcode."""
    q = db.query(ReagentCartItem).filter(
        or_(
            ReagentCartItem.catalog == body.barcode,
            ReagentCartItem.catalog.ilike(f"%{body.barcode}%"),
        )
    ).filter(ReagentCartItem.status == "ordered")
    item = q.first()
    if not item:
        return {"ok": False, "error": "No ordered item matches that barcode"}
    item.status = "received"
    if body.received_quantity:
        item.quantity = body.received_quantity
    db.commit()
    return {"ok": True, "item_id": item.id, "name": item.name}


# ─── Feature 16: Crowdsourced enrichment (opt-in) ───────────────────────────
class EnrichmentOptIn(BaseModel):
    enabled: bool


@router.get("/enrichment/status")
def enrichment_status(_: User = Depends(get_current_user)):
    return {"enabled": os.environ.get("LABOS_CROWDSOURCE_ENRICH", "false").lower() == "true"}


@router.post("/enrichment")
def submit_enrichment(payload: dict, _: User = Depends(get_current_user)):
    """Receive an anonymized capture for shared catalog (no-op until backend
    storage is wired). The opt-in lives in user settings."""
    return {"ok": True, "received": True}
