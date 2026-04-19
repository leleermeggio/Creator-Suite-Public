---
type: decision
status: active
priority: 2
date: 2026-04-07
owner: "Emanuele"
context: "Replace broken Vulkan llama-server with fresh CUDA build, unlock 128K context, wire OpenClaw + MCP servers"
source: ".raw/superpowers-plans/2026-04-07-local-llm-fresh-setup.md"
spec: ".raw/superpowers-specs/2026-04-07-local-llm-setup-design.md"
tags: [decision, plan, llm, tooling]
created: 2026-04-18
updated: 2026-04-18
---

# Plan — Local LLM Fresh Setup

## Goal
Replace broken Vulkan llama-server build with fresh CUDA build. Unlock 128K context. Wire OpenClaw with correct config. Add MCP servers (filesystem/reasoning/docs).

## Architecture
llama-server (CUDA 12, Windows x64) on port 8080 serves **Qwen3.5-35B-A3B-Q4_K_M** as primary model. OpenClaw connects via OpenAI-compatible API. Ollama 0.20.3 remains fallback. MCP servers run as stdio subprocesses managed by OpenClaw.

## Hardware
- CPU: AMD Ryzen 7 9800X3D (8c/16t)
- RAM: 32 GB
- GPU: NVIDIA RTX 5070 Ti — 16 GB VRAM (Blackwell SM 12.0)

## Tech stack
llama.cpp (CUDA 12), OpenClaw 2026.4.2, Ollama 0.20.3, Node 24, npx MCP servers

## Scope
- `C:\llama-server\*.exe`, `*.dll` — binaries swapped
- `C:\llama-server\start-qwen-cuda.ps1` — new CUDA launcher
- `C:\Users\parti\.openclaw\openclaw.json` — contextWindow 131072, maxTokens 32768, MCP servers
- `models.json` — same context/token fixes

## Related
- [[entities/Qwen35-35B]]
- [[entities/OpenClaw]]
- [[entities/llama-cpp]]
