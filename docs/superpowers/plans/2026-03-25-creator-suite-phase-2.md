# Creator Suite Phase 2 — Enhancement Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add captions, audio mixer, and graphics/thumbnail tools to make the editor feature-complete for content creators. After Phase 2, creators can produce polished, publish-ready videos entirely within the app.

**Prerequisites:** Phase 1 complete (media import, timeline, AI engine, export all working end-to-end).

---

## Task 1: Caption Generation Service — Backend

**Files:**
- Create: `backend/services/caption_service.py`
- Create: `backend/models/caption.py`
- Create: `backend/schemas/caption.py`
- Create: `backend/routes/captions.py`
- Create: `backend/tests/test_caption_service.py`

- [ ] **Step 1: Create Caption model**

```python
class Caption(Base):
    __tablename__ = "captions"
    id, project_id, user_id, asset_id, language,
    segments (JSON: [{start, end, text, words}]),
    style_preset, font_family, font_size, color, bg_color,
    position (top/center/bottom), created_at, updated_at
```

- [ ] **Step 2: Implement caption service**

- Auto-generate from transcription result (reuse Whisper output)
- Manual creation/editing
- Style presets: "default", "bold_center", "karaoke", "typewriter"
- SRT/ASS export
- Burn-in via FFmpeg (render captions into video)

- [ ] **Step 3: Create caption routes**

- `POST /captions/generate` — generate from transcription
- `GET /captions?project_id=X` — list captions
- `PUT /captions/{id}` — update text/timing/style
- `POST /captions/{id}/export` — export as SRT/ASS file
- `POST /captions/{id}/burn-in` — render into video (creates Job)

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 2: Caption Translation Service — Backend

**Files:**
- Create: `backend/services/translation_service.py`
- Create: `backend/tests/test_translation_service.py`

- [ ] **Step 1: Refactor existing translator.py into service**

Migrate `translator.py` into `backend/services/translation_service.py`:
- Accept caption ID + target language
- Translate segment by segment (preserve timing)
- Create new Caption record for translated version
- Support batch translation (multiple languages at once)

- [ ] **Step 2: Add translation endpoint**

- `POST /captions/{id}/translate` — `{target_language: "en"}`
- Returns new caption ID with translated text

- [ ] **Step 3: Wire into Celery for long translations**

- [ ] **Step 4: Write tests (mock deep-translator)**

- [ ] **Step 5: Commit**

---

## Task 3: Audio Mixer — Backend

**Files:**
- Create: `backend/services/audio_mixer_service.py`
- Create: `backend/routes/audio.py`
- Create: `backend/schemas/audio.py`
- Create: `backend/tests/test_audio_mixer.py`

- [ ] **Step 1: Implement audio mixer service**

- Accept timeline audio tracks with volume curves
- Mix multiple audio tracks (voice + music + SFX)
- Apply volume keyframes (fade in/out, ducking)
- Normalize final mix to -14 LUFS (YouTube standard)
- FFmpeg filter complex for mixing

- [ ] **Step 2: Create audio routes**

- `POST /audio/mix` — render mixed audio for timeline
- `POST /audio/normalize` — normalize a single audio file
- `POST /audio/extract` — extract audio from video

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

## Task 4: Thumbnail Generation — Backend

**Files:**
- Create: `backend/services/thumbnail_service.py`
- Create: `backend/models/thumbnail.py`
- Create: `backend/routes/thumbnails.py`
- Create: `backend/tests/test_thumbnail_service.py`

- [ ] **Step 1: Create Thumbnail model**

```python
class Thumbnail(Base):
    __tablename__ = "thumbnails"
    id, project_id, user_id, storage_key, source_type (frame_extract|ai_generated|uploaded),
    prompt (for AI generation), width, height, created_at
```

- [ ] **Step 2: Implement thumbnail service**

- Extract frame from video at specific timestamp
- AI generation via Gemini image API (given prompt + optional reference frame)
- Text overlay on extracted frame (title, creator name)
- Resize/crop for platform specs (YouTube: 1280x720, etc.)

- [ ] **Step 3: Create thumbnail routes**

- `POST /thumbnails/extract-frame` — extract from video at timestamp
- `POST /thumbnails/generate` — AI-generate from prompt
- `POST /thumbnails/add-text` — overlay text on image
- `GET /thumbnails?project_id=X` — list thumbnails

- [ ] **Step 4: Write tests**

- [ ] **Step 5: Commit**

---

## Task 5: Graphics & Overlays — Backend

**Files:**
- Create: `backend/services/graphics_service.py`
- Create: `backend/tests/test_graphics_service.py`

- [ ] **Step 1: Implement graphics service**

- Title cards: full-screen text slides with background
- Lower thirds: animated name/title bars
- Text overlays: positioned text on video
- All rendered via FFmpeg drawtext/overlay filters
- Template system: predefined styles users can customize

- [ ] **Step 2: Template presets**

```python
TEMPLATES = {
    "title_card_minimal": {"bg": "#000", "font": "Inter", "size": 72, "anim": "fade"},
    "lower_third_modern": {"bg": "rgba(0,0,0,0.7)", "font": "Inter", "size": 24},
    "lower_third_neon": {"bg": "transparent", "font": "Poppins", "glow": True},
    "text_overlay_shadow": {"shadow": True, "font": "Montserrat"},
}
```

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

## Task 6: Flutter — Caption Editor Feature

**Files:**
- Create: `flutter_app/lib/features/captions/` (data, domain, ui layers)

- [ ] **Step 1: Implement captions data/domain**

- `CaptionRepository` — CRUD, generate, translate, export, burn-in
- `captionsProvider` — per-project caption management

- [ ] **Step 2: Implement caption editor UI**

- Caption list synced to timeline (tap caption → seek to timestamp)
- Inline text editing with live preview
- Timing adjustment (drag start/end handles)
- Style editor: font, size, color, position, animation
- Style presets quick-picker
- Translation button → language picker → generate

- [ ] **Step 3: Karaoke-style preview**

Word-by-word highlight synced to playback (using word-level timestamps from Whisper).

- [ ] **Step 4: Widget tests**

- [ ] **Step 5: Commit**

---

## Task 7: Flutter — Audio Mixer Feature

**Files:**
- Create: `flutter_app/lib/features/audio/` (data, domain, ui layers)

- [ ] **Step 1: Implement audio data/domain**

- `AudioRepository` — mix, normalize, extract
- `audioProvider` — per-track volume state, music import

- [ ] **Step 2: Implement audio mixer UI**

- Waveform visualization (CustomPainter)
- Per-track volume slider with real-time preview
- Volume keyframe editor (tap waveform to add keypoints)
- Music track browser (import from device)
- Noise removal one-tap button (calls audio_cleanup backend)

- [ ] **Step 3: Widget tests**

- [ ] **Step 4: Commit**

---

## Task 8: Flutter — Graphics & Thumbnail Feature

**Files:**
- Create: `flutter_app/lib/features/graphics/` (data, domain, ui layers)

- [ ] **Step 1: Implement graphics data/domain**

- `GraphicsRepository` — create title cards, lower thirds, thumbnails
- `graphicsProvider` — template selection, customization state

- [ ] **Step 2: Implement thumbnail editor UI**

- Frame picker from video (scrub to select)
- AI generation dialog (prompt input, style selector)
- Text overlay editor (drag to position, resize, font picker)
- Side-by-side comparison of thumbnails

- [ ] **Step 3: Implement title card / lower third editor**

- Template gallery with previews
- Customize colors, text, animation
- Drag onto timeline to place
- Preview in video player

- [ ] **Step 4: Widget tests**

- [ ] **Step 5: Commit**

---

## Task 9: TTS & Format Conversion Services

**Files:**
- Create: `backend/services/tts_service.py`
- Create: `backend/services/convert_service.py`
- Create: `backend/tests/test_tts_service.py`
- Create: `backend/tests/test_convert_service.py`

- [ ] **Step 1: Refactor TTS from existing services.py**

Migrate edge-tts functionality:
- Accept text + voice + speed
- Generate audio file
- Upload to R2
- Return as MediaAsset

- [ ] **Step 2: Refactor format conversion**

Migrate FFmpeg conversion:
- Accept media + target format/codec/bitrate
- Convert via FFmpeg
- Upload to R2

- [ ] **Step 3: Write tests**

- [ ] **Step 4: Commit**

---

## Task 10: Integration Testing & Polish

- [ ] **Step 1: Full backend test suite**

- [ ] **Step 2: Full Flutter test suite**

- [ ] **Step 3: Manual E2E test — caption workflow**

1. Import video → Transcribe → Auto-generate captions
2. Edit caption text and timing
3. Apply style preset
4. Translate to English
5. Burn-in and export

- [ ] **Step 4: Manual E2E test — audio workflow**

1. Import video + music track
2. Adjust volumes (duck music during speech)
3. Apply noise removal
4. Mix and export

- [ ] **Step 5: Manual E2E test — thumbnail workflow**

1. Extract frame from video
2. AI-generate alternative
3. Add title text overlay
4. Download final thumbnail

- [ ] **Step 6: Tag release**

```bash
git tag v0.2.0-beta
```

---

## Summary

| Task | What it delivers | Type |
|------|-----------------|------|
| 1 | Caption generation + styling + burn-in | Backend |
| 2 | Caption translation (multilingual) | Backend |
| 3 | Audio mixer (multi-track, volume curves) | Backend |
| 4 | Thumbnail generation (frame extract + AI) | Backend |
| 5 | Graphics overlays (title cards, lower thirds) | Backend |
| 6 | Caption editor UI | Flutter |
| 7 | Audio mixer UI (waveforms, keyframes) | Flutter |
| 8 | Graphics & thumbnail editor UI | Flutter |
| 9 | TTS + format conversion services | Backend |
| 10 | Integration testing + polish | Verification |
