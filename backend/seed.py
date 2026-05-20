from app.core.database import Base, SessionLocal, engine
from app.core.security import get_password_hash
from app.models.models import (
    AuditAction,
    AuditLog,
    CalendarEvent,
    ComplianceLog,
    Feedback,
    IncidentReport,
    Instrument,
    InventoryItem,
    NotificationChannel,
    NotificationRule,
    Protocol,
    ReminderQueue,
    ReminderStatus,
    SampleEvent,
    SampleRecord,
    SampleStatus,
    StudyWorkspace,
    Task,
    TrainingRecord,
    TrainingStatus,
    User,
    UserRole,
    WorkflowStep,
)
from datetime import datetime, timezone

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

admin = User(
    full_name="Lab Administrator",
    email="admin@lab.local",
    hashed_password=get_password_hash("Admin123!"),
    role=UserRole.admin,
)
pi = User(
    full_name="Principal Investigator",
    email="pi@lab.local",
    hashed_password=get_password_hash("Pi123!"),
    role=UserRole.pi,
)
manager = User(
    full_name="Core Facility Manager",
    email="manager@lab.local",
    hashed_password=get_password_hash("Manager123!"),
    role=UserRole.manager,
)
staff = User(
    full_name="Research Staff",
    email="staff@lab.local",
    hashed_password=get_password_hash("Staff123!"),
    role=UserRole.staff,
)
trainee = User(
    full_name="Lab Trainee",
    email="trainee@lab.local",
    hashed_password=get_password_hash("Trainee123!"),
    role=UserRole.trainee,
)

db.add_all([admin, pi, manager, staff, trainee])
db.flush()

workspace1 = StudyWorkspace(
    name="CRC Organoid Genomics",
    field="Cancer/Genomics",
    lead_id=manager.id,
    milestone="Finalize DNA extraction QC batch",
    status="active",
    description="Shared workspace for organoid, sequencing, and metadata tasks.",
)
workspace2 = StudyWorkspace(
    name="EMAST Biomarker Validation",
    field="Cancer Biomarkers",
    lead_id=pi.id,
    milestone="Prepare abstract-ready analytics dashboard",
    status="active",
    description="Cross-team workspace for assay validation, analysis, and reporting.",
)
db.add_all([workspace1, workspace2])
db.flush()

protocol = Protocol(
    title="NGS Library Preparation QC Workflow",
    field="Genomics",
    version="2.1",
    description="End-to-end SOP for library QC before sequencing submission.",
    owner_id=manager.id,
    reminder_days_before=2,
)
db.add(protocol)
db.flush()

db.add_all(
    [
        WorkflowStep(protocol_id=protocol.id, step_order=1, title="Sample receipt check", instructions="Verify sample IDs, concentration, and storage condition.", estimated_minutes=10, requires_signoff=True),
        WorkflowStep(protocol_id=protocol.id, step_order=2, title="DNA quality assessment", instructions="Measure A260/280 and fragment distribution using TapeStation or equivalent.", estimated_minutes=20, requires_signoff=False),
        WorkflowStep(protocol_id=protocol.id, step_order=3, title="QC sign-off", instructions="Approve or flag sample before sequencing queue entry.", estimated_minutes=10, requires_signoff=True),
    ]
)

miseq = Instrument(name="Illumina MiSeq", category="Sequencer", location="Genomics Core Room 2", maintenance_frequency_days=30, next_maintenance_date="2026-04-05", status="available", notes="Quarterly calibration required.")
qpcr = Instrument(name="qPCR System", category="PCR", location="Cancer Biology Lab Bench A", maintenance_frequency_days=60, next_maintenance_date="2026-04-12", status="available", notes="Lamp inspection pending.")
flow = Instrument(name="Flow Cytometer BD LSR", category="Flow Cytometry", location="Immunology Core Room 1", maintenance_frequency_days=45, next_maintenance_date="2026-05-01", status="maintenance", notes="Currently under servicing.")
db.add_all([miseq, qpcr, flow])
db.flush()

db.add_all(
    [
        Task(title="Monthly biosafety cabinet certification", description="Coordinate vendor visit and document sticker update.", due_date="2026-04-03", assigned_to=manager.id, reminder_type="email"),
        Task(title="Protocol review: organoid contamination response", description="Update escalation and decontamination steps.", due_date="2026-04-07", assigned_to=staff.id, reminder_type="dashboard", related_protocol_id=protocol.id),
        Task(title="Freezer inventory audit Q1", description="Complete quarterly inventory check for all -80C freezers.", due_date="2026-03-15", assigned_to=staff.id, reminder_type="email"),
    ]
)

db.add_all(
    [
        ComplianceLog(title="Freezer temperature audit", category="storage", details="-80C freezer logs reviewed and within threshold.", logged_by=manager.id),
        ComplianceLog(title="Instrument decontamination", category="instrument", details="MiSeq external surfaces decontaminated after run completion.", logged_by=staff.id),
    ]
)

db.add_all(
    [
        Feedback(subject="Need barcode scan support", message="Adding barcode scan for instrument checkout would reduce manual entry errors.", module="instruments", submitted_by=staff.id, status="new"),
        Feedback(subject="Protocol version diff view", message="Please add version comparison when SOPs are revised.", module="protocols", submitted_by=manager.id, status="under_review"),
    ]
)

db.add_all(
    [
        TrainingRecord(user_id=staff.id, title="MiSeq operator certification", instrument_id=miseq.id, completed_on="2026-03-01", expires_on="2027-03-01", status=TrainingStatus.active, notes="Annual competency documented."),
        TrainingRecord(user_id=manager.id, title="NGS QC workflow approval training", protocol_id=protocol.id, completed_on="2026-02-15", expires_on="2027-02-15", status=TrainingStatus.active, notes="Approved for sign-off."),
    ]
)

db.add_all(
    [
        InventoryItem(name="PCR Master Mix", category="Reagent", lot_number="MMX-2041", quantity=8, unit="boxes", reorder_threshold=3, storage_location="Cold Room Shelf B", barcode="INV-PCR-0001", expires_on="2026-11-30", notes="Track freezer-to-bench cycles."),
        InventoryItem(name="96-well plates", category="Consumable", lot_number="PLT-8810", quantity=120, unit="plates", reorder_threshold=40, storage_location="Storage Cabinet 3", barcode="INV-CNS-0042", notes="Shared between genomics and cancer labs."),
        InventoryItem(name="RNA Later Solution", category="Reagent", lot_number="RNA-7721", quantity=5, unit="bottles", reorder_threshold=2, storage_location="Cold Room Shelf A", barcode="INV-RNA-0010", expires_on="2026-12-31", notes=""),
    ]
)

db.add_all(
    [
        IncidentReport(title="Unexpected qPCR lamp warning", area="Instrumentation", severity="medium", description="Instrument displayed lamp aging warning during assay startup.", corrective_action="Opened service ticket and shifted urgent runs to backup instrument.", reported_by=staff.id, status="under_review"),
        IncidentReport(title="Organoid incubator CO2 deviation", area="Cell culture", severity="high", description="CO2 levels drifted above threshold for 40 minutes.", corrective_action="Relocated cultures, documented excursion, and requested calibration.", reported_by=manager.id, status="open"),
        IncidentReport(title="Chemical spill in sample prep area", area="Lab bench", severity="low", description="Small ethanol spill during pipetting. Contained immediately.", corrective_action="Cleaned with appropriate PPE. No injury.", reported_by=staff.id, status="closed"),
    ]
)

db.add_all(
    [
        NotificationRule(title="Maintenance due reminders", trigger_event="instrument_maintenance_due", channel=NotificationChannel.email, recipient_role="manager", lead_time_hours=72, is_active=True),
        NotificationRule(title="Protocol deadline escalation", trigger_event="protocol_task_overdue", channel=NotificationChannel.dashboard, recipient_role="pi", lead_time_hours=24, is_active=True),
        NotificationRule(title="Sample storage audit reminder", trigger_event="sample_storage_review", channel=NotificationChannel.dashboard, recipient_role="staff", lead_time_hours=12, is_active=True),
    ]
)

db.flush()

sample1 = SampleRecord(sample_id="CRC-ORG-001", barcode="SMP-CRC-0001", sample_type="Organoid DNA", source="Colorectal organoid", project_id=workspace1.id, protocol_id=protocol.id, storage_location="-80C Freezer / Rack 4 / Box 2", status=SampleStatus.received, received_on="2026-03-29", owner_id=staff.id, notes="Prioritize for QC and library prep.")
sample2 = SampleRecord(sample_id="EMAST-TISSUE-014", barcode="SMP-EMAST-0014", sample_type="FFPE tissue", source="Colon biopsy", project_id=workspace2.id, storage_location="Pathology Archive / Drawer 7", status=SampleStatus.stored, received_on="2026-03-24", owner_id=manager.id, notes="Awaiting extraction batch.")
sample3 = SampleRecord(sample_id="CRC-ORG-002", barcode="SMP-CRC-0002", sample_type="Organoid DNA", source="Colorectal organoid", project_id=workspace1.id, storage_location="-80C Freezer / Rack 4 / Box 3", status=SampleStatus.processing, received_on="2026-03-28", owner_id=staff.id, notes="Batch 2 processing.")
db.add_all([sample1, sample2, sample3])
db.flush()

db.add_all(
    [
        SampleEvent(sample_record_id=sample1.id, event_type="received", location="Sample intake desk", status="verified", performed_by=staff.id, timestamp="2026-03-29T09:15:00", notes="Chain of custody logged."),
        SampleEvent(sample_record_id=sample1.id, event_type="transferred_to_qc", location="Genomics Core Room 2", status="in_progress", performed_by=manager.id, timestamp="2026-03-30T11:00:00", notes="Moved for TapeStation QC."),
        SampleEvent(sample_record_id=sample2.id, event_type="archived_storage_check", location="Pathology Archive / Drawer 7", status="logged", performed_by=manager.id, timestamp="2026-03-30T15:30:00", notes="Storage confirmed, no deviation observed."),
    ]
)

db.add_all(
    [
        CalendarEvent(title="MiSeq preventive maintenance", event_type="maintenance", start_time="2026-04-05T09:00:00", end_time="2026-04-05T11:00:00", location="Genomics Core Room 2", related_instrument_id=miseq.id, owner_id=manager.id, description="Quarterly calibration and maintenance visit."),
        CalendarEvent(title="NGS QC batch deadline", event_type="protocol_deadline", start_time="2026-04-02T14:00:00", end_time="2026-04-02T15:00:00", location="Dashboard milestone", related_protocol_id=protocol.id, owner_id=staff.id, description="Complete QC review before library submission."),
        CalendarEvent(title="Lab Safety Training", event_type="training", start_time="2026-04-10T10:00:00", end_time="2026-04-10T12:00:00", location="Conference Room A", owner_id=admin.id, description="Annual lab safety and compliance training."),
    ]
)

db.add_all(
    [
        ReminderQueue(entity_type="instrument", entity_id=miseq.id, title="MiSeq maintenance due", due_at="2026-04-02T09:00:00", channel=NotificationChannel.email, recipient_user_id=manager.id, recipient_role="manager", status=ReminderStatus.pending, message="MiSeq preventive maintenance is due in 72 hours."),
        ReminderQueue(entity_type="sample", entity_id=sample1.id, title="Sample QC follow-up", due_at="2026-04-01T10:00:00", channel=NotificationChannel.dashboard, recipient_user_id=staff.id, recipient_role="staff", status=ReminderStatus.pending, message="Complete QC logging for sample CRC-ORG-001."),
    ]
)

# Seed some audit logs
db.add_all([
    AuditLog(action=AuditAction.create, entity_type="user", entity_id=admin.id, user_id=admin.id, user_email=admin.email, changes_json='{"role":"admin"}', timestamp=datetime.now(timezone.utc)),
    AuditLog(action=AuditAction.create, entity_type="protocol", entity_id=protocol.id, user_id=admin.id, user_email=admin.email, changes_json='{"title":"NGS Library Preparation QC Workflow"}', timestamp=datetime.now(timezone.utc)),
])

db.commit()
db.close()
print("Database seeded successfully.")
print("Admin: admin@lab.local / Admin123!")
print("PI: pi@lab.local / Pi123!")
print("Manager: manager@lab.local / Manager123!")
print("Staff: staff@lab.local / Staff123!")
print("Trainee: trainee@lab.local / Trainee123!")
