"""
0004 — Privacy, Consent & GDPR tables
Adds:
  - consent_records
  - data_erasure_requests
  - data_export_requests
  - privacy_policy_versions
  - New columns on users: failed_login_attempts, locked_until, last_login_at,
      password_changed_at, must_change_password
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    # ── users: security columns ────────────────────────────────────────────────
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("locked_until", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("last_login_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("password_changed_at", sa.DateTime(), nullable=True))
        batch.add_column(sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default="0"))

    # ── consent_records ────────────────────────────────────────────────────────
    op.create_table(
        "consent_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("purpose", sa.String(60), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("granted_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("version", sa.String(20), nullable=False, server_default="1.0"),
        sa.Column("ip_address", sa.String(60), nullable=False, server_default=""),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
    )

    # ── data_erasure_requests ──────────────────────────────────────────────────
    op.create_table(
        "data_erasure_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("reviewed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=False, server_default=""),
    )

    # ── data_export_requests ───────────────────────────────────────────────────
    op.create_table(
        "data_export_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("export_url", sa.String(500), nullable=False, server_default=""),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )

    # ── privacy_policy_versions ────────────────────────────────────────────────
    op.create_table(
        "privacy_policy_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("version", sa.String(20), nullable=False, unique=True, index=True),
        sa.Column("effective_date", sa.String(50), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("published_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_table("privacy_policy_versions")
    op.drop_table("data_export_requests")
    op.drop_table("data_erasure_requests")
    op.drop_table("consent_records")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("must_change_password")
        batch.drop_column("password_changed_at")
        batch.drop_column("last_login_at")
        batch.drop_column("locked_until")
        batch.drop_column("failed_login_attempts")
