"""feature additions: suppliers, sops, maintenance, costs, integrations, settings,
   meetings, notebook, protocol versions, inventory SDS fields

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-09
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Extra columns on inventory_items ──────────────────────────────────
    with op.batch_alter_table("inventory_items") as batch_op:
        batch_op.add_column(sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id"), nullable=True))
        batch_op.add_column(sa.Column("catalog_number", sa.String(120), server_default=""))
        batch_op.add_column(sa.Column("unit_price", sa.Integer, server_default="0"))
        batch_op.add_column(sa.Column("last_ordered", sa.String(50), nullable=True))
        batch_op.add_column(sa.Column("lead_time_days", sa.Integer, server_default="0"))
        batch_op.add_column(sa.Column("hazard_class", sa.String(120), server_default=""))
        batch_op.add_column(sa.Column("storage_temp", sa.String(80), server_default=""))
        batch_op.add_column(sa.Column("msds_available", sa.Boolean, server_default="0"))
        batch_op.add_column(sa.Column("cas_number", sa.String(50), server_default=""))
        batch_op.add_column(sa.Column("sds_url", sa.String(500), server_default=""))

    # ── Suppliers ─────────────────────────────────────────────────────────
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(120), server_default=""),
        sa.Column("contact_name", sa.String(255), server_default=""),
        sa.Column("email", sa.String(255), server_default=""),
        sa.Column("phone", sa.String(50), server_default=""),
        sa.Column("website", sa.String(500), server_default=""),
        sa.Column("address", sa.Text, server_default=""),
        sa.Column("country", sa.String(100), server_default=""),
        sa.Column("status", sa.String(50), server_default="active"),
        sa.Column("priority", sa.String(30), server_default="medium"),
        sa.Column("rating", sa.Integer, server_default="0"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Purchase Orders ───────────────────────────────────────────────────
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id"), nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("total_amount", sa.Integer, server_default="0"),
        sa.Column("currency", sa.String(10), server_default="USD"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
        sa.Column("expected_delivery", sa.String(50), nullable=True),
    )

    # ── Supplier Reviews ──────────────────────────────────────────────────
    op.create_table(
        "supplier_reviews",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("supplier_id", sa.Integer, sa.ForeignKey("suppliers.id"), nullable=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("rating", sa.Integer, server_default="3"),
        sa.Column("comment", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime),
    )

    # ── SOPs ──────────────────────────────────────────────────────────────
    op.create_table(
        "sops",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("category", sa.String(120), server_default=""),
        sa.Column("version", sa.String(40), server_default="1.0"),
        sa.Column("content", sa.Text, server_default=""),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime, nullable=True),
        sa.Column("review_date", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Maintenance Logs ──────────────────────────────────────────────────
    op.create_table(
        "maintenance_logs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("instrument_id", sa.Integer, sa.ForeignKey("instruments.id"), nullable=True),
        sa.Column("maintenance_type", sa.String(80), server_default="preventive"),
        sa.Column("title", sa.String(255), server_default=""),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("scheduled_date", sa.String(50), nullable=True),
        sa.Column("completed_date", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), server_default="scheduled"),
        sa.Column("performed_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("cost", sa.Integer, server_default="0"),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Document Templates ────────────────────────────────────────────────
    op.create_table(
        "document_templates",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(120), server_default=""),
        sa.Column("content", sa.Text, server_default=""),
        sa.Column("variables_json", sa.Text, server_default="[]"),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Cost Entries ──────────────────────────────────────────────────────
    op.create_table(
        "cost_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("category", sa.String(120), server_default=""),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("amount", sa.Integer, server_default="0"),
        sa.Column("currency", sa.String(10), server_default="USD"),
        sa.Column("date", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), server_default="pending"),
        sa.Column("grant_id", sa.String(120), server_default=""),
        sa.Column("submitted_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Integrations ──────────────────────────────────────────────────────
    op.create_table(
        "integrations",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(80), server_default=""),
        sa.Column("status", sa.String(50), server_default="inactive"),
        sa.Column("config_json", sa.Text, server_default="{}"),
        sa.Column("last_sync", sa.DateTime, nullable=True),
        sa.Column("created_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Lab Settings ──────────────────────────────────────────────────────
    op.create_table(
        "lab_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("key", sa.String(120), unique=True, nullable=False),
        sa.Column("value", sa.Text, server_default=""),
        sa.Column("category", sa.String(80), server_default="general"),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("updated_at", sa.DateTime),
    )
    op.create_index("ix_lab_settings_key", "lab_settings", ["key"], unique=True)

    # ── Lab Meetings ──────────────────────────────────────────────────────
    op.create_table(
        "lab_meetings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("meeting_type", sa.String(80), server_default="general"),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("location", sa.String(255), server_default=""),
        sa.Column("start_time", sa.String(50), nullable=True),
        sa.Column("end_time", sa.String(50), nullable=True),
        sa.Column("status", sa.String(50), server_default="scheduled"),
        sa.Column("agenda", sa.Text, server_default=""),
        sa.Column("minutes", sa.Text, server_default=""),
        sa.Column("action_items", sa.Text, server_default=""),
        sa.Column("organizer_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("video_room_id", sa.String(120), server_default=""),
        sa.Column("created_at", sa.DateTime),
    )

    # ── Lab Notebook Entries ──────────────────────────────────────────────
    op.create_table(
        "lab_notebook_entries",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("experiment_type", sa.String(120), server_default=""),
        sa.Column("hypothesis", sa.Text, server_default=""),
        sa.Column("materials", sa.Text, server_default=""),
        sa.Column("methods", sa.Text, server_default=""),
        sa.Column("observations", sa.Text, server_default=""),
        sa.Column("results", sa.Text, server_default=""),
        sa.Column("conclusions", sa.Text, server_default=""),
        sa.Column("tags", sa.String(500), server_default=""),
        sa.Column("status", sa.String(50), server_default="draft"),
        sa.Column("author_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("witnessed_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("signed_at", sa.DateTime, nullable=True),
        sa.Column("witnessed_at", sa.DateTime, nullable=True),
        sa.Column("linked_sample_id", sa.Integer, sa.ForeignKey("sample_records.id"), nullable=True),
        sa.Column("linked_protocol_id", sa.Integer, sa.ForeignKey("protocols.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # ── Protocol Versions ─────────────────────────────────────────────────
    op.create_table(
        "protocol_versions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("protocol_id", sa.Integer, sa.ForeignKey("protocols.id"), nullable=False),
        sa.Column("version", sa.String(40), server_default=""),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("change_summary", sa.String(500), server_default=""),
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("protocol_versions")
    op.drop_table("lab_notebook_entries")
    op.drop_table("lab_meetings")
    op.drop_index("ix_lab_settings_key", table_name="lab_settings")
    op.drop_table("lab_settings")
    op.drop_table("integrations")
    op.drop_table("cost_entries")
    op.drop_table("document_templates")
    op.drop_table("maintenance_logs")
    op.drop_table("sops")
    op.drop_table("supplier_reviews")
    op.drop_table("purchase_orders")
    op.drop_table("suppliers")

    with op.batch_alter_table("inventory_items") as batch_op:
        batch_op.drop_column("sds_url")
        batch_op.drop_column("cas_number")
        batch_op.drop_column("msds_available")
        batch_op.drop_column("storage_temp")
        batch_op.drop_column("hazard_class")
        batch_op.drop_column("lead_time_days")
        batch_op.drop_column("last_ordered")
        batch_op.drop_column("unit_price")
        batch_op.drop_column("catalog_number")
        batch_op.drop_column("supplier_id")
