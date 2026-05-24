from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRole(str, Enum):
    superadmin = "superadmin"
    admin = "admin"
    pi = "pi"
    manager = "manager"
    staff = "staff"
    trainee = "trainee"


ROLE_HIERARCHY = {
    UserRole.superadmin: 6,
    UserRole.admin: 5,
    UserRole.pi: 4,
    UserRole.manager: 3,
    UserRole.staff: 2,
    UserRole.trainee: 1,
}


class SOPStatus(str, Enum):
    draft = "draft"
    review = "review"
    approved = "approved"
    archived = "archived"


class MaintenanceType(str, Enum):
    preventive = "preventive"
    corrective = "corrective"
    calibration = "calibration"
    inspection = "inspection"


class MaintenanceStatus(str, Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"


class CostCategory(str, Enum):
    reagents = "reagents"
    equipment = "equipment"
    maintenance = "maintenance"
    services = "services"
    personnel = "personnel"
    other = "other"


class CostStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    paid = "paid"
    rejected = "rejected"


class TemplateCategory(str, Enum):
    protocol = "protocol"
    report = "report"
    form = "form"
    checklist = "checklist"


class MeetingType(str, Enum):
    weekly = "weekly"
    journal_club = "journal_club"
    lab_retreat = "lab_retreat"
    one_on_one = "one_on_one"
    progress_report = "progress_report"
    special = "special"


class SupplierCategory(str, Enum):
    chemicals = "Chemicals, Reagents & Life Science Consumables"
    antibodies = "Antibodies, Proteins & Immunoassays"
    assays = "Assays, Kits & Molecular Diagnostics"
    instruments = "Instruments & Laboratory Equipment"
    clinical = "Clinical, Hospital & Lab Supply Companies"


class SupplierApprovalStatus(str, Enum):
    pending = "pending"
    review = "review"
    approved = "approved"
    rejected = "rejected"


class ProcurementPriority(str, Enum):
    high = "High"
    medium = "Medium"
    low = "Low"
    specialty = "Specialty"


class BudgetTier(str, Enum):
    premium = "Premium"
    mid_market = "Mid-market"
    economy = "Economy"


class PurchaseOrderStatus(str, Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    ordered = "ordered"
    shipped = "shipped"
    received = "received"
    cancelled = "cancelled"


class MeetingStatus(str, Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"


class BookingStatus(str, Enum):
    reserved = "reserved"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class TrainingStatus(str, Enum):
    active = "active"
    expired = "expired"
    pending = "pending"


class IncidentSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class NotificationChannel(str, Enum):
    dashboard = "dashboard"
    email = "email"
    sms = "sms"


class SampleStatus(str, Enum):
    received = "received"
    processing = "processing"
    stored = "stored"
    sequenced = "sequenced"
    archived = "archived"
    disposed = "disposed"


class ReminderStatus(str, Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class AuditAction(str, Enum):
    create = "create"
    update = "update"
    delete = "delete"


# ─── Security classification & clearance ─────────────────────────────────────

class DataClassification(str, Enum):
    public       = "public"        # No access restriction
    internal     = "internal"      # Lab members only
    confidential = "confidential"  # Managers + above
    restricted   = "restricted"    # PI + above
    phi          = "phi"           # HIPAA PHI — admin + designated staff only

# Clearance → minimum role required to access each classification
CLASSIFICATION_MIN_ROLE: dict[str, str] = {
    "public":       "trainee",
    "internal":     "staff",
    "confidential": "manager",
    "restricted":   "pi",
    "phi":          "admin",
}

CLASSIFICATION_LABELS = {
    "public":       ("Public",       "#22c55e", "🟢"),
    "internal":     ("Internal",     "#3b82f6", "🔵"),
    "confidential": ("Confidential", "#f59e0b", "🟡"),
    "restricted":   ("Restricted",   "#ef4444", "🔴"),
    "phi":          ("PHI",          "#8b5cf6", "🟣"),
}


class SecurityClearance(str, Enum):
    level_1 = "level_1"   # General — public resources only
    level_2 = "level_2"   # Researcher — internal resources
    level_3 = "level_3"   # Senior — confidential resources
    level_4 = "level_4"   # Lead / PI — restricted resources
    level_5 = "level_5"   # Admin — all including PHI

CLEARANCE_LABELS = {
    "level_1": ("L1 General",    "#6b7280"),
    "level_2": ("L2 Researcher", "#3b82f6"),
    "level_3": ("L3 Senior",     "#f59e0b"),
    "level_4": ("L4 Lead",       "#ef4444"),
    "level_5": ("L5 Admin",      "#8b5cf6"),
}

# Default clearance for each role
ROLE_DEFAULT_CLEARANCE: dict[str, str] = {
    "superadmin": "level_5",
    "admin":      "level_5",
    "pi":         "level_4",
    "manager":    "level_3",
    "staff":      "level_2",
    "trainee":    "level_1",
}


class SecurityEventType(str, Enum):
    login_success      = "login_success"
    login_failed       = "login_failed"
    login_locked       = "login_locked"
    logout             = "logout"
    mfa_success        = "mfa_success"
    mfa_failed         = "mfa_failed"
    mfa_enabled        = "mfa_enabled"
    mfa_disabled       = "mfa_disabled"
    password_changed   = "password_changed"
    permission_denied  = "permission_denied"
    clearance_changed  = "clearance_changed"
    classification_set = "classification_set"
    data_export        = "data_export"
    erasure_request    = "erasure_request"
    session_revoked    = "session_revoked"
    suspicious_access  = "suspicious_access"


class SecurityEventSeverity(str, Enum):
    info     = "info"
    warning  = "warning"
    critical = "critical"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(SqlEnum(UserRole), default=UserRole.staff)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Security / lockout
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    # Security clearance
    security_clearance: Mapped[SecurityClearance] = mapped_column(
        SqlEnum(SecurityClearance), default=SecurityClearance.level_1
    )
    # MFA (TOTP)
    totp_secret: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_backup_codes: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of hashed codes


class Protocol(Base):
    __tablename__ = "protocols"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    field: Mapped[str] = mapped_column(String(120), index=True)
    version: Mapped[str] = mapped_column(String(40), default="1.0")
    description: Mapped[str] = mapped_column(Text)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reminder_days_before: Mapped[int] = mapped_column(Integer, default=3)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    steps: Mapped[list["WorkflowStep"]] = relationship(
        back_populates="protocol", cascade="all, delete-orphan"
    )
    owner: Mapped["User | None"] = relationship("User", foreign_keys=[owner_id])


class ProtocolVersion(Base):
    __tablename__ = "protocol_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    protocol_id: Mapped[int] = mapped_column(ForeignKey("protocols.id"))
    version: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text, default="")
    change_summary: Mapped[str] = mapped_column(String(500), default="")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    protocol: Mapped["Protocol"] = relationship("Protocol", foreign_keys=[protocol_id])
    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class WorkflowStep(Base):
    __tablename__ = "workflow_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    protocol_id: Mapped[int] = mapped_column(ForeignKey("protocols.id"))
    step_order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    instructions: Mapped[str] = mapped_column(Text)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=15)
    requires_signoff: Mapped[bool] = mapped_column(Boolean, default=False)

    protocol: Mapped[Protocol] = relationship(back_populates="steps")


class Instrument(Base):
    __tablename__ = "instruments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(255))
    maintenance_frequency_days: Mapped[int] = mapped_column(Integer, default=30)
    next_maintenance_date: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(50), default="available")
    notes: Mapped[str] = mapped_column(Text, default="")


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    purpose: Mapped[str] = mapped_column(String(255))
    start_time: Mapped[str] = mapped_column(String(50), index=True)
    end_time: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[BookingStatus] = mapped_column(SqlEnum(BookingStatus), default=BookingStatus.reserved)

    instrument: Mapped["Instrument"] = relationship("Instrument")
    user: Mapped["User"] = relationship("User")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    due_date: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[TaskStatus] = mapped_column(SqlEnum(TaskStatus), default=TaskStatus.pending)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reminder_type: Mapped[str] = mapped_column(String(50), default="email")
    related_protocol_id: Mapped[int | None] = mapped_column(ForeignKey("protocols.id"), nullable=True)
    # Feature 1: priority
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    # Feature 4: subtasks as JSON array string
    subtasks: Mapped[str] = mapped_column(Text, default="[]")
    # Feature 5: comments as JSON array string
    comments: Mapped[str] = mapped_column(Text, default="[]")

    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_to])


class ComplianceLog(Base):
    __tablename__ = "compliance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100), index=True)
    details: Mapped[str] = mapped_column(Text)
    logged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    logger: Mapped["User | None"] = relationship("User", foreign_keys=[logged_by])


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subject: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    module: Mapped[str] = mapped_column(String(100), default="general")
    submitted_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    submitter: Mapped["User | None"] = relationship("User", foreign_keys=[submitted_by])


class TrainingRecord(Base):
    __tablename__ = "training_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255), index=True)
    instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True)
    protocol_id: Mapped[int | None] = mapped_column(ForeignKey("protocols.id"), nullable=True)
    completed_on: Mapped[str] = mapped_column(String(50))
    expires_on: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[TrainingStatus] = mapped_column(SqlEnum(TrainingStatus), default=TrainingStatus.active)
    notes: Mapped[str] = mapped_column(Text, default="")

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    instrument: Mapped["Instrument | None"] = relationship("Instrument", foreign_keys=[instrument_id])


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # e.g., SUP-001
    company: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(200), index=True)
    subcategory: Mapped[str] = mapped_column(String(200), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    market_segment: Mapped[str] = mapped_column(String(50), default="Both")  # Research only, Clinical/Hospital only, Both
    research_use: Mapped[bool] = mapped_column(Boolean, default=True)
    clinical_use: Mapped[bool] = mapped_column(Boolean, default=False)
    primary_offerings: Mapped[str] = mapped_column(Text, default="")
    common_applications: Mapped[str] = mapped_column(Text, default="")
    ai_recommendation_tags: Mapped[str] = mapped_column(Text, default="")
    workflow_examples: Mapped[str] = mapped_column(Text, default="")
    procurement_priority: Mapped[str] = mapped_column(String(50), default="Medium")
    approval_status: Mapped[str] = mapped_column(String(50), default="Review")
    is_preferred: Mapped[bool] = mapped_column(Boolean, default=False)
    website: Mapped[str] = mapped_column(String(500), default="")
    internal_notes: Mapped[str] = mapped_column(Text, default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(100), default="")
    quote_tracking: Mapped[str] = mapped_column(String(100), default="Not requested")
    contract_status: Mapped[str] = mapped_column(String(100), default="Unknown")
    budget_tier: Mapped[str] = mapped_column(String(50), default="Mid-market")
    country_region: Mapped[str] = mapped_column(String(100), default="Global")
    rating: Mapped[int] = mapped_column(Integer, default=0)  # 1-5 star rating
    total_orders: Mapped[int] = mapped_column(Integer, default=0)
    average_delivery_days: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    lot_number: Mapped[str] = mapped_column(String(120), default="")
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit: Mapped[str] = mapped_column(String(30), default="units")
    reorder_threshold: Mapped[int] = mapped_column(Integer, default=0)
    storage_location: Mapped[str] = mapped_column(String(255), default="")
    barcode: Mapped[str] = mapped_column(String(120), default="")
    expires_on: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    # New fields for supplier integration
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    catalog_number: Mapped[str] = mapped_column(String(100), default="")
    unit_price: Mapped[int] = mapped_column(Integer, default=0)  # Store in cents
    last_ordered: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=0)
    hazard_class: Mapped[str] = mapped_column(String(50), default="")  # e.g., "Flammable", "Corrosive", "Biohazard"
    storage_temp: Mapped[str] = mapped_column(String(50), default="")  # e.g., "RT", "-20C", "-80C", "4C"
    msds_available: Mapped[bool] = mapped_column(Boolean, default=False)
    cas_number: Mapped[str] = mapped_column(String(50), default="")
    sds_url: Mapped[str] = mapped_column(String(500), default="")

    supplier: Mapped["Supplier | None"] = relationship("Supplier", foreign_keys=[supplier_id])


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    area: Mapped[str] = mapped_column(String(120), index=True)
    severity: Mapped[IncidentSeverity] = mapped_column(SqlEnum(IncidentSeverity), default=IncidentSeverity.low)
    description: Mapped[str] = mapped_column(Text)
    corrective_action: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(50), default="open")
    reported_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    reporter: Mapped["User | None"] = relationship("User", foreign_keys=[reported_by])


class StudyWorkspace(Base):
    __tablename__ = "study_workspaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    field: Mapped[str] = mapped_column(String(120), index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    milestone: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(50), default="active")
    description: Mapped[str] = mapped_column(Text, default="")

    lead: Mapped["User | None"] = relationship("User", foreign_keys=[lead_id])


class NotificationRule(Base):
    __tablename__ = "notification_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    trigger_event: Mapped[str] = mapped_column(String(120), index=True)
    channel: Mapped[NotificationChannel] = mapped_column(SqlEnum(NotificationChannel), default=NotificationChannel.dashboard)
    recipient_role: Mapped[str] = mapped_column(String(50), default="staff")
    lead_time_hours: Mapped[int] = mapped_column(Integer, default=24)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SampleRecord(Base):
    __tablename__ = "sample_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_id: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    barcode: Mapped[str] = mapped_column(String(120), index=True, default="")
    sample_type: Mapped[str] = mapped_column(String(120), index=True)
    source: Mapped[str] = mapped_column(String(120), default="")
    project_id: Mapped[int | None] = mapped_column(ForeignKey("study_workspaces.id"), nullable=True)
    protocol_id: Mapped[int | None] = mapped_column(ForeignKey("protocols.id"), nullable=True)
    storage_location: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[SampleStatus] = mapped_column(SqlEnum(SampleStatus), default=SampleStatus.received)
    received_on: Mapped[str] = mapped_column(String(50), index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    data_classification: Mapped[DataClassification] = mapped_column(
        SqlEnum(DataClassification), default=DataClassification.internal
    )

    owner: Mapped["User | None"] = relationship("User", foreign_keys=[owner_id])
    project: Mapped["StudyWorkspace | None"] = relationship("StudyWorkspace", foreign_keys=[project_id])
    protocol: Mapped["Protocol | None"] = relationship("Protocol", foreign_keys=[protocol_id])


class SampleEvent(Base):
    __tablename__ = "sample_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sample_record_id: Mapped[int] = mapped_column(ForeignKey("sample_records.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(120), index=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(80), default="logged")
    performed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    timestamp: Mapped[str] = mapped_column(String(50), index=True)
    notes: Mapped[str] = mapped_column(Text, default="")

    performer: Mapped["User | None"] = relationship("User", foreign_keys=[performed_by])


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    event_type: Mapped[str] = mapped_column(String(120), index=True)
    start_time: Mapped[str] = mapped_column(String(50), index=True)
    end_time: Mapped[str] = mapped_column(String(50), index=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    related_instrument_id: Mapped[int | None] = mapped_column(ForeignKey("instruments.id"), nullable=True)
    related_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id"), nullable=True)
    related_protocol_id: Mapped[int | None] = mapped_column(ForeignKey("protocols.id"), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    # Feature 1: recurrence
    recurrence_rule: Mapped[str] = mapped_column(String(20), default="none")   # none/daily/weekly/monthly
    recurrence_end: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recurrence_group_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    # Feature 2: attendees (comma-separated user ids)
    attendee_ids: Mapped[str] = mapped_column(Text, default="")
    # Feature 4: reminder
    reminder_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    owner: Mapped["User | None"] = relationship("User", foreign_keys=[owner_id])


class ReminderQueue(Base):
    __tablename__ = "reminder_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(120), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    title: Mapped[str] = mapped_column(String(255))
    due_at: Mapped[str] = mapped_column(String(50), index=True)
    channel: Mapped[NotificationChannel] = mapped_column(SqlEnum(NotificationChannel), default=NotificationChannel.dashboard)
    recipient_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    recipient_role: Mapped[str] = mapped_column(String(50), default="staff")
    status: Mapped[ReminderStatus] = mapped_column(SqlEnum(ReminderStatus), default=ReminderStatus.pending)
    last_attempt_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message: Mapped[str] = mapped_column(Text, default="")


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(120), index=True)
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    filepath: Mapped[str] = mapped_column(String(500))
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    uploader: Mapped["User | None"] = relationship("User", foreign_keys=[uploaded_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    action: Mapped[AuditAction] = mapped_column(SqlEnum(AuditAction))
    entity_type: Mapped[str] = mapped_column(String(120), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    user_email: Mapped[str] = mapped_column(String(255), default="")
    changes_json: Mapped[str] = mapped_column(Text, default="{}")
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    prev_hash: Mapped[str] = mapped_column(String(64), default="0" * 64)
    chain_hash: Mapped[str] = mapped_column(String(64), default="")


class SignatureReason(str, Enum):
    approved = "approved"
    reviewed = "reviewed"
    authored = "authored"
    witnessed = "witnessed"
    rejected = "rejected"


class ElectronicSignature(Base):
    """21 CFR Part 11 compliant electronic signature record."""
    __tablename__ = "electronic_signatures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(120), index=True)  # "sop", "protocol", "notebook_entry", "sample"
    entity_id: Mapped[int] = mapped_column(Integer, index=True)
    entity_title: Mapped[str] = mapped_column(String(500), default="")
    signer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    signer_email: Mapped[str] = mapped_column(String(255), default="")
    signer_name: Mapped[str] = mapped_column(String(120), default="")
    reason: Mapped[SignatureReason] = mapped_column(SqlEnum(SignatureReason))
    meaning: Mapped[str] = mapped_column(String(500), default="")  # free-text meaning
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    user_agent: Mapped[str] = mapped_column(String(500), default="")
    content_hash: Mapped[str] = mapped_column(String(128), default="")  # SHA-256 of signed content
    signed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    is_valid: Mapped[bool] = mapped_column(Boolean, default=True)  # can be invalidated if content changed after signing
    invalidated_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    signer: Mapped["User"] = relationship("User", foreign_keys=[signer_id])


class SOP(Base):
    __tablename__ = "sops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    status: Mapped[SOPStatus] = mapped_column(SqlEnum(SOPStatus), default=SOPStatus.draft)
    effective_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    review_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    department: Mapped[str] = mapped_column(String(120), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author: Mapped["User | None"] = relationship("User", foreign_keys=[author_id])


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instrument_id: Mapped[int] = mapped_column(ForeignKey("instruments.id"), index=True)
    type: Mapped[MaintenanceType] = mapped_column(SqlEnum(MaintenanceType), default=MaintenanceType.preventive)
    status: Mapped[MaintenanceStatus] = mapped_column(SqlEnum(MaintenanceStatus), default=MaintenanceStatus.scheduled)
    scheduled_date: Mapped[str] = mapped_column(String(50), index=True)
    completed_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    performed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_due: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parts_replaced: Mapped[str] = mapped_column(String(500), default="")

    instrument: Mapped["Instrument"] = relationship("Instrument", foreign_keys=[instrument_id])
    performed_by: Mapped["User | None"] = relationship("User", foreign_keys=[performed_by_id])


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[TemplateCategory] = mapped_column(SqlEnum(TemplateCategory), default=TemplateCategory.protocol)
    description: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    variables: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of variable names
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    usage_count: Mapped[int] = mapped_column(Integer, default=0)

    created_by: Mapped["User | None"] = relationship("User", foreign_keys=[created_by_id])


class CostEntry(Base):
    __tablename__ = "cost_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category: Mapped[CostCategory] = mapped_column(SqlEnum(CostCategory), default=CostCategory.other)
    description: Mapped[str] = mapped_column(String(500))
    amount: Mapped[int] = mapped_column(Integer)  # Store in cents
    project: Mapped[str] = mapped_column(String(255), default="")
    date: Mapped[str] = mapped_column(String(50), index=True)
    vendor: Mapped[str] = mapped_column(String(255), default="")
    invoice_number: Mapped[str] = mapped_column(String(120), default="")
    status: Mapped[CostStatus] = mapped_column(SqlEnum(CostStatus), default=CostStatus.pending)
    submitted_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    submitted_by: Mapped["User | None"] = relationship("User", foreign_keys=[submitted_by_id])


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="disconnected")
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    last_sync: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class LabSettings(Base):
    __tablename__ = "lab_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(50), default="general")
    updated_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class LabMeeting(Base):
    __tablename__ = "lab_meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    type: Mapped[MeetingType] = mapped_column(SqlEnum(MeetingType), default=MeetingType.weekly)
    status: Mapped[MeetingStatus] = mapped_column(SqlEnum(MeetingStatus), default=MeetingStatus.scheduled)
    scheduled_at: Mapped[str] = mapped_column(String(50), index=True)
    end_time: Mapped[str] = mapped_column(String(50))
    location: Mapped[str] = mapped_column(String(255), default="")
    video_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurring_pattern: Mapped[str | None] = mapped_column(String(50), nullable=True)
    organizer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    agenda_json: Mapped[str] = mapped_column(Text, default="[]")
    attendees_json: Mapped[str] = mapped_column(Text, default="[]")
    minutes: Mapped[str] = mapped_column(Text, default="")
    minutes_published: Mapped[bool] = mapped_column(Boolean, default=False)
    minutes_published_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organizer: Mapped["User | None"] = relationship("User", foreign_keys=[organizer_id])


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    status: Mapped[PurchaseOrderStatus] = mapped_column(SqlEnum(PurchaseOrderStatus), default=PurchaseOrderStatus.draft)
    items_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON array of items
    subtotal: Mapped[int] = mapped_column(Integer, default=0)  # cents
    tax: Mapped[int] = mapped_column(Integer, default=0)  # cents
    shipping: Mapped[int] = mapped_column(Integer, default=0)  # cents
    total: Mapped[int] = mapped_column(Integer, default=0)  # cents
    requested_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ordered_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expected_delivery: Mapped[str | None] = mapped_column(String(50), nullable=True)
    received_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tracking_number: Mapped[str] = mapped_column(String(200), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    urgency: Mapped[str] = mapped_column(String(50), default="normal")  # normal, urgent, critical
    project_code: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])
    requested_by: Mapped["User | None"] = relationship("User", foreign_keys=[requested_by_id])
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id])


class SupplierReview(Base):
    __tablename__ = "supplier_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)  # 1-5
    delivery_rating: Mapped[int] = mapped_column(Integer, default=0)
    quality_rating: Mapped[int] = mapped_column(Integer, default=0)
    support_rating: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str] = mapped_column(Text, default="")
    order_reference: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier: Mapped["Supplier"] = relationship("Supplier", foreign_keys=[supplier_id])


# ─── Lab Notebook (ELN) ───────────────────────────────────────────────────────

class LabNotebookEntry(Base):
    __tablename__ = "lab_notebook_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text, default="")  # Markdown
    experiment_type: Mapped[str] = mapped_column(String(100), default="")
    tags: Mapped[str] = mapped_column(String(500), default="")
    linked_sample_id: Mapped[int | None] = mapped_column(ForeignKey("sample_records.id"), nullable=True)
    linked_protocol_id: Mapped[int | None] = mapped_column(ForeignKey("protocols.id"), nullable=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    signed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    witnessed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    witnessed_at: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    data_classification: Mapped[DataClassification] = mapped_column(
        SqlEnum(DataClassification), default=DataClassification.internal
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])
    witnessed_by: Mapped["User | None"] = relationship("User", foreign_keys=[witnessed_by_id])


# ─── IoT Sensors ──────────────────────────────────────────────────────────────

class IoTSensorType(str, Enum):
    freezer   = "freezer"
    incubator = "incubator"
    fridge    = "fridge"
    ln2       = "ln2"
    co2       = "co2"
    humidity  = "humidity"


class IoTSensor(Base):
    __tablename__ = "iot_sensors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    sensor_type: Mapped[IoTSensorType] = mapped_column(SqlEnum(IoTSensorType), default=IoTSensorType.freezer)
    unit: Mapped[str] = mapped_column(String(20), default="°C")
    target: Mapped[float] = mapped_column(default=0.0)
    min_threshold: Mapped[float] = mapped_column(default=-85.0)
    max_threshold: Mapped[float] = mapped_column(default=-70.0)
    api_key: Mapped[str] = mapped_column(String(64), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Alert notification config
    notify_email: Mapped[str] = mapped_column(String(500), default="")   # comma-separated emails
    alert_cooldown_minutes: Mapped[int] = mapped_column(Integer, default=30)  # min gap between alerts
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    readings: Mapped[list["IoTReading"]] = relationship("IoTReading", back_populates="sensor", order_by="IoTReading.recorded_at.desc()")
    alerts: Mapped[list["IoTAlert"]] = relationship("IoTAlert", back_populates="sensor", order_by="IoTAlert.triggered_at.desc()")


class IoTReading(Base):
    __tablename__ = "iot_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("iot_sensors.id"), index=True)
    value: Mapped[float] = mapped_column()
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    sensor: Mapped["IoTSensor"] = relationship("IoTSensor", back_populates="readings")


class IoTAlertSeverity(str, Enum):
    warning  = "warning"
    critical = "critical"


class IoTAlert(Base):
    __tablename__ = "iot_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("iot_sensors.id"), index=True)
    severity: Mapped[IoTAlertSeverity] = mapped_column(SqlEnum(IoTAlertSeverity), default=IoTAlertSeverity.warning)
    value: Mapped[float] = mapped_column()
    message: Mapped[str] = mapped_column(Text, default="")
    triggered_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notified_emails: Mapped[str] = mapped_column(String(500), default="")  # who was emailed

    sensor: Mapped["IoTSensor"] = relationship("IoTSensor", back_populates="alerts")


# ─── Privacy & Consent (GDPR / HIPAA) ────────────────────────────────────────

class ConsentPurpose(str, Enum):
    data_processing    = "data_processing"
    research_use       = "research_use"
    marketing          = "marketing"
    analytics          = "analytics"
    third_party_share  = "third_party_share"
    phi_access         = "phi_access"


class ConsentStatus(str, Enum):
    granted  = "granted"
    revoked  = "revoked"
    pending  = "pending"


class ConsentRecord(Base):
    """Tracks user consent for specific data-processing purposes (GDPR Art. 6/7)."""
    __tablename__ = "consent_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    purpose: Mapped[ConsentPurpose] = mapped_column(SqlEnum(ConsentPurpose))
    status: Mapped[ConsentStatus] = mapped_column(SqlEnum(ConsentStatus), default=ConsentStatus.pending)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    version: Mapped[str] = mapped_column(String(20), default="1.0")  # policy version user consented to
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class ErasureStatus(str, Enum):
    pending    = "pending"
    in_review  = "in_review"
    completed  = "completed"
    rejected   = "rejected"


class DataErasureRequest(Base):
    """GDPR Art. 17 — Right to Erasure ('right to be forgotten') requests."""
    __tablename__ = "data_erasure_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    status: Mapped[ErasureStatus] = mapped_column(SqlEnum(ErasureStatus), default=ErasureStatus.pending)
    reason: Mapped[str] = mapped_column(Text, default="")
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str] = mapped_column(Text, default="")

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
    reviewed_by: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by_id])


class DataExportRequest(Base):
    """GDPR Art. 20 — Right to Data Portability requests."""
    __tablename__ = "data_export_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending / ready / downloaded
    export_url: Mapped[str] = mapped_column(String(500), default="")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class PrivacyPolicyVersion(Base):
    """Tracks privacy policy versions published by admins."""
    __tablename__ = "privacy_policy_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    effective_date: Mapped[str] = mapped_column(String(50))
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    published_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)

    published_by: Mapped["User | None"] = relationship("User", foreign_keys=[published_by_id])


# ─── Session Management ───────────────────────────────────────────────────────

class UserSession(Base):
    """Tracks active user sessions for visibility and revocation."""
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    user_agent: Mapped[str] = mapped_column(String(500), default="")
    device_hint: Mapped[str] = mapped_column(String(120), default="")  # "Chrome / macOS", "Safari / iOS"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


# ─── Security Events ──────────────────────────────────────────────────────────

class SecurityEvent(Base):
    """Immutable log of security-relevant events (login, MFA, permission denials, etc.)."""
    __tablename__ = "security_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_type: Mapped[SecurityEventType] = mapped_column(SqlEnum(SecurityEventType), index=True)
    severity: Mapped[SecurityEventSeverity] = mapped_column(
        SqlEnum(SecurityEventSeverity), default=SecurityEventSeverity.info, index=True
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    user_email: Mapped[str] = mapped_column(String(255), default="")
    ip_address: Mapped[str] = mapped_column(String(60), default="")
    user_agent: Mapped[str] = mapped_column(String(500), default="")
    details: Mapped[str] = mapped_column(Text, default="{}")  # JSON
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])


class ReagentDisposalLog(Base):
    __tablename__ = "reagent_disposal_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    inventory_item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id"), nullable=True)
    reagent_name: Mapped[str] = mapped_column(String(255))
    lot_number: Mapped[str] = mapped_column(String(120), default="")
    quantity_disposed: Mapped[str] = mapped_column(String(80))
    disposal_method: Mapped[str] = mapped_column(String(120))  # e.g. "Incineration", "Drain disposal", "EHS pickup"
    hazard_class: Mapped[str] = mapped_column(String(80), default="")
    reason: Mapped[str] = mapped_column(String(255), default="")  # "Expired", "Degraded", "Excess"
    disposed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    witness_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    disposed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    item: Mapped["InventoryItem | None"] = relationship("InventoryItem", foreign_keys=[inventory_item_id])
    disposer: Mapped["User | None"] = relationship("User", foreign_keys=[disposed_by])
    witness: Mapped["User | None"] = relationship("User", foreign_keys=[witness_id])


class CapaStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    pending_verification = "pending_verification"
    closed = "closed"
    cancelled = "cancelled"


class CapaSeverity(str, Enum):
    critical = "critical"
    major = "major"
    minor = "minor"
    observation = "observation"


class CapaRecord(Base):
    __tablename__ = "capa_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    root_cause: Mapped[str] = mapped_column(Text, default="")
    corrective_action: Mapped[str] = mapped_column(Text, default="")
    preventive_action: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(120), default="")  # audit, incident, complaint, self-inspection
    reference_id: Mapped[str] = mapped_column(String(120), default="")  # linked incident/audit id
    severity: Mapped[str] = mapped_column(SqlEnum(CapaSeverity), default=CapaSeverity.minor)
    status: Mapped[str] = mapped_column(SqlEnum(CapaStatus), default=CapaStatus.open, index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    due_date: Mapped[str] = mapped_column(String(20), default="")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verification_notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_to])
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])


class Reference(Base):
    __tablename__ = "references"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pmid: Mapped[str] = mapped_column(String(40), default="", index=True)
    doi: Mapped[str] = mapped_column(String(255), default="")
    title: Mapped[str] = mapped_column(String(500))
    authors: Mapped[str] = mapped_column(Text, default="")  # JSON array stored as text
    journal: Mapped[str] = mapped_column(String(255), default="")
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    volume: Mapped[str] = mapped_column(String(40), default="")
    issue: Mapped[str] = mapped_column(String(40), default="")
    pages: Mapped[str] = mapped_column(String(80), default="")
    abstract: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # JSON array
    folder: Mapped[str] = mapped_column(String(120), default="Unfiled")
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    citations: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    short_code: Mapped[str] = mapped_column(String(20), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    country: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    website: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    sites: Mapped[list["Site"]] = relationship("Site", back_populates="organization", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(20), default="")
    site_type: Mapped[str] = mapped_column(String(80), default="lab")  # lab, core-facility, field, clinic
    country: Mapped[str] = mapped_column(String(100), default="")
    city: Mapped[str] = mapped_column(String(100), default="")
    address: Mapped[str] = mapped_column(String(500), default="")
    timezone: Mapped[str] = mapped_column(String(60), default="UTC")
    contact_name: Mapped[str] = mapped_column(String(255), default="")
    contact_email: Mapped[str] = mapped_column(String(255), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    organization: Mapped["Organization"] = relationship("Organization", back_populates="sites")
    labs: Mapped[list["LabUnit"]] = relationship("LabUnit", back_populates="site", cascade="all, delete-orphan")


class LabUnit(Base):
    __tablename__ = "lab_units"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    code: Mapped[str] = mapped_column(String(20), default="")
    lab_type: Mapped[str] = mapped_column(String(80), default="research")  # research, BSL2, BSL3, core
    pi_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    capacity_persons: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    site: Mapped["Site"] = relationship("Site", back_populates="labs")
    pi: Mapped["User | None"] = relationship("User", foreign_keys=[pi_user_id])


# ─── Freezer / Biobank ────────────────────────────────────────────────────────

class FreezerType(str, Enum):
    ult     = "ult"
    freezer = "freezer"
    fridge  = "fridge"
    ln2     = "ln2"


class Freezer(Base):
    __tablename__ = "freezers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200), default="")
    temp_setting: Mapped[str] = mapped_column(String(20), default="-80°C")
    freezer_type: Mapped[FreezerType] = mapped_column(SqlEnum(FreezerType), default=FreezerType.ult)
    total_racks: Mapped[int] = mapped_column(Integer, default=4)
    boxes_per_rack: Mapped[int] = mapped_column(Integer, default=12)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    boxes: Mapped[list["FreezerBox"]] = relationship("FreezerBox", back_populates="freezer", cascade="all, delete-orphan")


class FreezerBox(Base):
    __tablename__ = "freezer_boxes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    freezer_id: Mapped[int] = mapped_column(ForeignKey("freezers.id"), index=True)
    rack_number: Mapped[int] = mapped_column(Integer, default=1)
    box_number: Mapped[int] = mapped_column(Integer, default=1)
    label: Mapped[str] = mapped_column(String(100), default="")

    freezer: Mapped["Freezer"] = relationship("Freezer", back_populates="boxes")
    slots: Mapped[list["FreezerSlot"]] = relationship("FreezerSlot", back_populates="box", cascade="all, delete-orphan")


class FreezerSlot(Base):
    __tablename__ = "freezer_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    box_id: Mapped[int] = mapped_column(ForeignKey("freezer_boxes.id"), index=True)
    row_idx: Mapped[int] = mapped_column(Integer)
    col_idx: Mapped[int] = mapped_column(Integer)
    sample_id: Mapped[str] = mapped_column(String(100), default="")
    sample_type: Mapped[str] = mapped_column(String(100), default="")
    date_stored: Mapped[str] = mapped_column(String(20), default="")
    owner: Mapped[str] = mapped_column(String(200), default="")
    expiry_date: Mapped[str] = mapped_column(String(20), default="")
    volume: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    box: Mapped["FreezerBox"] = relationship("FreezerBox", back_populates="slots")


# ─── Biosketch (NIH) ─────────────────────────────────────────────────────────

class BiosketchProfile(Base):
    __tablename__ = "biosketch_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    education_json: Mapped[str] = mapped_column(Text, default="[]")
    positions_json: Mapped[str] = mapped_column(Text, default="[]")
    honors_json: Mapped[str] = mapped_column(Text, default="[]")
    contributions_json: Mapped[str] = mapped_column(Text, default="[]")
    products_json: Mapped[str] = mapped_column(Text, default="[]")
    research_support_json: Mapped[str] = mapped_column(Text, default="[]")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


# ─── Grant Version History ────────────────────────────────────────────────────

class GrantVersion(Base):
    __tablename__ = "grant_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grant_id: Mapped[str] = mapped_column(String(100), index=True)
    grant_title: Mapped[str] = mapped_column(String(500), default="")
    version_label: Mapped[str] = mapped_column(String(100), default="")
    created_by: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    changes_json: Mapped[str] = mapped_column(Text, default="[]")
    notes: Mapped[str] = mapped_column(Text, default="")
    content_json: Mapped[str] = mapped_column(Text, default="{}")


# ─── Grant Submissions (Success Analytics) ────────────────────────────────────

class GrantSubmissionStatus(str, Enum):
    submitted    = "submitted"
    under_review = "under_review"
    scored       = "scored"
    funded       = "funded"
    rejected     = "rejected"
    withdrawn    = "withdrawn"
    deferred     = "deferred"


class GrantSubmission(Base):
    __tablename__ = "grant_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    grant_number: Mapped[str] = mapped_column(String(100), default="", index=True)
    title: Mapped[str] = mapped_column(String(500))
    agency: Mapped[str] = mapped_column(String(200), default="NIH")
    institute: Mapped[str] = mapped_column(String(200), default="")
    grant_type: Mapped[str] = mapped_column(String(100), default="R01")
    submitted_at: Mapped[str] = mapped_column(String(20), default="")
    status: Mapped[GrantSubmissionStatus] = mapped_column(SqlEnum(GrantSubmissionStatus), default=GrantSubmissionStatus.submitted)
    score: Mapped[float | None] = mapped_column(nullable=True)
    percentile: Mapped[float | None] = mapped_column(nullable=True)
    total_amount: Mapped[float] = mapped_column(default=0.0)
    revision_number: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


# ─── Reagent Cart (Browser Extension capture + Stripe checkout) ─────────────
class ReagentCartItemStatus(str, Enum):
    pending = "pending"     # captured by extension, awaiting review
    approved = "approved"   # approved by user, ready to order
    ordered = "ordered"     # payment processed
    received = "received"   # arrived at lab
    cancelled = "cancelled"


class ReagentCartItem(Base):
    __tablename__ = "reagent_cart_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    vendor: Mapped[str] = mapped_column(String(200), default="")
    name: Mapped[str] = mapped_column(String(500))
    catalog: Mapped[str] = mapped_column(String(200), default="")
    size: Mapped[str] = mapped_column(String(100), default="")
    unit_price: Mapped[float | None] = mapped_column(nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    url: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str] = mapped_column(Text, default="")
    cas: Mapped[str] = mapped_column(String(50), default="")
    purity: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[ReagentCartItemStatus] = mapped_column(SqlEnum(ReagentCartItemStatus), default=ReagentCartItemStatus.pending)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    ordered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    stripe_charge_id: Mapped[str] = mapped_column(String(100), default="")


# ─── Extended cart fields (additions on top of ReagentCartItem) ─────────────
class CartItemMeta(Base):
    """Optional metadata table sidecar to keep ReagentCartItem stable. One row
    per cart item id, holds the advanced-feature fields."""
    __tablename__ = "reagent_cart_item_meta"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("reagent_cart_items.id"), unique=True, index=True)
    # Approval
    approval_status: Mapped[str] = mapped_column(String(30), default="not_required")  # not_required, pending, approved, rejected
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_reason: Mapped[str] = mapped_column(Text, default="")
    # Compliance
    sds_url: Mapped[str] = mapped_column(Text, default="")
    hazard_codes_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON list
    # Budget
    budget_code: Mapped[str] = mapped_column(String(100), default="")
    grant_id: Mapped[int | None] = mapped_column(ForeignKey("grant_submissions.id"), nullable=True)
    # Recurrence
    recurrence_pattern: Mapped[str] = mapped_column(String(50), default="")  # e.g. "monthly", "30d", ""
    next_reorder_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    auto_reorder: Mapped[bool] = mapped_column(Boolean, default=False)
    # Cross-vendor pricing
    alt_prices_json: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of {vendor, price, url}
    # RFQ
    rfq_status: Mapped[str] = mapped_column(String(30), default="")  # "", "requested", "received", "declined"
    rfq_quote_url: Mapped[str] = mapped_column(Text, default="")
    # Lab assignment + borrow
    lab_id: Mapped[int | None] = mapped_column(ForeignKey("lab_units.id"), nullable=True)


class LabBudget(Base):
    __tablename__ = "lab_budgets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    budget_code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    grant_id: Mapped[int | None] = mapped_column(ForeignKey("grant_submissions.id"), nullable=True)
    lab_id: Mapped[int | None] = mapped_column(ForeignKey("lab_units.id"), nullable=True)
    total_amount: Mapped[float] = mapped_column(default=0.0)
    spent_amount: Mapped[float] = mapped_column(default=0.0)
    fiscal_year: Mapped[str] = mapped_column(String(10), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class ApprovalRule(Base):
    __tablename__ = "approval_rules"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    # Triggers: any combination
    over_amount: Mapped[float | None] = mapped_column(nullable=True)  # require if cart total > X
    hazardous: Mapped[bool] = mapped_column(Boolean, default=False)
    vendor_match: Mapped[str] = mapped_column(String(200), default="")
    role_required: Mapped[str] = mapped_column(String(50), default="staff")  # who can approve
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RestrictedChemical(Base):
    """Institution's list of restricted / regulated chemicals."""
    __tablename__ = "restricted_chemicals"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(300))
    cas: Mapped[str] = mapped_column(String(50), default="", index=True)
    category: Mapped[str] = mapped_column(String(100))  # "DEA Schedule I", "Biohazard L3", "Radioactive", "Restricted"
    severity: Mapped[str] = mapped_column(String(20), default="warn")  # warn, block
    notes: Mapped[str] = mapped_column(Text, default="")
    added_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class BorrowRequest(Base):
    """Lab-to-lab borrow request."""
    __tablename__ = "borrow_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    lender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requester_lab_id: Mapped[int | None] = mapped_column(ForeignKey("lab_units.id"), nullable=True)
    lender_lab_id: Mapped[int | None] = mapped_column(ForeignKey("lab_units.id"), nullable=True)
    inventory_item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id"), nullable=True)
    cart_item_id: Mapped[int | None] = mapped_column(ForeignKey("reagent_cart_items.id"), nullable=True)
    requested_quantity: Mapped[str] = mapped_column(String(100), default="")
    purpose: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="pending")  # pending, approved, rejected, returned
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ─── Lab Membership (PI manages who can access the lab) ──────────────────────
class LabMembershipStatus(str, Enum):
    pending  = "pending"   # User requested join, waiting on PI approval
    approved = "approved"  # PI approved — full member
    revoked  = "revoked"   # Access revoked (kept for audit)
    invited  = "invited"   # PI invited a user who hasn't accepted yet


class LabMembership(Base):
    """Many-to-many: which users belong to which lab, gated by PI approval.
    A single user can be in multiple labs (postdocs, core staff, collaborators)."""
    __tablename__ = "lab_memberships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    lab_id: Mapped[int] = mapped_column(ForeignKey("lab_units.id"), index=True)
    # Role *within this lab* — independent of global User.role
    lab_role: Mapped[str] = mapped_column(String(50), default="member")  # member, manager, observer
    status: Mapped[LabMembershipStatus] = mapped_column(
        SqlEnum(LabMembershipStatus), default=LabMembershipStatus.pending
    )
    invited_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    invite_email: Mapped[str] = mapped_column(String(255), default="")  # for invites to non-existing users
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoke_reason: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
