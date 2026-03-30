from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from backend.models.enums import ControlMode, MissionStatus


class StepResult(BaseModel):
    step_index: int
    status: str
    job_id: str | None = None
    output: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class InsightCard(BaseModel):
    id: str
    type: str
    message: str
    action_tool: str | None = None
    action_params: dict[str, Any] | None = None
    status: str = "PENDING"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class MissionCreate(BaseModel):
    agent_id: str
    project_id: str
    mode: ControlMode = ControlMode.COPILOTA


class MissionResponse(BaseModel):
    id: str
    agent_id: str
    project_id: str
    user_id: str
    status: str
    current_step_index: int
    mode: str
    step_results: list[dict] | None
    insights: list[dict] | None
    started_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class MissionModeUpdate(BaseModel):
    mode: ControlMode


class StepParamsUpdate(BaseModel):
    parameters: dict[str, Any]
