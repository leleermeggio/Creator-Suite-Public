from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.middleware.rate_limit import limiter
from backend.models.agent import Agent
from backend.models.user import User
from backend.schemas.agent import (
    AgentCreate,
    AgentGenerateRequest,
    AgentResponse,
    AgentUpdate,
)

router = APIRouter(prefix="/agents", tags=["agents"])


@router.post(
    "/generate", response_model=AgentResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def generate_agent(
    request: Request,
    body: AgentGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.agent_service import generate_agent_from_description

    try:
        agent = await generate_agent_from_description(db, user.id, body.description)
        return agent
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Generazione agente fallita. Riprova.",
        )


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        user_id=user.id,
        name=body.name,
        icon=body.icon,
        description=body.description,
        steps=[step.model_dump() for step in body.steps],
        default_mode=body.default_mode,
        target_platforms=body.target_platforms,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("/", response_model=list[AgentResponse])
async def list_agents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent)
        .where(
            or_(
                Agent.user_id == user.id,
                Agent.is_preset.is_(True),
            )
        )
        .order_by(Agent.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/presets", response_model=list[AgentResponse])
async def list_preset_agents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.is_preset.is_(True)).order_by(Agent.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(
            Agent.id == agent_id,
            or_(
                Agent.user_id == user.id,
                Agent.is_preset.is_(True),
            ),
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: str,
    body: AgentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.is_preset:
        raise HTTPException(status_code=403, detail="Cannot edit preset agents")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if field == "steps" and value is not None:
            step_dicts = [
                step.model_dump() if hasattr(step, "model_dump") else step
                for step in value
            ]
            setattr(agent, field, step_dicts)
        else:
            setattr(agent, field, value)

    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.user_id == user.id)
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.is_preset:
        raise HTTPException(status_code=403, detail="Cannot delete preset agents")

    await db.delete(agent)
    await db.commit()
