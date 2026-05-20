"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-31

"""

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), default="staff"),
        sa.Column("is_active", sa.Boolean, default=True),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # Protocols
    op.create_table(
        "protocols",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("field", sa.String(120)),
        sa.Column("version", sa.String(40), default="1.0"),
        sa.Column("description", sa.Text),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("reminder_days_before", sa.Integer, default=3),
        sa.Column("created_at", sa.DateTime),
    )

    # Workflow steps
    op.create_table(
        "workflow_steps",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("protocol_id", sa.Integer, sa.ForeignKey("protocols.id")),
        sa.Column("step_order", sa.Integer),
        sa.Column("title", sa.String(255)),
        sa.Column("instructions", sa.Text),
        sa.Column("estimated_minutes", sa.Integer, default=15),
        sa.Column("requires_signoff", sa.Boolean, default=False),
    )

    # Instruments
    op.create_table(
        "instruments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255)),
        sa.Column("category", sa.String(100)),
        sa.Column("location", sa.String(255)),
        sa.Column("maintenance_frequency_days", sa.Integer, default=30),
        sa.Column("next_maintenance_date", sa.String(30)),
        sa.Column("status", sa.String(50), default="available"),
        sa.Column("notes", sa.Text, default=""),
    )

    # Bookings
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("instrument_id", sa.Integer, sa.ForeignKey("instruments.id")),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("purpose", sa.String(255)),
        sa.Column("start_time", sa.String(50)),
        sa.Column("end_time", sa.String(50)),
        sa.Column("status", sa.String(30), default="reserved"),
    )

    # Tasks
    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255)),
        sa.Column("description", sa.Text, default=""),
        sa.Column("due_date", sa.String(50)),
        sa.Column("status", sa.String(30), default="pending"),
        sa.Column("assigned_to", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("reminder_type", sa.String(50), default="email"),
        sa.Column("related_protocol_id", sa.Integer, sa.ForeignKey("protocols.id")),
    )

    # Compliance logs
    op.create_table(
        "compliance_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255)),
        sa.Column("category", sa.String(100)),
        sa.Column("details", sa.Text),
        sa.Column("logged_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime),
    )

    # Feedback
    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("subject", sa.String(255)),
        sa.Column("message", sa.Text),
        sa.Column("module", sa.String(100), default="general"),
        sa.Column("submitted_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("status", sa.String(50), default="new"),
        sa.Column("created_at", sa.DateTime),
    )

    # Training records
    op.create_table(
        "training_records",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("title", sa.String(255)),
        sa.Column("instrument_id", sa.Integer, sa.ForeignKey("instruments.id")),
        sa.Column("protocol_id", sa.Integer, sa.ForeignKey("protocols.id")),
        sa.Column("completed_on", sa.String(50)),
        sa.Column("expires_on", sa.String(50)),
        sa.Column("status", sa.String(30), default="active"),
        sa.Column("notes", sa.Text, default=""),
    )

    # Inventory items
    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255)),
        sa.Column("category", sa.String(120)),
        sa.Column("lot_number", sa.String(120), default=""),
        sa.Column("quantity", sa.Integer, default=0),
        sa.Column("unit", sa.String(30), default="units"),
        sa.Column("reorder_threshold", sa.Integer, default=0),
        sa.Column("storage_location", sa.String(255), default=""),
        sa.Column("barcode", sa.String(120), default=""),
        sa.Column("expires_on", sa.String(50)),
        sa.Column("notes", sa.Text, default=""),
    )

    # Incident reports
    op.create_table(
        "incident_reports",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255)),
        sa.Column("area", sa.String(120)),
        sa.Column("severity", sa.String(20), default="low"),
        sa.Column("description", sa.Text),
        sa.Column("corrective_action", sa.Text, default=""),
        sa.Column("status", sa.String(50), default="open"),
        sa.Column("reported_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime),
    )

    # Study workspaces
    op.create_table(
        "study_workspaces",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255)),
        sa.Column("field", sa.String(120)),
        sa.Column("lead_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("milestone", sa.String(255), default=""),
        sa.Column("status", sa.String(50), default="active"),
        sa.Column("description", sa.Text, default=""),
    )

    # Notification rules
    op.create_table(
        "notification_rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255)),
        sa.Column("trigger_event", sa.String(120)),
        sa.Column("channel", sa.String(30), default="dashboard"),
        sa.Column("recipient_role", sa.String(50), default="staff"),
        sa.Column("lead_time_hours", sa.Integer, default=24),
        sa.Column("is_active", sa.Boolean, default=True),
    )

    # Sample records
    op.create_table(
        "sample_records",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sample_id", sa.String(120), unique=True),
        sa.Column("barcode", sa.String(120), default=""),
        sa.Column("sample_type", sa.String(120)),
        sa.Column("source", sa.String(120), default=""),
        sa.Column("project_id", sa.Integer, sa.ForeignKey("study_workspaces.id")),
        sa.Column("protocol_id", sa.Integer, sa.ForeignKey("protocols.id")),
        sa.Column("storage_location", sa.String(255), default=""),
        sa.Column("status", sa.String(30), default="received"),
        sa.Column("received_on", sa.String(50)),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("notes", sa.Text, default=""),
    )

    # Sample events
    op.create_table(
        "sample_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("sample_record_id", sa.Integer, sa.ForeignKey("sample_records.id")),
        sa.Column("event_type", sa.String(120)),
        sa.Column("location", sa.String(255), default=""),
        sa.Column("status", sa.String(80), default="logged"),
        sa.Column("performed_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("timestamp", sa.String(50)),
        sa.Column("notes", sa.Text, default=""),
    )

    # Calendar events
    op.create_table(
        "calendar_events",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255)),
        sa.Column("event_type", sa.String(120)),
        sa.Column("start_time", sa.String(50)),
        sa.Column("end_time", sa.String(50)),
        sa.Column("location", sa.String(255), default=""),
        sa.Column("related_instrument_id", sa.Integer, sa.ForeignKey("instruments.id")),
        sa.Column("related_task_id", sa.Integer, sa.ForeignKey("tasks.id")),
        sa.Column("related_protocol_id", sa.Integer, sa.ForeignKey("protocols.id")),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("description", sa.Text, default=""),
    )

    # Reminder queue
    op.create_table(
        "reminder_queue",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_type", sa.String(120)),
        sa.Column("entity_id", sa.Integer),
        sa.Column("title", sa.String(255)),
        sa.Column("due_at", sa.String(50)),
        sa.Column("channel", sa.String(30), default="dashboard"),
        sa.Column("recipient_user_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("recipient_role", sa.String(50), default="staff"),
        sa.Column("status", sa.String(30), default="pending"),
        sa.Column("last_attempt_at", sa.String(50)),
        sa.Column("message", sa.Text, default=""),
    )

    # Attachments
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_type", sa.String(120)),
        sa.Column("entity_id", sa.Integer),
        sa.Column("filename", sa.String(255)),
        sa.Column("filepath", sa.String(500)),
        sa.Column("uploaded_by", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("uploaded_at", sa.DateTime),
    )

    # Audit logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("action", sa.String(20)),
        sa.Column("entity_type", sa.String(120)),
        sa.Column("entity_id", sa.Integer),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id")),
        sa.Column("user_email", sa.String(255), default=""),
        sa.Column("changes_json", sa.Text, default="{}"),
        sa.Column("timestamp", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("attachments")
    op.drop_table("reminder_queue")
    op.drop_table("calendar_events")
    op.drop_table("sample_events")
    op.drop_table("sample_records")
    op.drop_table("notification_rules")
    op.drop_table("study_workspaces")
    op.drop_table("incident_reports")
    op.drop_table("inventory_items")
    op.drop_table("training_records")
    op.drop_table("feedback")
    op.drop_table("compliance_logs")
    op.drop_table("tasks")
    op.drop_table("bookings")
    op.drop_table("instruments")
    op.drop_table("workflow_steps")
    op.drop_table("protocols")
    op.drop_table("users")
