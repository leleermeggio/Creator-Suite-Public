# ============================================================================
#  Creator Zone - llama-server for the tablet (Windows PowerShell, PC side)
#
#  Serves a local GGUF model on the ZeroTier network so Crush on the tablet
#  can reach it. The two flags that matter:
#    --host 0.0.0.0   otherwise the tablet cannot connect at all
#    --jinja          otherwise the model never emits tool_calls and the
#                     agent loop dies on the first tool use
#
#  Usage:
#    .\start-llama-server.ps1 -ModelPath "D:\models\Qwen3-Coder-30B-Q4_K_M.gguf"
#    .\start-llama-server.ps1 -ModelPath "..." -Port 8080 -ContextSize 65536
#    .\start-llama-server.ps1 -ModelPath "..." -OpenFirewall   (needs admin)
# ============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$ModelPath,

    [int]$Port = 8080,
    [string]$BindAddress = "0.0.0.0",
    [int]$ContextSize = 32768,
    [int]$GpuLayers = 999,
    [string]$LlamaServerPath = "llama-server",
    [switch]$OpenFirewall,
    [string[]]$ExtraArgs = @()
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$msg) {
    Write-Host ""
    Write-Host "  >> $msg" -ForegroundColor Cyan
}

# -- 1. Preconditions --
if (-not (Test-Path $ModelPath)) {
    throw "Model not found: $ModelPath"
}

$server = Get-Command $LlamaServerPath -ErrorAction SilentlyContinue
if (-not $server) {
    throw "llama-server not found on PATH. Pass -LlamaServerPath 'C:\path\to\llama-server.exe'."
}

# -- 2. Show the address the tablet must use --
Write-Step "ZeroTier addresses on this machine"
$ztAddresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceAlias -match 'ZeroTier' }

if ($ztAddresses) {
    foreach ($addr in $ztAddresses) {
        Write-Host ("     http://{0}:{1}   ({2})" -f $addr.IPAddress, $Port, $addr.InterfaceAlias) -ForegroundColor Green
    }
    Write-Host "     Use one of these as --host in the tablet bootstrap." -ForegroundColor DarkGray
} else {
    Write-Host "     No ZeroTier adapter found. Is ZeroTier One running and joined?" -ForegroundColor Yellow
}

# -- 3. Firewall (opt-in, needs an elevated shell) --
if ($OpenFirewall) {
    Write-Step "Allowing inbound TCP $Port for llama-server"
    $ruleName = "Creator Zone llama-server ($Port)"
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "     Rule already present." -ForegroundColor DarkGray
    } else {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
            -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
        Write-Host "     Firewall rule created." -ForegroundColor Green
    }
}

# -- 4. Launch --
$serverArgs = @(
    "--model", $ModelPath,
    "--host", $BindAddress,
    "--port", $Port,
    "--ctx-size", $ContextSize,
    "--n-gpu-layers", $GpuLayers,
    "--jinja"
) + $ExtraArgs

Write-Step "Starting llama-server"
Write-Host ("     $LlamaServerPath " + ($serverArgs -join " ")) -ForegroundColor DarkGray
Write-Host ""

& $LlamaServerPath @serverArgs
