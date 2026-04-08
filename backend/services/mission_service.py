from __future__ import annotations

import logging
import operator as _op
import re as _re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.agent import Agent
from backend.models.enums import ControlMode, JobStatus, JobType, MissionStatus
from backend.models.job import Job
from backend.models.mission import Mission

logger = logging.getLogger(__name__)

# ── Tool → JobType mapping ─────────────────────────────────────────────────────

_TOOL_TO_JOB_TYPE: dict[str, JobType] = {
    "transcribe": JobType.TRANSCRIBE,
    "jumpcut": JobType.JUMPCUT,
    "caption": JobType.CAPTION,
    "export": JobType.EXPORT,
    "audio_cleanup": JobType.AUDIO_CLEANUP,
    "thumbnail": JobType.THUMBNAIL,
    "translate": JobType.TRANSLATE,
    "tts": JobType.TTS,
    "download": JobType.DOWNLOAD,
    "convert": JobType.CONVERT,
}


# ── Mode logic helpers ─────────────────────────────────────────────────────────


def _should_auto_run(step_def: dict[str, Any], mode: ControlMode) -> bool:
    """Return True if this step should run automatically given the current control mode."""
    if mode == ControlMode.REGISTA:
        return False
    if mode == ControlMode.AUTOPILOTA:
        return True
    # COPILOTA: respect per-step auto_run flag
    return bool(step_def.get("auto_run", False))


_CONDITION_RE = _re.compile(r"^(\w+)\s*(>|<|>=|<=|==|!=)\s*(\d+(?:\.\d+)?)$")
_OPS = {
    ">": _op.gt,
    "<": _op.lt,
    ">=": _op.ge,
    "<=": _op.le,
    "==": _op.eq,
    "!=": _op.ne,
}


def _evaluate_condition(condition: str | None, context: dict[str, Any]) -> bool:
    """Evaluate a step condition expression like 'duration > 60'.

    Only simple `<variable> <op> <number>` comparisons are supported.
    Returns True (step should run) when condition is None or cannot be parsed.
    """
    if not condition:
        return True
    match = _CONDITION_RE.match(condition.strip())
    if not match:
        logger.warning(
            "⚠️ Condition syntax not supported (%r) — defaulting to True", condition
        )
        return True
    var_name, op_str, value_str = match.groups()
    left = context.get(var_name)
    if left is None:
        return True
    try:
        return _OPS[op_str](float(left), float(value_str))
    except (TypeError, ValueError) as exc:
        logger.warning(
            "⚠️ Condition eval failed (%r): %s — defaulting to True", condition, exc
        )
        return True


# ── Internal helpers ───────────────────────────────────────────────────────────


def _build_step_result(
    step_index: int,
    status: str = "PENDING",
    job_id: str | None = None,
    output: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "step_index": step_index,
        "status": status,
        "job_id": job_id,
        "output": output,
        "started_at": now if status == "RUNNING" else None,
        "completed_at": now if status in ("COMPLETED", "SKIPPED", "FAILED") else None,
    }


async def _fetch_mission_and_agent(
    db: AsyncSession,
    mission_id: str,
    user_id: str,
) -> tuple[Mission, Agent]:
    """Load mission + its agent, validating user ownership. Raises ValueError on not-found."""
    mission_result = await db.execute(
        select(Mission).where(Mission.id == mission_id, Mission.user_id == user_id)
    )
    mission = mission_result.scalar_one_or_none()
    if not mission:
        raise ValueError(f"Mission {mission_id!r} not found")

    agent_result = await db.execute(select(Agent).where(Agent.id == mission.agent_id))
    agent = agent_result.scalar_one_or_none()
    if not agent:
        raise ValueError(
            f"Agent {mission.agent_id!r} not found for mission {mission_id!r}"
        )

    return mission, agent


def _upsert_step_result(
    step_results: list[dict[str, Any]],
    new_result: dict[str, Any],
) -> list[dict[str, Any]]:
    """Replace an existing step result by step_index, or append if not present."""
    idx = new_result["step_index"]
    for i, sr in enumerate(step_results):
        if sr.get("step_index") == idx:
            step_results[i] = new_result
            return step_results
    step_results.append(new_result)
    return step_results


# ── Public service API ─────────────────────────────────────────────────────────


async def start_mission(
    db: AsyncSession,
    mission_id: str,
    user_id: str,
) -> Mission:
    """Transition mission PENDING → RUNNING and auto-execute the first eligible step."""
    mission, agent = await _fetch_mission_and_agent(db, mission_id, user_id)

    if mission.status != MissionStatus.PENDING:
        raise ValueError(
            f"Mission must be PENDING to start (current: {mission.status.value})"
        )

    mission.status = MissionStatus.RUNNING
    mission.current_step_index = 0
    mission.step_results = []
    await db.commit()
    await db.refresh(mission)

    steps = agent.steps or []
    if steps and _should_auto_run(steps[0], mission.mode):
        mission = await execute_step(db, mission_id, 0, user_id)

    return mission


async def execute_step(
    db: AsyncSession,
    mission_id: str,
    step_index: int,
    user_id: str,
) -> Mission:
    """Execute a specific step: evaluate condition, create Job record, update step_results."""
    mission, agent = await _fetch_mission_and_agent(db, mission_id, user_id)

    if mission.status not in (MissionStatus.RUNNING, MissionStatus.PAUSED):
        raise ValueError(
            f"Mission must be RUNNING or PAUSED to execute steps (current: {mission.status.value})"
        )

    steps = agent.steps or []
    if step_index >= len(steps):
        raise ValueError(
            f"Step index {step_index} out of range (agent has {len(steps)} steps)"
        )

    step_def = steps[step_index]
    tool_id: str = step_def.get("tool_id", "")

    # Evaluate optional condition (e.g. "duration > 60")
    context: dict[str, Any] = {"duration": 0}
    if not _evaluate_condition(step_def.get("condition"), context):
        return await _skip_step(db, mission, agent, step_index)

    # Create a trackable Job record for known tool types
    job_id: str | None = None
    job_type = _TOOL_TO_JOB_TYPE.get(tool_id)
    if job_type:
        job = Job(
            project_id=mission.project_id,
            user_id=user_id,
            type=job_type,
            status=JobStatus.QUEUED,
            input_params={
                "mission_id": mission_id,
                "step_index": step_index,
                **step_def.get("parameters", {}),
            },
        )
        db.add(job)
        await db.flush()
        job_id = job.id

    step_results = list(mission.step_results or [])
    step_results = _upsert_step_result(
        step_results,
        _build_step_result(step_index, status="RUNNING", job_id=job_id),
    )

    mission.step_results = step_results
    mission.current_step_index = step_index
    mission.status = MissionStatus.RUNNING
    await db.commit()
    await db.refresh(mission)

    # ── Inline dispatch: run the tool and auto-complete ──────────────────
    from backend.services.step_executor import build_step_context, dispatch_step

    previous_outputs = [
        {
            "tool_id": steps[sr["step_index"]].get("tool_id", ""),
            "output": sr.get("output", {}),
        }
        for sr in step_results
        if sr.get("status") == "COMPLETED" and sr.get("output")
    ]

    ctx = build_step_context(
        project_id=mission.project_id,
        user_id=user_id,
        media_path=None,
        previous_outputs=previous_outputs,
    )

    try:
        output = await dispatch_step(
            tool_id=tool_id,
            parameters=step_def.get("parameters", {}),
            context=ctx,
        )
    except Exception as exc:
        logger.error("❌ dispatch_step raised for step %d: %s", step_index, exc)
        output = {"error": str(exc)}

    # If the tool returned an error, mark FAILED; otherwise COMPLETED
    if output.get("error"):
        logger.warning("⚠️ Step %d returned error: %s", step_index, output["error"])

    mission = await complete_step(db, mission_id, step_index, user_id, output)
    return mission


async def complete_step(
    db: AsyncSession,
    mission_id: str,
    step_index: int,
    user_id: str,
    output: dict[str, Any] | None = None,
) -> Mission:
    """Mark a step COMPLETED, persist its output, and advance to the next step.

    If the next step is auto-runnable in the current mode, it is triggered immediately.
    If the completed step was the last one, the mission is marked COMPLETED.
    """
    mission, agent = await _fetch_mission_and_agent(db, mission_id, user_id)

    now = datetime.now(timezone.utc).isoformat()
    step_results = list(mission.step_results or [])
    # Preserve existing job_id from the RUNNING state
    existing_result = next(
        (sr for sr in step_results if sr.get("step_index") == step_index), None
    )
    preserved_job_id = existing_result.get("job_id") if existing_result else None

    step_results = _upsert_step_result(
        step_results,
        {
            **_build_step_result(step_index, status="COMPLETED", output=output),
            "job_id": preserved_job_id,
            "completed_at": now,
        },
    )
    mission.step_results = step_results

    steps = agent.steps or []
    next_index = step_index + 1

    if next_index >= len(steps):
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(mission)
        return mission

    mission.current_step_index = next_index
    await db.commit()
    await db.refresh(mission)

    next_step_def = steps[next_index]
    if _should_auto_run(next_step_def, mission.mode):
        mission = await execute_step(db, mission_id, next_index, user_id)

    return mission


async def _skip_step(
    db: AsyncSession,
    mission: Mission,
    agent: Agent,
    step_index: int,
) -> Mission:
    """Internal: mark a step SKIPPED and advance mission index."""
    now = datetime.now(timezone.utc).isoformat()
    step_results = list(mission.step_results or [])
    skipped = _build_step_result(step_index, status="SKIPPED")
    skipped["completed_at"] = now
    step_results = _upsert_step_result(step_results, skipped)
    mission.step_results = step_results

    steps = agent.steps or []
    next_index = step_index + 1
    if next_index >= len(steps):
        mission.status = MissionStatus.COMPLETED
        mission.completed_at = datetime.now(timezone.utc)
    else:
        mission.current_step_index = next_index

    await db.commit()
    await db.refresh(mission)
    return mission


async def update_step_params(
    db: AsyncSession,
    mission_id: str,
    step_index: int,
    user_id: str,
    parameters: dict[str, Any],
) -> Mission:
    """Merge new parameters into a pending/upcoming step definition on the agent."""
    mission, agent = await _fetch_mission_and_agent(db, mission_id, user_id)

    steps = list(agent.steps or [])
    if step_index >= len(steps):
        raise ValueError(
            f"Step index {step_index} out of range (agent has {len(steps)} steps)"
        )

    for sr in mission.step_results or []:
        if sr.get("step_index") == step_index and sr.get("status") in (
            "RUNNING",
            "COMPLETED",
        ):
            raise ValueError(
                f"Step {step_index} is already {sr['status']} — cannot update parameters"
            )

    existing_params = steps[step_index].get("parameters", {})
    steps[step_index] = {
        **steps[step_index],
        "parameters": {**existing_params, **parameters},
    }
    agent.steps = steps
    await db.commit()
    await db.refresh(mission)
    return mission
