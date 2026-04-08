# Script per configurare variabili d'ambiente Android
# Esegui come Amministratore dopo aver installato Android Studio

Write-Host "🔧 Configurazione variabili d'ambiente Android..." -ForegroundColor Cyan

$androidHome = "$env:LOCALAPPDATA\Android\Sdk"

if (-Not (Test-Path $androidHome)) {
    Write-Host "❌ Android SDK non trovato in: $androidHome" -ForegroundColor Red
    Write-Host "   Verifica che Android Studio sia installato correttamente" -ForegroundColor Yellow
    Read-Host "Premi Invio per uscire"
    exit 1
}

Write-Host "✅ Android SDK trovato: $androidHome" -ForegroundColor Green

# Configura variabili d'ambiente di sistema
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidHome, "User")
Write-Host "✅ ANDROID_HOME configurato" -ForegroundColor Green

# Aggiungi tools al PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathsToAdd = @(
    "$androidHome\platform-tools",
    "$androidHome\cmdline-tools\latest\bin",
    "$androidHome\emulator"
)

foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $currentPath = "$currentPath;$path"
        Write-Host "✅ Aggiunto al PATH: $path" -ForegroundColor Green
    } else {
        Write-Host "⏭️  Già nel PATH: $path" -ForegroundColor Yellow
    }
}

[Environment]::SetEnvironmentVariable("Path", $currentPath, "User")

Write-Host "`n✅ Configurazione completata!" -ForegroundColor Green
Write-Host "⚠️  IMPORTANTE: Chiudi e riapri tutti i terminali per applicare le modifiche" -ForegroundColor Yellow
Write-Host "`nPremi Invio per uscire..."
Read-Host
