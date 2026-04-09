from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backend.models.project_member import ProjectRole
from backend.models.team import TeamRole

# --- Teams ---


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

    def __init__(self, **data):
        if "name" in data:
            data["name"] = data["name"].strip()
            if not data["name"]:
                raise ValueError("Name cannot be empty or whitespace only")
        super().__init__(**data)


class TeamResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TeamMemberAdd(BaseModel):
    user_id: str
    role: TeamRole = TeamRole.VIEWER


class TeamMemberUpdate(BaseModel):
    role: TeamRole


class TeamMemberResponse(BaseModel):
    id: str
    team_id: str
    user_id: str
    role: TeamRole
    invited_at: datetime
    accepted_at: datetime | None
    model_config = {"from_attributes": True}


# --- Project Sharing ---


class ProjectShareRequest(BaseModel):
    user_id: str
    role: ProjectRole = ProjectRole.VIEWER


class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: ProjectRole
    granted_at: datetime
    model_config = {"from_attributes": True}


# --- Comments ---


class CommentCreate(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    timeline_timestamp: float | None = None
    asset_id: str | None = None

    def __init__(self, **data):
        if "text" in data:
            data["text"] = data["text"].strip()
        super().__init__(**data)


class CommentUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=5000)


class CommentResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    timeline_timestamp: float | None
    asset_id: str | None
    text: str
    resolved: bool
    created_at: datetime
    updated_at: datetime | None
    model_config = {"from_attributes": True}
