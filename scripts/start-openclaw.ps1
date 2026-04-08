# Start OpenClaw with local Qwen3.5 (coding-agent) for Creator Suite
# Usage: .\scripts\start-openclaw.ps1
#
# DO NOT use "ollama launch openclaw" — it overwrites openclaw.json every time.

$ErrorActionPreference = "Stop"
$env:OLLAMA_API_KEY = "ollama-local"
$ProjectRoot = "C:\OLD D\Projects\GIt repo\Creator-Suite-Public"

Write-Host "⚡ Creator Suite — OpenClaw Launcher" -ForegroundColor Magenta
Write-Host ""

# 1. Ensure Ollama is running
$ollamaProcess = Get-Process -Name "ollama*" -ErrorAction SilentlyContinue
if (-not $ollamaProcess) {
    Write-Host "🚀 Starting Ollama..." -ForegroundColor Cyan
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep 3
} else {
    Write-Host "✅ Ollama already running" -ForegroundColor Green
}

# 2. Verify model is available
Write-Host "🔍 Checking coding-agent model..." -ForegroundColor Cyan
try {
    $models = ollama list 2>&1
    if ($models -match "coding-agent") {
        Write-Host "✅ coding-agent model loaded" -ForegroundColor Green
    } else {
        Write-Host "⚠️  coding-agent not found. Available models:" -ForegroundColor Yellow
        Write-Host $models
        Write-Host "Run: ollama create coding-agent -f Modelfile.coding" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not check models (Ollama may still be starting)" -ForegroundColor Yellow
}

# 3. Start OpenClaw gateway
Write-Host "🌐 Starting OpenClaw gateway..." -ForegroundColor Cyan
openclaw gateway --force &
Start-Sleep 3

# 4. Open TUI in project directory
Write-Host "📂 Project: $ProjectRoot" -ForegroundColor Gray
Write-Host "🖥️  Opening TUI..." -ForegroundColor Cyan
Write-Host ""
Push-Location $ProjectRoot
openclaw tui
Pop-Location
