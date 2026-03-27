# Task: Integrazione NanoBanana API per Image Generation

## ✅ COMPLETATO

## Obiettivo
Aggiungere supporto per NanoBanana come provider AI alternativo per la generazione di immagini, permettendo agli utenti di usare crediti gratuiti invece di Stable Horde.

## Informazioni NanoBanana
- **Website**: https://nanobananaapi.ai
- **API Docs**: https://docs.nananobanana.com/en/api
- **API Key**: Gratuita con crediti inclusi - https://nanobananaapi.ai/api-key
- **Endpoint Base**: `https://www.nananobanana.com/api/v1`
- **Tipo**: Text-to-image generation (Gemini 2.5/3.0 Flash Image models)
- **Scope**: SOLO generazione immagini, NON compatibile con translate/summarize/OCR

## Implementazione Completata

### 1. ✅ Backend - Aggiunto supporto NanoBanana (`backend/routes/tools.py`)

**Modifiche:**
- Aggiunto URL costante: `NANOBANANA_URL = "https://www.nananobanana.com/api/v1"`
- Aggiunto `provider` e `api_key` a `GenerateImageRequest` schema
- Implementata funzione `_nanobanana_generate()` con sync mode
- Modificato endpoint `/generate-image` per supportare provider selection:
  - `stable-horde` (default, gratuito, no API key)
  - `nanobanana` (richiede API key)

**Codice chiave:**
```python
# Schema aggiornato
class GenerateImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=2000)
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=768, ge=256, le=2048)
    model: str | None = None
    provider: str | None = None  # ← nuovo
    api_key: str | None = None   # ← nuovo

# Funzione NanoBanana
async def _nanobanana_generate(
    client: httpx.AsyncClient,
    prompt: str,
    width: int,
    height: int,
    api_key: str,
    model: str = "nano-banana",
) -> str:
    # Determina aspect ratio automaticamente
    # Chiama API con mode=sync
    # Scarica immagine e converte in base64
```

### 2. ✅ Frontend - Types aggiornati (`frontend/types/index.ts`)

**Modifiche:**
- Aggiunto `nanobananaApiKey: string` a `AppSettings`
- Aggiunto al `DEFAULT_SETTINGS`
- Creato type `ImageProvider = 'stable-horde' | 'nanobanana'`
- Creato array `IMAGE_PROVIDERS` con configurazione providers:
  ```typescript
  export const IMAGE_PROVIDERS: ImageProviderConfig[] = [
    {
      id: 'stable-horde',
      name: 'Stable Horde',
      description: 'Gratuito, nessuna chiave richiesta',
      requiresKey: false,
      models: ['Deliberate', 'DreamShaper', 'Realistic Vision'],
      defaultModel: 'Deliberate',
    },
    {
      id: 'nanobanana',
      name: 'NanoBanana',
      description: 'Gemini-powered, crediti gratuiti disponibili',
      requiresKey: true,
      signupUrl: 'https://nanobananaapi.ai/api-key',
      models: ['nano-banana', 'nano-banana-pro'],
      defaultModel: 'nano-banana',
    },
  ];
  ```

### 3. ✅ Frontend - ImageGeneratorUI (`frontend/components/ImageGeneratorUI.tsx`)

**Modifiche:**
- Aggiunto state `provider` per selezione provider
- Aggiunta UI provider selector con cards
- Passaggio `provider` e `api_key` nelle chiamate API
- Warning se NanoBanana selezionato ma API key mancante
- Import di `IMAGE_PROVIDERS` e `useSettings`

### 4. ✅ Frontend - Settings Screen (`frontend/app/(tabs)/settings.tsx`)

**Modifiche:**
- Aggiunta sezione "GENERAZIONE IMMAGINI"
- Input per NanoBanana API Key con:
  - Placeholder `nb_...`
  - SecureTextEntry
  - Link per ottenere crediti gratuiti
  - Indicatore ✅ quando key salvata
- Aggiornato useEffect per includere `nanobananaApiKey`

## File Modificati

### Backend
- ✅ `backend/routes/tools.py` - Provider support, schema update, endpoint logic

### Frontend  
- ✅ `frontend/types/index.ts` - AppSettings, IMAGE_PROVIDERS
- ✅ `frontend/components/ImageGeneratorUI.tsx` - Provider selector UI
- ✅ `frontend/app/(tabs)/settings.tsx` - API key management

## Testing Consigliato

1. ✅ Registrarsi su https://nanobananaapi.ai/api-key e ottenere API key gratuita
2. ✅ Inserire API key in Impostazioni → GENERAZIONE IMMAGINI
3. ✅ Aprire tool generazione immagini
4. ✅ Selezionare provider NanoBanana
5. ✅ Testare generazione con prompt semplice
6. ✅ Verificare gestione errori:
   - Provider selezionato senza API key
   - API key errata
   - Prompt vuoto

## Note Implementazione

### Architettura Scelta
- **NON** aggiunta API key in `config.py` (coerente con Groq/OpenRouter)
- API key gestita completamente dal frontend (user-provided)
- Pattern esistente mantenuto per consistenza
- Nessun file `ai_providers.py` creato (funzioni già in `tools.py`)

### Limitazioni Note
- Solo sync mode (no streaming o async polling)
- Aspect ratio calcolato automaticamente da dimensioni
- Timeout 90 secondi per generazione
- Download immagine da URL e conversione base64 inline

### Vantaggi
- ✅ Crediti gratuiti per testing
- ✅ Qualità Gemini-powered
- ✅ Opzione free alternativa a Stable Horde
- ✅ Gestione coerente con altri AI providers

## Priorità
**Media** - Feature utile per testing fase iniziale. Permette di usare image generation con crediti gratuiti senza dipendere solo da Stable Horde.

## Tempo Effettivo
~1.5 ore implementazione + testing inline
