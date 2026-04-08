# Local LLM Stack — Fresh Setup Design

**Date:** 2026-04-07  
**Status:** Approved (Option B)

---

## Goal

Clean, working local LLM stack for CLI coding assistance using Qwen3.5-35B-A3B on RTX 5070 Ti (Blackwell), with full MCP server support in OpenClaw.

---

## Hardware

| Component | Spec |
|-----------|------|
| CPU | AMD Ryzen 7 9800X3D (8c/16t) |
| RAM | 32 GB |
| GPU | NVIDIA RTX 5070 Ti — 16 GB VRAM (Blackwell SM 12.0) |

---

## Stack (after)

```
OpenClaw TUI/CLI  ←→  llama-server (CUDA, port 8080)  ←→  Qwen3.5-35B-A3B-Q4_K_M.gguf
         ↓
    Ollama (port 11434) — fallback only
         ↓
    MCP servers (stdio)
```

**Remove:** LM Studio (unused)

---

## 1. llama-server — Fresh CUDA Build

**Why:** Current build (b8690) disabled CUDA (`ggml-cuda.dll.bak`) — likely due to missing Blackwell support. Newer builds (b5000+) have SM 12.0 support.

**Action:**
- Download latest llama.cpp Windows CUDA 12 release from GitHub releases
- Replace all DLLs and `.exe` files in `C:\llama-server\`
- Keep `C:\llama-server\models\Qwen3.5-35B-A3B-Q4_K_M.gguf` untouched
- Add `C:\llama-server` to user PATH

**Architecture facts from logs:**
- 40 layers, 2 KV heads, 256 head dim → 80 KB KV cache per token (very efficient GQA)
- Max supported context: 262,144 tokens
- Vulkan baseline: 41 layers on GPU = 13,791 MiB, leaving ~2.5 GB free for KV cache

**KV cache VRAM at different settings:**
| Context | KV type | KV size | Notes |
|---------|---------|---------|-------|
| 32K | f16 | 2.5 GB | baseline |
| 65K | q8_0 | 2.5 GB | same VRAM, 2x context |
| **131K** | **q8_0** | **5 GB** | overflows ~2.5 GB to CPU RAM (fast, 32 GB available) |
| 131K | q4_0 | 2.5 GB | fully on GPU, minimal quality loss |

**Chosen: `--ctx-size 131072` with q8_0 KV cache**
Rationale: coding + Claude Code plan context easily exceeds 32K with large files + history. 128K covers everything. q8_0 overflows ~2.5 GB to CPU RAM — with 32 GB RAM and fast DDR5, latency impact is minimal on a Ryzen 9800X3D.

**New startup parameters:**
```
--model  C:\llama-server\models\Qwen3.5-35B-A3B-Q4_K_M.gguf
--n-gpu-layers 99              # all layers on CUDA
--ctx-size 131072              # 128K context
--cache-type-k q8_0            # halves KV VRAM, negligible quality loss
--cache-type-v q8_0
--flash-attn                   # enabled (CUDA supports it)
--threads 8
--threads-batch 16
--host 127.0.0.1               # localhost only (was 0.0.0.0)
--port 8080
--parallel 1
--cont-batching
--metrics
```

---

## 2. OpenClaw Config — Clean Rewrite

**`~/.openclaw/openclaw.json` changes:**

- `llama-server/qwen3.5-35b` stays as primary model
- Increase `contextWindow`: 8192 → 131072
- Increase `maxTokens`: 4096 → 32768
- Set `reasoning: true` on the llama-server model
- Ollama `coding-agent` stays as fallback
- Remove `coding-pro` fallback (redundant — same base model)

**`~/.openclaw/agents/main/agent/models.json` changes:**
- Same context/maxTokens fixes as above

---

## 3. MCP Servers

Three MCP servers added to OpenClaw via `openclaw mcp set`:

| Server | Package | Purpose |
|--------|---------|---------|
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Read/write local files |
| `sequential-thinking` | `@modelcontextprotocol/server-sequential-thinking` | Structured reasoning chains |
| `context7` | `@upstash/context7-mcp` | Live library docs lookup |

All installed globally via `npx` (no persistent install needed for MCP stdio servers).

---

## 4. Cleanup

- Uninstall LM Studio via `winget uninstall ElementLabs.LMStudio`
- No changes to Ollama models (keep `coding-agent` and `coding-pro` as-is for fallback)

---

## 5. Startup Workflow (after)

1. Start llama-server: run `start-llm.ps1` (or new `start-qwen-cuda.ps1`)
2. Start OpenClaw: `openclaw gateway --force` then `openclaw tui`
3. Model resolves: `llama-server/qwen3.5-35b` (CUDA, 32K context)
4. MCP tools available in every session

---

## Out of Scope

- No OpenCode install (OpenClaw covers all requirements)
- No model quantization changes (Q4_K_M is the right tradeoff for 16GB VRAM)
- No Ollama model changes
