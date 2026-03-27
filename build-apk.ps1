# Script per generare APK locale
# Richiede: Java JDK 17, Android SDK, EAS CLI

Write-Host "🚀 Build APK Locale - Creator Suite" -ForegroundColor Cyan
Write-Host "=" * 60

# Verifica che siamo nella root del progetto
if (-Not (Test-Path ".\frontend")) {
    Write-Host "❌ Errore: esegui questo script dalla root del progetto" -ForegroundColor Red
    exit 1
}

# Vai nella cartella frontend
Set-Location ".\frontend"

Write-Host "`n📦 Verifico dipendenze..." -ForegroundColor Yellow
if (-Not (Test-Path "node_modules")) {
    Write-Host "⏳ Installo dipendenze npm..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Errore installazione dipendenze" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n✅ Dipendenze OK" -ForegroundColor Green

Write-Host "`n🔨 Avvio build APK locale..." -ForegroundColor Yellow
Write-Host "   (Questo processo può richiedere 5-10 minuti)" -ForegroundColor Gray
Write-Host ""

# Build APK locale con profile preview
eas build --platform android --profile preview --local

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ APK generato con successo!" -ForegroundColor Green
    Write-Host "`n📱 L'APK si trova in: .\frontend\build-*.apk" -ForegroundColor Cyan
    Write-Host "`nPer installarlo su Android:" -ForegroundColor Yellow
    Write-Host "1. Trasferisci l'APK sul telefono" -ForegroundColor White
    Write-Host "2. Apri il file e autorizza 'Installa da origini sconosciute'" -ForegroundColor White
    Write-Host "3. Completa l'installazione" -ForegroundColor White
} else {
    Write-Host "`n❌ Build fallito. Controlla gli errori sopra." -ForegroundColor Red
    Write-Host "`nProblemi comuni:" -ForegroundColor Yellow
    Write-Host "- Assicurati di aver fatto login: eas login" -ForegroundColor White
    Write-Host "- Verifica Java: java -version" -ForegroundColor White
    Write-Host "- Verifica Android SDK installato completamente" -ForegroundColor White
}

Write-Host "`nPremi Invio per uscire..."
Read-Host

# Torna alla root
Set-Location ..
