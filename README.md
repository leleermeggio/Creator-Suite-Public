# 🤖 Caz_zoneBot — Bot Telegram Multifunzione

Bot Telegram con **menu contestuali** (InlineKeyboard) che offre 4 funzioni principali:

## Funzionalità

| Funzione | Descrizione | Input accettati |
|----------|-------------|-----------------|
| 🎙 **Trascrivi Audio** | Trascrizione audio con Whisper | Vocali, file audio, link (YouTube, TikTok, ecc.) |
| 🌍 **Traduci** | Traduzione testi via Google Translate | Testo, vocali, file audio, link, documenti |
| 🖼 **Scarica Immagini** | Download media da social | Link (Instagram, Twitter, Facebook, ecc.) |
| 🎵 **Scarica MP3** | Estrazione traccia audio MP3 | Link video (YouTube, TikTok, Instagram, ecc.) |

## Architettura

```
bot.py           → Entry point, menu contestuali, ConversationHandler
transcriber.py   → Servizio trascrizione (OpenAI Whisper)
translator.py    → Servizio traduzione (Google Translate via deep-translator)
downloader.py    → Servizio download media (yt-dlp + httpx)
```

### Flusso utente

```
/start → Menu Principale
         ├── 🎙 Trascrivi → invia audio/link → ricevi trascrizione
         ├── 🌍 Traduci → scegli lingua → invia contenuto → ricevi traduzione
         ├── 🖼 Immagini → invia link → ricevi media
         └── 🎵 MP3 → invia link → ricevi file MP3
```

## Setup locale

### Prerequisiti

- Python 3.10+
- ffmpeg (`sudo pacman -S ffmpeg` su Arch, `sudo apt install ffmpeg` su Debian)

### Installazione

```bash
# Crea virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Installa dipendenze (PyTorch CPU-only)
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Configura il file .env
cp .env.example .env
# Modifica .env con il tuo token e user ID
```

### Avvio

```bash
source .venv/bin/activate
python bot.py
```

## Setup Docker

```bash
# Configura il file .env
cp .env.example .env
# Modifica .env con il tuo token e user ID

# Build e avvio
docker compose up -d

# Logs in tempo reale
docker compose logs -f
```

## Variabili d'ambiente

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `TELEGRAM_TOKEN` | Token del bot (obbligatorio) | — |
| `ALLOWED_USERS` | ID utenti autorizzati (virgola-separati) | tutti |
| `WHISPER_MODEL` | Modello Whisper (`tiny`, `base`, `small`, `medium`) | `small` |
| `TRANSCRIBE_LANGUAGE` | Lingua trascrizione | `it` |
| `DOWNLOADS_DIR` | Cartella download temporanei | `/app/downloads` |
| `AUDIO_DIR` | Cartella audio (archiviati) | `/app/audio` |
| `LOG_DIR` | Cartella log | `/app/logs` |
| `COOKIES_DIR` | Cartella cookie Netscape (per siti protetti) | `/app/cookies` |

## Cookies (opzionale)

Per scaricare da siti che richiedono autenticazione (es. Instagram privato), posiziona i file cookie in formato Netscape nella cartella `cookies/`:

```
cookies/
  youtube.txt
  instagram.txt
  twitter.txt
```

## Lingue supportate (Traduzione)

🇬🇧 English · 🇮🇹 Italiano · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch · 🇵🇹 Português · 🇨🇳 中文 · 🇯🇵 日本語 · 🇰🇷 한국어 · 🇷🇺 Русский · 🇸🇦 العربية

## Log

I log sono configurati per essere verbosi e descrittivi con emoji per facilitare il debugging:

```
🚀 Avvio bot
📋 Menu mostrato
🎙️ Trascrizione richiesta
⚙️  Whisper in esecuzione
✅ Operazione completata
❌ Errore
⛔ Accesso negato
🔙 Ritorno al menu
```

## Note tecniche

- **Whisper** viene caricato una sola volta all'avvio (il primo avvio scarica il modello ~461 MB per `small`)
- **Limite Telegram**: file fino a 50 MB per l'upload via bot
- **Messaggi lunghi**: trascrizioni/traduzioni oltre 4000 caratteri vengono automaticamente divise in più messaggi
- **Blockquote expandable**: testi oltre 10 righe vengono collassati automaticamente
- **Cleanup automatico**: la cartella downloads viene pulita dopo ogni operazione

---

## Dev Stack Quickstart (Windows — host machine)

### Prerequisiti
- **Python 3.11+** — disponibile come `python` nel PATH
- **Node 20+** — disponibile come `node`/`npm` nel PATH

### Primo avvio (setup + start con un solo comando)
```powershell
.\start.ps1
```
Lo script:
1. Crea `backend/.env` da `.env.example` (SQLite — non serve PostgreSQL)
2. Crea il virtual environment Python in `backend/.venv`
3. Installa tutte le dipendenze Python e Node
4. Crea il dev user nel database
5. Avvia backend e frontend in due finestre separate

**Login:** `dev@cazzone.local` / `CazZone2024!`

### Avvii successivi (senza reinstallare)
```powershell
.\start.ps1 -SkipInstall
```

### URL
| Servizio | URL locale | URL rete LAN |
|---|---|---|
| Frontend | http://localhost:8081 | http://\<server-ip\>:8081 |
| Backend API | http://localhost:8000 | http://\<server-ip\>:8000 |
| Swagger Docs | http://localhost:8000/docs | — |

> L'IP di rete viene stampato all'avvio di `run_server.py`.
> Il frontend si connette automaticamente all'API usando l'IP del server, senza configurazione manuale.

### Avvio manuale (alternativa)
```powershell
# Terminale 1 — Backend
python run_server.py

# Terminale 2 — Frontend
cd frontend
npx expo start --web --port 8081
```

---

### Avvio con Docker (stack completo)
```bash
docker compose up
```
Servizi avviati:
- **API** → http://localhost:8000
- **Frontend** → http://localhost:8081
- **PostgreSQL** → localhost:5432
- **Redis** → localhost:6379
- **Celery Worker** (in background)
- **Telegram Bot** (se `.env` radice configurato)
