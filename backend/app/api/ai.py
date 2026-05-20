from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import (
    CapaRecord, CapaStatus, IncidentReport, InventoryItem,
    LabNotebookEntry, Protocol, ReminderQueue, ReminderStatus,
    SampleRecord, Task, TaskStatus, User,
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    question: str
    context: Optional[str] = ""


class ChatResponse(BaseModel):
    answer: str
    source: str  # "openai" | "local"
    suggestions: list[str] = []


def _gather_lab_context(db: Session) -> dict:
    """Pull key stats from the database for local answers."""
    low_stock = db.query(InventoryItem).filter(
        InventoryItem.quantity <= InventoryItem.reorder_threshold
    ).all()
    pending_reminders = db.query(ReminderQueue).filter(
        ReminderQueue.status == ReminderStatus.pending
    ).count()
    overdue_tasks = db.query(Task).filter(Task.status == TaskStatus.overdue).count()
    open_tasks = db.query(Task).filter(Task.status == TaskStatus.in_progress).count()
    sample_count = db.query(SampleRecord).count()
    protocol_count = db.query(Protocol).count()
    notebook_count = db.query(LabNotebookEntry).count()
    open_capas = db.query(CapaRecord).filter(CapaRecord.status == CapaStatus.open).count()
    open_incidents = db.query(IncidentReport).filter(IncidentReport.status.in_(["open", "investigating"])).count()

    return {
        "low_stock_items": [{"name": i.name, "qty": i.quantity, "unit": i.unit, "threshold": i.reorder_threshold} for i in low_stock],
        "pending_reminders": pending_reminders,
        "overdue_tasks": overdue_tasks,
        "open_tasks": open_tasks,
        "sample_count": sample_count,
        "protocol_count": protocol_count,
        "notebook_count": notebook_count,
        "open_capas": open_capas,
        "open_incidents": open_incidents,
    }


def _local_answer(question: str, ctx: dict) -> tuple[str, list[str]]:
    """Rule-based answers when OpenAI is not configured."""
    q = question.lower()
    suggestions = []

    if any(w in q for w in ["low stock", "running out", "reorder", "out of", "shortage"]):
        items = ctx["low_stock_items"]
        if not items:
            answer = "Great news — all inventory items are above their reorder thresholds. Nothing needs restocking right now."
        else:
            lines = "\n".join(f"• **{i['name']}** — {i['qty']} {i['unit']} (threshold: {i['threshold']})" for i in items[:10])
            answer = f"You have **{len(items)} item(s) at or below reorder threshold**:\n\n{lines}\n\nConsider creating purchase orders for these items."
            suggestions = ["Go to Suppliers & Procurement", "View Inventory Hub"]
        return answer, suggestions

    if any(w in q for w in ["overdue", "late", "behind", "missed"]):
        answer = f"You currently have **{ctx['overdue_tasks']} overdue task(s)** and **{ctx['pending_reminders']} pending reminder(s)**."
        if ctx["overdue_tasks"] > 0:
            suggestions = ["View Tasks", "Go to Reminders"]
        return answer, suggestions

    if any(w in q for w in ["sample", "samples", "biorepository"]):
        answer = f"Your lab has **{ctx['sample_count']} sample(s)** registered in the biorepository. Use the Sample Hub to search, filter by status, or register new samples."
        suggestions = ["Open Sample Hub"]
        return answer, suggestions

    if any(w in q for w in ["protocol", "protocols", "sop"]):
        answer = f"There are **{ctx['protocol_count']} protocol(s)** in the system. You can execute any protocol step-by-step using the Lab Hub's execution mode."
        suggestions = ["Open Lab Hub"]
        return answer, suggestions

    if any(w in q for w in ["notebook", "experiment", "eln", "notes"]):
        answer = f"Your Electronic Lab Notebook contains **{ctx['notebook_count']} entr(ies)**. Entries are auto-timestamped and can be signed and witnessed for IP protection."
        suggestions = ["Open Lab Notebook"]
        return answer, suggestions

    if any(w in q for w in ["reminder", "notification", "alert"]):
        answer = f"There are **{ctx['pending_reminders']} pending reminder(s)** scheduled for delivery. You can manage all reminders from the Admin Hub."
        suggestions = ["Go to Reminders"]
        return answer, suggestions

    if any(w in q for w in ["task", "tasks", "todo", "to do", "to-do"]):
        answer = f"You have **{ctx['open_tasks']} in-progress task(s)** and **{ctx['overdue_tasks']} overdue task(s)**. Use the Tasks page to prioritize and update them."
        suggestions = ["Open Tasks"]
        return answer, suggestions

    if any(w in q for w in ["capa", "corrective", "preventive"]):
        answer = f"There are **{ctx['open_capas']} open CAPA record(s)** requiring attention. CAPA tracks corrective and preventive actions from audits, incidents, and complaints."
        suggestions = ["Open CAPA", "View Safety Hub"]
        return answer, suggestions

    if any(w in q for w in ["incident", "safety", "hazard", "spill"]):
        answer = f"There are **{ctx['open_incidents']} open/investigating incident(s)**. Use the Safety Hub to log new incidents, track investigations, and close them out."
        suggestions = ["Open Safety Hub", "Report Incident"]
        return answer, suggestions

    if any(w in q for w in ["help", "what can you", "what do you", "how do", "capabilities"]):
        answer = (
            "I'm your LabOS AI Assistant. I can help you with:\n\n"
            "• **Inventory** — find low-stock items, check quantities, anomaly detection\n"
            "• **Tasks** — see overdue and pending tasks\n"
            "• **Samples** — count and status overview\n"
            "• **Protocols** — analyze protocol steps, find missing reagents\n"
            "• **Lab Notebook** — create and retrieve experiment entries\n"
            "• **CAPA** — track corrective and preventive actions\n"
            "• **Incidents** — safety tracking and open investigations\n"
            "• **Reminders** — check pending alerts\n"
            "• **Search** — full-text search across all lab data\n"
            "• **Grant writing** — AI-assisted section drafting\n\n"
            "Ask me anything about your lab!"
        )
        suggestions = ["Check low stock", "Show overdue tasks", "Analyze my protocols", "Search for CRISPR"]
        return answer, suggestions

    # Fallback
    answer = (
        f"I searched your lab data for an answer to: *\"{question}\"*\n\n"
        f"Here's a quick summary of your lab right now:\n"
        f"• **{ctx['low_stock_items'].__len__()} item(s)** need restocking\n"
        f"• **{ctx['overdue_tasks']} overdue task(s)**, {ctx['open_tasks']} in progress\n"
        f"• **{ctx['sample_count']} sample(s)** in the biorepository\n"
        f"• **{ctx['pending_reminders']} pending reminder(s)**\n\n"
        "For more specific answers, try connecting an OpenAI API key in Settings."
    )
    suggestions = ["Check low stock", "Show overdue tasks", "Open Lab Notebook"]
    return answer, suggestions


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    ctx = _gather_lab_context(db)

    if settings.openai_api_key:
        try:
            import httpx
            system_prompt = (
                "You are LabOS AI, an intelligent assistant for a biomedical research lab management system. "
                "You have access to the following real-time lab data:\n"
                f"- Low stock items: {len(ctx['low_stock_items'])} ({', '.join(i['name'] for i in ctx['low_stock_items'][:5])})\n"
                f"- Overdue tasks: {ctx['overdue_tasks']}\n"
                f"- Open tasks: {ctx['open_tasks']}\n"
                f"- Pending reminders: {ctx['pending_reminders']}\n"
                f"- Samples in biorepository: {ctx['sample_count']}\n"
                f"- Protocols: {ctx['protocol_count']}\n"
                f"- Lab notebook entries: {ctx['notebook_count']}\n"
                f"- Open CAPA records: {ctx['open_capas']}\n"
                f"- Open/investigating incidents: {ctx['open_incidents']}\n\n"
                "Answer the researcher's question concisely and helpfully. Use markdown formatting. "
                "Be specific with numbers. Suggest next actions when relevant."
            )
            async with httpx.AsyncClient(timeout=20) as http:
                resp = await http.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": body.question},
                        ],
                        "max_tokens": 600,
                    },
                )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return ChatResponse(answer=content, source="openai")
        except Exception as exc:
            print(f"[AI CHAT] OpenAI failed: {exc}")

    answer, suggestions = _local_answer(body.question, ctx)
    return ChatResponse(answer=answer, source="local", suggestions=suggestions)


@router.get("/inventory/predictions")
def inventory_predictions(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return inventory items with predicted depletion dates based on usage."""
    from app.models.models import AuditLog, AuditAction
    from datetime import timedelta
    import json

    items = db.query(InventoryItem).all()
    predictions = []

    for item in items:
        # Count how many times this item was updated (used) in the last 30 days
        thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
        usage_events = db.query(AuditLog).filter(
            AuditLog.entity_type == "inventory",
            AuditLog.entity_id == item.id,
            AuditLog.action == AuditAction.update,
            AuditLog.timestamp >= thirty_days_ago,
        ).count()

        # Heuristic: each update event = ~10% of current quantity used
        avg_monthly_usage = max(usage_events * (item.quantity * 0.1), 1) if usage_events > 0 else 0
        days_remaining = None
        status = "stable"

        if avg_monthly_usage > 0 and item.quantity > 0:
            days_remaining = int((item.quantity / avg_monthly_usage) * 30)
            if days_remaining <= 7:
                status = "critical"
            elif days_remaining <= 21:
                status = "warning"
            else:
                status = "stable"

        below_threshold = item.quantity <= item.reorder_threshold

        predictions.append({
            "id": item.id,
            "name": item.name,
            "quantity": item.quantity,
            "unit": item.unit,
            "reorder_threshold": item.reorder_threshold,
            "below_threshold": below_threshold,
            "usage_events_30d": usage_events,
            "avg_monthly_usage": round(avg_monthly_usage, 1),
            "days_remaining": days_remaining,
            "status": status,
            "storage_location": item.storage_location or "",
            "category": item.category or "",
        })

    # Sort: critical first, then warning, then stable
    order = {"critical": 0, "warning": 1, "stable": 2}
    predictions.sort(key=lambda x: (order.get(x["status"], 3), x["days_remaining"] or 9999))

    return {"predictions": predictions, "total": len(predictions)}


from datetime import datetime


# ── Protocol Analysis ─────────────────────────────────────────────────────────

@router.get("/protocol-analysis/{protocol_id}")
def analyze_protocol(
    protocol_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Analyze a protocol for missing reagents, safety flags, and step completeness."""
    protocol = db.query(Protocol).filter(Protocol.id == protocol_id).first()
    if not protocol:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Protocol not found")

    import re as _re
    steps = protocol.steps or []  # SQLAlchemy relationship — list of WorkflowStep

    all_inventory = {i.name.lower(): i for i in db.query(InventoryItem).all()}
    missing_reagents: list[str] = []
    low_reagents: list[str] = []
    safety_flags: list[str] = []

    step_texts = []
    for s in steps:
        step_texts.append(f"{s.title} {s.instructions}")
    combined = " ".join(step_texts).lower()

    HAZARD_KEYWORDS = ["acid", "base", "toxic", "flammable", "corrosive", "carcinogen", "oxidizer", "ethanol", "methanol", "chloroform", "formaldehyde"]
    for keyword in HAZARD_KEYWORDS:
        if keyword in combined:
            safety_flags.append(f"Contains hazardous material reference: **{keyword}**")

    # Heuristic: look for words that look like chemical/reagent names (capitalized or quoted)
    candidates = _re.findall(r'\b[A-Z][a-z]{2,}\b', " ".join(step_texts))
    for c in set(candidates):
        low = c.lower()
        if low in all_inventory:
            item = all_inventory[low]
            if item.quantity <= item.reorder_threshold:
                low_reagents.append(f"**{item.name}** ({item.quantity} {item.unit} — at/below reorder threshold)")
        else:
            missing_reagents.append(c)

    issues = []
    if not steps:
        issues.append("Protocol has no steps defined.")
    if 0 < len(steps) < 3:
        issues.append("Protocol has very few steps — consider adding more detail.")
    if not protocol.description:
        issues.append("Protocol has no description.")

    score = 100
    score -= len(issues) * 10
    score -= len(safety_flags) * 5
    score -= min(len(missing_reagents), 5) * 3
    score = max(score, 0)

    return {
        "protocol_id": protocol_id,
        "title": protocol.title,
        "step_count": len(steps),
        "completeness_score": score,
        "issues": issues,
        "safety_flags": safety_flags,
        "low_reagents": low_reagents[:10],
        "potentially_missing_reagents": list(set(missing_reagents))[:10],
        "recommendations": [
            "Verify all reagent stock before starting" if low_reagents else None,
            "Review SDS sheets for flagged hazardous materials" if safety_flags else None,
            "Add more protocol steps for reproducibility" if len(steps) < 3 else None,
        ],
    }


# ── Anomaly Detection ─────────────────────────────────────────────────────────

@router.get("/anomaly-detection")
def anomaly_detection(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Detect anomalies across lab data: unusual inventory changes, overdue patterns, incident spikes."""
    from datetime import timedelta

    anomalies = []
    now = datetime.utcnow()

    # 1. Inventory: items with quantity = 0
    empty = db.query(InventoryItem).filter(InventoryItem.quantity == 0).all()
    for i in empty:
        anomalies.append({
            "type": "inventory_empty",
            "severity": "critical",
            "message": f"**{i.name}** has zero quantity remaining",
            "entity": "inventory",
            "entity_id": i.id,
        })

    # 2. Tasks overdue by more than 7 days
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    old_overdue = db.query(Task).filter(
        Task.status == TaskStatus.overdue,
        Task.due_date != None,
        Task.due_date < week_ago,
    ).all()
    if len(old_overdue) > 3:
        anomalies.append({
            "type": "tasks_overdue_spike",
            "severity": "warning",
            "message": f"**{len(old_overdue)} tasks** have been overdue for more than 7 days",
            "entity": "tasks",
            "entity_id": None,
        })

    # 3. Open CAPA with past due date
    today = now.date().isoformat()
    overdue_capas = db.query(CapaRecord).filter(
        CapaRecord.status.in_([CapaStatus.open, CapaStatus.in_progress]),
        CapaRecord.due_date != "",
        CapaRecord.due_date != None,
        CapaRecord.due_date < today,
    ).all()
    for c in overdue_capas:
        anomalies.append({
            "type": "capa_overdue",
            "severity": "critical" if c.severity == "critical" else "warning",
            "message": f"CAPA #{c.id} **{c.title}** is overdue (was due {c.due_date})",
            "entity": "capa",
            "entity_id": c.id,
        })

    # 4. Recent incidents (last 7 days) — spike detection
    week_ago_str = (now - timedelta(days=7)).isoformat()
    recent_incidents = db.query(IncidentReport).filter(
        IncidentReport.created_at >= week_ago_str
    ).count()
    if recent_incidents >= 3:
        anomalies.append({
            "type": "incident_spike",
            "severity": "warning",
            "message": f"**{recent_incidents} incidents** reported in the last 7 days — above normal",
            "entity": "incidents",
            "entity_id": None,
        })

    # 5. Reagents expiring within 7 days
    cutoff_7 = (now.date() + timedelta(days=7)).isoformat()
    expiring_soon = db.query(InventoryItem).filter(
        InventoryItem.expires_on != None,
        InventoryItem.expires_on != "",
        InventoryItem.expires_on <= cutoff_7,
        InventoryItem.expires_on >= today,
    ).all()
    for i in expiring_soon:
        anomalies.append({
            "type": "reagent_expiring_imminently",
            "severity": "critical",
            "message": f"**{i.name}** expires on {i.expires_on} (within 7 days)",
            "entity": "inventory",
            "entity_id": i.id,
        })

    anomalies.sort(key=lambda a: {"critical": 0, "warning": 1, "info": 2}.get(a["severity"], 3))
    return {
        "anomalies": anomalies,
        "total": len(anomalies),
        "critical": sum(1 for a in anomalies if a["severity"] == "critical"),
        "warnings": sum(1 for a in anomalies if a["severity"] == "warning"),
    }


# ── Lab Context Search ────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    entity_types: list[str] = ["protocols", "inventory", "samples", "notebook", "tasks"]


@router.post("/search")
def lab_search(
    body: SearchRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Full-text search across lab entities."""
    q = body.query.lower()
    like = f"%{q}%"
    results = []

    if "protocols" in body.entity_types:
        rows = db.query(Protocol).filter(
            or_(Protocol.title.ilike(like), Protocol.description.ilike(like))
        ).limit(5).all()
        for r in rows:
            results.append({"type": "protocol", "id": r.id, "title": r.title, "snippet": (r.description or "")[:120], "navigate_to": "lab-hub"})

    if "inventory" in body.entity_types:
        rows = db.query(InventoryItem).filter(
            or_(InventoryItem.name.ilike(like), InventoryItem.category.ilike(like), InventoryItem.cas_number.ilike(like))
        ).limit(5).all()
        for r in rows:
            results.append({"type": "inventory", "id": r.id, "title": r.name, "snippet": f"{r.category} · {r.quantity} {r.unit} · {r.storage_location or ''}", "navigate_to": "inventory"})

    if "samples" in body.entity_types:
        rows = db.query(SampleRecord).filter(
            or_(SampleRecord.sample_id.ilike(like), SampleRecord.sample_type.ilike(like), SampleRecord.storage_location.ilike(like), SampleRecord.source.ilike(like))
        ).limit(5).all()
        for r in rows:
            results.append({"type": "sample", "id": r.id, "title": r.sample_id, "snippet": f"{r.sample_type} · {r.status} · {r.storage_location or ''}", "navigate_to": "samples"})

    if "notebook" in body.entity_types:
        rows = db.query(LabNotebookEntry).filter(
            or_(LabNotebookEntry.title.ilike(like), LabNotebookEntry.content.ilike(like))
        ).limit(5).all()
        for r in rows:
            results.append({"type": "notebook", "id": r.id, "title": r.title, "snippet": (r.content or "")[:120], "navigate_to": "eln"})

    if "tasks" in body.entity_types:
        rows = db.query(Task).filter(
            or_(Task.title.ilike(like), Task.description.ilike(like))
        ).limit(5).all()
        for r in rows:
            results.append({"type": "task", "id": r.id, "title": r.title, "snippet": f"{r.status} · {r.priority}", "navigate_to": "tasks"})

    return {"results": results, "total": len(results), "query": body.query}
