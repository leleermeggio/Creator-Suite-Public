# Local LLM Fresh Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace broken Vulkan llama-server build with a fresh CUDA build, unlock 128K context, wire up OpenClaw with correct config, and add MCP servers for filesystem/reasoning/docs.

**Architecture:** llama-server (CUDA) on port 8080 serves Qwen3.5-35B-A3B-Q4_K_M as the primary model. OpenClaw connects to it via OpenAI-compatible API. Ollama stays as a fallback. MCP servers run as stdio subprocesses managed by OpenClaw.

**Tech Stack:** llama.cpp (CUDA 12 build, Windows x64), OpenClaw 2026.4.2, Ollama 0.20.3, Node 24, npx MCP servers

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `C:\llama-server\*.exe`, `*.dll` | Replace | All binaries swapped for new CUDA build |
| `C:\llama-server\start-qwen-cuda.ps1` | Create | New CUDA launcher (replaces start-llm.ps1) |
| `C:\Users\parti\.openclaw\openclaw.json` | Modify | contextWindow 131072, maxTokens 32768, MCP servers added |
| `C:\Users\parti\.openclaw\agents\main\agent\models.json` | Modify | Same context/token fixes |

---

## Task 1: Uninstall LM Studio

**Files:** system only

- [ ] **Step 1: Uninstall via winget**

```powershell
winget uninstall ElementLabs.LMStudio --silent
```

Expected output: `Successfully uninstalled LM Studio`

- [ ] **Step 2: Verify removed**

```powershell
winget list | grep -i lmstudio
```

Expected: no output

---

## Task 2: Download Latest llama.cpp CUDA Build

**Files:** `C:\llama-server\` (new binaries)

- [ ] **Step 1: Find latest release tag**

```powershell
$release = Invoke-RestMethod "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"
$release.tag_name
```

Note the tag (e.g. `b5123`).

- [ ] **Step 2: Find the CUDA 12 Windows asset URL**

```powershell
$release = Invoke-RestMethod "https://api.github.com/repos/ggerganov/llama.cpp/releases/latest"
$asset = $release.assets | Where-Object { $_.name -like "*win-cuda*x64*" -or $_.name -like "*bin-win-cuda12*" }
$asset | Select-Object name, browser_download_url
```

Pick the asset ending in `cuda12` or `cuda-cu12.*-x64.zip`.

- [ ] **Step 3: Download the zip**

```powershell
$asset = ($release.assets | Where-Object { $_.name -like "*cuda*x64*.zip" })[0]
$dest = "$env:TEMP\llama-cuda-latest.zip"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest -UseBasicParsing
Write-Host "Downloaded: $dest"
```

- [ ] **Step 4: Extract to temp folder**

```powershell
$extractDir = "$env:TEMP\llama-cuda-extract"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Expand-Archive -Path "$env:TEMP\llama-cuda-latest.zip" -DestinationPath $extractDir
ls $extractDir
```

Expected: see `llama-server.exe`, `ggml-cuda.dll`, and other DLLs.

---

## Task 3: Replace llama-server Binaries (Keep Model)

**Files:** `C:\llama-server\`

- [ ] **Step 1: Back up old binaries**

```powershell
$backup = "C:\llama-server\backup-vulkan-build"
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Get-ChildItem "C:\llama-server\" -File | Where-Object { $_.Extension -in @(".exe",".dll") } |
    Move-Item -Destination $backup
Write-Host "Backed up to $backup"
```

- [ ] **Step 2: Copy new CUDA binaries**

```powershell
$src = "$env:TEMP\llama-cuda-extract"
# The zip may have a subdirectory — find where the exe actually is
$exePath = Get-ChildItem $src -Recurse -Filter "llama-server.exe" | Select-Object -First 1
$binDir = $exePath.DirectoryName
Write-Host "Bin dir: $binDir"
Copy-Item "$binDir\*" "C:\llama-server\" -Force
Write-Host "Copied new binaries"
```

- [ ] **Step 3: Verify model is still there**

```powershell
Test-Path "C:\llama-server\models\Qwen3.5-35B-A3B-Q4_K_M.gguf"
```

Expected: `True`

- [ ] **Step 4: Verify ggml-cuda.dll exists (not .bak)**

```powershell
ls "C:\llama-server\" | Where-Object { $_.Name -like "ggml-cuda*" }
```

Expected: `ggml-cuda.dll` (no `.bak`)

- [ ] **Step 5: Check build version**

```powershell
& "C:\llama-server\llama-server.exe" --version
```

Expected: build number higher than `b8690`

---

## Task 4: Add llama-server to PATH

**Files:** system environment

- [ ] **Step 1: Add to user PATH**

```powershell
$current = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($current -notlike "*C:\llama-server*") {
    [Environment]::SetEnvironmentVariable("PATH", "$current;C:\llama-server", "User")
    Write-Host "Added to PATH"
} else {
    Write-Host "Already in PATH"
}
```

- [ ] **Step 2: Reload PATH in current session**

```powershell
$env:PATH += ";C:\llama-server"
```

- [ ] **Step 3: Verify**

```powershell
where.exe llama-server
```

Expected: `C:\llama-server\llama-server.exe`

---

## Task 5: Write New CUDA Startup Script

**Files:** Create `C:\llama-server\start-qwen-cuda.ps1`

- [ ] **Step 1: Write the script**

```powershell
Set-Content "C:\llama-server\start-qwen-cuda.ps1" @'
# Qwen3.5-35B-A3B — llama-server CUDA launcher
$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$host.UI.RawUI.WindowTitle = "llama-server | Qwen3.5-35B-A3B | CUDA"

$MODEL   = "C:\llama-server\models\Qwen3.5-35B-A3B-Q4_K_M.gguf"
$SERVER  = "C:\llama-server\llama-server.exe"
$LOGDIR  = "C:\llama-server\logs"
$LOGFILE = "$LOGDIR\qwen35-cuda.log"

if (!(Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR -Force | Out-Null }
"" | Set-Content $LOGFILE

function ts { (Get-Date).ToString("HH:mm:ss") }
function W($prefix, $pc, $text, $tc = "Gray") {
    Write-Host "[$(ts)]  " -NoNewline -ForegroundColor DarkGray
    Write-Host $prefix -NoNewline -ForegroundColor $pc
    Write-Host "  $text" -ForegroundColor $tc
}

Write-Host ""
Write-Host "  llama-server  Qwen3.5-35B-A3B  CUDA  :8080  128K ctx" -ForegroundColor Cyan
Write-Host "  RTX 5070 Ti (16 GB)  |  Ryzen 9800X3D  |  32 GB RAM" -ForegroundColor DarkCyan
Write-Host ""

$args = @(
    "--model", $MODEL,
    "--n-gpu-layers", "99",
    "--ctx-size", "131072",
    "--cache-type-k", "q8_0",
    "--cache-type-v", "q8_0",
    "--flash-attn",
    "--threads", "8",
    "--threads-batch", "16",
    "--host", "127.0.0.1",
    "--port", "8080",
    "--parallel", "1",
    "--cont-batching",
    "--metrics",
    "--log-timestamps"
)

W ".." "Yellow" "Loading model — this takes ~10-15s on first run..."

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $SERVER
$psi.Arguments = $args -join " "
$psi.WorkingDirectory = "C:\llama-server"
$psi.UseShellExecute = $false
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$proc = [System.Diagnostics.Process]::new()
$proc.StartInfo = $psi
$proc.Start() | Out-Null

$reader = $proc.StandardError
try {
    while ($true) {
        $line = $reader.ReadLine()
        if ($null -eq $line) { break }
        Add-Content -Path $LOGFILE -Value $line

        if ($line -match "offloaded (\d+)/(\d+) layers") {
            W "  " "Cyan" "CUDA layers: $($Matches[1])/$($Matches[2])"
        } elseif ($line -match "CUDA.*model buffer size\s*=\s*([\d.]+)\s*MiB") {
            W "  " "Cyan" "VRAM model: $($Matches[1]) MiB"
        } elseif ($line -match "KV cache.*size.*?([\d.]+)\s*MiB") {
            W "  " "Cyan" "KV cache: $($Matches[1]) MiB"
        } elseif ($line -match "server is listening on") {
            Write-Host ""
            W "OK" "Green" "Ready at http://127.0.0.1:8080  (128K ctx, CUDA)" "White"
            Write-Host ""
        } elseif ($line -match "eval time.*?([\d.]+) tokens per second") {
            W ">>" "Green" "Gen speed: $($Matches[1]) t/s"
        } elseif ($line -match "CUDA error|GGML_ASSERT") {
            W "!!" "Red" $line "Red"
        }
    }
} finally {
    if (!$proc.HasExited) { $proc.Kill() }
    $proc.WaitForExit()
    Write-Host ""
    W "!!" "Red" "Server stopped (exit $($proc.ExitCode))" "Red"
}
'@
Write-Host "Written: C:\llama-server\start-qwen-cuda.ps1"
```

- [ ] **Step 2: Verify file exists**

```powershell
Test-Path "C:\llama-server\start-qwen-cuda.ps1"
```

Expected: `True`

---

## Task 6: Smoke Test llama-server CUDA

**Files:** runtime only

- [ ] **Step 1: Start server in background (new terminal)**

Open a new PowerShell window and run:
```powershell
& "C:\llama-server\start-qwen-cuda.ps1"
```

Watch for:
- `CUDA layers: XX/40` — confirms CUDA backend loaded
- `VRAM model: XXXX MiB` — confirms GPU memory used
- `Ready at http://127.0.0.1:8080` — server up

> If you see `Vulkan` instead of `CUDA` in the layer output, the CUDA DLL is missing. Re-check Task 3 Step 4.

- [ ] **Step 2: Test inference endpoint (from any terminal)**

```powershell
$body = '{"model":"qwen","messages":[{"role":"user","content":"Reply with one word: pong"}],"max_tokens":5}'
Invoke-RestMethod -Method POST -Uri "http://127.0.0.1:8080/v1/chat/completions" `
    -ContentType "application/json" -Body $body |
    Select-Object -ExpandProperty choices | ForEach-Object { $_.message.content }
```

Expected: `pong` (or similar single-word response)

- [ ] **Step 3: Check CUDA is confirmed in response headers**

```powershell
Invoke-RestMethod "http://127.0.0.1:8080/health" | ConvertTo-Json
```

Expected: `{"status":"ok"}`

---

## Task 7: Fix OpenClaw openclaw.json

**Files:** `C:\Users\parti\.openclaw\openclaw.json`

- [ ] **Step 1: Update llama-server model context in openclaw.json**

```powershell
$path = "C:\Users\parti\.openclaw\openclaw.json"
$cfg = Get-Content $path -Raw | ConvertFrom-Json

# Update llama-server model entry
$lsModel = $cfg.models.providers.'llama-server'.models[0]
$lsModel.contextWindow = 131072
$lsModel.maxTokens = 32768

$cfg | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
Write-Host "Updated openclaw.json"
```

- [ ] **Step 2: Verify the change**

```powershell
$cfg = Get-Content "C:\Users\parti\.openclaw\openclaw.json" -Raw | ConvertFrom-Json
$cfg.models.providers.'llama-server'.models[0] | Select-Object id, contextWindow, maxTokens
```

Expected:
```
id           contextWindow maxTokens
--           ------------- ---------
qwen3.5-35b         131072     32768
```

---

## Task 8: Fix OpenClaw agents/main models.json

**Files:** `C:\Users\parti\.openclaw\agents\main\agent\models.json`

- [ ] **Step 1: Update same values in the agent-level models.json**

```powershell
$path = "C:\Users\parti\.openclaw\agents\main\agent\models.json"
$cfg = Get-Content $path -Raw | ConvertFrom-Json

$lsModel = $cfg.providers.'llama-server'.models[0]
$lsModel.contextWindow = 131072
$lsModel.maxTokens = 32768

$cfg | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
Write-Host "Updated agents models.json"
```

- [ ] **Step 2: Verify**

```powershell
$cfg = Get-Content "C:\Users\parti\.openclaw\agents\main\agent\models.json" -Raw | ConvertFrom-Json
$cfg.providers.'llama-server'.models[0] | Select-Object id, contextWindow, maxTokens
```

Expected: same as Task 7 Step 2

---

## Task 9: Add MCP Servers to OpenClaw

**Files:** `~/.openclaw/openclaw.json` (via `openclaw mcp set`)

Three MCP servers: `filesystem`, `sequential-thinking`, `context7`.

- [ ] **Step 1: Add filesystem MCP server**

```powershell
openclaw mcp set filesystem '{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem",
           "C:\\Users\\parti",
           "C:\\OLD D\\Projects\\GIt repo\\Creator-Suite-Public"]
}'
```

Expected: success (no error output)

- [ ] **Step 2: Add sequential-thinking MCP server**

```powershell
openclaw mcp set sequential-thinking '{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
}'
```

- [ ] **Step 3: Add context7 MCP server**

```powershell
openclaw mcp set context7 '{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp"]
}'
```

- [ ] **Step 4: Verify all three are registered**

```powershell
openclaw mcp list
```

Expected output:
```
MCP servers (C:\Users\parti\.openclaw\openclaw.json):
  filesystem          npx -y @modelcontextprotocol/server-filesystem ...
  sequential-thinking npx -y @modelcontextprotocol/server-sequential-thinking
  context7            npx -y @upstash/context7-mcp
```

---

## Task 10: End-to-End Verification

**Files:** runtime only

> llama-server must still be running from Task 6.

- [ ] **Step 1: Start OpenClaw gateway**

```powershell
openclaw gateway --force
```

Expected: `Gateway started` or similar — no error about model connection.

- [ ] **Step 2: Check model resolves to llama-server**

```powershell
openclaw mcp list
```

Expected: all 3 MCP servers listed.

- [ ] **Step 3: Quick TUI smoke test**

```powershell
openclaw tui
```

In the TUI: send the message `what model are you?`

Expected: response identifies as Qwen or mentions the local model. Should NOT show a connection error on startup.

- [ ] **Step 4: Verify context window reported correctly**

In the TUI type `/info` or check model info. Context should show 131072.

- [ ] **Step 5: Update memory**

Update `C:\Users\parti\.claude\projects\...\memory\user_setup.md` to reflect the new setup:
- llama-server: CUDA, 128K context, `C:\llama-server\start-qwen-cuda.ps1`
- MCP servers: filesystem, sequential-thinking, context7

---

## Rollback

If CUDA fails to load (Blackwell driver issue):

```powershell
# Restore Vulkan build
Copy-Item "C:\llama-server\backup-vulkan-build\*" "C:\llama-server\" -Force
```

Then fall back to Ollama as primary:
```powershell
$path = "C:\Users\parti\.openclaw\openclaw.json"
$cfg = Get-Content $path -Raw | ConvertFrom-Json
$cfg.agents.defaults.model.primary = "ollama/coding-agent"
$cfg | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
```
