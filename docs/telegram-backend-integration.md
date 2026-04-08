# Integrazione Backend → Bot Telegram

## Panoramica

Questo documento spiega come integrare le funzionalità del backend della web app (`Creator Suite API`) nel bot Telegram, permettendo agli utenti di accedere agli stessi strumenti avanzati direttamente dalla chat.

---

## Funzionalità Backend Disponibili

| Funzione | Stato Attuale | Difficoltà Integrazione |
|----------|---------------|------------------------|
| **Jump Cut** | ✅ Già integrato | Facile - usa `jumpcut_service.py` |
| **Export Video** | 🔄 Da integrare | Media - richiede job async |
| **Watermark** | 🔄 Da integrare | Media - processing video |
| **Thumbnails** | 🔄 Da integrare | Facile - generazione immagine |
| **Graphics Overlay** | 🔄 Da integrare | Media - compositing video |
| **Audio Processing** | 🔄 Da integrare | Facile - conversioni audio |
| **Captions/Subtitles** | 🔄 Da integrare | Media - generazione SRT |
| **Media Management** | 🔄 Da integrare | Media - upload/download |
| **Teams/Collaboration** | ❌ Non consigliato | Alta - complessa per chat |
| **Analytics** | ❌ Non consigliato | Alta - troppi dati per Telegram |

---

## Approcci di Integrazione

### Approccio 1: Import Diretto dei Servizi (Consigliato)

**Come funziona:** Importa direttamente i moduli Python dal backend, come già fatto con `jumpcut_service.py`.

**Vantaggi:**
- Nessuna latenza di rete
- Nessuna autenticazione da gestire
- Codice semplice e diretto
- Funziona offline (senza server API)

**Svantaggi:**
- Richiede che tutte le dipendenze siano installate nel venv del bot
- Aumenta la dimensione del bot
- Potenziali conflitti di versione

**Esempio di implementazione:**
```python
# bot.py - Aggiungi l'import
from backend.services.watermark_service import apply_watermark
from backend.services.thumbnail_service import generate_thumbnail
from backend.services.exporter_service import export_video

# Crea il comando nel bot
async def watermark_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Gestisce la selezione del watermark."""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "Inviami un video e un'immagine/logo da usare come watermark."
    )
    return WATERMARK_WAIT

async def process_watermark(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora il video con watermark."""
    # 1. Scarica video e immagine
    # 2. Chiama apply_watermark()
    # 3. Invia il risultato
    pass
```

---

### Approccio 2: Chiamate HTTP all'API Backend

**Come funziona:** Il bot chiama l'API REST del backend come un client normale.

**Vantaggi:**
- Backend e bot possono essere su server diversi
- Scalabilità indipendente
- Bot rimane leggero (solo HTTP client)
- Facile aggiornare il backend senza toccare il bot

**Svantaggi:**
- Richiede che l'API sia sempre online
- Latenza di rete
- Gestione autenticazione JWT
- Gestione errori di rete

**Esempio di implementazione:**
```python
import httpx

async def call_backend_api(endpoint: str, data: dict, token: str) -> dict:
    """Chiama l'API backend con autenticazione."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"http://localhost:8000/api/v1/{endpoint}",
            json=data,
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        return response.json()

# Usa nel bot
async def process_export(update: Update, context: ContextTypes.DEFAULT_TYPE):
    result = await call_backend_api(
        "exports",
        {"project_id": "xyz", "format": "mp4"},
        context.user_data["api_token"]
    )
```

---

## Consigli per l'Implementazione

### 1. Per Funzioni Sincrone (Consigliato: Approccio 1)

Funzioni che elaborano file in pochi secondi:
- ✅ Jump Cut
- ✅ Thumbnail generation
- ✅ Audio conversion
- ✅ Watermark semplice

**Implementazione:**
```python
# services.py o modulo dedicato nel bot
from backend.services.xxx import process_xxx

async def process_xxx_telegram(update, context):
    # Scarica il file
    file_path = await download_file(update.message.document)
    
    # Processa in thread separato per non bloccare
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(
        None, process_xxx, file_path
    )
    
    # Invia risultato
    await update.message.reply_document(result)
```

### 2. Per Funzioni Asincrone/Lunghe (Consigliato: Approccio 1 + Job Queue)

Funzioni che richiedono più tempo:
- ⏳ Export video complessi
- ⏳ Processing pesanti
- ⏳ Generazione captions AI

**Implementazione:**
```python
# Usa JobQueue di python-telegram-bot
async def start_long_process(update, context):
    # Crea job nel backend o locale
    job = await create_processing_job(file_path)
    
    # Informa l'utente
    await update.message.reply_text(
        f"⏳ Elaborazione avviata (Job: {job.id}).\n"
        "Ti avviso quando è pronto!"
    )
    
    # Schedule check dello stato
    context.job_queue.run_repeating(
        check_job_status,
        interval=30,
        first=30,
        data={"job_id": job.id, "chat_id": update.message.chat_id}
    )

async def check_job_status(context: ContextTypes.DEFAULT_TYPE):
    """Controlla lo stato del job e notifica l'utente."""
    job_data = context.job.data
    status = await get_job_status(job_data["job_id"])
    
    if status == "completed":
        await context.bot.send_document(
            chat_id=job_data["chat_id"],
            document=status["output_path"]
        )
        context.job.schedule_removal()
```

---

## Integrazioni Consigliate per Priorità

### Alta Priorità (Facili e Utili)

1. **Jump Cut** ⭐ (già fatto)
   - Elimina silenzi dai video
   - Molto richiesto dai content creator

2. **Audio → MP3** ⭐ (già presente con yt-dlp)
   - Estrazione audio semplice

3. **Thumbnail Generator**
   - Genera thumbnail da video
   - Aggiunge testo/bordi
   - Utile per YouTube

### Media Priorità (Richiedono più lavoro)

4. **Watermark**
   - Aggiunge logo/watermark ai video
   - Posizionamento personalizzabile

5. **Video Converter**
   - Cambia formato/risoluzione
   - Comprimi video

6. **Captions/Subtitles**
   - Genera sottotitoli automatici (con Whisper)
   - Sincronizzazione SRT

### Bassa Priorità (Complesse)

7. **Export Multi-formato**
   - Export per diverse piattaforme
   - Richiede preset e configurazioni

8. **Graphics Overlay**
   - Aggiungi lower thirds, subscribe button, ecc.
   - Richiede templates

---

## Struttura Consigliata per Nuove Integrazioni

### 1. Crea un nuovo modulo nel bot

```
bot_integrations/
├── __init__.py
├── jumpcut_handler.py      # Già presente
├── watermark_handler.py    # Nuovo
├── thumbnail_handler.py    # Nuovo
└── utils.py                # Funzioni comuni
```

### 2. Implementazione standard di un handler

```python
# bot_integrations/thumbnail_handler.py
from telegram import Update
from telegram.ext import ContextTypes, ConversationHandler
from backend.services.thumbnail_service import generate_thumbnail
import asyncio

# Stati
THUMBNAIL_WAIT_VIDEO, THUMBNAIL_WAIT_TEXT = range(2)

async def thumbnail_selected(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Entry point dal menu principale."""
    await update.callback_query.edit_message_text(
        "Inviami un video per generare la thumbnail."
    )
    return THUMBNAIL_WAIT_VIDEO

async def process_thumbnail(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Elabora il video e genera thumbnail."""
    status_msg = await update.message.reply_text("⏳ Generazione thumbnail…")
    
    try:
        # 1. Scarica video
        video_path = await download_video(update.message.video)
        
        # 2. Genera thumbnail (in thread separato)
        loop = asyncio.get_running_loop()
        thumb_path = await loop.run_in_executor(
            None, generate_thumbnail, video_path
        )
        
        # 3. Invia risultato
        await update.message.reply_photo(photo=open(thumb_path, 'rb'))
        await status_msg.delete()
        
    except Exception as e:
        await status_msg.edit_text(f"❌ Errore: {e}")
    
    return ConversationHandler.END
```

### 3. Registra nel bot principale

```python
# bot.py - Aggiungi ai ConversationHandler
from bot_integrations.thumbnail_handler import (
    thumbnail_selected, process_thumbnail,
    THUMBNAIL_WAIT_VIDEO
)

# Aggiungi alla lista dei callback
CallbackQueryHandler(thumbnail_selected, pattern="^thumbnail$"),

# Aggiungi ConversationHandler
ConversationHandler(
    entry_points=[CallbackQueryHandler(thumbnail_selected, pattern="^thumbnail$")],
    states={
        THUMBNAIL_WAIT_VIDEO: [MessageHandler(filters.VIDEO, process_thumbnail)],
    },
    fallbacks=[CallbackQueryHandler(back_to_menu, pattern="^back$")],
    map_to_parent={
        ConversationHandler.END: CHOOSING,
    },
)
```

---

## Gestione dei File Temporanei

**Importante:** I file scaricati da Telegram vanno sempre puliti!

```python
import tempfile
import os

async def process_with_cleanup(update, context, process_func):
    """Wrapper che gestisce automaticamente la pulizia."""
    tmp_dir = tempfile.mkdtemp()
    try:
        input_path = os.path.join(tmp_dir, "input.mp4")
        output_path = os.path.join(tmp_dir, "output.mp4")
        
        # Scarica
        await download_file(update.message.video, input_path)
        
        # Processa
        result = await process_func(input_path, output_path)
        
        # Invia
        await update.message.reply_document(open(result, 'rb'))
        
    finally:
        # Pulizia garantita
        shutil.rmtree(tmp_dir, ignore_errors=True)
```

---

## Limiti di Telegram da Considerare

| Limite | Valore | Implicazione |
|--------|--------|--------------|
| File download | 20 MB (bot), 2 GB (user) | Video lunghi vanno segmentati |
| File upload | 50 MB | Risultati grandi vanno splittati |
| Timeout webhook | 60 secondi | Processi lunghi richiedono job queue |
| Rate limiting | ~30 msg/sec | Non floodare gli utenti |

---

## Checklist per Nuova Integrazione

- [ ] Analizzare il servizio backend da integrare
- [ ] Decidere approccio (import diretto vs HTTP API)
- [ ] Creare handler nel bot
- [ ] Gestire download file da Telegram
- [ ] Chiamare servizio in thread separato (`run_in_executor`)
- [ ] Gestire progresso/feedback all'utente
- [ ] Inviare risultato
- [ ] Pulire file temporanei
- [ ] Gestire errori gracefully
- [ ] Testare con file di varie dimensioni
- [ ] Documentare nel menu del bot

---

## Conclusione

L'integrazione backend → bot è **tecnicamente fattibile** e **consigliata** per funzioni come:
- Jump Cut ✅
- Thumbnail generation
- Watermark
- Audio conversion

L'**approccio consigliato** è l'**import diretto dei servizi** (come jumpcut) per semplicità e performance.

Per funzioni complesse, considerare l'uso di **job queue asincrona** per non bloccare il bot.
