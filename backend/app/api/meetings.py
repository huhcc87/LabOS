from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.auth import get_current_user, require_role
from app.models.models import LabMeeting, User, MeetingStatus, ROLE_HIERARCHY, UserRole
from app.schemas.schemas import (
    LabMeetingCreate,
    LabMeetingUpdate,
    LabMeetingOut,
    PaginatedResponse,
)
from app.api.audit import log_action

router = APIRouter(prefix="/meetings", tags=["meetings"])


def meeting_to_out(m: LabMeeting) -> LabMeetingOut:
    return LabMeetingOut(
        id=m.id,
        title=m.title,
        type=m.type,
        status=m.status,
        scheduled_at=m.scheduled_at,
        end_time=m.end_time,
        location=m.location,
        video_link=m.video_link,
        description=m.description,
        is_recurring=m.is_recurring,
        recurring_pattern=m.recurring_pattern,
        organizer_id=m.organizer_id,
        organizer_name=m.organizer.full_name if m.organizer else None,
        agenda_json=m.agenda_json,
        attendees_json=m.attendees_json,
        minutes=m.minutes,
        minutes_published=m.minutes_published,
        minutes_published_at=m.minutes_published_at,
        tags=m.tags,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


@router.get("", response_model=PaginatedResponse[LabMeetingOut])
def list_meetings(
    page: int = 1,
    per_page: int = 20,
    search: str = "",
    type: str = "",
    status: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(LabMeeting)
    if search:
        query = query.filter(LabMeeting.title.ilike(f"%{search}%"))
    if type:
        query = query.filter(LabMeeting.type == type)
    if status:
        query = query.filter(LabMeeting.status == status)

    total = query.count()
    items = query.order_by(LabMeeting.scheduled_at.desc()).offset((page - 1) * per_page).limit(per_page).all()
    pages = (total + per_page - 1) // per_page

    return PaginatedResponse(
        items=[meeting_to_out(m) for m in items],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/upcoming", response_model=list[LabMeetingOut])
def list_upcoming_meetings(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    items = (
        db.query(LabMeeting)
        .filter(LabMeeting.scheduled_at >= now)
        .filter(LabMeeting.status.in_([MeetingStatus.scheduled, MeetingStatus.in_progress]))
        .order_by(LabMeeting.scheduled_at.asc())
        .limit(limit)
        .all()
    )
    return [meeting_to_out(m) for m in items]


@router.get("/past", response_model=list[LabMeetingOut])
def list_past_meetings(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import datetime
    now = datetime.now(timezone.utc).isoformat()
    items = (
        db.query(LabMeeting)
        .filter(LabMeeting.scheduled_at < now)
        .order_by(LabMeeting.scheduled_at.desc())
        .limit(limit)
        .all()
    )
    return [meeting_to_out(m) for m in items]


@router.get("/{meeting_id}", response_model=LabMeetingOut)
def get_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting_to_out(m)


@router.post("", response_model=LabMeetingOut)
def create_meeting(
    data: LabMeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    m = LabMeeting(
        title=data.title,
        type=data.type,
        status=MeetingStatus.scheduled,
        scheduled_at=data.scheduled_at,
        end_time=data.end_time,
        location=data.location,
        video_link=data.video_link,
        description=data.description,
        is_recurring=data.is_recurring,
        recurring_pattern=data.recurring_pattern,
        organizer_id=current_user.id,
        agenda_json=data.agenda_json,
        attendees_json=data.attendees_json,
        tags=data.tags,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    log_action(db, "create", "LabMeeting", m.id, current_user, {"title": m.title})
    return meeting_to_out(m)


@router.put("/{meeting_id}", response_model=LabMeetingOut)
def update_meeting(
    meeting_id: int,
    data: LabMeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # Only organizer or admin/pi can edit
    user_level = ROLE_HIERARCHY.get(current_user.role, 0)
    is_organizer = m.organizer_id == current_user.id
    if not is_organizer and user_level < ROLE_HIERARCHY[UserRole.pi]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this meeting")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(m, key, value)

    db.commit()
    db.refresh(m)
    log_action(db, "update", "LabMeeting", m.id, current_user, update_data)
    return meeting_to_out(m)


@router.delete("/{meeting_id}")
def delete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("pi")),
):
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    title = m.title
    db.delete(m)
    db.commit()
    log_action(db, "delete", "LabMeeting", meeting_id, current_user, {"title": title})
    return {"detail": "Meeting deleted"}


@router.post("/{meeting_id}/cancel", response_model=LabMeetingOut)
def cancel_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m.status = MeetingStatus.cancelled
    db.commit()
    db.refresh(m)
    log_action(db, "update", "LabMeeting", m.id, current_user, {"status": "cancelled"})
    return meeting_to_out(m)


@router.post("/{meeting_id}/complete", response_model=LabMeetingOut)
def complete_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m.status = MeetingStatus.completed
    db.commit()
    db.refresh(m)
    log_action(db, "update", "LabMeeting", m.id, current_user, {"status": "completed"})
    return meeting_to_out(m)


@router.post("/{meeting_id}/publish-minutes", response_model=LabMeetingOut)
def publish_minutes(
    meeting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("manager")),
):
    from datetime import datetime
    m = db.query(LabMeeting).filter(LabMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meeting not found")

    m.minutes_published = True
    m.minutes_published_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(m)
    log_action(db, "update", "LabMeeting", m.id, current_user, {"minutes_published": True})
    return meeting_to_out(m)
