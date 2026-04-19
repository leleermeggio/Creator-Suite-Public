# 🛠️ Tools Update - Nuove Funzionalità Attivate

## Data: 27 Marzo 2026

### Funzionalità Attivate

Le seguenti funzionalità sono state attivate e sono ora disponibili nell'applicazione:

---

## 1. 🔊 Text to Speech (TTS)

### Descrizione
Converte testo in audio naturale utilizzando Edge TTS con voci di alta qualità.

### Endpoint Backend
- **Route**: `POST /audio/tts`
- **Input**: 
  - `project_id`: ID del progetto
  - `text`: Testo da convertire (max 10.000 caratteri)
  - `language`: Codice lingua (es. `it`, `en`, `es`)
- **Output**: File MP3 con audio generato

### Voci Supportate
- Italiano: `it-IT-IsabellaNeural`
- Inglese: `en-US-JennyNeural`
- Spagnolo: `es-ES-ElviraNeural`
- Francese: `fr-FR-DeniseNeural`
- Tedesco: `de-DE-KatjaNeural`
- Portoghese: `pt-BR-FranciscaNeural`

### Frontend
- Selezione lingua target
- Input testuale multilinea
- Download audio MP3 generato

### Dipendenze
```bash
pip install edge-tts
```

---

## 2. 🔄 Convert (Conversione Formati)

### Descrizione
Converte file audio/video tra diversi formati usando FFmpeg.

### Endpoint Backend
- **Route**: `POST /tools/convert`
- **Input**: 
  - `file`: File da convertire (UploadFile)
  - `target_format`: Formato destinazione (query param)
- **Output**: File convertito nel formato richiesto

### Formati Supportati

**Audio:**
- MP3 (libmp3lame, quality 2)
- WAV (PCM 16-bit)
- OGG (Vorbis, quality 5)
- AAC (Advanced Audio Coding)

**Video:**
- MP4 (H.264 + AAC)
- MKV (Matroska)
- WEBM (VP9 + Opus)
- AVI (Legacy)
- MOV (QuickTime)

### Frontend
- Upload file tramite drag & drop
- Selezione formato destinazione (MP3, WAV, MP4, WEBM)
- Download file convertito

### Dipendenze
FFmpeg già presente (usato anche per Jumpcut)

---

## 3. ⬇️ Download (YouTube/Social Media)

### Descrizione
Scarica video e audio da YouTube, Instagram, TikTok e altri social media usando yt-dlp.

### Endpoint Backend
- **Route**: `POST /tools/download`
- **Input**: 
  - `url`: URL del video (query param)
  - `format_type`: `video` o `audio` (query param)
- **Output**: File scaricato (MP4 per video, MP3/M4A per audio)

### Piattaforme Supportate
- YouTube
- Instagram
- TikTok
- Twitter/X
- Facebook
- Vimeo
- Dailymotion
- E molte altre...

### Features
- Download video fino a 4K
- Estrazione audio in alta qualità
- Metadata inclusi (titolo, autore, durata)
- Limite durata: 3 ore per file

### Frontend
- Input URL
- Selezione tipo: Video o Audio
- Visualizzazione metadata (titolo, durata, uploader)
- Download diretto

### Dipendenze
```bash
pip install yt-dlp
```

---

## 4. 🎙️ Transcribe (Trascrizione con Whisper AI)

### Descrizione
Trascrizione automatica di file audio/video usando OpenAI Whisper.

### Endpoint Backend
- **Route**: `POST /tools/transcribe`
- **Input**: 
  - `file`: File audio/video (UploadFile)
  - `language`: Codice lingua opzionale (query param)
  - `model`: Modello Whisper (query param)
- **Output**: JSON con testo trascritto e segmenti

### Modelli Whisper Disponibili

| Modello | Dimensione | Velocità | Precisione | RAM Richiesta |
|---------|------------|----------|------------|---------------|
| `tiny` | ~75 MB | Molto veloce | Bassa | ~1 GB |
| `small` | ~461 MB | Veloce | Buona | ~2 GB |
| `medium` | ~1.5 GB | Media | Ottima | ~5 GB |
| `large` | ~3 GB | Lenta | Eccellente | ~10 GB |
| `large-v2` | ~3 GB | Lenta | Eccellente | ~10 GB |
| `large-v3` | ~3 GB | Lenta | Migliore | ~10 GB |

**Raccomandato per produzione**: `small` (buon compromesso velocità/qualità)

### Output Format
```json
{
  "text": "Testo completo trascritto...",
  "segments": [
    {
      "start": 0.0,
      "end": 2.5,
      "text": "Segmento di testo...",
      "words": [...]
    }
  ],
  "language": "it"
}
```

### Frontend
- Upload file audio/video
- Selezione modello Whisper (Tiny, Small, Medium)
- Selezione lingua (opzionale, auto-detect se non specificata)
- Visualizzazione testo trascritto
- Copia o salva in fase progetto

### Dipendenze
```bash
pip install openai-whisper
```

**⚠️ NOTA IMPORTANTE**: Whisper richiede ~3GB di spazio per i modelli. Il primo avvio scaricherà il modello selezionato.

**Performance GPU**: Per prestazioni ottimali con modelli grandi, si consiglia GPU CUDA-compatibile.

---

## 📋 Riepilogo Modifiche Codice

### Backend (`backend/routes/tools.py`)
- ✅ Aggiunto endpoint `POST /tools/convert` (linee 742-803)
- ✅ Aggiunto endpoint `POST /tools/download` (linee 809-866)
- ✅ Aggiunto endpoint `POST /tools/transcribe` (linee 878-933)

### Frontend (`frontend/constants/tools.ts`)
- ✅ Attivato `tts` → `available: true` (linea 66)
- ✅ Attivato `convert` → `available: true` (linea 75)
- ✅ Attivato `download` → `available: true` (linea 39)
- ✅ Attivato `transcribe` → `available: true` (linea 21)

### Frontend (`frontend/app/tool/[id].tsx`)
- ✅ Aggiunto handling TTS (linee 202-221)
- ✅ Aggiunto handling Transcribe (linee 178-201)
- ✅ Aggiunto handling Convert (linee 204-230)
- ✅ Aggiunto handling Download (linee 233-258)
- ✅ Aggiunto UI selezione modello Whisper (linee 483-500)
- ✅ Aggiunto UI selezione tipo download (linee 502-519)
- ✅ Aggiunto UI selezione formato conversione (linee 478-496)

---

## 🔧 Setup e Installazione

### Installazione Dipendenze

```bash
# Backend - installa tutte le nuove dipendenze
cd backend
pip install edge-tts yt-dlp openai-whisper

# Frontend - nessuna nuova dipendenza richiesta
```

### Variabili d'Ambiente

Aggiornare `.env` se necessario:

```env
# TTS (opzionale - usa Edge TTS gratuito)
# Nessuna configurazione richiesta

# Whisper Model (opzionale)
WHISPER_MODEL=small  # tiny, small, medium, large

# Download (opzionale)
# Nessuna configurazione richiesta
```

---

## 🧪 Testing

### Test TTS
```bash
curl -X POST "http://localhost:8000/audio/tts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","text":"Ciao mondo","language":"it"}'
```

### Test Convert
```bash
curl -X POST "http://localhost:8000/tools/convert?target_format=mp3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@input.wav"
```

### Test Download
```bash
curl -X POST "http://localhost:8000/tools/download?url=https://youtube.com/watch?v=VIDEO_ID&format_type=audio" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Transcribe
```bash
curl -X POST "http://localhost:8000/tools/transcribe?model=small&language=it" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@audio.mp3"
```

---

## ⚠️ Limitazioni e Note

### TTS
- Limite caratteri: 10.000 per richiesta
- Qualità voce: dipende da Edge TTS (gratis)
- Latenza: ~2-5 secondi per testo medio

### Convert
- File size max: dipende dalla configurazione server
- Timeout: 300 secondi (5 minuti)
- FFmpeg deve essere installato sul server

### Download
- Durata max: 3 ore (10.800 secondi)
- Alcuni siti potrebbero richiedere cookie di autenticazione
- Rate limiting da parte delle piattaforme

### Transcribe
- **Modello small**: ~461 MB da scaricare al primo avvio
- **Performance**: CPU può essere lento per file lunghi
- **GPU consigliata** per modelli medium/large
- Memoria RAM richiesta varia per modello (vedi tabella)

---

## 📊 Metriche di Performance (Stimate)

| Tool | File 10 MB | File 100 MB | CPU/GPU |
|------|------------|-------------|---------|
| TTS | ~3s | N/A | CPU |
| Convert | ~5-10s | ~30-60s | CPU |
| Download | ~10-30s | ~60-180s | Network |
| Transcribe (small) | ~30-60s | ~5-10 min | CPU |
| Transcribe (small, GPU) | ~5-10s | ~30-60s | GPU |

---

## 🎯 Prossimi Passi

1. **Testing con utenti reali** - raccogliere feedback sulle nuove funzionalità
2. **Ottimizzazione performance** - considerare GPU per Whisper in produzione
3. **Rate limiting** - implementare limiti per prevenire abusi
4. **Caching** - cache dei risultati per URL già processati (Download)
5. **Batch processing** - supporto per multiple file contemporaneamente

---

## 📝 Changelog

### [v2.0.0] - 2026-03-27

#### Aggiunte
- ✅ Tool TTS (Text to Speech) con Edge TTS
- ✅ Tool Convert per conversione formati audio/video
- ✅ Tool Download per scaricare da YouTube/Social
- ✅ Tool Transcribe con OpenAI Whisper AI

#### Modifiche
- Aggiornato frontend per supportare i nuovi tools
- Aggiornato backend con nuovi endpoint REST
- UI migliorata con selezione modelli e formati

#### Dipendenze
- Aggiunto `edge-tts` per TTS
- Aggiunto `yt-dlp` per Download
- Aggiunto `openai-whisper` per Transcribe

---

**Autore**: AI Assistant  
**Data**: 27 Marzo 2026  
**Versione**: 2.0.0
