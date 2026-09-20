"""Electronic signatures (21 CFR Part 11)

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-15
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "electronic_signatures",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", sa.String(120), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("entity_title", sa.String(500), nullable=False, server_default=""),
        sa.Column("signer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("signer_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("signer_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("reason", sa.Enum("approved", "reviewed", "authored", "witnessed", "rejected", name="signaturereason"), nullable=False),
        sa.Column("meaning", sa.String(500), nullable=False, server_default=""),
        sa.Column("ip_address", sa.String(60), nullable=False, server_default=""),
        sa.Column("user_agent", sa.String(500), nullable=False, server_default=""),
        sa.Column("content_hash", sa.String(128), nullable=False, server_default=""),
        sa.Column("signed_at", sa.DateTime(), nullable=False),
        sa.Column("is_valid", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("invalidated_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_electronic_signatures_entity_type", "electronic_signatures", ["entity_type"])
    op.create_index("ix_electronic_signatures_entity_id", "electronic_signatures", ["entity_id"])
    op.create_index("ix_electronic_signatures_signer_id", "electronic_signatures", ["signer_id"])
    op.create_index("ix_electronic_signatures_signed_at", "electronic_signatures", ["signed_at"])


def downgrade():
    op.drop_table("electronic_signatures")
