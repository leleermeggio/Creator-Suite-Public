# Thumbnail Generator — Design Spec

**Date:** 2026-03-27  
**Status:** Approved  
**Last Updated:** 2026-03-27 (Added mode selector & free generation)

---

## Overview

Replace the placeholder thumbnail generator with a production-ready YouTube thumbnail tool. The system combines:

- **8 pre-built layout templates** (user picks one)
- **Backend compositing with Pillow** (text, colors, photo, graphics assembled server-side)
- **Pollinations AI** for background image generation (free, no API key)
- **Medium UX flow**: template picker → title + subtitle + accent color + optional photo → Generate

Output: a real 1280×720 PNG ready to upload to YouTube.

---

## Templates (8 total)

Each template is a Python class that receives `(background_img, title, subtitle, accent_color, subject_photo)` and returns a composed `PIL.Image`.

| ID | Name | Description | Best for |
|----|------|-------------|----------|
| `impact` | Impact | Full-bleed AI background, centered bold title, badge top-left | Viral hooks, challenges |
| `split` | Split | Left: subject photo on dark bg. Right: dark panel + label + title | Tutorials, personal brand |
| `gradient-bar` | Gradient Bar | AI scene top 55%, dark gradient fade, text at bottom | Listicles, tips, rankings |
| `bold-side` | Bold Side | Solid accent-color left panel with large text, right: AI image | Before/after, comparisons |
| `minimal` | Minimal | Dark background, centered title + category pill, no photo needed | Podcasts, finance, essays |
| `reaction` | Reaction | Large face/subject 65% left, short 2–3 word title right | Reactions, reveals, shocking news |
| `neon` | Neon | Pure dark bg, neon glow text, corner HUD brackets | Gaming, tech, crypto |
| `cinematic` | Cinematic | Black letterbox bars, AI scene in middle, title in bottom bar | Documentaries, journeys |

---

## Architecture

### Backend

#### 1. `backend/services/thumbnail_service.py` (new)

Core compositing service. Public interface:

```python
async def generate_thumbnail(
    template_id: str,
    title: str,
    subtitle: str | None,
    accent_color: str,          # hex e.g. "#FF0000"
    subject_photo_b64: str | None,
) -> bytes                      # PNG bytes
```

Internal flow:
1. Build a detailed Pollinations prompt from `template_id` + `title` (e.g. `"cinematic landscape, dramatic lighting, dark moody atmosphere, 4k, no text"`)
2. Download background image from Pollinations (`requests.get`, sync — runs inside Celery worker)
3. Open with `PIL.Image`
4. Call the matching template compositor (one class per template)
5. Each compositor applies: background resize/crop, gradient overlays, subject photo paste (with optional auto-mask), text layers (title, subtitle, badge), accent color fills
6. Return final PNG bytes

#### 2. Template compositor classes — `backend/services/thumbnail_templates/`

One file per template:
- `base.py` — `BaseThumbnailTemplate` with shared helpers: `draw_text_with_stroke()`, `apply_gradient_overlay()`, `paste_subject()`, `draw_badge()`
- `impact.py`, `split.py`, `gradient_bar.py`, `bold_side.py`, `minimal.py`, `reaction.py`, `neon.py`, `cinematic.py`

Each class implements:
```python
class ImpactTemplate(BaseThumbnailTemplate):
    def compose(self, bg: Image, ctx: ThumbnailContext) -> Image: ...
```

`ThumbnailContext` is a dataclass holding title, subtitle, accent_color (as RGB tuple), subject_photo (PIL.Image or None).

#### 3. `backend/routes/thumbnails.py` — updated `/generate` endpoint

Replace placeholder with real async job:

```python
@router.post("/generate", status_code=202)
async def generate_thumbnail(body: ThumbnailGenerateRequest, ...):
    thumb = Thumbnail(project_id=..., template_id=body.template_id, ...)
    db.add(thumb); await db.commit()
    generate_thumbnail_task.delay(thumb.id, body.model_dump())
    return {"job_id": thumb.id, "status": "queued"}
```

#### 4. `backend/workers/thumbnail_worker.py` (new)

Celery task:
```python
@celery_app.task
def generate_thumbnail_task(thumbnail_id: str, params: dict):
    # run thumbnail_service.generate_thumbnail()
    # upload PNG to R2 (or save locally in dev)
    # update Thumbnail.storage_key + status
```

#### 5. Schema changes — `backend/schemas/thumbnail.py`

Updated `ThumbnailGenerateRequest`:
```python
class ThumbnailGenerateRequest(BaseModel):
    project_id: str
    template_id: str = Field(default="impact")
    title: str = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=120)
    accent_color: str = Field(default="#FF0000", pattern=r"^#[0-9A-Fa-f]{6}$")
    subject_photo_b64: str | None = None   # base64 JPEG/PNG, optional
```

#### 6. Model changes — `backend/models/thumbnail.py`

Add `template_id` column:
```python
template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
```

New Alembic migration.

#### 7. Dependencies

Add to `backend/requirements.txt`:
- `Pillow>=10.0.0` (image compositing)
- `requests` (already present — for Pollinations download)

Fonts: ship 2 bold fonts in `backend/assets/fonts/`:
- `Anton-Regular.ttf` — display titles (free, Google Fonts)
- `Oswald-Bold.ttf` — subtitles and badges (free, Google Fonts)

---

### Frontend

#### 1. `frontend/components/ThumbnailGeneratorUI.tsx` (new)

Replaces `ImageGeneratorUI` for the `ai-image` tool. Layout:

**Mode Selector** (NEW - 2026-03-27):
- 4 buttons: 🖼️ Thumbnail, 💎 Logo (512×512), 📱 Copertina (1080×1080), ✨ Generazione Libera
- Filters available templates based on selected mode
- Shows different UI based on mode (template-based vs free generation)

**Template-based Mode** (thumbnail/logo/cover):
1. **Template grid** — 8 cards (filtered by mode), 4 per row on desktop / 2 per row on mobile. Selected state uses neon border.
2. **Title input** — required, `max_length=80`
3. **Subtitle input** — optional
4. **Accent color picker** — 6 preset swatches: Red `#FF0000`, Blue `#2563EB`, Green `#16A34A`, Yellow `#FFE633`, Purple `#7C3AED`, Cyan `#06B6D4`
5. **Subject photo upload** — optional drop zone (web: `<input type=file>`, native: `expo-image-picker`). Shows preview thumbnail when selected.
6. **Generate button** → calls `POST /thumbnails/generate`, gets back `job_id`
7. **Job polling** — polls `GET /jobs/{job_id}` every 2s until `status: completed`
8. **Result preview** — shows final 16:9 image. Buttons: Rigenera, Download, Salva in fase.

**Free Generation Mode** (NEW - 2026-03-27):
1. **Provider selector** — NanoBanana (default, requires API key) or Stable Horde (free)
2. **Prompt input** — multiline textarea for image description
3. **Generate button** → calls `POST /tools/generate-image` with provider & dimensions
4. **Result preview** — shows generated image with save/regenerate actions
5. **Dimensions** — auto-selected based on mode: thumbnail=1280×720, logo=512×512, cover=1080×1080

#### 2. `frontend/app/tool/[id].tsx` — updated

Replace `<ImageGeneratorUI />` with `<ThumbnailGeneratorUI />` for `id === 'ai-image'`.

Keep `ImageGeneratorUI` for any other use cases (logo, social-cover modes).

#### 3. `frontend/services/thumbnailApi.ts` (new)

```typescript
export async function generateThumbnail(params: ThumbnailGenerateParams): Promise<string>
// polls until done, returns download_url
```

---

## Data Flow

```
User fills form
  → POST /thumbnails/generate (202, job_id)
  → Celery worker picks up job
    → Builds Pollinations prompt from template + title
    → Downloads background PNG from Pollinations
    → Composites with Pillow (template + text + photo)
    → Uploads result PNG to R2 / saves locally
    → Updates Thumbnail record: storage_key, status=completed
  → Frontend polls GET /jobs/{job_id}
  → On completed: fetch GET /thumbnails/{id} → download_url
  → Display result image
```

---

## Error Handling

- Pollinations unreachable → use solid color background matching accent_color + dark overlay
- subject_photo decode fails → log warning, proceed without photo
- Pillow OOM (very large image) → cap background download at 1280×720
- job timeout (>120s) → mark job as `failed`, return error message to frontend

---

## Testing

- `backend/tests/services/test_thumbnail_service.py` — unit test each template compositor with a solid-color background (no network call)
- `backend/tests/routes/test_thumbnails.py` — test `/generate` returns 202 + job_id, test auth required
- Frontend: manual test plan in PR — verify each template renders, photo upload works, polling resolves

---

## Out of Scope

- Custom font upload
- Drag-and-drop canvas editor
- Background removal for subject photos (can add later)
- More than 8 templates at launch

---

## Changelog

### 2026-03-27 - Mode Selector & Free Generation
**Added:**
- Mode selector with 4 options: Thumbnail, Logo, Cover, Free Generation
- Free generation mode without templates (text-to-image)
- Provider selector for free generation (NanoBanana default, Stable Horde alternative)
- Template filtering based on selected mode:
  - Thumbnail: all 8 templates
  - Logo: minimal, bold-side, neon
  - Cover: impact, minimal, gradient-bar
- Auto-dimensioning based on mode
- Conditional UI: template form vs prompt form

**Files Modified:**
- `frontend/components/ThumbnailGeneratorUI.tsx` - added mode state, provider selector, free generation logic
- Integrated with existing `POST /tools/generate-image` endpoint
