from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.agent import Agent
from backend.models.mission import Mission
from backend.models.project import Project
from backend.models.enums import MissionStatus
from backend.models.user import User
from backend.schemas.mission import (
    MissionCreate,
    MissionModeUpdate,
    MissionResponse,
    StepParamsUpdate,
)

router = APIRouter(prefix="/missions", tags=["missions"])


@router.post("/{mission_id}/start", response_model=MissionResponse)
async def start_mission(
    mission_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.mission_service import start_mission as svc_start

    try:
        return await svc_start(db, mission_id, user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.post(
    "/{mission_id}/steps/{step_index}/execute", response_model=MissionResponse
)
async def execute_step(
    mission_id: str,
    step_index: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.mission_service import execute_step as svc_execute

    try:
        return await svc_execute(db, mission_id, step_index, user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.put(
    "/{mission_id}/steps/{step_index}/params", response_model=MissionResponse
)
async def update_step_params(
    mission_id: str,
    step_index: int,
    body: StepParamsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.mission_service import update_step_params as svc_params

    try:
        return await svc_params(db, mission_id, step_index, user.id, body.parameters)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        )


@router.post("/", response_model=MissionResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    body: MissionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate agent_id belongs to user or is preset
    agent_result = await db.execute(
        select(Agent).where(Agent.id == body.agent_id)
    )
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.is_preset and agent.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your agent")

    # Validate project_id belongs to user
    project_result = await db.execute(
        select(Project).where(Project.id == body.project_id)
    )
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your project")

    mission = Mission(
        agent_id=body.agent_id,
        project_id=body.project_id,
        user_id=user.id,
        status=MissionStatus.PENDING,
        current_step_index=0,
        mode=body.mode,
        step_results=[],
        insights=[],
        started_at=datetime.now(timezone.utc),
        completed_at=None,
    )
    db.add(mission)
    await db.commit()
    await db.refresh(mission)
    return mission


@router.get("/", response_model=list[MissionResponse])
async def list_missions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission)
        .where(Mission.user_id == user.id)
        .order_by(Mission.started_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{mission_id}", response_model=MissionResponse)
async def get_mission(
    mission_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    return mission


@router.put("/{mission_id}/mode", response_model=MissionResponse)
async def update_mission_mode(
    mission_id: str,
    body: MissionModeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    mission.mode = body.mode
    await db.commit()
    await db.refresh(mission)
    return mission


@router.post("/{mission_id}/pause", response_model=MissionResponse)
async def pause_mission(
    mission_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission.status != MissionStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mission must be RUNNING to pause",
        )

    mission.status = MissionStatus.PAUSED
    await db.commit()
    await db.refresh(mission)
    return mission


@router.post("/{mission_id}/resume", response_model=MissionResponse)
async def resume_mission(
    mission_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    if mission.status != MissionStatus.PAUSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mission must be PAUSED to resume",
        )

    mission.status = MissionStatus.RUNNING
    await db.commit()
    await db.refresh(mission)
    return mission


@router.post("/{mission_id}/steps/{step_index}/skip", response_model=MissionResponse)
async def skip_step(
    mission_id: str,
    step_index: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    step_results = list(mission.step_results or [])

    # Find or create step result
    step_found = False
    for step in step_results:
        if step.get("step_index") == step_index:
            step["status"] = "SKIPPED"
            step_found = True
            break

    if not step_found:
        step_results.append({
            "step_index": step_index,
            "status": "SKIPPED",
            "job_id": None,
            "output": None,
            "started_at": None,
            "completed_at": None,
        })

    mission.step_results = step_results
    await db.commit()
    await db.refresh(mission)
    return mission


@router.post(
    "/{mission_id}/insights/{insight_id}/accept", response_model=MissionResponse
)
async def accept_insight(
    mission_id: str,
    insight_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    insights = list(mission.insights or [])

    insight_found = False
    for insight in insights:
        if insight.get("id") == insight_id:
            insight["status"] = "ACCEPTED"
            insight_found = True
            break

    if not insight_found:
        raise HTTPException(status_code=404, detail="Insight not found")

    mission.insights = insights
    await db.commit()
    await db.refresh(mission)
    return mission


@router.post(
    "/{mission_id}/insights/{insight_id}/dismiss", response_model=MissionResponse
)
async def dismiss_insight(
    mission_id: str,
    insight_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Mission).where(
            Mission.id == mission_id,
            Mission.user_id == user.id,
        )
    )
    mission = result.scalar_one_or_none()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission not found")

    insights = list(mission.insights or [])

    insight_found = False
    for insight in insights:
        if insight.get("id") == insight_id:
            insight["status"] = "DISMISSED"
            insight_found = True
            break

    if not insight_found:
        raise HTTPException(status_code=404, detail="Insight not found")

    mission.insights = insights
    await db.commit()
    await db.refresh(mission)
    return mission
