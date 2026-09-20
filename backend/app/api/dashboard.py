from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import (
    AuditLog,
    Booking,
    CalendarEvent,
    ComplianceLog,
    Feedback,
    IncidentReport,
    IncidentSeverity,
    Instrument,
    InventoryItem,
    NotificationRule,
    Protocol,
    ReminderQueue,
    ReminderStatus,
    SampleEvent,
    SampleRecord,
    SampleStatus,
    StudyWorkspace,
    Task,
    TaskStatus,
    TrainingRecord,
    User,
)
from app.schemas.schemas import AuditLogOut, DashboardSummary, WeekCount
from app.services.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    cutoff = today + timedelta(days=7)
    instruments = db.query(Instrument).all()
    upcoming_maintenance = sum(
        1 for i in instruments if today.isoformat() <= i.next_maintenance_date <= cutoff.isoformat()
    )
    overdue_tasks = db.query(Task).filter(Task.status == TaskStatus.overdue).count()
    feedback_open = db.query(Feedback).filter(Feedback.status != "closed").count()

    # Charts data
    samples_by_status = {}
    for status in SampleStatus:
        samples_by_status[status.value] = db.query(SampleRecord).filter(SampleRecord.status == status).count()

    tasks_by_status = {}
    for status in TaskStatus:
        tasks_by_status[status.value] = db.query(Task).filter(Task.status == status).count()

    incidents_by_severity = {}
    for sev in IncidentSeverity:
        incidents_by_severity[sev.value] = db.query(IncidentReport).filter(IncidentReport.severity == sev).count()

    # Sample intake by week (last 8 weeks)
    sample_intake_by_week: list[WeekCount] = []
    for weeks_back in range(7, -1, -1):
        week_start = today - timedelta(days=today.weekday() + weeks_back * 7)
        week_end = week_start + timedelta(days=6)
        count = db.query(SampleRecord).filter(
            SampleRecord.received_on >= week_start.isoformat(),
            SampleRecord.received_on <= week_end.isoformat(),
        ).count()
        sample_intake_by_week.append(WeekCount(week=week_start.strftime("%b %d"), count=count))

    # Recent audit
    audit_rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(10).all()
    audit_recent = [AuditLogOut.model_validate(a) for a in audit_rows]

    return DashboardSummary(
        protocols=db.query(Protocol).count(),
        instruments=len(instruments),
        bookings=db.query(Booking).count(),
        tasks_open=db.query(Task).filter(Task.status != TaskStatus.completed).count(),
        compliance_logs=db.query(ComplianceLog).count(),
        feedback_open=feedback_open,
        upcoming_maintenance=upcoming_maintenance,
        overdue_tasks=overdue_tasks,
        training_records=db.query(TrainingRecord).count(),
        inventory_items=db.query(InventoryItem).count(),
        incident_reports=db.query(IncidentReport).count(),
        workspaces=db.query(StudyWorkspace).count(),
        notification_rules=db.query(NotificationRule).count(),
        samples=db.query(SampleRecord).count(),
        sample_events=db.query(SampleEvent).count(),
        calendar_events=db.query(CalendarEvent).count(),
        reminders_pending=db.query(ReminderQueue).filter(ReminderQueue.status == ReminderStatus.pending).count(),
        low_stock_items=db.query(InventoryItem).filter(InventoryItem.quantity <= InventoryItem.reorder_threshold).count(),
        samples_by_status=samples_by_status,
        tasks_by_status=tasks_by_status,
        incidents_by_severity=incidents_by_severity,
        sample_intake_by_week=sample_intake_by_week,
        audit_recent=audit_recent,
    )
