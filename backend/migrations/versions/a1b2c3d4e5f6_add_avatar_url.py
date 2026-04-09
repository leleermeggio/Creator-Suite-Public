"""add_avatar_url_to_users

Revision ID: a1b2c3d4e5f6
Revises: 1cd136f2d91c
Create Date: 2026-04-09

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "1cd136f2d91c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("avatar_url", sa.String(length=512), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
