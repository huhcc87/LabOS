"""Add IoT sensors, readings, and alerts tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-15
"""

from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'iot_sensors',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sensor_key', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('location', sa.String(200), nullable=False, server_default=''),
        sa.Column('sensor_type', sa.String(50), nullable=False, server_default='freezer'),
        sa.Column('unit', sa.String(20), nullable=False, server_default='°C'),
        sa.Column('target', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('min_threshold', sa.Float(), nullable=False, server_default='-85.0'),
        sa.Column('max_threshold', sa.Float(), nullable=False, server_default='-70.0'),
        sa.Column('api_key', sa.String(64), nullable=False, index=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('notify_email', sa.String(500), nullable=False, server_default=''),
        sa.Column('alert_cooldown_minutes', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'iot_readings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sensor_id', sa.Integer(), sa.ForeignKey('iot_sensors.id'), nullable=False, index=True),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(), nullable=False, index=True),
    )

    op.create_table(
        'iot_alerts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sensor_id', sa.Integer(), sa.ForeignKey('iot_sensors.id'), nullable=False, index=True),
        sa.Column('severity', sa.String(20), nullable=False, server_default='warning'),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False, server_default=''),
        sa.Column('triggered_at', sa.DateTime(), nullable=False, index=True),
        sa.Column('acknowledged', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('notified_emails', sa.String(500), nullable=False, server_default=''),
    )


def downgrade() -> None:
    op.drop_table('iot_alerts')
    op.drop_table('iot_readings')
    op.drop_table('iot_sensors')
