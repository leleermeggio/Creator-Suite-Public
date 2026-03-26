"""Seed a dev user into the database.

Usage:
    python -m backend.seeds.dev_user
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.passwords import hash_password
from backend.config import get_settings
from backend.database import Base, create_engine, create_session_factory
from backend.models.user import User

DEV_EMAIL = "dev@cazzone.local"
DEV_PASSWORD = "CazZone2024!"
DEV_DISPLAY_NAME = "Dev"


async def seed() -> None:
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = create_session_factory(engine)

    async with session_factory() as session:  # type: AsyncSession
        result = await session.execute(select(User).where(User.email == DEV_EMAIL))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Dev user already exists (id={existing.id}). Skipping.")
        else:
            user = User(
                email=DEV_EMAIL,
                hashed_password=hash_password(DEV_PASSWORD),
                display_name=DEV_DISPLAY_NAME,
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"Dev user created: id={user.id}, email={user.email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
