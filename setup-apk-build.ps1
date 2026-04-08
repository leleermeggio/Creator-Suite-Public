# Script completo per setup build APK
# Esegui DOPO aver installato Java e Android Studio

Write-Host "🚀 Setup Build APK Locale" -ForegroundColor Cyan
Write-Host "=" * 50

# Verifica Java
Write-Host "`n1️⃣ Verifico Java JDK..." -ForegroundColor Yellow
try {
    $javaVersion = java -version 2>&1 | Select-String "version"
    Write-Host "✅ Java installato: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Java non trovato. Installa Java JDK 17 prima di continuare" -ForegroundColor Red
    exit 1
}

# Verifica Android SDK
Write-Host "`n2️⃣ Verifico Android SDK..." -ForegroundColor Yellow
$androidHome = "$env:LOCALAPPDATA\Android\Sdk"
if (Test-Path $androidHome) {
    Write-Host "✅ Android SDK trovato: $androidHome" -ForegroundColor Green
} else {
    Write-Host "❌ Android SDK non trovato. Installa Android Studio prima di continuare" -ForegroundColor Red
    exit 1
}

# Installa EAS CLI globalmente
Write-Host "`n3️⃣ Installo EAS CLI globalmente..." -ForegroundColor Yellow
npm install -g eas-cli
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ EAS CLI installato" -ForegroundColor Green
} else {
    Write-Host "❌ Errore installazione EAS CLI" -ForegroundColor Red
    exit 1
}

# Vai nella cartella frontend
Write-Host "`n4️⃣ Configuro progetto Expo..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\frontend"

# Verifica se node_modules esiste
if (-Not (Test-Path "node_modules")) {
    Write-Host "⏳ Installo dipendenze npm..." -ForegroundColor Yellow
    npm install
}

Write-Host "`n✅ Setup completato!" -ForegroundColor Green
Write-Host "`n📋 Prossimi step:" -ForegroundColor Cyan
Write-Host "1. Esegui: eas login (per login Expo)"
Write-Host "2. Esegui: eas build:configure (per configurare build)"
Write-Host "3. Esegui: eas build --platform android --profile preview --local"
Write-Host "`nPremi Invio per uscire..."
Read-Host
