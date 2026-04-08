#!/usr/bin/env bash
# ============================================================
# AGENT: Task 2 — Templates Batch 1
# Implements: impact.py, split.py, gradient_bar.py, bold_side.py
# Type: Backend Python agent
# Requires: Task 1 complete
# Run: bash scripts/agents/task-2-templates-batch1.sh
# ============================================================
set -e

PROJECT="D:/Projects/GIt repo/Creator-Suite-Public"
PLAN="docs/superpowers/plans/2026-03-27-thumbnail-generator.md"
TASK="Task 2"

cd "$PROJECT"

claude --dangerously-skip-permissions -p "
You are a senior Python backend developer specializing in Pillow image processing.
Working directory: $PROJECT
Plan: $PLAN

Implement $TASK ONLY (Templates Batch 1) from the plan.
Steps to complete:
  2.1 Create backend/services/thumbnail_templates/impact.py (full code in plan)
  2.2 Create backend/services/thumbnail_templates/split.py (full code in plan)
  2.3 Create backend/services/thumbnail_templates/gradient_bar.py (full code in plan)
  2.4 Create backend/services/thumbnail_templates/bold_side.py (full code in plan)
  2.5 Commit

Rules:
- Do NOT implement any other task
- Copy the code exactly from the plan — do not improvise
- Use superpowers:executing-plans to track progress
"
