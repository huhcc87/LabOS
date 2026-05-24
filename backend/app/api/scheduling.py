from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import AuditAction, Booking, CalendarEvent, ReminderQueue, User, UserRole
from app.schemas.schemas import (
    CalendarEventCreate, CalendarEventOut, CalendarEventUpdate,
    PaginatedResponse,
    ReminderQueueCreate, ReminderQueueOut, ReminderQueueUpdate,
)
from app.services.auth import get_current_user, require_role, write_audit

router = APIRouter(prefix="/scheduling", tags=["scheduling"])


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _enrich_cal(e: CalendarEvent, db: Session) -> CalendarEventOut:
    attendee_names = None
    if e.attendee_ids:
        ids = [int(x) for x in e.attendee_ids.split(",") if x.strip().isdigit()]
        if ids:
            users = db.query(User).filter(User.id.in_(ids)).all()
            attendee_names = ", ".join(u.full_name for u in users)
    return CalendarEventOut.model_validate({
        "id": e.id, "title": e.title, "event_type": e.event_type,
        "start_time": e.start_time, "end_time": e.end_time, "location": e.location,
        "related_instrument_id": e.related_instrument_id,
        "related_task_id": e.related_task_id,
        "related_protocol_id": e.related_protocol_id,
        "owner_id": e.owner_id,
        "owner_name": e.owner.full_name if e.owner else None,
        "description": e.description,
        "recurrence_rule": e.recurrence_rule or "none",
        "recurrence_end": e.recurrence_end,
        "recurrence_group_id": e.recurrence_group_id,
        "attendee_ids": e.attendee_ids or "",
        "attendee_names": attendee_names,
        "reminder_minutes": e.reminder_minutes,
    })


def _expand_recurrence(base: CalendarEventCreate, first_id: int, db: Session) -> list[CalendarEvent]:
    """Generate additional CalendarEvent rows for recurring events."""
    rule = base.recurrence_rule
    if rule == "none" or not base.recurrence_end:
        return []

    try:
        start = _parse_dt(base.start_time)
        end = _parse_dt(base.end_time)
        rec_end = _parse_dt(base.recurrence_end + "T23:59:59" if "T" not in base.recurrence_end else base.recurrence_end)
    except Exception:
        return []

    duration = end - start
    extras: list[CalendarEvent] = []
    current = start

    deltas = {"daily": timedelta(days=1), "weekly": timedelta(weeks=1), "monthly": None}

    for _ in range(365):  # safety cap
        if rule == "monthly":
            month = current.month + 1
            year = current.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            try:
                current = current.replace(year=year, month=month)
            except ValueError:
                break
        else:
            current = current + deltas[rule]

        if current > rec_end:
            break

        new_end = current + duration
        e = CalendarEvent(
            title=base.title,
            event_type=base.event_type,
            start_time=current.isoformat(),
            end_time=new_end.isoformat(),
            location=base.location,
            related_instrument_id=base.related_instrument_id,
            related_task_id=base.related_task_id,
            related_protocol_id=base.related_protocol_id,
            owner_id=base.owner_id,
            description=base.description,
            recurrence_rule=base.recurrence_rule,
            recurrence_end=base.recurrence_end,
            recurrence_group_id=first_id,
            attendee_ids=base.attendee_ids,
            reminder_minutes=base.reminder_minutes,
        )
        extras.append(e)
    return extras


def _schedule_reminder(db: Session, event: CalendarEvent):
    """Create a ReminderQueue entry if reminder_minutes is set."""
    if not event.reminder_minutes:
        return
    try:
        start = _parse_dt(event.start_time)
        due = start - timedelta(minutes=event.reminder_minutes)
        reminder = ReminderQueue(
            entity_type="calendar_event",
            entity_id=event.id,
            title=f"Reminder: {event.title}",
            due_at=due.isoformat(),
            channel="dashboard",
            recipient_user_id=event.owner_id,
            recipient_role="staff",
            message=f"Upcoming event: {event.title} at {event.start_time}",
        )
        db.add(reminder)
    except Exception:
        pass


@router.get("/calendar", response_model=PaginatedResponse[CalendarEventOut])
def list_calendar_events(
    page: int = 1,
    per_page: int = 500,
    search: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(CalendarEvent)
    if search:
        q = q.filter(CalendarEvent.title.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(CalendarEvent.start_time.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=[_enrich_cal(e, db) for e in items], total=total, page=page, per_page=per_page, pages=pages)


@router.post("/calendar", response_model=CalendarEventOut, status_code=201)
def create_calendar_event(
    body: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = body.model_dump()
    e = CalendarEvent(**data)
    db.add(e)
    db.flush()

    # Set recurrence_group_id = own id for the root event
    if body.recurrence_rule != "none":
        e.recurrence_group_id = e.id

    write_audit(db, AuditAction.create, "calendar_event", e.id, current_user, {"title": body.title})

    # Expand recurrence
    extras = _expand_recurrence(body, e.id, db)
    for extra in extras:
        db.add(extra)

    db.flush()
    _schedule_reminder(db, e)
    db.commit()
    db.refresh(e)
    return _enrich_cal(e, db)


@router.get("/calendar/{event_id}", response_model=CalendarEventOut)
def get_calendar_event(event_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    e = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    return _enrich_cal(e, db)


@router.put("/calendar/{event_id}", response_model=CalendarEventOut)
def update_calendar_event(
    event_id: int,
    body: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    changes = {}
    for fname in ("title", "event_type", "start_time", "end_time", "location",
                  "related_instrument_id", "related_task_id", "related_protocol_id",
                  "owner_id", "description", "recurrence_rule", "recurrence_end",
                  "attendee_ids", "reminder_minutes"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(e, fname, val)
    write_audit(db, AuditAction.update, "calendar_event", event_id, current_user, changes)
    db.commit()
    db.refresh(e)
    return _enrich_cal(e, db)


@router.delete("/calendar/{event_id}", status_code=204)
def delete_calendar_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    e = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    write_audit(db, AuditAction.delete, "calendar_event", event_id, current_user, {"title": e.title})
    db.delete(e)
    db.commit()


@router.delete("/calendar/{event_id}/series", status_code=204)
def delete_calendar_series(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all events in a recurrence series."""
    e = db.query(CalendarEvent).filter(CalendarEvent.id == event_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
    group_id = e.recurrence_group_id or event_id
    series = db.query(CalendarEvent).filter(
        (CalendarEvent.recurrence_group_id == group_id) | (CalendarEvent.id == group_id)
    ).all()
    for ev in series:
        db.delete(ev)
    write_audit(db, AuditAction.delete, "calendar_event", event_id, current_user, {"series": True})
    db.commit()


@router.get("/calendar/export.ics")
def export_ics(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from icalendar import Calendar, Event as ICalEvent
    cal = Calendar()
    cal.add("prodid", "-//LabOS v3//EN")
    cal.add("version", "2.0")

    events = db.query(CalendarEvent).all()
    bookings = db.query(Booking).all()

    for e in events:
        ie = ICalEvent()
        ie.add("summary", e.title)
        ie.add("dtstart", datetime.fromisoformat(e.start_time.replace("Z", "+00:00")))
        ie.add("dtend", datetime.fromisoformat(e.end_time.replace("Z", "+00:00")))
        ie.add("location", e.location or "")
        ie.add("description", e.description or "")
        cal.add_component(ie)

    for b in bookings:
        ie = ICalEvent()
        ie.add("summary", f"Booking: {b.purpose}")
        try:
            ie.add("dtstart", datetime.fromisoformat(b.start_time.replace("Z", "+00:00")))
            ie.add("dtend", datetime.fromisoformat(b.end_time.replace("Z", "+00:00")))
        except Exception:
            continue
        cal.add_component(ie)

    ics_bytes = cal.to_ical()
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=labos-calendar.ics"},
    )


# ─── Reminders ────────────────────────────────────────────────────────────────

@router.get("/reminders/stats")
def reminders_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from app.models.models import ReminderStatus
    now_str = datetime.now(timezone.utc).isoformat()
    pending = db.query(ReminderQueue).filter(ReminderQueue.status == ReminderStatus.pending).count()
    overdue = (
        db.query(ReminderQueue)
        .filter(
            ReminderQueue.status == ReminderStatus.pending,
            ReminderQueue.due_at <= now_str,
        )
        .count()
    )
    return {"pending": pending, "overdue": overdue}


@router.get("/reminders", response_model=PaginatedResponse[ReminderQueueOut])
def list_reminders(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.manager)),
):
    q = db.query(ReminderQueue)
    if search:
        q = q.filter(ReminderQueue.title.ilike(f"%{search}%"))
    if status:
        q = q.filter(ReminderQueue.status == status)
    total = q.count()
    items = q.order_by(ReminderQueue.due_at.asc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page or 1
    return PaginatedResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post("/reminders", response_model=ReminderQueueOut, status_code=201)
def create_reminder(
    body: ReminderQueueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = ReminderQueue(**body.model_dump())
    db.add(item)
    db.flush()
    write_audit(db, AuditAction.create, "reminder", item.id, current_user, {"title": body.title})
    db.commit()
    db.refresh(item)
    return item


@router.put("/reminders/{reminder_id}", response_model=ReminderQueueOut)
def update_reminder(
    reminder_id: int,
    body: ReminderQueueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = db.query(ReminderQueue).filter(ReminderQueue.id == reminder_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Reminder not found")
    changes = {}
    for fname in ("title", "due_at", "channel", "recipient_user_id", "recipient_role", "status", "message"):
        val = getattr(body, fname)
        if val is not None:
            changes[fname] = str(val)
            setattr(item, fname, val)
    write_audit(db, AuditAction.update, "reminder", reminder_id, current_user, changes)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/reminders/{reminder_id}", status_code=204)
def delete_reminder(
    reminder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.manager)),
):
    item = db.query(ReminderQueue).filter(ReminderQueue.id == reminder_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Reminder not found")
    write_audit(db, AuditAction.delete, "reminder", reminder_id, current_user, {"title": item.title})
    db.delete(item)
    db.commit()


# ── Equipment Booking Conflict Detection ──────────────────────────────────────

from app.models.models import Instrument, BookingStatus


@router.get("/bookings/conflicts")
def detect_conflicts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Scan all upcoming bookings for overlapping time windows on the same instrument."""
    upcoming = (
        db.query(Booking)
        .filter(Booking.status == BookingStatus.reserved)
        .order_by(Booking.instrument_id, Booking.start_time)
        .all()
    )

    # Group by instrument
    by_instrument: dict[int, list[Booking]] = {}
    for b in upcoming:
        by_instrument.setdefault(b.instrument_id, []).append(b)

    conflicts = []
    for instr_id, bookings in by_instrument.items():
        for i in range(len(bookings)):
            for j in range(i + 1, len(bookings)):
                a, b_booking = bookings[i], bookings[j]
                # Overlap: a.start < b.end AND b.start < a.end
                if a.start_time < b_booking.end_time and b_booking.start_time < a.end_time:
                    instr = db.query(Instrument).filter(Instrument.id == instr_id).first()
                    conflicts.append({
                        "instrument_id": instr_id,
                        "instrument_name": instr.name if instr else f"Instrument #{instr_id}",
                        "booking_a": {"id": a.id, "start": a.start_time, "end": a.end_time, "user_id": a.user_id, "purpose": a.purpose},
                        "booking_b": {"id": b_booking.id, "start": b_booking.start_time, "end": b_booking.end_time, "user_id": b_booking.user_id, "purpose": b_booking.purpose},
                    })

    return {"conflicts": conflicts, "total": len(conflicts)}


@router.get("/bookings/utilization")
def booking_utilization(
    days: int = 30,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return per-instrument utilization heatmap data for the last N days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    bookings = (
        db.query(Booking)
        .filter(Booking.start_time >= cutoff)
        .filter(Booking.status != BookingStatus.cancelled)
        .all()
    )
    instruments = {i.id: i for i in db.query(Instrument).all()}

    # Per instrument: total booked hours and per-day counts
    from collections import defaultdict
    instr_stats: dict[int, dict] = {}
    day_counts: dict[str, int] = defaultdict(int)  # date → total bookings

    for b in bookings:
        iid = b.instrument_id
        if iid not in instr_stats:
            instr = instruments.get(iid)
            instr_stats[iid] = {
                "instrument_id": iid,
                "instrument_name": instr.name if instr else f"#{iid}",
                "total_bookings": 0,
                "total_hours": 0.0,
                "by_day": defaultdict(int),
            }
        try:
            start = datetime.fromisoformat(b.start_time.replace("Z", "+00:00"))
            end = datetime.fromisoformat(b.end_time.replace("Z", "+00:00"))
            hours = max((end - start).total_seconds() / 3600, 0)
        except Exception:
            hours = 1.0
        instr_stats[iid]["total_bookings"] += 1
        instr_stats[iid]["total_hours"] = round(instr_stats[iid]["total_hours"] + hours, 2)
        day = b.start_time[:10]
        instr_stats[iid]["by_day"][day] += 1
        day_counts[day] += 1

    # Convert defaultdicts for JSON serialization
    result_instruments = []
    for stats in instr_stats.values():
        result_instruments.append({
            "instrument_id": stats["instrument_id"],
            "instrument_name": stats["instrument_name"],
            "total_bookings": stats["total_bookings"],
            "total_hours": stats["total_hours"],
            "by_day": dict(stats["by_day"]),
        })

    result_instruments.sort(key=lambda x: x["total_hours"], reverse=True)

    return {
        "days": days,
        "instruments": result_instruments,
        "heatmap": dict(day_counts),
        "total_bookings": len(bookings),
    }
