from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.models import User
from app.models.models import UserRole
from app.services.auth import get_current_user, require_role
from app.services.email import (
    send_capa_assignment,
    send_email,
    send_expiry_alert,
    send_incident_notification,
    send_task_reminder,
    send_welcome,
)

router = APIRouter(prefix="/email", tags=["email"])


class TestEmailRequest(BaseModel):
    to: str
    subject: str = "LabOS Test Email"
    message: str = "This is a test email from LabOS."


class SmtpStatus(BaseModel):
    configured: bool
    host: str
    port: int
    user: str
    from_address: str
    tls: bool


@router.get("/smtp-status", response_model=SmtpStatus)
def smtp_status(_: User = Depends(get_current_user)):
    return SmtpStatus(
        configured=bool(settings.smtp_host and settings.smtp_user),
        host=settings.smtp_host,
        port=settings.smtp_port,
        user=settings.smtp_user,
        from_address=settings.smtp_from,
        tls=settings.smtp_tls,
    )


@router.post("/test")
def send_test_email(
    body: TestEmailRequest,
    current_user: User = Depends(require_role(UserRole.admin)),
):
    html = f"""<div style="font-family:sans-serif;max-width:480px;margin:40px auto;padding:24px;
               border:1px solid #e5e7eb;border-radius:10px">
      <h2 style="color:#6366f1">⬡ LabOS Test Email</h2>
      <p>{body.message}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb">
      <p style="font-size:12px;color:#9ca3af">Sent by {current_user.email} via LabOS v3</p>
    </div>"""
    ok = send_email(body.to, body.subject, html, body.message)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to send email")
    return {"status": "sent", "to": body.to}


class ExpiryAlertRequest(BaseModel):
    to: list[str]


@router.post("/notify/expiry-alerts")
def notify_expiry_alerts(
    body: ExpiryAlertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.staff)),
):
    from datetime import date, timedelta
    from app.models.models import InventoryItem
    today = date.today()
    cutoff = today + timedelta(days=90)
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.expires_on.isnot(None))
        .filter(InventoryItem.expires_on != "")
        .filter(InventoryItem.expires_on <= cutoff.isoformat())
        .all()
    )
    if not items:
        return {"status": "no_items", "count": 0}
    payload = [{"name": i.name, "expires_on": i.expires_on, "category": i.category} for i in items]
    ok = send_expiry_alert(body.to, payload)
    return {"status": "sent" if ok else "failed", "count": len(items)}


class WelcomeEmailRequest(BaseModel):
    to: str
    full_name: str
    temp_password: str = ""


@router.post("/notify/welcome")
def notify_welcome(
    body: WelcomeEmailRequest,
    current_user: User = Depends(require_role(UserRole.admin)),
):
    ok = send_welcome(body.to, body.full_name, body.temp_password)
    return {"status": "sent" if ok else "failed"}
