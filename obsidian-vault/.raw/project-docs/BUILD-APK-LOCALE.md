# 📱 Guida: Generare APK in Locale

Questa guida spiega come configurare il tuo ambiente di sviluppo Windows per generare file APK dell'applicazione Creator Suite direttamente sulla tua macchina, senza dipendere da servizi cloud.

---

## 📋 Indice

- [Prerequisiti](#prerequisiti)
- [Installazione Java JDK 17](#1-installazione-java-jdk-17)
- [Installazione Android Studio](#2-installazione-android-studio)
- [Configurazione Android SDK](#3-configurazione-android-sdk)
- [Installazione EAS CLI](#4-installazione-eas-cli)
- [Generare l'APK](#5-generare-lapk)
- [Installare l'APK su Android](#6-installare-lapk-su-android)
- [Risoluzione Problemi](#risoluzione-problemi)

---

## Prerequisiti

Prima di iniziare, assicurati di avere:

- ✅ Windows 10/11
- ✅ Almeno **15 GB di spazio libero** (per Android Studio + SDK)
- ✅ Connessione internet stabile
- ✅ Node.js installato (verifica con `node -v`)
- ✅ npm installato (verifica con `npm -v`)

**Tempo totale stimato**: 30-45 minuti (prima volta)

---

## 1. Installazione Java JDK 17

### Perché serve
Java Development Kit è necessario per compilare applicazioni Android.

### Procedura

1. **Scarica Java JDK 17**
   - Vai su: https://adoptium.net/temurin/releases/?version=17
   - Seleziona: **Windows x64 Installer (.msi)**
   - Scarica il file

2. **Installa Java**
   - Esegui il file `.msi` scaricato
   - Clicca **Next** → **Next** → **Install**
   - Attendi il completamento (~2-3 minuti)
   - Clicca **Finish**

3. **Verifica installazione** (dopo aver riavviato il terminale)
   ```powershell
   java -version
   ```
   Dovresti vedere qualcosa come:
   ```
   openjdk version "17.0.x" 2024-xx-xx
   ```

### Configurazione variabili d'ambiente (se necessario)

Se il comando `java -version` non funziona, configura manualmente:

```powershell
# Imposta JAVA_HOME
[Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot", "User")

# Aggiungi al PATH
$javaPath = "C:\Program Files\Eclipse Adoptium\jdk-17.0.x-hotspot\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$currentPath;$javaPath", "User")
```

**Importante:** Sostituisci `17.0.x` con la versione effettiva installata.

---

## 2. Installazione Android Studio

### Perché serve
Android Studio include Android SDK, necessario per compilare app Android.

### Procedura

1. **Scarica Android Studio**
   - Vai su: https://developer.android.com/studio
   - Clicca **Download Android Studio**
   - Accetta i termini e scarica

2. **Installa Android Studio**
   - Esegui il file `.exe` scaricato
   - **Componenti da installare** (spunta tutto):
     - ✅ Android Studio
     - ✅ Android SDK
     - ✅ Android Virtual Device
   - Percorso consigliato: usa quello di default
   - Clicca **Next** → **Install**
   - Attendi completamento (~5-10 minuti)

3. **Primo avvio - Setup Wizard**
   
   Quando Android Studio si apre per la prima volta:
   
   **a) Welcome Screen**
   - Clicca **Next** su tutte le schermate
   
   **b) Install Type**
   - Seleziona **Standard**
   - Clicca **Next**
   
   **c) Verify Settings**
   - Verifica che sia selezionato:
     - Android SDK
     - Android SDK Platform
     - Performance (HAXD o AMD)
   - **IMPORTANTE:** Annota il percorso SDK (es: `C:\Users\TuoNome\AppData\Local\Android\Sdk`)
   - Clicca **Next** → **Finish**
   
   **d) Download Components**
   - Attendi che scarichi SDK e componenti (~3-5 GB, 10-15 minuti)
   - Quando completo, clicca **Finish**

---

## 3. Configurazione Android SDK

### Installare componenti necessari

1. **Apri SDK Manager**
   - Nella schermata principale di Android Studio
   - Clicca **More Actions** → **SDK Manager**

2. **Tab "SDK Platforms"**
   - Spunta: ✅ **Android 13.0 (Tiramisu)** o superiore
   - Clicca **Apply**

3. **Tab "SDK Tools"**
   
   Verifica che siano spuntati:
   - ✅ Android SDK Build-Tools
   - ✅ Android SDK Command-line Tools (latest)
   - ✅ Android SDK Platform-Tools
   - ✅ Android Emulator
   - ✅ Intel x86 Emulator Accelerator (HAXM installer) [se Intel]
   
   Clicca **Apply** → **OK**
   
   Attendi download (~1-2 GB, 5-10 minuti)

4. **Chiudi Android Studio** (puoi chiuderlo dopo il setup)

### Configurare variabili d'ambiente Android

Apri PowerShell e esegui:

```powershell
# Imposta ANDROID_HOME
$androidHome = "$env:LOCALAPPDATA\Android\Sdk"
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidHome, "User")

# Aggiungi tools al PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathsToAdd = @(
    "$androidHome\platform-tools",
    "$androidHome\cmdline-tools\latest\bin",
    "$androidHome\emulator"
)

$newPath = $currentPath
foreach ($path in $pathsToAdd) {
    if ($currentPath -notlike "*$path*") {
        $newPath = "$newPath;$path"
    }
}

[Environment]::SetEnvironmentVariable("Path", $newPath, "User")
```

**Importante:** Dopo aver eseguito questi comandi, **chiudi e riapri tutti i terminali**.

### Verifica configurazione

Apri un **nuovo** terminale PowerShell e verifica:

```powershell
# Verifica Java
java -version

# Verifica ANDROID_HOME
echo $env:ANDROID_HOME

# Verifica adb (Android Debug Bridge)
adb version
```

Tutti i comandi dovrebbero funzionare senza errori.

---

## 4. Installazione EAS CLI

EAS (Expo Application Services) è lo strumento per generare build di app Expo.

### Procedura

```powershell
# Installa EAS CLI globalmente
npm install -g eas-cli

# Verifica installazione
eas --version
```

### Login Expo (necessario per il primo build)

```powershell
eas login
```

- Se **non hai** un account Expo:
  - Scegli **"Sign up"**
  - Inserisci email, username, password
  - Conferma email

- Se **hai già** un account:
  - Inserisci username e password

**Nota:** L'account Expo è gratuito e necessario anche per build locali.

---

## 5. Generare l'APK

Ora sei pronto per generare l'APK!

### Metodo 1: Script Automatico (Consigliato)

Nella root del progetto, esegui:

```powershell
cd "P:\Emanuele\Progetti Ai\Nuova cartella\Creator-Suite-Public"
.\build-apk.ps1
```

Lo script automaticamente:
- ✅ Verifica dipendenze
- ✅ Installa pacchetti npm se necessario
- ✅ Esegue il build locale
- ✅ Ti indica dove trovare l'APK

### Metodo 2: Manuale

```powershell
# Vai nella cartella frontend
cd "P:\Emanuele\Progetti Ai\Nuova cartella\Creator-Suite-Public\frontend"

# Installa dipendenze (se non già fatto)
npm install

# Genera APK in locale
eas build --platform android --profile preview --local
```

### Durante il build

- **Tempo stimato**: 5-10 minuti (primo build), 3-5 minuti (successivi)
- Vedrai output in tempo reale del processo di compilazione
- **Non chiudere il terminale** durante il build

### Output

Quando il build è completato, troverai l'APK in:

```
frontend\build-<timestamp>.apk
```

Esempio: `frontend\build-1710589234567.apk`

---

## 6. Installare l'APK su Android

### Trasferire l'APK sul telefono

**Opzione A: USB**
1. Collega telefono al PC via USB
2. Copia il file APK nella memoria del telefono
3. Scollega il telefono

**Opzione B: Cloud**
1. Carica l'APK su Google Drive / Dropbox
2. Scaricalo dal telefono

### Installare l'APK

1. Sul telefono, apri **File Manager**
2. Trova il file APK
3. Tocca l'APK per aprirlo
4. **Se appare "Installa app sconosciute":**
   - Tocca **Impostazioni**
   - Attiva **"Consenti da questa origine"**
   - Torna indietro
5. Tocca **Installa**
6. Attendi completamento
7. Tocca **Apri** per avviare l'app

---

## Risoluzione Problemi

### ❌ "java: comando non trovato"

**Causa:** Java non è nel PATH

**Soluzione:**
1. Riavvia il terminale
2. Se persiste, riconfigura JAVA_HOME (vedi sezione Java)
3. Verifica il percorso di installazione effettivo di Java

### ❌ "ANDROID_HOME not set"

**Causa:** Variabili d'ambiente non configurate

**Soluzione:**
```powershell
# Verifica se Android SDK esiste
Test-Path "$env:LOCALAPPDATA\Android\Sdk"

# Se ritorna True, configura ANDROID_HOME
[Environment]::SetEnvironmentVariable("ANDROID_HOME", "$env:LOCALAPPDATA\Android\Sdk", "User")
```

Poi riavvia il terminale.

### ❌ "SDK location not found"

**Causa:** Android SDK non installato completamente

**Soluzione:**
1. Apri Android Studio
2. More Actions → SDK Manager
3. Verifica che i componenti siano installati
4. Riavvia il build

### ❌ "Build failed: Gradle error"

**Causa:** Cache corrotta o dipendenze mancanti

**Soluzione:**
```powershell
cd frontend

# Pulisci cache Gradle
rm -r -Force "$env:USERPROFILE\.gradle\caches"

# Reinstalla dipendenze
rm -r -Force node_modules
npm install

# Riprova build
eas build --platform android --profile preview --local
```

### ❌ "EAS requires login"

**Causa:** Non hai fatto login a Expo

**Soluzione:**
```powershell
eas login
```

### ❌ Build lento (>15 minuti)

**Causa:** Primo build o cache fredda

**Soluzioni:**
- Il primo build è sempre più lento (~10-15 min)
- Build successivi saranno più veloci (~5 min)
- Assicurati di avere almeno 4GB RAM liberi
- Chiudi applicazioni pesanti durante il build

---

## 📚 Risorse Aggiuntive

- [Documentazione Expo EAS Build](https://docs.expo.dev/build/setup/)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [Java JDK Download](https://adoptium.net/)

---

## 🆘 Supporto

Se incontri problemi non elencati qui:

1. Verifica i log di errore completi
2. Cerca l'errore specifico su Google
3. Controlla GitHub Issues del progetto
4. Chiedi supporto nel canale appropriato

---

## ✅ Checklist Rapida

Prima di generare un APK, verifica:

- [ ] Java JDK 17 installato (`java -version`)
- [ ] Android Studio installato
- [ ] Android SDK scaricato
- [ ] JAVA_HOME configurato
- [ ] ANDROID_HOME configurato
- [ ] PATH aggiornato
- [ ] Terminale riavviato
- [ ] EAS CLI installato (`eas --version`)
- [ ] Login Expo effettuato (`eas whoami`)
- [ ] Dipendenze npm installate (`npm install` in frontend/)

Se tutti i punti sono ✅, sei pronto per `.\build-apk.ps1`!

---

**Ultima modifica:** 27 Marzo 2026  
**Versione:** 1.0.0
