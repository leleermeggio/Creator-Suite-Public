from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from backend.models.enums import ControlMode


class StepDefinition(BaseModel):
    tool_id: str
    label: str
    parameters: dict[str, Any] = {}
    auto_run: bool = True
    required: bool = True
    condition: str | None = None


class AgentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    icon: str = Field(default="🤖", max_length=10)
    description: str | None = Field(default=None, max_length=1000)
    steps: list[StepDefinition] = []
    default_mode: ControlMode = ControlMode.COPILOTA
    target_platforms: list[str] = []


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    icon: str | None = Field(default=None, max_length=10)
    description: str | None = None
    steps: list[StepDefinition] | None = None
    default_mode: ControlMode | None = None
    target_platforms: list[str] | None = None


class AgentResponse(BaseModel):
    id: str
    user_id: str
    name: str
    icon: str
    description: str | None
    steps: list[dict] | None
    default_mode: str
    target_platforms: list[str] | None
    is_preset: bool
    preset_id: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
