"""add_agents_and_missions

Revision ID: 1cd136f2d91c
Revises: bf665d623b0b
Create Date: 2026-04-04 00:00:00.000000

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1cd136f2d91c"
down_revision: Union[str, None] = "bf665d623b0b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("steps", sa.JSON(), nullable=True),
        sa.Column(
            "default_mode", sa.String(20), nullable=False, server_default="COPILOTA"
        ),
        sa.Column("target_platforms", sa.JSON(), nullable=True),
        sa.Column("is_preset", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("preset_id", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_agents_user_id", "agents", ["user_id"])

    op.create_table(
        "missions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "agent_id",
            sa.String(36),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="PENDING"),
        sa.Column(
            "current_step_index", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("mode", sa.String(20), nullable=False, server_default="COPILOTA"),
        sa.Column("step_results", sa.JSON(), nullable=True),
        sa.Column("insights", sa.JSON(), nullable=True),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_missions_agent_id", "missions", ["agent_id"])
    op.create_index("ix_missions_project_id", "missions", ["project_id"])
    op.create_index("ix_missions_user_id", "missions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_missions_user_id", table_name="missions")
    op.drop_index("ix_missions_project_id", table_name="missions")
    op.drop_index("ix_missions_agent_id", table_name="missions")
    op.drop_table("missions")
    op.drop_index("ix_agents_user_id", table_name="agents")
    op.drop_table("agents")
