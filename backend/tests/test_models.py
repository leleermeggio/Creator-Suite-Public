from __future__ import annotations

import pytest
from sqlalchemy import select

from backend.models.user import User
from backend.models.project import Project
from backend.models.media_asset import MediaAsset
from backend.models.job import Job
from backend.models.enums import JobStatus, JobType


@pytest.mark.asyncio
async def test_create_user(db_session):
    user = User(
        email="test@example.com", hashed_password="fakehash", display_name="Tester"
    )
    db_session.add(user)
    await db_session.commit()

    result = await db_session.execute(
        select(User).where(User.email == "test@example.com")
    )
    fetched = result.scalar_one()
    assert fetched.email == "test@example.com"
    assert fetched.display_name == "Tester"
    assert fetched.id is not None
    assert fetched.created_at is not None
    assert fetched.is_active is True


@pytest.mark.asyncio
async def test_user_email_unique(db_session):
    """Duplicate emails should raise IntegrityError."""
    from sqlalchemy.exc import IntegrityError

    db_session.add(
        User(email="dupe@example.com", hashed_password="h1", display_name="A")
    )
    await db_session.commit()

    db_session.add(
        User(email="dupe@example.com", hashed_password="h2", display_name="B")
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()


@pytest.mark.asyncio
async def test_create_project(db_session):
    user = User(email="proj@test.com", hashed_password="h", display_name="P")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="My Video")
    db_session.add(project)
    await db_session.commit()

    result = await db_session.execute(select(Project).where(Project.user_id == user.id))
    p = result.scalar_one()
    assert p.title == "My Video"
    assert p.user_id == user.id


@pytest.mark.asyncio
async def test_create_media_asset(db_session):
    user = User(email="media@test.com", hashed_password="h", display_name="M")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="Media Test")
    db_session.add(project)
    await db_session.commit()

    asset = MediaAsset(
        project_id=project.id,
        user_id=user.id,
        filename="clip01.mp4",
        storage_key="media/user-1/proj-1/clip01.mp4",
        mime_type="video/mp4",
        size_bytes=1_000_000,
    )
    db_session.add(asset)
    await db_session.commit()

    result = await db_session.execute(
        select(MediaAsset).where(MediaAsset.project_id == project.id)
    )
    a = result.scalar_one()
    assert a.filename == "clip01.mp4"
    assert a.size_bytes == 1_000_000


@pytest.mark.asyncio
async def test_create_job(db_session):
    user = User(email="job@test.com", hashed_password="h", display_name="J")
    db_session.add(user)
    await db_session.commit()

    project = Project(user_id=user.id, title="Job Test")
    db_session.add(project)
    await db_session.commit()

    job = Job(
        project_id=project.id,
        user_id=user.id,
        type=JobType.TRANSCRIBE,
        status=JobStatus.QUEUED,
        input_params={"language": "it"},
    )
    db_session.add(job)
    await db_session.commit()

    result = await db_session.execute(select(Job).where(Job.project_id == project.id))
    j = result.scalar_one()
    assert j.type == JobType.TRANSCRIBE
    assert j.status == JobStatus.QUEUED
    assert j.progress == 0
    assert j.input_params == {"language": "it"}
