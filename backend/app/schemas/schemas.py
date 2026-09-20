from datetime import datetime
from typing import Generic, Optional, TypeVar

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
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


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
    owner_id: Optional[int] = None
    reminder_days_before: int = 3
    steps: list[WorkflowStepCreate] = []


class ProtocolUpdate(BaseModel):
    title: Optional[str] = None
    field: Optional[str] = None
    version: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[int] = None
    reminder_days_before: Optional[int] = None
    steps: Optional[list[WorkflowStepCreate]] = None


class ProtocolOut(BaseModel):
    id: int
    title: str
    field: str
    version: str
    description: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
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
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    maintenance_frequency_days: Optional[int] = None
    next_maintenance_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


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
    instrument_id: Optional[int] = None
    user_id: Optional[int] = None
    purpose: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[BookingStatus] = None


class BookingOut(BaseModel):
    id: int
    instrument_id: int
    instrument_name: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
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
    assigned_to: Optional[int] = None
    reminder_type: str = "email"
    related_protocol_id: Optional[int] = None
    priority: str = "medium"
    subtasks: str = "[]"
    comments: str = "[]"


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[int] = None
    reminder_type: Optional[str] = None
    related_protocol_id: Optional[int] = None
    priority: Optional[str] = None
    subtasks: Optional[str] = None
    comments: Optional[str] = None


class TaskOut(BaseModel):
    id: int
    title: str
    description: str
    due_date: str
    status: TaskStatus
    assigned_to: Optional[int] = None
    assignee_name: Optional[str] = None
    reminder_type: str
    related_protocol_id: Optional[int] = None
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
    logged_by: Optional[int] = None


class ComplianceLogUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    details: Optional[str] = None
    logged_by: Optional[int] = None


class ComplianceLogOut(BaseModel):
    id: int
    title: str
    category: str
    details: str
    logged_by: Optional[int] = None
    logger_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Feedback ─────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    subject: str
    message: str
    module: str = "general"
    submitted_by: Optional[int] = None


class FeedbackUpdate(BaseModel):
    subject: Optional[str] = None
    message: Optional[str] = None
    module: Optional[str] = None
    status: Optional[str] = None


class FeedbackOut(BaseModel):
    id: int
    subject: str
    message: str
    module: str
    submitted_by: Optional[int] = None
    submitter_name: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Training ─────────────────────────────────────────────────────────────────

class TrainingRecordCreate(BaseModel):
    user_id: int
    title: str
    instrument_id: Optional[int] = None
    protocol_id: Optional[int] = None
    completed_on: str
    expires_on: str
    status: TrainingStatus = TrainingStatus.active
    notes: str = ""


class TrainingRecordUpdate(BaseModel):
    user_id: Optional[int] = None
    title: Optional[str] = None
    instrument_id: Optional[int] = None
    protocol_id: Optional[int] = None
    completed_on: Optional[str] = None
    expires_on: Optional[str] = None
    status: Optional[TrainingStatus] = None
    notes: Optional[str] = None


class TrainingRecordOut(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    title: str
    instrument_id: Optional[int] = None
    instrument_name: Optional[str] = None
    protocol_id: Optional[int] = None
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
    expires_on: Optional[str] = None
    notes: str = ""
    cas_number: str = ""
    sds_url: str = ""
    hazard_class: str = ""
    storage_temp: str = ""


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    lot_number: Optional[str] = None
    quantity: Optional[int] = None
    unit: Optional[str] = None
    reorder_threshold: Optional[int] = None
    storage_location: Optional[str] = None
    barcode: Optional[str] = None
    expires_on: Optional[str] = None
    notes: Optional[str] = None
    cas_number: Optional[str] = None
    sds_url: Optional[str] = None
    hazard_class: Optional[str] = None
    storage_temp: Optional[str] = None


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
    expires_on: Optional[str] = None
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
    reported_by: Optional[int] = None


class IncidentReportUpdate(BaseModel):
    title: Optional[str] = None
    area: Optional[str] = None
    severity: Optional[IncidentSeverity] = None
    description: Optional[str] = None
    corrective_action: Optional[str] = None
    status: Optional[str] = None
    reported_by: Optional[int] = None


class IncidentReportOut(BaseModel):
    id: int
    title: str
    area: str
    severity: IncidentSeverity
    description: str
    corrective_action: str
    status: str
    reported_by: Optional[int] = None
    reporter_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Workspaces ───────────────────────────────────────────────────────────────

class StudyWorkspaceCreate(BaseModel):
    name: str
    field: str
    lead_id: Optional[int] = None
    milestone: str = ""
    status: str = "active"
    description: str = ""


class StudyWorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    field: Optional[str] = None
    lead_id: Optional[int] = None
    milestone: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None


class StudyWorkspaceOut(BaseModel):
    id: int
    name: str
    field: str
    lead_id: Optional[int] = None
    lead_name: Optional[str] = None
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
    title: Optional[str] = None
    trigger_event: Optional[str] = None
    channel: Optional[NotificationChannel] = None
    recipient_role: Optional[str] = None
    lead_time_hours: Optional[int] = None
    is_active: Optional[bool] = None


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
    project_id: Optional[int] = None
    protocol_id: Optional[int] = None
    storage_location: str = ""
    status: SampleStatus = SampleStatus.received
    received_on: str
    owner_id: Optional[int] = None
    notes: str = ""


class SampleRecordUpdate(BaseModel):
    sample_id: Optional[str] = None
    barcode: Optional[str] = None
    sample_type: Optional[str] = None
    source: Optional[str] = None
    project_id: Optional[int] = None
    protocol_id: Optional[int] = None
    storage_location: Optional[str] = None
    status: Optional[SampleStatus] = None
    received_on: Optional[str] = None
    owner_id: Optional[int] = None
    notes: Optional[str] = None


class SampleRecordOut(BaseModel):
    id: int
    sample_id: str
    barcode: str
    sample_type: str
    source: str
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    protocol_id: Optional[int] = None
    protocol_name: Optional[str] = None
    storage_location: str
    status: SampleStatus
    received_on: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    notes: str

    class Config:
        from_attributes = True


# ─── Sample Events ────────────────────────────────────────────────────────────

class SampleEventCreate(BaseModel):
    sample_record_id: int
    event_type: str
    location: str = ""
    status: str = "logged"
    performed_by: Optional[int] = None
    timestamp: str
    notes: str = ""


class SampleEventUpdate(BaseModel):
    event_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    performed_by: Optional[int] = None
    timestamp: Optional[str] = None
    notes: Optional[str] = None


class SampleEventOut(BaseModel):
    id: int
    sample_record_id: int
    event_type: str
    location: str
    status: str
    performed_by: Optional[int] = None
    performer_name: Optional[str] = None
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
    related_instrument_id: Optional[int] = None
    related_task_id: Optional[int] = None
    related_protocol_id: Optional[int] = None
    owner_id: Optional[int] = None
    description: str = ""
    recurrence_rule: str = "none"
    recurrence_end: Optional[str] = None
    attendee_ids: str = ""
    reminder_minutes: Optional[int] = None


class CalendarEventUpdate(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    related_instrument_id: Optional[int] = None
    related_task_id: Optional[int] = None
    related_protocol_id: Optional[int] = None
    owner_id: Optional[int] = None
    description: Optional[str] = None
    recurrence_rule: Optional[str] = None
    recurrence_end: Optional[str] = None
    attendee_ids: Optional[str] = None
    reminder_minutes: Optional[int] = None


class CalendarEventOut(BaseModel):
    id: int
    title: str
    event_type: str
    start_time: str
    end_time: str
    location: str
    related_instrument_id: Optional[int] = None
    related_task_id: Optional[int] = None
    related_protocol_id: Optional[int] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    description: str
    recurrence_rule: str = "none"
    recurrence_end: Optional[str] = None
    recurrence_group_id: Optional[int] = None
    attendee_ids: str = ""
    attendee_names: Optional[str] = None
    reminder_minutes: Optional[int] = None

    class Config:
        from_attributes = True


# ─── Reminders ────────────────────────────────────────────────────────────────

class ReminderQueueCreate(BaseModel):
    entity_type: str
    entity_id: int
    title: str
    due_at: str
    channel: NotificationChannel = NotificationChannel.dashboard
    recipient_user_id: Optional[int] = None
    recipient_role: str = "staff"
    message: str = ""


class ReminderQueueUpdate(BaseModel):
    title: Optional[str] = None
    due_at: Optional[str] = None
    channel: Optional[NotificationChannel] = None
    recipient_user_id: Optional[int] = None
    recipient_role: Optional[str] = None
    status: Optional[ReminderStatus] = None
    message: Optional[str] = None


class ReminderQueueOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    title: str
    due_at: str
    channel: NotificationChannel
    recipient_user_id: Optional[int] = None
    recipient_role: str
    status: ReminderStatus
    last_attempt_at: Optional[str] = None
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
    uploaded_by: Optional[int] = None
    uploader_name: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ─── Audit ────────────────────────────────────────────────────────────────────

class AuditLogOut(BaseModel):
    id: int
    action: AuditAction
    entity_type: str
    entity_id: Optional[int] = None
    user_id: Optional[int] = None
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
    effective_date: Optional[str] = None
    review_date: Optional[str] = None
    author_id: Optional[int] = None
    approver_id: Optional[int] = None


class SOPUpdate(BaseModel):
    title: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    version: Optional[str] = None
    status: Optional[SOPStatus] = None
    description: Optional[str] = None
    content: Optional[str] = None
    effective_date: Optional[str] = None
    review_date: Optional[str] = None
    author_id: Optional[int] = None
    approver_id: Optional[int] = None


class SOPOut(BaseModel):
    id: int
    title: str
    code: str
    category: str
    version: str
    status: SOPStatus
    description: str
    content: str
    effective_date: Optional[str] = None
    review_date: Optional[str] = None
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    approver_id: Optional[int] = None
    approver_name: Optional[str] = None
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
    performed_by: Optional[int] = None
    parts_replaced: str = ""
    cost: float = 0.0
    notes: str = ""


class MaintenanceLogUpdate(BaseModel):
    instrument_id: Optional[int] = None
    type: Optional[MaintenanceType] = None
    status: Optional[MaintenanceStatus] = None
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_date: Optional[str] = None
    completed_date: Optional[str] = None
    performed_by: Optional[int] = None
    parts_replaced: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None


class MaintenanceLogOut(BaseModel):
    id: int
    instrument_id: int
    instrument_name: Optional[str] = None
    type: MaintenanceType
    status: MaintenanceStatus
    title: str
    description: str
    scheduled_date: str
    completed_date: Optional[str] = None
    performed_by: Optional[int] = None
    technician_name: Optional[str] = None
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
    created_by: Optional[int] = None


class DocumentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[TemplateCategory] = None
    description: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[str] = None
    is_active: Optional[bool] = None


class DocumentTemplateOut(BaseModel):
    id: int
    name: str
    category: TemplateCategory
    description: str
    content: str
    variables: str
    is_active: bool
    created_by: Optional[int] = None
    creator_name: Optional[str] = None
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
    submitted_by: Optional[int] = None
    receipt_path: str = ""
    notes: str = ""


class CostEntryUpdate(BaseModel):
    category: Optional[CostCategory] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    project: Optional[str] = None
    vendor: Optional[str] = None
    date: Optional[str] = None
    status: Optional[CostStatus] = None
    approved_by: Optional[int] = None
    approved_date: Optional[str] = None
    receipt_path: Optional[str] = None
    notes: Optional[str] = None


class CostEntryOut(BaseModel):
    id: int
    category: CostCategory
    description: str
    amount: float
    project: str
    vendor: str
    date: str
    status: CostStatus
    submitted_by: Optional[int] = None
    submitter_name: Optional[str] = None
    approved_by: Optional[int] = None
    approver_name: Optional[str] = None
    approved_date: Optional[str] = None
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
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    config_json: Optional[str] = None
    status: Optional[str] = None
    last_sync_at: Optional[str] = None


class IntegrationOut(BaseModel):
    id: int
    name: str
    category: str
    description: str
    api_endpoint: str
    config_json: str
    status: str
    last_sync_at: Optional[str] = None
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
    value: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


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
    entity_id: Optional[int] = None
    entity_name: str
    user_id: Optional[int] = None
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
    video_link: Optional[str] = None
    description: str = ""
    is_recurring: bool = False
    recurring_pattern: Optional[str] = None
    agenda_json: str = "[]"
    attendees_json: str = "[]"
    tags: str = ""


class LabMeetingUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[MeetingType] = None
    status: Optional[MeetingStatus] = None
    scheduled_at: Optional[str] = None
    end_time: Optional[str] = None
    location: Optional[str] = None
    video_link: Optional[str] = None
    description: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_pattern: Optional[str] = None
    agenda_json: Optional[str] = None
    attendees_json: Optional[str] = None
    minutes: Optional[str] = None
    minutes_published: Optional[bool] = None
    minutes_published_at: Optional[str] = None
    tags: Optional[str] = None


class LabNotebookEntryCreate(BaseModel):
    title: str
    content: str = ""
    experiment_type: str = ""
    tags: str = ""
    linked_sample_id: Optional[int] = None
    linked_protocol_id: Optional[int] = None


class LabNotebookEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    experiment_type: Optional[str] = None
    tags: Optional[str] = None
    linked_sample_id: Optional[int] = None
    linked_protocol_id: Optional[int] = None
    is_archived: Optional[bool] = None


class LabNotebookEntryOut(BaseModel):
    id: int
    title: str
    content: str
    experiment_type: str
    tags: str
    linked_sample_id: Optional[int] = None
    linked_protocol_id: Optional[int] = None
    author_id: int
    author_name: Optional[str] = None
    signed_at: Optional[str] = None
    witnessed_by_id: Optional[int] = None
    witnessed_at: Optional[str] = None
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
    video_link: Optional[str] = None
    description: str
    is_recurring: bool
    recurring_pattern: Optional[str] = None
    organizer_id: Optional[int] = None
    organizer_name: Optional[str] = None
    agenda_json: str
    attendees_json: str
    minutes: str
    minutes_published: bool
    minutes_published_at: Optional[str] = None
    tags: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DisposalLogCreate(BaseModel):
    inventory_item_id: Optional[int] = None
    reagent_name: str
    lot_number: str = ""
    quantity_disposed: str
    disposal_method: str
    hazard_class: str = ""
    reason: str = ""
    witness_id: Optional[int] = None
    notes: str = ""


class DisposalLogOut(BaseModel):
    id: int
    inventory_item_id: Optional[int] = None
    reagent_name: str
    lot_number: str
    quantity_disposed: str
    disposal_method: str
    hazard_class: str
    reason: str
    disposed_by: Optional[int] = None
    witness_id: Optional[int] = None
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
    assigned_to: Optional[int] = None
    due_date: str = ""
    notes: str = ""


class CapaUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    root_cause: Optional[str] = None
    corrective_action: Optional[str] = None
    preventive_action: Optional[str] = None
    source: Optional[str] = None
    reference_id: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None
    verification_notes: Optional[str] = None


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
    assigned_to: Optional[int] = None
    created_by: Optional[int] = None
    due_date: str
    closed_at: Optional[datetime] = None
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
    year: Optional[int] = None
    volume: str = ""
    issue: str = ""
    pages: str = ""
    abstract: str = ""
    tags: list[str] = []
    folder: str = "Unfiled"
    notes: str = ""
    citations: int = 0


class ReferenceUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    journal: Optional[str] = None
    year: Optional[int] = None
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    abstract: Optional[str] = None
    tags: Optional[list[str]] = None
    folder: Optional[str] = None
    is_favorite: Optional[bool] = None
    notes: Optional[str] = None
    doi: Optional[str] = None


class ReferenceOut(BaseModel):
    id: int
    pmid: str
    doi: str
    title: str
    authors: list[str]
    journal: str
    year: Optional[int] = None
    volume: str
    issue: str
    pages: str
    abstract: str
    tags: list[str]
    folder: str
    is_favorite: bool
    notes: str
    citations: int
    created_by: Optional[int] = None
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
    pi_user_id: Optional[int] = None
    capacity_persons: int = 0
    notes: str = ""


class LabUnitOut(BaseModel):
    id: int
    site_id: int
    name: str
    code: str
    lab_type: str
    pi_user_id: Optional[int] = None
    capacity_persons: int
    notes: str
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True
