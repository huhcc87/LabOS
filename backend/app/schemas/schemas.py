from datetime import datetime
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.models.models import (
    AuditAction,
    BookingStatus,
    CostCategory,
    CostStatus,
    IncidentSeverity,
    MaintenanceStatus,
    MaintenanceType,
    MeetingStatus,
    MeetingType,
    NotificationChannel,
    ReminderStatus,
    SampleStatus,
    SOPStatus,
    TaskStatus,
    TemplateCategory,
    TrainingStatus,
    UserRole,
)

T = TypeVar("T")


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int


# ─── Auth / User ─────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: UserRole = UserRole.staff
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Protocols ────────────────────────────────────────────────────────────────

class WorkflowStepCreate(BaseModel):
    step_order: int
    title: str
    instructions: str
    estimated_minutes: int = 15
    requires_signoff: bool = False


class WorkflowStepOut(WorkflowStepCreate):
    id: int

    class Config:
        from_attributes = True


class ProtocolCreate(BaseModel):
    title: str
    field: str
    version: str = "1.0"
    description: str
    owner_id: int | None = None
    reminder_days_before: int = 3
    steps: list[WorkflowStepCreate] = []


class ProtocolUpdate(BaseModel):
    title: str | None = None
    field: str | None = None
    version: str | None = None
    description: str | None = None
    owner_id: int | None = None
    reminder_days_before: int | None = None
    steps: list[WorkflowStepCreate] | None = None


class ProtocolOut(BaseModel):
    id: int
    title: str
    field: str
    version: str
    description: str
    owner_id: int | None = None
    owner_name: str | None = None
    reminder_days_before: int
    created_at: datetime
    steps: list[WorkflowStepOut] = []

    class Config:
        from_attributes = True


# ─── Instruments ──────────────────────────────────────────────────────────────

class InstrumentCreate(BaseModel):
    name: str
    category: str
    location: str
    maintenance_frequency_days: int = 30
    next_maintenance_date: str
    status: str = "available"
    notes: str = ""


class InstrumentUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    location: str | None = None
    maintenance_frequency_days: int | None = None
    next_maintenance_date: str | None = None
    status: str | None = None
    notes: str | None = None


class InstrumentOut(BaseModel):
    id: int
    name: str
    category: str
    location: str
    maintenance_frequency_days: int
    next_maintenance_date: str
    status: str
    notes: str

    class Config:
        from_attributes = True


# ─── Bookings ─────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    instrument_id: int
    user_id: int
    purpose: str
    start_time: str
    end_time: str
    status: BookingStatus = BookingStatus.reserved


class BookingUpdate(BaseModel):
    instrument_id: int | None = None
    user_id: int | None = None
    purpose: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    status: BookingStatus | None = None


class BookingOut(BaseModel):
    id: int
    instrument_id: int
    instrument_name: str | None = None
    user_id: int
    user_name: str | None = None
    purpose: str
    start_time: str
    end_time: str
    status: BookingStatus

    class Config:
        from_attributes = True


# ─── Tasks ────────────────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    due_date: str
    status: TaskStatus = TaskStatus.pending
    assigned_to: int | None = None
    reminder_type: str = "email"
    related_protocol_id: int | None = None
    priority: str = "medium"
    subtasks: str = "[]"
    comments: str = "[]"


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    due_date: str | None = None
    status: TaskStatus | None = None
    assigned_to: int | None = None
    reminder_type: str | None = None
    related_protocol_id: int | None = None
    priority: str | None = None
    subtasks: str | None = None
    comments: str | None = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    due_date: str
    status: TaskStatus
    assigned_to: int | None = None
    assignee_name: str | None = None
    reminder_type: str
    related_protocol_id: int | None = None
    priority: str = "medium"
    subtasks: str = "[]"
    comments: str = "[]"

    class Config:
        from_attributes = True


# ─── Compliance ───────────────────────────────────────────────────────────────

class ComplianceLogCreate(BaseModel):
    title: str
    category: str
    details: str
    logged_by: int | None = None


class ComplianceLogUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    details: str | None = None
    logged_by: int | None = None


class ComplianceLogOut(BaseModel):
    id: int
    title: str
    category: str
    details: str
    logged_by: int | None = None
    logger_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    subject: str
    message: str
    module: str = "general"
    submitted_by: int | None = None


class FeedbackUpdate(BaseModel):
    subject: str | None = None
    message: str | None = None
    module: str | None = None
    status: str | None = None


class FeedbackOut(BaseModel):
    id: int
    subject: str
    message: str
    module: str
    submitted_by: int | None = None
    submitter_name: str | None = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Training ─────────────────────────────────────────────────────────────────

class TrainingRecordCreate(BaseModel):
    user_id: int
    title: str
    instrument_id: int | None = None
    protocol_id: int | None = None
    completed_on: str
    expires_on: str
    status: TrainingStatus = TrainingStatus.active
    notes: str = ""


class TrainingRecordUpdate(BaseModel):
    user_id: int | None = None
    title: str | None = None
    instrument_id: int | None = None
    protocol_id: int | None = None
    completed_on: str | None = None
    expires_on: str | None = None
    status: TrainingStatus | None = None
    notes: str | None = None


class TrainingRecordOut(BaseModel):
    id: int
    user_id: int
    user_name: str | None = None
    title: str
    instrument_id: int | None = None
    instrument_name: str | None = None
    protocol_id: int | None = None
    completed_on: str
    expires_on: str
    status: TrainingStatus
    notes: str

    class Config:
        from_attributes = True


# ─── Inventory ────────────────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    name: str
    category: str
    lot_number: str = ""
    quantity: int = 0
    unit: str = "units"
    reorder_threshold: int = 0
    storage_location: str = ""
    barcode: str = ""
    expires_on: str | None = None
    notes: str = ""
    cas_number: str = ""
    sds_url: str = ""
    hazard_class: str = ""
    storage_temp: str = ""


class InventoryItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    lot_number: str | None = None
    quantity: int | None = None
    unit: str | None = None
    reorder_threshold: int | None = None
    storage_location: str | None = None
    barcode: str | None = None
    expires_on: str | None = None
    notes: str | None = None
    cas_number: str | None = None
    sds_url: str | None = None
    hazard_class: str | None = None
    storage_temp: str | None = None


class InventoryItemOut(BaseModel):
    id: int
    name: str
    category: str
    lot_number: str
    quantity: int
    unit: str
    reorder_threshold: int
    storage_location: str
    barcode: str
    expires_on: str | None = None
    notes: str
    cas_number: str = ""
    sds_url: str = ""
    hazard_class: str = ""
    storage_temp: str = ""

    class Config:
        from_attributes = True


# ─── Incidents ────────────────────────────────────────────────────────────────

class IncidentReportCreate(BaseModel):
    title: str
    area: str
    severity: IncidentSeverity = IncidentSeverity.low
    description: str
    corrective_action: str = ""
    status: str = "open"
    reported_by: int | None = None


class IncidentReportUpdate(BaseModel):
    title: str | None = None
    area: str | None = None
    severity: IncidentSeverity | None = None
    description: str | None = None
    corrective_action: str | None = None
    status: str | None = None
    reported_by: int | None = None


class IncidentReportOut(BaseModel):
    id: int
    title: str
    area: str
    severity: IncidentSeverity
    description: str
    corrective_action: str
    status: str
    reported_by: int | None = None
    reporter_name: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Workspaces ───────────────────────────────────────────────────────────────

class StudyWorkspaceCreate(BaseModel):
    name: str
    field: str
    lead_id: int | None = None
    milestone: str = ""
    status: str = "active"
    description: str = ""


class StudyWorkspaceUpdate(BaseModel):
    name: str | None = None
    field: str | None = None
    lead_id: int | None = None
    milestone: str | None = None
    status: str | None = None
    description: str | None = None


class StudyWorkspaceOut(BaseModel):
    id: int
    name: str
    field: str
    lead_id: int | None = None
    lead_name: str | None = None
    milestone: str
    status: str
    description: str

    class Config:
        from_attributes = True


# ─── Notifications ────────────────────────────────────────────────────────────

class NotificationRuleCreate(BaseModel):
    title: str
    trigger_event: str
    channel: NotificationChannel = NotificationChannel.dashboard
    recipient_role: str = "staff"
    lead_time_hours: int = 24
    is_active: bool = True


class NotificationRuleUpdate(BaseModel):
    title: str | None = None
    trigger_event: str | None = None
    channel: NotificationChannel | None = None
    recipient_role: str | None = None
    lead_time_hours: int | None = None
    is_active: bool | None = None


class NotificationRuleOut(BaseModel):
    id: int
    title: str
    trigger_event: str
    channel: NotificationChannel
    recipient_role: str
    lead_time_hours: int
    is_active: bool

    class Config:
        from_attributes = True


# ─── Samples ──────────────────────────────────────────────────────────────────

class SampleRecordCreate(BaseModel):
    sample_id: str
    barcode: str = ""
    sample_type: str
    source: str = ""
    project_id: int | None = None
    protocol_id: int | None = None
    storage_location: str = ""
    status: SampleStatus = SampleStatus.received
    received_on: str
    owner_id: int | None = None
    notes: str = ""


class SampleRecordUpdate(BaseModel):
    sample_id: str | None = None
    barcode: str | None = None
    sample_type: str | None = None
    source: str | None = None
    project_id: int | None = None
    protocol_id: int | None = None
    storage_location: str | None = None
    status: SampleStatus | None = None
    received_on: str | None = None
    owner_id: int | None = None
    notes: str | None = None


class SampleRecordOut(BaseModel):
    id: int
    sample_id: str
    barcode: str
    sample_type: str
    source: str
    project_id: int | None = None
    project_name: str | None = None
    protocol_id: int | None = None
    protocol_name: str | None = None
    storage_location: str
    status: SampleStatus
    received_on: str
    owner_id: int | None = None
    owner_name: str | None = None
    notes: str

    class Config:
        from_attributes = True


# ─── Sample Events ────────────────────────────────────────────────────────────

class SampleEventCreate(BaseModel):
    sample_record_id: int
    event_type: str
    location: str = ""
    status: str = "logged"
    performed_by: int | None = None
    timestamp: str
    notes: str = ""


class SampleEventUpdate(BaseModel):
    event_type: str | None = None
    location: str | None = None
    status: str | None = None
    performed_by: int | None = None
    timestamp: str | None = None
    notes: str | None = None


class SampleEventOut(BaseModel):
    id: int
    sample_record_id: int
    event_type: str
    location: str
    status: str
    performed_by: int | None = None
    performer_name: str | None = None
    timestamp: str
    notes: str

    class Config:
        from_attributes = True


# ─── Calendar Events ──────────────────────────────────────────────────────────

class CalendarEventCreate(BaseModel):
    title: str
    event_type: str
    start_time: str
    end_time: str
    location: str = ""
    related_instrument_id: int | None = None
    related_task_id: int | None = None
    related_protocol_id: int | None = None
    owner_id: int | None = None
    description: str = ""
    recurrence_rule: str = "none"
    recurrence_end: str | None = None
    attendee_ids: str = ""
    reminder_minutes: int | None = None


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    event_type: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    related_instrument_id: int | None = None
    related_task_id: int | None = None
    related_protocol_id: int | None = None
    owner_id: int | None = None
    description: str | None = None
    recurrence_rule: str | None = None
    recurrence_end: str | None = None
    attendee_ids: str | None = None
    reminder_minutes: int | None = None


class CalendarEventOut(BaseModel):
    id: int
    title: str
    event_type: str
    start_time: str
    end_time: str
    location: str
    related_instrument_id: int | None = None
    related_task_id: int | None = None
    related_protocol_id: int | None = None
    owner_id: int | None = None
    owner_name: str | None = None
    description: str
    recurrence_rule: str = "none"
    recurrence_end: str | None = None
    recurrence_group_id: int | None = None
    attendee_ids: str = ""
    attendee_names: str | None = None
    reminder_minutes: int | None = None

    class Config:
        from_attributes = True


# ─── Reminders ────────────────────────────────────────────────────────────────

class ReminderQueueCreate(BaseModel):
    entity_type: str
    entity_id: int
    title: str
    due_at: str
    channel: NotificationChannel = NotificationChannel.dashboard
    recipient_user_id: int | None = None
    recipient_role: str = "staff"
    message: str = ""


class ReminderQueueUpdate(BaseModel):
    title: str | None = None
    due_at: str | None = None
    channel: NotificationChannel | None = None
    recipient_user_id: int | None = None
    recipient_role: str | None = None
    status: ReminderStatus | None = None
    message: str | None = None


class ReminderQueueOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    title: str
    due_at: str
    channel: NotificationChannel
    recipient_user_id: int | None = None
    recipient_role: str
    status: ReminderStatus
    last_attempt_at: str | None = None
    message: str

    class Config:
        from_attributes = True


# ─── Attachments ──────────────────────────────────────────────────────────────

class AttachmentOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    filename: str
    filepath: str
    uploaded_by: int | None = None
    uploader_name: str | None = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    action: AuditAction
    entity_type: str
    entity_id: int | None = None
    user_id: int | None = None
    user_email: str
    changes_json: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ─── Dashboard ────────────────────────────────────────────────────────────────

class WeekCount(BaseModel):
    week: str
    count: int


class DashboardSummary(BaseModel):
    protocols: int
    instruments: int
    bookings: int
    tasks_open: int
    compliance_logs: int
    feedback_open: int
    upcoming_maintenance: int
    overdue_tasks: int
    training_records: int
    inventory_items: int
    incident_reports: int
    workspaces: int
    notification_rules: int
    samples: int
    sample_events: int
    calendar_events: int
    reminders_pending: int
    low_stock_items: int
    samples_by_status: dict[str, int]
    tasks_by_status: dict[str, int]
    incidents_by_severity: dict[str, int]
    sample_intake_by_week: list[WeekCount]
    audit_recent: list[AuditLogOut]


# ─── SOPs ────────────────────────────────────────────────────────────────────

class SOPCreate(BaseModel):
    title: str
    code: str
    category: str
    version: str = "1.0"
    description: str = ""
    content: str = ""
    effective_date: str | None = None
    review_date: str | None = None
    author_id: int | None = None
    approver_id: int | None = None


class SOPUpdate(BaseModel):
    title: str | None = None
    code: str | None = None
    category: str | None = None
    version: str | None = None
    status: SOPStatus | None = None
    description: str | None = None
    content: str | None = None
    effective_date: str | None = None
    review_date: str | None = None
    author_id: int | None = None
    approver_id: int | None = None


class SOPOut(BaseModel):
    id: int
    title: str
    code: str
    category: str
    version: str
    status: SOPStatus
    description: str
    content: str
    effective_date: str | None = None
    review_date: str | None = None
    author_id: int | None = None
    author_name: str | None = None
    approver_id: int | None = None
    approver_name: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Maintenance Logs ────────────────────────────────────────────────────────

class MaintenanceLogCreate(BaseModel):
    instrument_id: int
    type: MaintenanceType = MaintenanceType.preventive
    title: str
    description: str = ""
    scheduled_date: str
    performed_by: int | None = None
    parts_replaced: str = ""
    cost: float = 0.0
    notes: str = ""


class MaintenanceLogUpdate(BaseModel):
    instrument_id: int | None = None
    type: MaintenanceType | None = None
    status: MaintenanceStatus | None = None
    title: str | None = None
    description: str | None = None
    scheduled_date: str | None = None
    completed_date: str | None = None
    performed_by: int | None = None
    parts_replaced: str | None = None
    cost: float | None = None
    notes: str | None = None


class MaintenanceLogOut(BaseModel):
    id: int
    instrument_id: int
    instrument_name: str | None = None
    type: MaintenanceType
    status: MaintenanceStatus
    title: str
    description: str
    scheduled_date: str
    completed_date: str | None = None
    performed_by: int | None = None
    technician_name: str | None = None
    parts_replaced: str
    cost: float
    notes: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Document Templates ──────────────────────────────────────────────────────

class DocumentTemplateCreate(BaseModel):
    name: str
    category: TemplateCategory
    description: str = ""
    content: str = ""
    variables: str = "[]"
    created_by: int | None = None


class DocumentTemplateUpdate(BaseModel):
    name: str | None = None
    category: TemplateCategory | None = None
    description: str | None = None
    content: str | None = None
    variables: str | None = None
    is_active: bool | None = None


class DocumentTemplateOut(BaseModel):
    id: int
    name: str
    category: TemplateCategory
    description: str
    content: str
    variables: str
    is_active: bool
    created_by: int | None = None
    creator_name: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Cost Entries ────────────────────────────────────────────────────────────

class CostEntryCreate(BaseModel):
    category: CostCategory
    description: str
    amount: float
    project: str = ""
    vendor: str = ""
    date: str
    submitted_by: int | None = None
    receipt_path: str = ""
    notes: str = ""


class CostEntryUpdate(BaseModel):
    category: CostCategory | None = None
    description: str | None = None
    amount: float | None = None
    project: str | None = None
    vendor: str | None = None
    date: str | None = None
    status: CostStatus | None = None
    approved_by: int | None = None
    approved_date: str | None = None
    receipt_path: str | None = None
    notes: str | None = None


class CostEntryOut(BaseModel):
    id: int
    category: CostCategory
    description: str
    amount: float
    project: str
    vendor: str
    date: str
    status: CostStatus
    submitted_by: int | None = None
    submitter_name: str | None = None
    approved_by: int | None = None
    approver_name: str | None = None
    approved_date: str | None = None
    receipt_path: str
    notes: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Integrations ────────────────────────────────────────────────────────────

class IntegrationCreate(BaseModel):
    name: str
    category: str
    description: str = ""
    api_endpoint: str = ""
    config_json: str = "{}"


class IntegrationUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    api_endpoint: str | None = None
    api_key: str | None = None
    config_json: str | None = None
    status: str | None = None
    last_sync_at: str | None = None


class IntegrationOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    api_endpoint: str
    config_json: str
    status: str
    last_sync_at: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Lab Settings ────────────────────────────────────────────────────────────

class LabSettingCreate(BaseModel):
    key: str
    value: str
    category: str = "general"
    description: str = ""


class LabSettingUpdate(BaseModel):
    value: str | None = None
    category: str | None = None
    description: str | None = None


class LabSettingOut(BaseModel):
    id: int
    key: str
    value: str
    category: str
    description: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Activity Timeline ───────────────────────────────────────────────────────

class ActivityTimelineItem(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int | None = None
    entity_name: str
    user_id: int | None = None
    user_name: str
    timestamp: datetime
    details: str = ""


# ─── Lab Meetings ────────────────────────────────────────────────────────────

class LabMeetingCreate(BaseModel):
    title: str
    type: MeetingType = MeetingType.weekly
    scheduled_at: str
    end_time: str
    location: str = ""
    video_link: str | None = None
    description: str = ""
    is_recurring: bool = False
    recurring_pattern: str | None = None
    agenda_json: str = "[]"
    attendees_json: str = "[]"
    tags: str = ""


class LabMeetingUpdate(BaseModel):
    title: str | None = None
    type: MeetingType | None = None
    status: MeetingStatus | None = None
    scheduled_at: str | None = None
    end_time: str | None = None
    location: str | None = None
    video_link: str | None = None
    description: str | None = None
    is_recurring: bool | None = None
    recurring_pattern: str | None = None
    agenda_json: str | None = None
    attendees_json: str | None = None
    minutes: str | None = None
    minutes_published: bool | None = None
    minutes_published_at: str | None = None
    tags: str | None = None


class LabNotebookEntryCreate(BaseModel):
    title: str
    content: str = ""
    experiment_type: str = ""
    tags: str = ""
    linked_sample_id: int | None = None
    linked_protocol_id: int | None = None


class LabNotebookEntryUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    experiment_type: str | None = None
    tags: str | None = None
    linked_sample_id: int | None = None
    linked_protocol_id: int | None = None
    is_archived: bool | None = None


class LabNotebookEntryOut(BaseModel):
    id: int
    title: str
    content: str
    experiment_type: str
    tags: str
    linked_sample_id: int | None = None
    linked_protocol_id: int | None = None
    author_id: int
    author_name: str | None = None
    signed_at: str | None = None
    witnessed_by_id: int | None = None
    witnessed_at: str | None = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LabMeetingOut(BaseModel):
    id: int
    title: str
    type: MeetingType
    status: MeetingStatus
    scheduled_at: str
    end_time: str
    location: str
    video_link: str | None = None
    description: str
    is_recurring: bool
    recurring_pattern: str | None = None
    organizer_id: int | None = None
    organizer_name: str | None = None
    agenda_json: str
    attendees_json: str
    minutes: str
    minutes_published: bool
    minutes_published_at: str | None = None
    tags: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DisposalLogCreate(BaseModel):
    inventory_item_id: int | None = None
    reagent_name: str
    lot_number: str = ""
    quantity_disposed: str
    disposal_method: str
    hazard_class: str = ""
    reason: str = ""
    witness_id: int | None = None
    notes: str = ""


class DisposalLogOut(BaseModel):
    id: int
    inventory_item_id: int | None = None
    reagent_name: str
    lot_number: str
    quantity_disposed: str
    disposal_method: str
    hazard_class: str
    reason: str
    disposed_by: int | None = None
    witness_id: int | None = None
    notes: str
    disposed_at: datetime

    class Config:
        from_attributes = True


class CapaCreate(BaseModel):
    title: str
    description: str = ""
    root_cause: str = ""
    corrective_action: str = ""
    preventive_action: str = ""
    source: str = ""
    reference_id: str = ""
    severity: str = "minor"
    assigned_to: int | None = None
    due_date: str = ""
    notes: str = ""


class CapaUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    root_cause: str | None = None
    corrective_action: str | None = None
    preventive_action: str | None = None
    source: str | None = None
    reference_id: str | None = None
    severity: str | None = None
    status: str | None = None
    assigned_to: int | None = None
    due_date: str | None = None
    verification_notes: str | None = None


class CapaOut(BaseModel):
    id: int
    title: str
    description: str
    root_cause: str
    corrective_action: str
    preventive_action: str
    source: str
    reference_id: str
    severity: str
    status: str
    assigned_to: int | None = None
    created_by: int | None = None
    due_date: str
    closed_at: datetime | None = None
    verification_notes: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReferenceCreate(BaseModel):
    pmid: str = ""
    doi: str = ""
    title: str
    authors: list[str] = []
    journal: str = ""
    year: int | None = None
    volume: str = ""
    issue: str = ""
    pages: str = ""
    abstract: str = ""
    tags: list[str] = []
    folder: str = "Unfiled"
    notes: str = ""
    citations: int = 0


class ReferenceUpdate(BaseModel):
    title: str | None = None
    authors: list[str] | None = None
    journal: str | None = None
    year: int | None = None
    volume: str | None = None
    issue: str | None = None
    pages: str | None = None
    abstract: str | None = None
    tags: list[str] | None = None
    folder: str | None = None
    is_favorite: bool | None = None
    notes: str | None = None
    doi: str | None = None


class ReferenceOut(BaseModel):
    id: int
    pmid: str
    doi: str
    title: str
    authors: list[str]
    journal: str
    year: int | None = None
    volume: str
    issue: str
    pages: str
    abstract: str
    tags: list[str]
    folder: str
    is_favorite: bool
    notes: str
    citations: int
    created_by: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        import json
        if hasattr(obj, "authors") and isinstance(obj.authors, str):
            try:
                obj.authors = json.loads(obj.authors)
            except Exception:
                obj.authors = [a.strip() for a in obj.authors.split(",") if a.strip()]
        if hasattr(obj, "tags") and isinstance(obj.tags, str):
            try:
                obj.tags = json.loads(obj.tags)
            except Exception:
                obj.tags = [t.strip() for t in obj.tags.split(",") if t.strip()]
        return super().model_validate(obj, *args, **kwargs)


class OrgCreate(BaseModel):
    name: str
    short_code: str = ""
    description: str = ""
    country: str = ""
    city: str = ""
    address: str = ""
    contact_email: str = ""
    website: str = ""


class OrgOut(BaseModel):
    id: int
    name: str
    short_code: str
    description: str
    country: str
    city: str
    address: str
    contact_email: str
    website: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


class SiteCreate(BaseModel):
    organization_id: int
    name: str
    code: str = ""
    site_type: str = "lab"
    country: str = ""
    city: str = ""
    address: str = ""
    timezone: str = "UTC"
    contact_name: str = ""
    contact_email: str = ""


class SiteOut(BaseModel):
    id: int
    organization_id: int
    name: str
    code: str
    site_type: str
    country: str
    city: str
    address: str
    timezone: str
    contact_name: str
    contact_email: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True


class LabUnitCreate(BaseModel):
    site_id: int
    name: str
    code: str = ""
    lab_type: str = "research"
    pi_user_id: int | None = None
    capacity_persons: int = 0
    notes: str = ""


class LabUnitOut(BaseModel):
    id: int
    site_id: int
    name: str
    code: str
    lab_type: str
    pi_user_id: int | None = None
    capacity_persons: int
    notes: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True
