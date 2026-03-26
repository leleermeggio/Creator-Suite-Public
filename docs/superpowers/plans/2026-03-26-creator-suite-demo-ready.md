# Creator Suite — Demo-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken features (translate, summarize, OCR, AI image), improve error handling, and make the app demo-ready with polished UI.

**Architecture:** Backend FastAPI serves tools via `/tools/*` endpoints. Frontend Expo web app calls backend. Gemini API for summarize/OCR, deep-translator for translate, Pollinations for AI images. Frontend passes user's API key + model to backend per-request.

**Tech Stack:** Python 3.12 / FastAPI / SQLAlchemy, TypeScript / React Native / Expo, Gemini API, Pollinations AI, deep-translator

---

## Task Overview

| Task | Description | Agent Model | Estimated Steps |
|------|-------------|-------------|-----------------|
| 1 | Fix Gemini model 404 + translate endpoint | Sonnet | 12 |
| 2 | Fix summarize + OCR end-to-end | Sonnet | 10 |
| 3 | Settings screen — API key + model selector UX | Sonnet | 14 |
| 4 | AI Image generation — wire Pollinations end-to-end | Sonnet | 8 |
| 5 | Frontend polish — better design, responsive, animations | Sonnet | 16 |
| 6 | End-to-end testing of all features | Sonnet | 10 |

---

### Task 1: Fix Gemini Model 404 + Translate Endpoint

**Problem:** `gemini-2.0-flash` returns 404 from Gemini API. Translate silently fails and falls back to deep-translator which works but error handling is poor. The translate endpoint doesn't accept `model` or `api_key` from the request body like summarize/OCR do.

**Files:**
- Modify: `backend/routes/tools.py` — TranslateRequest schema + endpoint
- Modify: `backend/config.py` — default GEMINI_MODEL
- Test: `backend/tests/routes/test_tools.py`

- [ ] **Step 1: Fix default model in config.py**

Change the default `GEMINI_MODEL` to a model that actually exists and has generous free-tier limits:

```python
# backend/config.py line 37
GEMINI_MODEL: str = "gemini-1.5-flash"
```

- [ ] **Step 2: Update GEMINI_MODELS list in settings.tsx**

Ensure the frontend model list has only valid models:

```typescript
// frontend/app/(tabs)/settings.tsx
const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];
```

Note: `gemini-2.0-flash` may or may not be available depending on the user's API access. Keep it as option but not default.

- [ ] **Step 3: Add api_key and model to TranslateRequest**

```python
class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
    target_language: str = Field(min_length=2, max_length=10)
    api_key: str | None = None
    model: str | None = None
```

- [ ] **Step 4: Update translate endpoint to use request api_key/model**

```python
@router.post("/translate", response_model=ToolResult)
async def translate(
    body: TranslateRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY

    async with httpx.AsyncClient() as client:
        if api_key:
            try:
                translated = await _call_gemini(
                    client=client,
                    api_key=api_key,
                    model=body.model or settings.GEMINI_MODEL,
                    system_prompt=(
                        f"You are a translator. Translate the text to {body.target_language}. "
                        "Return only the translation."
                    ),
                    user_content=body.text,
                )
                return ToolResult(result=translated)
            except Exception:
                pass  # fall through to deep-translator

        # Fallback: deep-translator with auto language detection
        import asyncio
        from deep_translator import GoogleTranslator
        try:
            translated = await asyncio.to_thread(
                lambda: GoogleTranslator(source="auto", target=body.target_language).translate(body.text)
            )
            return ToolResult(result=translated or body.text)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Servizio di traduzione non disponibile",
            ) from exc
```

- [ ] **Step 5: Update frontend translate service to pass api_key and model**

```typescript
// frontend/services/translate.ts
import { post } from './apiClient';

export async function translateText(
  text: string,
  targetLang: string,
  apiKey?: string,
  model?: string,
): Promise<string> {
  const res = await post<{ result: string }>('/tools/translate', {
    text,
    target_language: targetLang,
    api_key: apiKey || undefined,
    model: model || undefined,
  });
  return res.result;
}
```

- [ ] **Step 6: Write test for translate endpoint**

```python
# backend/tests/routes/test_tools.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_translate_returns_result(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/tools/translate",
        json={"text": "hello", "target_language": "it"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "result" in data
    assert len(data["result"]) > 0

@pytest.mark.asyncio
async def test_translate_missing_text_returns_422(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/tools/translate",
        json={"text": "", "target_language": "it"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
```

- [ ] **Step 7: Run tests**

```bash
cd "D:\Projects\GIt repo\Creator-Suite-Public"
python -m pytest backend/tests/routes/test_tools.py -x -v
```

- [ ] **Step 8: Commit**

```bash
git add backend/routes/tools.py backend/config.py frontend/services/translate.ts
git commit -m "fix(tools): fix Gemini 404 and translate endpoint consistency"
```

---

### Task 2: Fix Summarize + OCR End-to-End

**Problem:** Summarize and OCR return 502 errors because error messages leak API keys and model names may be wrong. Need clean error handling and the full request flow working.

**Files:**
- Modify: `backend/routes/tools.py` — summarize + OCR error handling
- Modify: `frontend/services/gemini.ts` — pass api_key + model
- Modify: `frontend/app/tool/[id].tsx` — error display
- Test: `backend/tests/routes/test_tools.py`

- [ ] **Step 1: Fix summarize endpoint error handling**

Replace the summarize endpoint with clean error handling that never leaks API keys:

```python
@router.post("/summarize", response_model=ToolResult)
async def summarize(
    body: SummarizeRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google API Key richiesta. Aggiungila nelle Impostazioni.",
        )

    model = body.model or settings.GEMINI_MODEL
    async with httpx.AsyncClient() as client:
        try:
            result = await _call_gemini(
                client=client,
                api_key=api_key,
                model=model,
                system_prompt="Sei un assistente che riassume testi in modo conciso.",
                user_content=f"Riassumi il seguente testo in modo conciso con bullet points:\n\n{body.text}",
            )
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            if code == 429:
                detail = "Troppe richieste. Riprova tra qualche secondo."
            elif code == 404:
                detail = f"Modello '{model}' non disponibile. Cambia modello nelle Impostazioni."
            elif code == 400:
                detail = "API Key non valida. Controlla nelle Impostazioni."
            else:
                detail = f"Errore Gemini ({code}). Riprova."
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except (httpx.RequestError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Servizio AI non raggiungibile. Riprova.",
            ) from exc
    return ToolResult(result=result)
```

- [ ] **Step 2: Fix OCR endpoint error handling (same pattern)**

```python
@router.post("/ocr", response_model=ToolResult)
async def ocr(
    body: OcrRequest,
    _user: User = Depends(get_current_user),
) -> ToolResult:
    settings = get_settings()
    api_key = body.api_key or settings.GOOGLE_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google API Key richiesta. Aggiungila nelle Impostazioni.",
        )

    model = body.model or settings.GEMINI_MODEL
    parts = [
        {
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": body.image_base64,
            }
        },
        {"text": "Estrai tutto il testo visibile in questa immagine."},
    ]

    async with httpx.AsyncClient() as client:
        try:
            result = await _call_gemini(
                client=client,
                api_key=api_key,
                model=model,
                system_prompt="Sei un assistente OCR. Restituisci solo il testo estratto dall'immagine.",
                user_content=parts,
            )
        except httpx.HTTPStatusError as exc:
            code = exc.response.status_code
            if code == 429:
                detail = "Troppe richieste. Riprova tra qualche secondo."
            elif code == 404:
                detail = f"Modello '{model}' non disponibile. Cambia modello nelle Impostazioni."
            elif code == 400:
                detail = "API Key non valida. Controlla nelle Impostazioni."
            else:
                detail = f"Errore Gemini ({code}). Riprova."
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from exc
        except (httpx.RequestError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Servizio AI non raggiungibile. Riprova.",
            ) from exc
    return ToolResult(result=result)
```

- [ ] **Step 3: Verify frontend gemini.ts passes api_key + model correctly**

Should already be fixed from our earlier changes. Verify `frontend/services/gemini.ts` has:

```typescript
export async function summarizeText(
  apiKey: string,
  model: string,
  text: string,
): Promise<string> {
  const res = await post<{ result: string }>('/tools/summarize', {
    text,
    api_key: apiKey || undefined,
    model: model || undefined,
  });
  return res.result;
}

export async function ocrImage(
  apiKey: string,
  model: string,
  imageBase64: string,
  _mimeType = 'image/jpeg',
): Promise<string> {
  const res = await post<{ result: string }>('/tools/ocr', {
    image_base64: imageBase64,
    api_key: apiKey || undefined,
    model: model || undefined,
  });
  return res.result;
}
```

- [ ] **Step 4: Write tests**

```python
@pytest.mark.asyncio
async def test_summarize_no_api_key_returns_400(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/tools/summarize",
        json={"text": "Some long text to summarize here."},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "API Key" in resp.json()["detail"]

@pytest.mark.asyncio
async def test_ocr_no_api_key_returns_400(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/tools/ocr",
        json={"image_base64": "iVBORw0KGgo="},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "API Key" in resp.json()["detail"]
```

- [ ] **Step 5: Run tests and commit**

```bash
python -m pytest backend/tests/routes/test_tools.py -x -v
git add backend/routes/tools.py frontend/services/gemini.ts
git commit -m "fix(tools): clean error handling for summarize/OCR, no key leaks"
```

---

### Task 3: Settings Screen — API Key + Model Selector UX

**Problem:** Settings screen needs a working API key input field and a proper model selector (not just cycling). The user must be able to enter their Google API Key and select a Gemini model.

**Files:**
- Modify: `frontend/types/index.ts` — AppSettings type (already has googleApiKey)
- Modify: `frontend/app/(tabs)/settings.tsx` — API key input + model dropdown
- Modify: `frontend/hooks/useSettings.ts` — no changes needed

- [ ] **Step 1: Verify AppSettings type has googleApiKey**

`frontend/types/index.ts` should have:

```typescript
export interface AppSettings {
  geminiModel: string;
  googleApiKey: string;
  notifications: boolean;
  autoProcess: boolean;
  highQuality: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  geminiModel: 'gemini-1.5-flash',
  googleApiKey: '',
  notifications: true,
  autoProcess: false,
  highQuality: true,
};
```

Note: changed default model to `gemini-1.5-flash`.

- [ ] **Step 2: Rewrite settings.tsx ACCOUNT section with model dropdown + API key input**

Replace the ACCOUNT section with a proper model dropdown (not cycling) and a visible API key input:

```tsx
{/* Account section */}
<Animated.View style={[styles.section, { opacity: fadeAnim }]}>
  <Text style={styles.sectionLabel}>ACCOUNT</Text>
  <GlowCard gradient={COLORS.gradCyan} glowIntensity={0.1} borderWidth={1}>
    <View style={styles.settingsGroup}>
      {/* Google API Key */}
      <View style={styles.settingRow}>
        <Text style={styles.settingIcon}>🔑</Text>
        <View style={styles.settingTextCol}>
          <Text style={styles.settingLabel}>Google API Key</Text>
          <Text style={styles.settingSublabel}>Richiesta per Riassumi e OCR</Text>
          <TextInput
            style={styles.apiKeyInput}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            onBlur={() => update({ googleApiKey: apiKeyInput.trim() })}
            placeholder="AIza..."
            placeholderTextColor={COLORS.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {apiKeyInput.trim().length > 0 && (
            <Text style={styles.apiKeyStatus}>
              ✅ Key salvata
            </Text>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Gemini Model Selector */}
      <View style={styles.settingRow}>
        <Text style={styles.settingIcon}>🧠</Text>
        <View style={styles.settingTextCol}>
          <Text style={styles.settingLabel}>Modello Gemini</Text>
          <Text style={styles.settingSublabel}>{settings.geminiModel}</Text>
          <View style={styles.modelChips}>
            {GEMINI_MODELS.map(m => (
              <Pressable
                key={m}
                onPress={() => update({ geminiModel: m })}
                style={[
                  styles.modelChip,
                  settings.geminiModel === m && styles.modelChipActive,
                ]}
              >
                <Text style={[
                  styles.modelChipText,
                  settings.geminiModel === m && styles.modelChipTextActive,
                ]}>
                  {m.replace('gemini-', '')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  </GlowCard>
</Animated.View>
```

- [ ] **Step 3: Add new styles for model chips and API key status**

```typescript
apiKeyInput: {
  marginTop: SPACING.sm,
  fontFamily: FONTS.bodyRegular,
  fontSize: 13,
  color: COLORS.textPrimary,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
  borderRadius: RADIUS.sm,
  paddingHorizontal: SPACING.md,
  paddingVertical: SPACING.sm,
  backgroundColor: COLORS.bgElevated,
  ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
},
apiKeyStatus: {
  fontFamily: FONTS.bodyRegular,
  fontSize: 11,
  color: COLORS.neonLime,
  marginTop: SPACING.xs,
},
modelChips: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: SPACING.xs,
  marginTop: SPACING.sm,
},
modelChip: {
  paddingHorizontal: SPACING.md,
  paddingVertical: SPACING.xs,
  borderRadius: RADIUS.full,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.1)',
},
modelChipActive: {
  borderColor: COLORS.neonCyan,
  backgroundColor: COLORS.neonCyan + '15',
},
modelChipText: {
  fontFamily: FONTS.bodyMedium,
  fontSize: 11,
  color: COLORS.textMuted,
},
modelChipTextActive: {
  color: COLORS.neonCyan,
},
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(tabs\)/settings.tsx frontend/types/index.ts
git commit -m "feat(settings): add API key input and model chip selector"
```

---

### Task 4: AI Image Generation — Wire Pollinations End-to-End

**Problem:** AI Image tool is marked as available and the `ImageGeneratorUI` component + `pollinations.ts` service exist and work. Need to verify it works end-to-end and fix any issues.

**Files:**
- Verify: `frontend/services/pollinations.ts` — should work as-is
- Verify: `frontend/components/ImageGeneratorUI.tsx` — should work as-is
- Verify: `frontend/app/tool/[id].tsx` — AI image routing

- [ ] **Step 1: Verify pollinations service builds URLs correctly**

Read `frontend/services/pollinations.ts` and verify:
- `buildImageUrl()` returns a valid Pollinations URL
- `generateImage()` fetches and verifies the image loads
- `SOCIAL_FORMATS` has correct dimensions

- [ ] **Step 2: Test AI Image generation in browser**

Open app → Quick Tools → Genera Immagini AI → Enter prompt like "futuristic city skyline, neon lights" → Click Genera.

Verify:
- Image loads and displays
- Mode switching (Thumbnail/Logo/Cover Social) works
- "Tutti i formati" batch generation works in social-cover mode
- Rigenera button produces a different image

- [ ] **Step 3: Fix any issues found during testing**

Common issues:
- CORS on Pollinations image loading (unlikely, they allow all origins)
- Image not rendering (check if URL is built correctly)

- [ ] **Step 4: Commit if changes needed**

```bash
git add frontend/
git commit -m "fix(ai-image): ensure Pollinations image generation works"
```

---

### Task 5: Frontend Polish — Better Design, Responsive, Animations

**Problem:** The app works but needs visual polish for a demo. Improve the layout, add subtle animations, ensure responsive design works well on desktop.

**Files:**
- Modify: `frontend/app/(tabs)/index.tsx` — projects home polish
- Modify: `frontend/app/(tabs)/quick-tools.tsx` — tools grid polish
- Modify: `frontend/app/tool/[id].tsx` — tool screen polish
- Modify: `frontend/app/login.tsx` — login screen polish
- Modify: `frontend/components/GlowCard.tsx` — card hover effects

- [ ] **Step 1: Add hover effects to GlowCard for web**

```tsx
// In GlowCard.tsx, add web hover state for cards
// Add scale transform on hover (web only)
const [hovered, setHovered] = useState(false);

// In the Pressable/View wrapper:
onMouseEnter={() => setHovered(true)}
onMouseLeave={() => setHovered(false)}
style={[
  cardStyle,
  Platform.OS === 'web' && hovered && { transform: [{ scale: 1.02 }] },
]}
```

- [ ] **Step 2: Polish login screen**

- Ensure the login card is vertically centered
- Add subtle floating animation to the lightning bolt
- Ensure error messages are in Italian
- Test text at the bottom should be hidden in production

- [ ] **Step 3: Polish Quick Tools grid**

- Ensure 3-column grid on desktop, 2 on mobile
- Add card hover glow effect
- Available tools should be visually distinct from coming-soon tools

- [ ] **Step 4: Polish tool execution screens**

- Ensure result text has proper formatting
- Add loading skeleton when processing
- Result section has smooth slide-in animation

- [ ] **Step 5: Ensure responsive layout works on desktop**

- Test at 1920px, 1440px, 1024px, 768px, 375px widths
- Verify max-width constraints
- Verify padding adjustments

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): polish UI for demo — hover effects, animations, responsive"
```

---

### Task 6: End-to-End Testing of All Features

**Problem:** Need to verify every feature works before declaring demo-ready.

- [ ] **Step 1: Start backend**

```bash
cd "D:\Projects\GIt repo\Creator-Suite-Public\backend"
python ../run_server.py
```

- [ ] **Step 2: Seed dev user**

```bash
cd "D:\Projects\GIt repo\Creator-Suite-Public"
python -m backend.seeds.dev_user
```

- [ ] **Step 3: Start frontend**

```bash
cd "D:\Projects\GIt repo\Creator-Suite-Public\frontend"
npx expo start --web
```

- [ ] **Step 4: Test login**

- Login with `dev@cazzone.local` / `CazZone2024!`
- Verify redirect to projects home
- Verify no CORS errors in console

- [ ] **Step 5: Test Translate**

- Quick Tools → Traduci
- Enter "Ciao, come stai?" → target: English
- Expected: "Hello, how are you?" (or similar)

- [ ] **Step 6: Test Summarize**

- Quick Tools → Riassumi
- Enter a long paragraph of text
- Expected: Bullet-point summary in Italian

- [ ] **Step 7: Test OCR**

- Quick Tools → OCR
- Upload an image with text
- Expected: Extracted text displayed

- [ ] **Step 8: Test AI Image Generation**

- Quick Tools → Genera Immagini AI
- Enter "sunset over Rome, cinematic"
- Expected: Generated image displayed
- Test all 3 modes (Thumbnail, Logo, Cover)

- [ ] **Step 9: Test Project Creation**

- Home → + Nuovo progetto
- Create a project with a name
- Verify it appears in the list

- [ ] **Step 10: Test Settings**

- Settings → Enter API key → click away
- Settings → Change model → verify it sticks after refresh

---

## Execution Strategy

This plan has **6 independent tasks** that can be parallelized:

- **Tasks 1 + 2** (backend fixes) can run in parallel
- **Task 3** (settings UX) can run in parallel with 1+2
- **Task 4** (AI image verification) can run in parallel
- **Task 5** (frontend polish) depends loosely on 1-4 being done
- **Task 6** (E2E testing) must run last after everything is deployed
