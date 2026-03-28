# Task: Implementazione Torch & Whisper per Trascrizione Audio

## Obiettivo
Installare PyTorch e OpenAI Whisper per abilitare la funzione "Trascrivi Audio" del bot Telegram, che attualmente è disabilitata per mancanza di queste librerie.

## Perché Serve Torch?

**Torch (PyTorch)** è il framework di machine learning alla base di **Whisper**, il modello di trascrizione audio di OpenAI. Senza torch:
- ❌ Il bot non può trascrivere messaggi vocali/audio
- ❌ Non funziona la traduzione di contenuti audio
- ❌ Non funziona il riassunto di audio/link

## Dipendenze da Installare

| Package | Versione | Scopo |
|---------|----------|-------|
| `torch` | 2.x | Framework ML per eseguire Whisper |
| `torchaudio` | 2.x | Supporto audio per torch |
| `openai-whisper` | 20231117 | Modello di trascrizione di OpenAI |

## Passi per l'Implementazione

### 1. Installazione Torch

```bash
# CPU-only (consigliato per server senza GPU)
.venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Oppure con GPU (CUDA) - richiede NVIDIA GPU
.venv/bin/pip install torch torchaudio
```

### 2. Installazione Whisper

```bash
.venv/bin/pip install -U openai-whisper
```

### 3. Verifica Installazione

```bash
.venv/bin/python -c "import torch; print(f'Torch: {torch.__version__}')"
.venv/bin/python -c "import whisper; print('Whisper OK')"
.venv/bin/python -c "from transcriber import WhisperTranscriber; print('Transcriber import OK')"
```

### 4. Riavvio del Bot

Dopo l'installazione, riavviare il bot per caricare automaticamente il transcriber:

```bash
# Fermare il bot se in esecuzione
pkill -f bot.py

# Riavviare
.venv/bin/python bot.py
```

## Note Importanti

### Dimensione Download
- **Torch CPU**: ~200-300 MB
- **Whisper + dipendenze**: ~100-150 MB
- **Totale**: ~400-500 MB di download

### Tempo Installazione
- CPU-only: 2-5 minuti
- Con GPU: 5-10 minuti (dipende dalla connessione)

### Requisiti Minimi
- RAM: 2GB minimo (4GB consigliato)
- Spazio disco: 2GB liberi
- CPU: supporta qualsiasi CPU moderna (x86_64)

### Modelli Whisper
Il bot usa il modello `small` di default (configurabile in `.env` con `WHISPER_MODEL`):
- `tiny`: 39M parametri, veloce, meno accurato
- `base`: 74M parametri, bilanciato
- `small`: 244M parametri, default, buona accuratezza
- `medium`: 769M parametri, lento, molto accurato
- `large`: 1550M parametri, lentissimo, massima accuratezza

## Verifica Funzionamento

Dopo il riavvio, testare nel bot Telegram:
1. Premi "🎙 Trascrivi"
2. Invia un messaggio vocale
3. Dovrebbe mostrare "⏳ Trascrizione in corso…" e poi il testo

Se compare ancora il messaggio "⚠️ Funzione non disponibile", controllare:
- Se l'import `torch` funziona
- Se ci sono errori nei log (`logs/bot.log`)

## Troubleshooting

### Errore: "No module named 'torch'"
Soluzione: reinstallare torch nel virtual environment corretto

### Errore: "CUDA out of memory"
Soluzione: usare torch CPU-only o modello più piccolo (tiny/base)

### Errore: "ffmpeg not found"
Soluzione: installare ffmpeg (`sudo apt install ffmpeg` su Ubuntu/Debian)

## Comando Rapido (Copy-Paste)

```bash
cd /home/lele/CascadeProjects/gitRepo/Creator-Suite-Public
.venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -U openai-whisper
echo "Installazione completata! Riavvia il bot con: .venv/bin/python bot.py"
```
