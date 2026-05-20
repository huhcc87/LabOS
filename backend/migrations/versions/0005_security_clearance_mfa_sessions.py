"""Security clearance, MFA, session tracking, and security events

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    # ── New columns on users ───────────────────────────────────────────────
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column(
            "security_clearance",
            sa.Enum("level_1", "level_2", "level_3", "level_4", "level_5",
                    name="securityclearance"),
            nullable=False, server_default="level_1",
        ))
        batch.add_column(sa.Column("totp_secret", sa.String(64), nullable=True))
        batch.add_column(sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("mfa_backup_codes", sa.Text(), nullable=False, server_default="[]"))

    # ── data_classification on sample_records ─────────────────────────────
    with op.batch_alter_table("sample_records") as batch:
        batch.add_column(sa.Column(
            "data_classification",
            sa.Enum("public", "internal", "confidential", "restricted", "phi",
                    name="dataclassification"),
            nullable=False, server_default="internal",
        ))

    # ── data_classification on lab_notebook_entries ───────────────────────
    with op.batch_alter_table("lab_notebook_entries") as batch:
        batch.add_column(sa.Column(
            "data_classification",
            sa.Enum("public", "internal", "confidential", "restricted", "phi",
                    name="dataclassification"),
            nullable=False, server_default="internal",
        ))

    # ── user_sessions table ───────────────────────────────────────────────
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("token_hash", sa.String(128), nullable=False, unique=True, index=True),
        sa.Column("ip_address", sa.String(60), nullable=False, server_default=""),
        sa.Column("user_agent", sa.String(500), nullable=False, server_default=""),
        sa.Column("device_hint", sa.String(120), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_active_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="0"),
    )

    # ── security_events table ─────────────────────────────────────────────
    op.create_table(
        "security_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "event_type",
            sa.Enum(
                "login_success", "login_failed", "login_locked",
                "mfa_success", "mfa_failed", "mfa_enabled", "mfa_disabled",
                "permission_denied", "clearance_changed", "session_revoked",
                "password_changed", "account_locked", "account_unlocked",
                "data_exported", "data_erased",
                name="securityeventtype",
            ),
            nullable=False, index=True,
        ),
        sa.Column(
            "severity",
            sa.Enum("info", "warning", "critical", name="securityeventseverity"),
            nullable=False, server_default="info", index=True,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("user_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("ip_address", sa.String(60), nullable=False, server_default=""),
        sa.Column("user_agent", sa.String(500), nullable=False, server_default=""),
        sa.Column("details", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("timestamp", sa.DateTime(), nullable=False, index=True),
    )


def downgrade():
    op.drop_table("security_events")
    op.drop_table("user_sessions")

    with op.batch_alter_table("lab_notebook_entries") as batch:
        batch.drop_column("data_classification")

    with op.batch_alter_table("sample_records") as batch:
        batch.drop_column("data_classification")

    with op.batch_alter_table("users") as batch:
        batch.drop_column("mfa_backup_codes")
        batch.drop_column("mfa_enabled")
        batch.drop_column("totp_secret")
        batch.drop_column("security_clearance")
