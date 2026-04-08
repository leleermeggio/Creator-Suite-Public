from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.team import Team, TeamMember, TeamRole
from backend.models.user import User
from backend.schemas.collaboration import (
    TeamCreate,
    TeamMemberAdd,
    TeamMemberResponse,
    TeamMemberUpdate,
    TeamResponse,
)

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    team = Team(name=body.name, owner_id=user.id)
    db.add(team)
    await db.commit()
    await db.refresh(team)

    # Auto-add owner as member
    member = TeamMember(team_id=team.id, user_id=user.id, role=TeamRole.OWNER)
    db.add(member)
    await db.commit()

    return team


@router.get("/", response_model=list[TeamResponse])
async def list_teams(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
        .order_by(Team.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    team = await _get_team_as_member(team_id, user.id, db)
    return team


@router.post(
    "/{team_id}/members",
    response_model=TeamMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    team_id: str,
    body: TeamMemberAdd,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_team_role(team_id, user.id, db, min_role=TeamRole.OWNER)

    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == body.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already a member")

    member = TeamMember(team_id=team_id, user_id=body.user_id, role=body.role)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.put("/{team_id}/members/{member_user_id}", response_model=TeamMemberResponse)
async def update_member_role(
    team_id: str,
    member_user_id: str,
    body: TeamMemberUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_team_role(team_id, user.id, db, min_role=TeamRole.OWNER)

    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == member_user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    member.role = body.role
    await db.commit()
    await db.refresh(member)
    return member


@router.delete(
    "/{team_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_member(
    team_id: str,
    member_user_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_team_role(team_id, user.id, db, min_role=TeamRole.OWNER)

    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == member_user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove team owner")

    await db.delete(member)
    await db.commit()


@router.get("/{team_id}/members", response_model=list[TeamMemberResponse])
async def list_members(
    team_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_team_as_member(team_id, user.id, db)
    result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id))
    return list(result.scalars().all())


# --- Helpers ---


async def _get_team_as_member(team_id: str, user_id: str, db: AsyncSession) -> Team:
    result = await db.execute(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(Team.id == team_id, TeamMember.user_id == user_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return team


async def _require_team_role(
    team_id: str, user_id: str, db: AsyncSession, min_role: TeamRole = TeamRole.OWNER
) -> TeamMember:
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id, TeamMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team not found")

    role_hierarchy = {TeamRole.OWNER: 3, TeamRole.EDITOR: 2, TeamRole.VIEWER: 1}
    if role_hierarchy.get(member.role, 0) < role_hierarchy.get(min_role, 0):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return member
