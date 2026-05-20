import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings

scheduler = BackgroundScheduler()


def _send_email(to: str, subject: str, body: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not settings.smtp_host or not settings.smtp_user:
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_tls:
                server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from, [to], msg.as_string())
        return True
    except Exception as exc:
        print(f"[EMAIL ERROR] {exc}")
        return False


def dispatch_reminders():
    """Poll reminder_queue for pending reminders due now and dispatch them."""
    from app.core.database import SessionLocal
    from app.models.models import NotificationChannel, ReminderQueue, ReminderStatus, User

    db = SessionLocal()
    try:
        now_str = datetime.now(timezone.utc).isoformat()
        pending = (
            db.query(ReminderQueue)
            .filter(
                ReminderQueue.status == ReminderStatus.pending,
                ReminderQueue.due_at <= now_str,
            )
            .all()
        )
        for reminder in pending:
            recipient_email = None
            recipient_label = reminder.recipient_role

            if reminder.recipient_user_id:
                user = db.query(User).filter(User.id == reminder.recipient_user_id).first()
                if user:
                    recipient_email = user.email
                    recipient_label = user.email

            sent = False
            if reminder.channel == NotificationChannel.email and recipient_email:
                subject = f"[LabOS] {reminder.title}"
                body = (
                    f"{reminder.title}\n\n"
                    f"{reminder.message}\n\n"
                    f"Due: {reminder.due_at}\n"
                    f"-- LabOS v3"
                )
                sent = _send_email(recipient_email, subject, body)
                if not sent:
                    print(f"[REMINDER] Email not configured — logged: {reminder.title} → {recipient_label}")
            else:
                print(f"[REMINDER] Dashboard delivery to {recipient_label}: {reminder.title}")
                sent = True

            reminder.status = ReminderStatus.sent if sent else ReminderStatus.failed
            reminder.last_attempt_at = datetime.now(timezone.utc).isoformat()

        if pending:
            db.commit()
    except Exception as exc:
        print(f"[REMINDER ERROR] {exc}")
        db.rollback()
    finally:
        db.close()


def check_iot_alerts():
    """
    Runs every scheduler tick. For each active IoT sensor:
    - Grabs the latest reading
    - Checks if it breaches warning or critical thresholds
    - Creates an IoTAlert record (deduped by cooldown window)
    - Sends email to notify_email addresses if SMTP is configured
    """
    from app.core.database import SessionLocal
    from app.models.models import IoTAlert, IoTAlertSeverity, IoTSensor

    db = SessionLocal()
    try:
        sensors = db.query(IoTSensor).filter(IoTSensor.is_active == True).all()
        now = datetime.now(timezone.utc)

        for sensor in sensors:
            if not sensor.readings:
                continue

            latest = sensor.readings[0]
            value = latest.value
            mn, mx = sensor.min_threshold, sensor.max_threshold
            span = abs(mx - mn)

            # Determine severity
            if value < mn or value > mx:
                severity = IoTAlertSeverity.critical
                msg = (
                    f"CRITICAL: {sensor.name} reading {value}{sensor.unit} is outside "
                    f"safe range ({mn}–{mx}{sensor.unit}). Immediate action required."
                )
            elif value < mn + span * 0.1 or value > mx - span * 0.1:
                severity = IoTAlertSeverity.warning
                msg = (
                    f"WARNING: {sensor.name} reading {value}{sensor.unit} is approaching "
                    f"threshold boundary ({mn}–{mx}{sensor.unit}). Monitor closely."
                )
            else:
                continue  # All good

            # Cooldown: skip if a recent unacknowledged alert already exists
            from datetime import timedelta
            cooldown_cutoff = now - timedelta(minutes=sensor.alert_cooldown_minutes)
            recent = (
                db.query(IoTAlert)
                .filter(
                    IoTAlert.sensor_id == sensor.id,
                    IoTAlert.acknowledged == False,
                    IoTAlert.triggered_at >= cooldown_cutoff,
                )
                .first()
            )
            if recent:
                continue

            # Create alert record
            alert = IoTAlert(
                sensor_id=sensor.id,
                severity=severity,
                value=value,
                message=msg,
                triggered_at=now,
            )
            db.add(alert)
            db.flush()

            # Send emails
            notified = []
            if sensor.notify_email:
                subject = f"[LabOS IoT {'🚨 CRITICAL' if severity == IoTAlertSeverity.critical else '⚠️ Warning'}] {sensor.name}"
                body = (
                    f"{msg}\n\n"
                    f"Sensor:   {sensor.name}\n"
                    f"Location: {sensor.location}\n"
                    f"Reading:  {value}{sensor.unit}\n"
                    f"Target:   {sensor.target}{sensor.unit}\n"
                    f"Range:    {mn} – {mx}{sensor.unit}\n"
                    f"Time:     {now.strftime('%Y-%m-%d %H:%M UTC')}\n\n"
                    f"Log in to LabOS → IoT Monitor to acknowledge this alert.\n"
                    f"-- LabOS v3 Alert System"
                )
                for email in sensor.notify_email.split(","):
                    email = email.strip()
                    if email:
                        ok = _send_email(email, subject, body)
                        if ok:
                            notified.append(email)
                        else:
                            print(f"[IOT ALERT] SMTP not configured — would email {email}: {subject}")

            alert.notified_emails = ",".join(notified)
            print(f"[IOT ALERT] {severity.upper()} — {sensor.name}: {value}{sensor.unit}  emails={notified or 'none'}")

        db.commit()
    except Exception as exc:
        print(f"[IOT ALERT ERROR] {exc}")
        db.rollback()
    finally:
        db.close()


def check_reagent_expiry():
    """Daily job: email lab staff about reagents expiring within 30 days."""
    from datetime import date, timedelta

    from app.core.database import SessionLocal
    from app.models.models import InventoryItem, User, UserRole
    from app.services.email import send_expiry_alert

    db = SessionLocal()
    try:
        today = date.today()
        cutoff = (today + timedelta(days=30)).isoformat()
        today_str = today.isoformat()
        items = (
            db.query(InventoryItem)
            .filter(InventoryItem.expires_on.isnot(None))
            .filter(InventoryItem.expires_on != "")
            .filter(InventoryItem.expires_on <= cutoff)
            .all()
        )
        if not items:
            return
        staff = db.query(User).filter(
            User.is_active == True,
            User.role.in_([UserRole.admin, UserRole.staff]),
        ).all()
        recipients = [u.email for u in staff if u.email]
        if not recipients:
            print(f"[EXPIRY] {len(items)} expiring reagents — no staff emails configured")
            return
        payload = [{"name": i.name, "expires_on": i.expires_on, "category": i.category} for i in items]
        send_expiry_alert(recipients, payload)
        print(f"[EXPIRY] Sent alert for {len(items)} reagents to {recipients}")
    except Exception as exc:
        print(f"[EXPIRY ERROR] {exc}")
    finally:
        db.close()


def start_scheduler():
    scheduler.add_job(
        dispatch_reminders,
        "interval",
        seconds=settings.scheduler_interval_seconds,
        id="reminder_dispatch",
        replace_existing=True,
    )
    scheduler.add_job(
        check_iot_alerts,
        "interval",
        seconds=settings.scheduler_interval_seconds,
        id="iot_alert_check",
        replace_existing=True,
    )
    scheduler.add_job(
        check_reagent_expiry,
        "cron",
        hour=8,
        minute=0,
        id="reagent_expiry_check",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[SCHEDULER] Started — polling every {settings.scheduler_interval_seconds}s")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
