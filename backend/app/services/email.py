"""
Email service — sends via Resend (preferred), falls back to SMTP, finally logs.

Priority:
  1. RESEND_API_KEY set → use Resend HTTP API (3k emails/mo free).
  2. SMTP_HOST + SMTP_USER + SMTP_PASSWORD set → use SMTP.
  3. Neither → log to console (dev mode).
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resend_configured() -> bool:
    return bool(os.environ.get("RESEND_API_KEY", "").strip())


def _smtp_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _send_via_resend(recipients: list[str], subject: str, body_html: str, body_text: str = "") -> bool:
    try:
        import resend  # type: ignore
        resend.api_key = os.environ["RESEND_API_KEY"]
        params = {
            "from": settings.smtp_from or "noreply@yourdomain.com",
            "to": recipients,
            "subject": subject,
            "html": body_html,
        }
        if body_text:
            params["text"] = body_text
        resend.Emails.send(params)
        logger.info("Email sent via Resend to %s: %s", ", ".join(recipients), subject)
        return True
    except Exception as exc:
        logger.error("Resend send failed (will try SMTP if configured): %s", exc)
        return False


def _send_via_smtp(recipients: list[str], subject: str, body_html: str, body_text: str = "") -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = ", ".join(recipients)
    if body_text:
        msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))
    try:
        if settings.smtp_tls:
            server = smtplib.SMTP(settings.smtp_host, settings.smtp_port)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port)
        server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, recipients, msg.as_string())
        server.quit()
        logger.info("Email sent via SMTP to %s: %s", ", ".join(recipients), subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", ", ".join(recipients), exc)
        return False


def send_email(to: str | list[str], subject: str, body_html: str, body_text: str = "") -> bool:
    recipients = [to] if isinstance(to, str) else to
    if not recipients:
        return False

    # 1. Try Resend first (preferred — free tier 3k/mo, HTTP not SMTP)
    if _resend_configured():
        if _send_via_resend(recipients, subject, body_html, body_text):
            return True
        # If Resend fails, fall through to SMTP if available

    # 2. SMTP fallback
    if _smtp_configured():
        return _send_via_smtp(recipients, subject, body_html, body_text)

    # 3. Dev mode — log only
    logger.info(
        "[EMAIL - no provider configured] To: %s | Subject: %s\n%s",
        ", ".join(recipients), subject, body_text or body_html,
    )
    return True  # Silent success in dev


# ── Template helpers ──────────────────────────────────────────────────────────

_BASE_STYLE = """
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #f5f5f5; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 40px auto; background: #fff;
               border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { background: #6366f1; color: #fff; padding: 28px 32px; }
  .header h1 { margin: 0; font-size: 22px; }
  .body { padding: 28px 32px; color: #374151; }
  .footer { padding: 16px 32px; font-size: 12px; color: #9ca3af; background: #f9fafb;
            border-top: 1px solid #e5e7eb; }
  .btn { display: inline-block; margin-top: 16px; padding: 10px 24px;
         background: #6366f1; color: #fff; border-radius: 6px;
         text-decoration: none; font-weight: 600; font-size: 14px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 4px;
           font-size: 12px; font-weight: 600; }
"""


def _wrap(title: str, content: str) -> str:
    return f"""<!DOCTYPE html><html><head><style>{_BASE_STYLE}</style></head><body>
<div class="container">
  <div class="header"><h1>⬡ LabOS — {title}</h1></div>
  <div class="body">{content}</div>
  <div class="footer">LabOS v3 · This is an automated notification · Do not reply</div>
</div></body></html>"""


def send_expiry_alert(to: str | list[str], items: list[dict]) -> bool:
    lines = "".join(
        f"<tr><td style='padding:6px 8px'>{i['name']}</td>"
        f"<td style='padding:6px 8px'>{i.get('expires_on','')}</td>"
        f"<td style='padding:6px 8px'>{i.get('category','')}</td></tr>"
        for i in items
    )
    html = _wrap("Reagent Expiry Alert", f"""
<p>{len(items)} reagent(s) are expiring soon or have already expired.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px">
  <thead><tr style="background:#f3f4f6">
    <th style="padding:6px 8px;text-align:left;font-size:12px">Name</th>
    <th style="padding:6px 8px;text-align:left;font-size:12px">Expires</th>
    <th style="padding:6px 8px;text-align:left;font-size:12px">Category</th>
  </tr></thead>
  <tbody>{lines}</tbody>
</table>
<a href="http://localhost:5173" class="btn">Open Reagent Hub →</a>
""")
    return send_email(to, f"[LabOS] {len(items)} Reagent(s) Expiring Soon", html,
                      f"{len(items)} reagents expiring soon: " + ", ".join(i['name'] for i in items))


def send_capa_assignment(to: str, capa_title: str, capa_id: int, due_date: str) -> bool:
    html = _wrap("CAPA Assignment", f"""
<p>You have been assigned a new CAPA record.</p>
<table style="margin-top:8px">
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">CAPA #</td><td style="padding:4px 12px"><strong>#{capa_id}</strong></td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Title</td><td style="padding:4px 12px">{capa_title}</td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Due Date</td><td style="padding:4px 12px">{due_date or 'Not set'}</td></tr>
</table>
<a href="http://localhost:5173" class="btn">View CAPA →</a>
""")
    return send_email(to, f"[LabOS] CAPA #{capa_id} Assigned to You", html)


def send_task_reminder(to: str, task_name: str, due_date: str) -> bool:
    html = _wrap("Task Reminder", f"""
<p>A task assigned to you is due soon.</p>
<table style="margin-top:8px">
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Task</td><td style="padding:4px 12px">{task_name}</td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Due</td><td style="padding:4px 12px"><strong>{due_date}</strong></td></tr>
</table>
<a href="http://localhost:5173" class="btn">View Task →</a>
""")
    return send_email(to, f"[LabOS] Task Due Soon: {task_name}", html)


def send_welcome(to: str, full_name: str, temp_password: str = "") -> bool:
    pwd_block = f"<p>Your temporary password is: <code>{temp_password}</code><br>Please change it after first login.</p>" if temp_password else ""
    html = _wrap("Welcome to LabOS", f"""
<p>Hi {full_name},</p>
<p>Your LabOS account has been created. You now have access to the lab management system.</p>
{pwd_block}
<a href="http://localhost:5173" class="btn">Log In Now →</a>
""")
    return send_email(to, "[LabOS] Welcome — Your account is ready", html)


def send_incident_notification(to: str | list[str], incident_title: str, severity: str, reporter: str) -> bool:
    color = {"critical": "#ef4444", "high": "#f59e0b", "medium": "#6366f1", "low": "#22c55e"}.get(severity.lower(), "#6b7280")
    html = _wrap("Incident Reported", f"""
<p>A new incident has been reported that may require your attention.</p>
<table style="margin-top:8px">
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Title</td><td style="padding:4px 12px">{incident_title}</td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Severity</td>
      <td style="padding:4px 12px"><span class="badge" style="background:{color}22;color:{color};border:1px solid {color}44">{severity.upper()}</span></td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0">Reported By</td><td style="padding:4px 12px">{reporter}</td></tr>
</table>
<a href="http://localhost:5173" class="btn">Review Incident →</a>
""")
    return send_email(to, f"[LabOS] Incident: {incident_title}", html)
