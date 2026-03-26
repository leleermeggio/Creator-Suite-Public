# ============================================================
#  Creator Suite — Avvio locale (Windows PowerShell)
#  Uso:  .\start.ps1
#        .\start.ps1 -SkipInstall   (se le deps sono già installate)
# ============================================================
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "  >> $msg" -ForegroundColor Cyan
}

# ── 1. backend/.env ─────────────────────────────────────────
$envFile = Join-Path $Root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Step "Creating backend/.env from .env.example (SQLite mode)..."
    Copy-Item (Join-Path $Root "backend\.env.example") $envFile
    # Switch to SQLite for local dev (no PostgreSQL required)
    (Get-Content $envFile) -replace `
        '^DATABASE_URL=postgresql.*', `
        'DATABASE_URL=sqlite+aiosqlite:///./creator_suite_dev.db' `
        | Set-Content $envFile
    Write-Host "  backend/.env created. Edit it if you need to change settings." -ForegroundColor Yellow
} else {
    Write-Host "  backend/.env already exists — skipping." -ForegroundColor DarkGray
}

# ── 2. Python virtual environment ───────────────────────────
$venv = Join-Path $Root "backend\.venv"
if (-not (Test-Path $venv)) {
    Write-Step "Creating Python virtual environment..."
    python -m venv $venv
}

$pip  = Join-Path $venv "Scripts\pip.exe"
$python = Join-Path $venv "Scripts\python.exe"

if (-not $SkipInstall) {
    Write-Step "Installing Python dependencies..."
    & $pip install --quiet -r (Join-Path $Root "backend\requirements.txt")
}

# ── 3. Seed dev user ────────────────────────────────────────
Write-Step "Seeding dev user (idempotent)..."
Push-Location $Root
& $python -m backend.seeds.dev_user
Pop-Location

# ── 4. Node dependencies for frontend ───────────────────────
$nodeModules = Join-Path $Root "frontend\node_modules"
if (-not $SkipInstall -or -not (Test-Path $nodeModules)) {
    Write-Step "Installing Node dependencies..."
    Push-Location (Join-Path $Root "frontend")
    npm install --silent
    Pop-Location
}

# ── 5. Print instructions ────────────────────────────────────
$ip = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
)
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  Setup complete!  Starting backend + frontend..." -ForegroundColor Green
Write-Host "================================================================"
Write-Host ""
Write-Host "  Backend API  -> http://localhost:8000"
Write-Host "  Frontend     -> http://localhost:8081"
if ($ip) {
    Write-Host "  Network URL  -> http://${ip}:8081  (view from other PCs)"
}
Write-Host "  Docs         -> http://localhost:8000/docs"
Write-Host "  Login        -> dev@cazzone.local / CazZone2024!"
Write-Host ""

# ── 6. Start backend in a new window ────────────────────────
$backendCmd = "& '$python' '$Root\run_server.py'; Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd `
    -WindowStyle Normal

# Wait for backend to be ready
Write-Step "Waiting for backend to start..."
$timeout = 30
$elapsed = 0
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1
    $elapsed++
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) {
            Write-Host "  Backend is ready ($elapsed s)" -ForegroundColor Green
            break
        }
    } catch { }
}

# ── 7. Start frontend ────────────────────────────────────────
Write-Step "Starting Expo web frontend..."
$frontendCmd = "Set-Location '$Root\frontend'; npx expo start --web --port 8081; Read-Host 'Press Enter to close'"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd `
    -WindowStyle Normal

Write-Host ""
Write-Host "  Both servers are starting in separate windows." -ForegroundColor Green
Write-Host "  Open http://localhost:8081 in your browser." -ForegroundColor Green
Write-Host ""
