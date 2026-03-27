# Thumbnail Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder thumbnail generator with a real system that composites AI-generated Pollinations backgrounds with Pillow text/graphics overlays using 8 professional templates.

**Architecture:** Pollinations AI generates a background image (URL-based, free). A Python Pillow compositor combines that background with user-supplied title, subtitle, accent color, and optional subject photo according to a chosen template. The result is a real PNG returned via the existing async job system.

**Tech Stack:** Python/Pillow (backend compositing), Pollinations AI (background), Celery (async jobs), React Native/Expo (frontend form + polling), existing `/thumbnails/generate` + `/jobs/{id}` routes.

---

## File Map

### New (backend)
| File | Responsibility |
|------|---------------|
| `backend/assets/fonts/Anton-Regular.ttf` | Display title font (downloaded) |
| `backend/assets/fonts/Oswald-Bold.ttf` | Subtitle/badge font (downloaded) |
| `backend/services/thumbnail_templates/__init__.py` | Package init + template registry |
| `backend/services/thumbnail_templates/base.py` | `ThumbnailContext` dataclass + `BaseThumbnailTemplate` with shared helpers |
| `backend/services/thumbnail_templates/impact.py` | Full-bleed + centered title |
| `backend/services/thumbnail_templates/split.py` | Photo left + text panel right |
| `backend/services/thumbnail_templates/gradient_bar.py` | Scene top + gradient + text bar |
| `backend/services/thumbnail_templates/bold_side.py` | Solid color panel left + image right |
| `backend/services/thumbnail_templates/minimal.py` | Dark bg + centered title pill |
| `backend/services/thumbnail_templates/reaction.py` | Large face left + punchy text right |
| `backend/services/thumbnail_templates/neon.py` | Dark bg + glowing text + HUD brackets |
| `backend/services/thumbnail_templates/cinematic.py` | Letterbox bars + title in bottom bar |
| `backend/services/thumbnail_service.py` | Orchestrator: fetches BG, calls template, returns PNG bytes |
| `backend/tests/services/test_thumbnail_service.py` | Unit tests for compositing (no network) |

### Modified (backend)
| File | Change |
|------|--------|
| `backend/models/thumbnail.py` | Add `template_id` column |
| `backend/schemas/thumbnail.py` | Update `ThumbnailGenerateRequest` with new fields; add `ThumbnailJobResponse` |
| `backend/routes/thumbnails.py` | `/generate` becomes 202 async job |
| `backend/workers/tasks.py` | Add `generate_thumbnail` action to `_handle_thumbnail_or_watermark` |
| `backend/tests/test_thumbnail_routes.py` | Update tests for new 202 response + new request shape |

### New (frontend)
| File | Responsibility |
|------|---------------|
| `frontend/services/thumbnailApi.ts` | POST generate + poll job until done |
| `frontend/components/ThumbnailGeneratorUI.tsx` | Full form: template grid, inputs, color picker, photo upload, result |

### Modified (frontend)
| File | Change |
|------|--------|
| `frontend/app/tool/[id].tsx` | Replace `<ImageGeneratorUI />` with `<ThumbnailGeneratorUI />` for `ai-image` |

---

## Task 1 — Backend Foundation
**Agent: backend** | Files: `base.py`, `__init__.py`, fonts

- [ ] **Step 1.1 — Download fonts**

```bash
mkdir -p "D:/Projects/GIt repo/Creator-Suite-Public/backend/assets/fonts"
cd "D:/Projects/GIt repo/Creator-Suite-Public/backend/assets/fonts"
curl -L "https://fonts.gstatic.com/s/anton/v25/1Ptgg87LROyAm0K08i4gS7lu.woff2" -o Anton-Regular.woff2
# woff2 won't work with Pillow — download the TTF directly:
python -c "
import urllib.request
urllib.request.urlretrieve(
    'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf',
    'Anton-Regular.ttf'
)
urllib.request.urlretrieve(
    'https://github.com/google/fonts/raw/main/ofl/oswald/static/Oswald-Bold.ttf',
    'Oswald-Bold.ttf'
)
print('Fonts downloaded OK')
"
```

Expected: `Anton-Regular.ttf` and `Oswald-Bold.ttf` in `backend/assets/fonts/`.

- [ ] **Step 1.2 — Create package and write `base.py`**

Create `backend/services/thumbnail_templates/__init__.py`:
```python
from __future__ import annotations
from backend.services.thumbnail_templates.base import BaseThumbnailTemplate, ThumbnailContext
from backend.services.thumbnail_templates.impact import ImpactTemplate
from backend.services.thumbnail_templates.split import SplitTemplate
from backend.services.thumbnail_templates.gradient_bar import GradientBarTemplate
from backend.services.thumbnail_templates.bold_side import BoldSideTemplate
from backend.services.thumbnail_templates.minimal import MinimalTemplate
from backend.services.thumbnail_templates.reaction import ReactionTemplate
from backend.services.thumbnail_templates.neon import NeonTemplate
from backend.services.thumbnail_templates.cinematic import CinematicTemplate

TEMPLATE_REGISTRY: dict[str, type[BaseThumbnailTemplate]] = {
    "impact": ImpactTemplate,
    "split": SplitTemplate,
    "gradient-bar": GradientBarTemplate,
    "bold-side": BoldSideTemplate,
    "minimal": MinimalTemplate,
    "reaction": ReactionTemplate,
    "neon": NeonTemplate,
    "cinematic": CinematicTemplate,
}

def get_template(template_id: str) -> BaseThumbnailTemplate:
    cls = TEMPLATE_REGISTRY.get(template_id, ImpactTemplate)
    return cls()
```

Create `backend/services/thumbnail_templates/base.py`:
```python
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1280, 720
_FONTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "fonts")
TITLE_FONT_PATH = os.path.normpath(os.path.join(_FONTS_DIR, "Anton-Regular.ttf"))
SUB_FONT_PATH = os.path.normpath(os.path.join(_FONTS_DIR, "Oswald-Bold.ttf"))


def _load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except (OSError, IOError):
        return ImageFont.load_default()


@dataclass
class ThumbnailContext:
    title: str
    subtitle: Optional[str]
    accent_color: tuple[int, int, int]      # RGB
    subject_photo: Optional[Image.Image]


class BaseThumbnailTemplate:
    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        raise NotImplementedError

    # ── helpers ─────────────────────────────────────────────────────────────

    def resize_cover(self, img: Image.Image, w: int = W, h: int = H) -> Image.Image:
        ratio = max(w / img.width, h / img.height)
        nw, nh = int(img.width * ratio), int(img.height * ratio)
        img = img.resize((nw, nh), Image.LANCZOS)
        left, top = (nw - w) // 2, (nh - h) // 2
        return img.crop((left, top, left + w, top + h))

    def apply_gradient_overlay(
        self,
        img: Image.Image,
        direction: str = "bottom",
        start_alpha: int = 0,
        end_alpha: int = 210,
    ) -> Image.Image:
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        iw, ih = img.size
        steps = ih if direction in ("bottom", "top") else iw
        for i in range(steps):
            t = i / steps
            if direction in ("bottom", "right"):
                alpha = int(start_alpha + (end_alpha - start_alpha) * t)
            else:
                alpha = int(end_alpha + (start_alpha - end_alpha) * t)
            if direction in ("bottom", "top"):
                draw.line([(0, i), (iw, i)], fill=(0, 0, 0, alpha))
            else:
                draw.line([(i, 0), (i, ih)], fill=(0, 0, 0, alpha))
        return Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    def draw_text_with_stroke(
        self,
        draw: ImageDraw.ImageDraw,
        text: str,
        pos: tuple[int, int],
        font: ImageFont.FreeTypeFont,
        fill: tuple[int, int, int],
        stroke_width: int = 4,
        stroke_fill: tuple[int, int, int] = (0, 0, 0),
    ) -> None:
        x, y = pos
        for dx in range(-stroke_width, stroke_width + 1):
            for dy in range(-stroke_width, stroke_width + 1):
                if dx != 0 or dy != 0:
                    draw.text((x + dx, y + dy), text, font=font, fill=stroke_fill)
        draw.text((x, y), text, font=font, fill=fill)

    def draw_badge(
        self,
        img: Image.Image,
        text: str,
        pos: tuple[int, int],
        bg_color: tuple[int, int, int],
        font_size: int = 28,
        padding: int = 14,
    ) -> Image.Image:
        draw = ImageDraw.Draw(img)
        font = _load_font(SUB_FONT_PATH, font_size)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x, y = pos
        draw.rectangle([x, y, x + tw + padding * 2, y + th + padding], fill=bg_color)
        draw.text((x + padding, y + padding // 2), text, font=font, fill=(255, 255, 255))
        return img

    def wrap_text(
        self, text: str, font: ImageFont.FreeTypeFont, max_width: int
    ) -> list[str]:
        words = text.split()
        lines: list[str] = []
        current = ""
        dummy_draw = ImageDraw.Draw(Image.new("RGB", (1, 1)))
        for word in words:
            test = (current + " " + word).strip()
            bbox = dummy_draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    def paste_subject(
        self,
        base: Image.Image,
        subject: Image.Image,
        region: tuple[int, int, int, int],  # x, y, region_w, region_h
    ) -> Image.Image:
        rx, ry, rw, rh = region
        ratio = min(rw / subject.width, rh / subject.height)
        nw, nh = int(subject.width * ratio), int(subject.height * ratio)
        subject = subject.resize((nw, nh), Image.LANCZOS)
        ox = rx + (rw - nw) // 2
        oy = ry + (rh - nh)   # anchor to bottom of region
        if subject.mode == "RGBA":
            base.paste(subject, (ox, oy), subject)
        else:
            base.paste(subject, (ox, oy))
        return base
```

- [ ] **Step 1.3 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add backend/assets/fonts/ backend/services/thumbnail_templates/
git commit -m "feat(thumbnails): add base template class and font assets"
```

---

## Task 2 — Templates Batch 1 (impact, split, gradient-bar, bold-side)
**Agent: backend** | Files: 4 template files

- [ ] **Step 2.1 — Write `impact.py`**

```python
# backend/services/thumbnail_templates/impact.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

class ImpactTemplate(BaseThumbnailTemplate):
    """Full-bleed AI background, centered bold title, badge top-left."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)
        img = self.apply_gradient_overlay(img, "bottom", start_alpha=0, end_alpha=210)

        # Badge top-left
        badge_text = ctx.subtitle.upper() if ctx.subtitle else "GUARDA ORA"
        self.draw_badge(img, badge_text, (24, 24), bg_color=(200, 0, 0), font_size=26)

        draw = ImageDraw.Draw(img)
        # Centered title — shrink font until it fits
        for size in (96, 80, 68, 56, 46):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, W - 80)
            if len(lines) <= 3:
                break

        line_h = size + 10
        total_h = len(lines) * line_h
        start_y = (H - total_h) // 2

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            lw = bbox[2] - bbox[0]
            x = (W - lw) // 2
            y = start_y + i * line_h
            self.draw_text_with_stroke(draw, line, (x, y), font, fill=(255, 255, 255), stroke_width=4)

        return img
```

- [ ] **Step 2.2 — Write `split.py`**

```python
# backend/services/thumbnail_templates/split.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

PANEL_W = 550     # right text panel width
LEFT_W = W - PANEL_W

class SplitTemplate(BaseThumbnailTemplate):
    """Photo left on dark panel, text right on very dark panel."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)

        # Darken left zone (subject area)
        left_overlay = Image.new("RGBA", (LEFT_W, H), (0, 0, 0, 160))
        img = img.convert("RGBA")
        img.paste(left_overlay, (0, 0), left_overlay)

        # Very dark right panel
        right_panel = Image.new("RGBA", (PANEL_W, H), (8, 8, 20, 230))
        img.paste(right_panel, (LEFT_W, 0), right_panel)
        img = img.convert("RGB")

        # Subject photo on left
        if ctx.subject_photo:
            self.paste_subject(img, ctx.subject_photo, (0, 0, LEFT_W, H))

        # Accent top bar on right panel (3px)
        draw = ImageDraw.Draw(img)
        draw.rectangle([LEFT_W, 0, W, 3], fill=ctx.accent_color)

        # Category label
        cat_font = _load_font(SUB_FONT_PATH, 22)
        cat_text = "VIDEO"
        draw.text((LEFT_W + 28, 28), cat_text, font=cat_font, fill=ctx.accent_color)

        # Title on right panel
        for size in (72, 60, 50, 42):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, PANEL_W - 56)
            if len(lines) <= 4:
                break

        line_h = size + 8
        start_y = H // 2 - (len(lines) * line_h) // 2
        for i, line in enumerate(lines):
            y = start_y + i * line_h
            self.draw_text_with_stroke(
                draw, line, (LEFT_W + 28, y), font,
                fill=(255, 255, 255), stroke_width=3
            )

        # Accent underline
        uy = start_y + len(lines) * line_h + 12
        draw.rectangle([LEFT_W + 28, uy, LEFT_W + 80, uy + 3], fill=ctx.accent_color)

        return img
```

- [ ] **Step 2.3 — Write `gradient_bar.py`**

```python
# backend/services/thumbnail_templates/gradient_bar.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

class GradientBarTemplate(BaseThumbnailTemplate):
    """AI scene top 55%, strong gradient fade, title + subtitle at bottom."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)
        img = self.apply_gradient_overlay(img, "bottom", start_alpha=0, end_alpha=230)

        draw = ImageDraw.Draw(img)

        # Optional number badge (parsed from subtitle like "5 Tips" → badge "5")
        badge_num = None
        if ctx.subtitle and ctx.subtitle.strip()[0].isdigit():
            badge_num = ctx.subtitle.strip().split()[0]

        if badge_num:
            bfont = _load_font(TITLE_FONT_PATH, 52)
            bx, by = W - 90, 20
            draw.ellipse([bx, by, bx + 70, by + 70], fill=ctx.accent_color)
            bbox = draw.textbbox((0, 0), badge_num, font=bfont)
            bw = bbox[2] - bbox[0]
            draw.text((bx + (70 - bw) // 2, by + 6), badge_num, font=bfont, fill=(255, 255, 255))

        # Subtitle line above title
        if ctx.subtitle:
            sfont = _load_font(SUB_FONT_PATH, 32)
            sy = H - 120
            r, g, b = ctx.accent_color
            draw.text((36, sy), ctx.subtitle.upper(), font=sfont, fill=(r, g, b))

        # Title
        for size in (72, 60, 50, 42):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, W - 72)
            if len(lines) <= 2:
                break

        line_h = size + 8
        start_y = H - 36 - len(lines) * line_h
        if ctx.subtitle:
            start_y = H - 70 - len(lines) * line_h

        for i, line in enumerate(lines):
            self.draw_text_with_stroke(
                draw, line, (36, start_y + i * line_h),
                font, fill=(255, 255, 255), stroke_width=4
            )

        return img
```

- [ ] **Step 2.4 — Write `bold_side.py`**

```python
# backend/services/thumbnail_templates/bold_side.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

LEFT_PANEL_W = 480

class BoldSideTemplate(BaseThumbnailTemplate):
    """Solid accent-color left panel with large title, AI image on the right."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)

        # Darken right zone
        right_overlay = Image.new("RGBA", (W - LEFT_PANEL_W + 30, H), (0, 0, 0, 80))
        img = img.convert("RGBA")
        img.paste(right_overlay, (LEFT_PANEL_W - 30, 0), right_overlay)

        # Solid left panel
        panel = Image.new("RGBA", (LEFT_PANEL_W, H), (*ctx.accent_color, 255))
        img.paste(panel, (0, 0))

        # Angled right edge (parallelogram effect) — draw a triangle over the join
        poly = Image.new("RGBA", img.size, (0, 0, 0, 0))
        poly_draw = ImageDraw.Draw(poly)
        poly_draw.polygon(
            [(LEFT_PANEL_W, 0), (LEFT_PANEL_W + 40, 0), (LEFT_PANEL_W, H)],
            fill=(*ctx.accent_color, 255),
        )
        img.paste(poly, (0, 0), poly)
        img = img.convert("RGB")

        # Subject photo on right zone
        if ctx.subject_photo:
            self.paste_subject(img, ctx.subject_photo, (LEFT_PANEL_W + 20, 0, W - LEFT_PANEL_W - 20, H))

        draw = ImageDraw.Draw(img)

        # Large title on left panel (2 lines max, very large)
        for size in (96, 80, 68, 56):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, LEFT_PANEL_W - 48)
            if len(lines) <= 3:
                break

        line_h = size + 6
        total_h = len(lines) * line_h
        start_y = (H - total_h) // 2

        # Alternate white / yellow for multiline dramatic effect
        colors = [(255, 255, 255), (255, 230, 50)]
        for i, line in enumerate(lines):
            fill = colors[i % 2]
            self.draw_text_with_stroke(
                draw, line, (24, start_y + i * line_h),
                font, fill=fill, stroke_width=0,
                stroke_fill=(0, 0, 0)
            )

        # Subtitle (small, white, bottom of panel)
        if ctx.subtitle:
            sfont = _load_font(SUB_FONT_PATH, 28)
            sy = H - 50
            draw.text((24, sy), ctx.subtitle.upper(), font=sfont, fill=(255, 255, 255, 180))

        return img
```

- [ ] **Step 2.5 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add backend/services/thumbnail_templates/
git commit -m "feat(thumbnails): add impact, split, gradient-bar, bold-side templates"
```

---

## Task 3 — Templates Batch 2 (minimal, reaction, neon, cinematic)
**Agent: backend** | Files: 4 template files

- [ ] **Step 3.1 — Write `minimal.py`**

```python
# backend/services/thumbnail_templates/minimal.py
from __future__ import annotations
from PIL import Image, ImageDraw, ImageEnhance
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

class MinimalTemplate(BaseThumbnailTemplate):
    """Dark desaturated background, centered category pill + large title."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        # Desaturate and darken the AI background
        img = self.resize_cover(bg)
        img = ImageEnhance.Color(img).enhance(0.2)
        img = ImageEnhance.Brightness(img).enhance(0.35)

        draw = ImageDraw.Draw(img)

        # Category pill (rounded rect)
        cat_text = ctx.subtitle.upper() if ctx.subtitle else "VIDEO"
        sfont = _load_font(SUB_FONT_PATH, 24)
        bbox = draw.textbbox((0, 0), cat_text, font=sfont)
        tw = bbox[2] - bbox[0]
        pill_w, pill_h = tw + 32, 38
        pill_x = (W - pill_w) // 2
        pill_y = H // 2 - 90
        r, g, b = ctx.accent_color
        # Semi-transparent pill background
        pill = Image.new("RGBA", img.size, (0, 0, 0, 0))
        pdraw = ImageDraw.Draw(pill)
        pdraw.rounded_rectangle(
            [pill_x, pill_y, pill_x + pill_w, pill_y + pill_h],
            radius=pill_h // 2,
            fill=(r, g, b, 60),
            outline=(r, g, b, 180),
            width=1,
        )
        img = Image.alpha_composite(img.convert("RGBA"), pill).convert("RGB")
        draw = ImageDraw.Draw(img)
        draw.text((pill_x + 16, pill_y + 7), cat_text, font=sfont, fill=(r, g, b))

        # Large centered title
        for size in (96, 80, 68, 56):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, W - 120)
            if len(lines) <= 3:
                break

        line_h = size + 8
        start_y = H // 2 - 20

        for i, line in enumerate(lines):
            bbox2 = draw.textbbox((0, 0), line, font=font)
            lw = bbox2[2] - bbox2[0]
            x = (W - lw) // 2
            y = start_y + i * line_h
            draw.text((x, y), line, font=font, fill=(255, 255, 255))

        # Accent underline
        uy = start_y + len(lines) * line_h + 16
        draw.rectangle([(W // 2 - 30, uy), (W // 2 + 30, uy + 3)], fill=ctx.accent_color)

        return img
```

- [ ] **Step 3.2 — Write `reaction.py`**

```python
# backend/services/thumbnail_templates/reaction.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, _load_font,
)

FACE_W = int(W * 0.65)
TEXT_X = FACE_W + 20

class ReactionTemplate(BaseThumbnailTemplate):
    """Large face/subject 65% left, short punchy title on the right."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)
        img = self.apply_gradient_overlay(img, "right", start_alpha=0, end_alpha=200)

        if ctx.subject_photo:
            self.paste_subject(img, ctx.subject_photo, (0, 0, FACE_W, H))

        draw = ImageDraw.Draw(img)

        # Short title — 2-3 words, very large
        words = ctx.title.upper().split()
        # Chunk into single words or pairs for max impact
        lines = []
        for i in range(0, min(len(words), 4), 1):
            lines.append(words[i])

        text_zone_w = W - TEXT_X - 20
        for size in (110, 96, 80, 68):
            font = _load_font(TITLE_FONT_PATH, size)
            fits = all(
                draw.textbbox((0, 0), ln, font=font)[2] <= text_zone_w
                for ln in lines
            )
            if fits:
                break

        line_h = size + 4
        start_y = H // 2 - (len(lines) * line_h) // 2

        for i, line in enumerate(lines):
            y = start_y + i * line_h
            self.draw_text_with_stroke(
                draw, line, (TEXT_X, y), font,
                fill=(255, 255, 255), stroke_width=5
            )

        # Arrow pointing left toward face
        arrow_y = start_y + len(lines) * line_h // 2
        afont = _load_font(TITLE_FONT_PATH, 48)
        draw.text((TEXT_X - 50, arrow_y - 24), "←", font=afont, fill=ctx.accent_color)

        return img
```

- [ ] **Step 3.3 — Write `neon.py`**

```python
# backend/services/thumbnail_templates/neon.py
from __future__ import annotations
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

class NeonTemplate(BaseThumbnailTemplate):
    """Very dark background + neon glowing text + HUD corner brackets."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)
        img = ImageEnhance.Color(img).enhance(0.15)
        img = ImageEnhance.Brightness(img).enhance(0.2)

        # Glow radial gradient from center
        r, g, b = ctx.accent_color
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gdraw = ImageDraw.Draw(glow)
        for radius in range(300, 0, -20):
            alpha = int(30 * (1 - radius / 300))
            gdraw.ellipse(
                [W // 2 - radius, H // 2 - radius, W // 2 + radius, H // 2 + radius],
                fill=(r, g, b, alpha),
            )
        img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

        draw = ImageDraw.Draw(img)

        # Category label (small, accent color, top-center)
        cat_text = (ctx.subtitle or "GAMING").upper()
        cfont = _load_font(SUB_FONT_PATH, 26)
        cbbox = draw.textbbox((0, 0), cat_text, font=cfont)
        cx = (W - (cbbox[2] - cbbox[0])) // 2
        draw.text((cx, 40), cat_text, font=cfont, fill=ctx.accent_color)

        # Glowing title (blur layer + sharp layer)
        for size in (100, 84, 70, 58):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title.upper(), font, W - 120)
            if len(lines) <= 2:
                break

        line_h = size + 10
        start_y = H // 2 - (len(lines) * line_h) // 2

        for i, line in enumerate(lines):
            bbox = draw.textbbox((0, 0), line, font=font)
            lw = bbox[2] - bbox[0]
            x = (W - lw) // 2
            y = start_y + i * line_h

            # Glow layer
            glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow_layer)
            fill_color = (r, g, b) if i % 2 == 0 else (255, 255, 255)
            gd.text((x, y), line, font=font, fill=(*fill_color, 200))
            glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=12))
            img = Image.alpha_composite(img.convert("RGBA"), glow_layer).convert("RGB")
            draw = ImageDraw.Draw(img)

            # Sharp text on top
            color = ctx.accent_color if i % 2 == 0 else (255, 255, 255)
            draw.text((x, y), line, font=font, fill=color)

        # HUD corner brackets
        bracket_size, bw = 28, 3
        corners = [(10, 10), (W - 10 - bracket_size, 10),
                   (10, H - 10 - bracket_size), (W - 10 - bracket_size, H - 10 - bracket_size)]
        for cx2, cy2 in corners:
            # top/bottom horizontal
            draw.rectangle([cx2, cy2, cx2 + bracket_size, cy2 + bw], fill=ctx.accent_color)
            draw.rectangle([cx2, cy2 + bracket_size - bw, cx2 + bracket_size, cy2 + bracket_size], fill=ctx.accent_color)
            # left/right vertical
            draw.rectangle([cx2, cy2, cx2 + bw, cy2 + bracket_size], fill=ctx.accent_color)
            draw.rectangle([cx2 + bracket_size - bw, cy2, cx2 + bracket_size, cy2 + bracket_size], fill=ctx.accent_color)

        return img
```

- [ ] **Step 3.4 — Write `cinematic.py`**

```python
# backend/services/thumbnail_templates/cinematic.py
from __future__ import annotations
from PIL import Image, ImageDraw
from backend.services.thumbnail_templates.base import (
    BaseThumbnailTemplate, ThumbnailContext, W, H,
    TITLE_FONT_PATH, SUB_FONT_PATH, _load_font,
)

TOP_BAR_H = int(H * 0.17)    # ~122px
BOT_BAR_H = int(H * 0.22)    # ~158px
SCENE_Y = TOP_BAR_H
SCENE_H = H - TOP_BAR_H - BOT_BAR_H

class CinematicTemplate(BaseThumbnailTemplate):
    """Black letterbox bars. Category in top bar, title in bottom bar."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)

        # Crop to scene area then re-place
        scene = img.crop((0, 0, W, H))
        # Subtle vignette on scene
        scene = self.apply_gradient_overlay(scene, "bottom", start_alpha=0, end_alpha=80)

        # Rebuild with black bars
        result = Image.new("RGB", (W, H), (0, 0, 0))
        result.paste(scene.crop((0, TOP_BAR_H, W, H - BOT_BAR_H)), (0, TOP_BAR_H))

        draw = ImageDraw.Draw(result)

        # Top bar — category label
        cat_text = (ctx.subtitle or "DOCUMENTARIO").upper()
        cfont = _load_font(SUB_FONT_PATH, 28)
        cbbox = draw.textbbox((0, 0), cat_text, font=cfont)
        cy = (TOP_BAR_H - (cbbox[3] - cbbox[1])) // 2
        draw.text((36, cy), cat_text, font=cfont, fill=(200, 200, 200))

        # Top bar thin accent line at bottom edge
        draw.rectangle([0, TOP_BAR_H - 1, W, TOP_BAR_H], fill=ctx.accent_color)

        # Bottom bar — title
        for size in (72, 60, 50, 42):
            font = _load_font(TITLE_FONT_PATH, size)
            lines = self.wrap_text(ctx.title, font, W - 72)
            if len(lines) <= 2:
                break

        line_h = size + 6
        total_h = len(lines) * line_h
        start_y = H - BOT_BAR_H + (BOT_BAR_H - total_h) // 2

        for i, line in enumerate(lines):
            y = start_y + i * line_h
            color = (255, 255, 255) if i == 0 else ctx.accent_color
            draw.text((36, y), line, font=font, fill=color)

        # Bottom bar thin accent line at top edge
        draw.rectangle([0, H - BOT_BAR_H, W, H - BOT_BAR_H + 1], fill=ctx.accent_color)

        return result
```

- [ ] **Step 3.5 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add backend/services/thumbnail_templates/
git commit -m "feat(thumbnails): add minimal, reaction, neon, cinematic templates"
```

---

## Task 4 — Backend Wiring (service, schema, model, route, worker)
**Agent: backend** | Files: thumbnail_service.py, schema, model, route, tasks.py

- [ ] **Step 4.1 — Write `thumbnail_service.py`**

```python
# backend/services/thumbnail_service.py
from __future__ import annotations

import io
import logging
from typing import Optional

import requests
from PIL import Image

from backend.services.thumbnail_templates import ThumbnailContext, get_template

logger = logging.getLogger(__name__)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"

_TEMPLATE_PROMPTS: dict[str, str] = {
    "impact":       "dramatic cinematic scene, vibrant colors, dynamic lighting, no text, no watermark, photorealistic, 4k",
    "split":        "dark moody background, professional atmosphere, gradient dark, no faces, no text, studio lighting",
    "gradient-bar": "wide landscape scene, golden hour light, cinematic, no text, high contrast, atmospheric",
    "bold-side":    "abstract background texture, bokeh, dark right side, no text, professional photography",
    "minimal":      "subtle texture background, dark gradient, minimalist, no text, abstract pattern",
    "reaction":     "dramatic background, expressive scene, no text, cinematic wide shot, vivid colors",
    "neon":         "dark cyberpunk cityscape, neon lights reflection, dark background, sci-fi, no text",
    "cinematic":    "cinematic widescreen landscape, dramatic sky, golden hour, no text, epic scene, film grain",
}


def _build_pollinations_url(template_id: str, title: str, w: int = 1280, h: int = 720) -> str:
    style = _TEMPLATE_PROMPTS.get(template_id, _TEMPLATE_PROMPTS["impact"])
    # Inject topic keywords from title for more relevant backgrounds
    topic_words = " ".join(title.split()[:4]).lower()
    full_prompt = f"{topic_words}, {style}"
    encoded = requests.utils.quote(full_prompt)
    return f"{POLLINATIONS_BASE}/{encoded}?width={w}&height={h}&nologo=true&seed=42"


def _fetch_background(url: str) -> Image.Image:
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as e:
        logger.warning("Pollinations fetch failed (%s) — using solid fallback", e)
        return Image.new("RGB", (1280, 720), (15, 10, 30))


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _decode_photo(b64: str) -> Optional[Image.Image]:
    if not b64:
        return None
    import base64
    try:
        data = base64.b64decode(b64)
        return Image.open(io.BytesIO(data)).convert("RGBA")
    except Exception as e:
        logger.warning("Subject photo decode failed: %s", e)
        return None


def generate_thumbnail(
    template_id: str,
    title: str,
    subtitle: Optional[str],
    accent_color: str,
    subject_photo_b64: Optional[str],
) -> bytes:
    """Fetch Pollinations background, composite with Pillow, return PNG bytes."""
    url = _build_pollinations_url(template_id, title)
    bg = _fetch_background(url)

    ctx = ThumbnailContext(
        title=title,
        subtitle=subtitle,
        accent_color=_hex_to_rgb(accent_color),
        subject_photo=_decode_photo(subject_photo_b64) if subject_photo_b64 else None,
    )

    template = get_template(template_id)
    result = template.compose(bg, ctx)

    # Cap output size
    if result.size != (1280, 720):
        result = result.resize((1280, 720), Image.LANCZOS)

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
```

- [ ] **Step 4.2 — Update schema**

In `backend/schemas/thumbnail.py`, replace the entire file:
```python
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from backend.models.thumbnail import ThumbnailSource


class ThumbnailExtractRequest(BaseModel):
    project_id: str
    asset_id: str
    timestamp: float = Field(ge=0.0, description="Timestamp in seconds to extract frame")


class ThumbnailGenerateRequest(BaseModel):
    project_id: str
    template_id: str = Field(default="impact")
    title: str = Field(min_length=1, max_length=80)
    subtitle: str | None = Field(default=None, max_length=120)
    accent_color: str = Field(default="#FF0000", pattern=r"^#[0-9A-Fa-f]{6}$")
    subject_photo_b64: str | None = None


class ThumbnailJobResponse(BaseModel):
    job_id: str
    status: str


class ThumbnailResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    storage_key: str | None
    source_type: ThumbnailSource
    prompt: str | None
    width: int
    height: int
    download_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 4.3 — Update model**

In `backend/models/thumbnail.py`, add `template_id` column after the `prompt` field:
```python
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    width: Mapped[int] = mapped_column(Integer, default=1280, nullable=False)
```

- [ ] **Step 4.4 — Create migration**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public/backend"
alembic revision --autogenerate -m "add_thumbnail_template_id"
```

Verify the generated file adds `template_id` column. Then apply:
```bash
alembic upgrade head
```

- [ ] **Step 4.5 — Add thumbnail action to `tasks.py`**

In `backend/workers/tasks.py`, find `_handle_thumbnail_or_watermark` and add the `generate_thumbnail` branch at the top of the function:

```python
def _handle_thumbnail_or_watermark(job_id: str, params: dict) -> dict:
    action = params.get("action", "")

    if action == "generate_thumbnail":
        from backend.services.thumbnail_service import generate_thumbnail
        import base64, os
        from backend.storage.r2 import R2Client
        from backend.config import get_settings

        png_bytes = generate_thumbnail(
            template_id=params.get("template_id", "impact"),
            title=params.get("title", ""),
            subtitle=params.get("subtitle"),
            accent_color=params.get("accent_color", "#FF0000"),
            subject_photo_b64=params.get("subject_photo_b64"),
        )

        # Save: try R2, fall back to local tmp
        storage_key = f"thumbnails/{job_id}.png"
        download_url: str | None = None
        try:
            settings = get_settings()
            r2 = R2Client(
                endpoint_url=settings.R2_ENDPOINT_URL,
                access_key_id=settings.R2_ACCESS_KEY_ID,
                secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                bucket_name=settings.R2_BUCKET_NAME,
            )
            r2.upload_bytes(png_bytes, storage_key, content_type="image/png")
            download_url = r2.generate_download_url(storage_key, expires_in=86400)
        except Exception as e:
            logger.warning("R2 upload failed (%s) — saving locally", e)
            local_dir = os.path.join(os.path.dirname(__file__), "..", "..", "media", "thumbnails")
            os.makedirs(local_dir, exist_ok=True)
            local_path = os.path.join(local_dir, f"{job_id}.png")
            with open(local_path, "wb") as f:
                f.write(png_bytes)
            storage_key = local_path
            download_url = None

        # Update thumbnail record
        import asyncio
        from sqlalchemy import select, update
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from backend.models.thumbnail import Thumbnail
        from backend.config import get_settings as gs

        async def _update_db() -> None:
            s = gs()
            engine = create_async_engine(s.DATABASE_URL)
            async_session = async_sessionmaker(engine, expire_on_commit=False)
            async with async_session() as session:
                await session.execute(
                    update(Thumbnail)
                    .where(Thumbnail.id == job_id)
                    .values(storage_key=storage_key)
                )
                await session.commit()
            await engine.dispose()

        asyncio.run(_update_db())
        return {
            "job_id": job_id,
            "job_type": "thumbnail",
            "status": "completed",
            "result": {"storage_key": storage_key, "download_url": download_url},
        }

    if action == "watermark_image":
        # ... existing watermark code unchanged ...
```

- [ ] **Step 4.6 — Update `/thumbnails/generate` route**

In `backend/routes/thumbnails.py`, replace the `generate_thumbnail` endpoint:
```python
from backend.schemas.thumbnail import (
    ThumbnailExtractRequest,
    ThumbnailGenerateRequest,
    ThumbnailJobResponse,
    ThumbnailResponse,
)

@router.post(
    "/generate", response_model=ThumbnailJobResponse, status_code=status.HTTP_202_ACCEPTED
)
async def generate_thumbnail(
    body: ThumbnailGenerateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue a thumbnail generation job. Poll GET /jobs/{job_id} for result."""
    await _verify_project_access(body.project_id, user, db)

    from backend.workers.tasks import process_job

    thumb = Thumbnail(
        id=str(__import__("uuid").uuid4()),
        project_id=body.project_id,
        user_id=user.id,
        source_type=__import__("backend.models.thumbnail", fromlist=["ThumbnailSource"]).ThumbnailSource.AI_GENERATED,
        prompt=body.title,
        template_id=body.template_id,
    )
    db.add(thumb)
    await db.commit()

    process_job.delay(
        job_id=thumb.id,
        job_type="thumbnail",
        input_params={
            "action": "generate_thumbnail",
            "template_id": body.template_id,
            "title": body.title,
            "subtitle": body.subtitle,
            "accent_color": body.accent_color,
            "subject_photo_b64": body.subject_photo_b64,
        },
    )

    return ThumbnailJobResponse(job_id=thumb.id, status="queued")
```

- [ ] **Step 4.7 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add backend/services/thumbnail_service.py backend/schemas/thumbnail.py \
        backend/models/thumbnail.py backend/routes/thumbnails.py \
        backend/workers/tasks.py backend/migrations/
git commit -m "feat(thumbnails): wire service, schema, model, route, worker"
```

---

## Task 5 — Backend Tests
**Agent: backend** | Files: new test file + update existing

- [ ] **Step 5.1 — Write unit tests for thumbnail_service**

Create `backend/tests/services/test_thumbnail_service.py`:
```python
from __future__ import annotations

import io
import pytest
from PIL import Image
from unittest.mock import patch

from backend.services.thumbnail_service import generate_thumbnail, _hex_to_rgb, _decode_photo
from backend.services.thumbnail_templates.base import ThumbnailContext
from backend.services.thumbnail_templates import get_template, TEMPLATE_REGISTRY


def _solid_bg(color=(30, 20, 50)) -> Image.Image:
    """A 1280x720 solid color image — no network needed."""
    return Image.new("RGB", (1280, 720), color)


def _make_ctx(title="Test Title", subtitle=None, accent=(255, 0, 0)):
    return ThumbnailContext(title=title, subtitle=subtitle, accent_color=accent, subject_photo=None)


# ── hex_to_rgb ───────────────────────────────────────────────────────────────

def test_hex_to_rgb_red():
    assert _hex_to_rgb("#FF0000") == (255, 0, 0)

def test_hex_to_rgb_lowercase():
    assert _hex_to_rgb("#2563eb") == (37, 99, 235)

def test_hex_to_rgb_no_hash():
    assert _hex_to_rgb("00FF00") == (0, 255, 0)


# ── decode_photo ─────────────────────────────────────────────────────────────

def test_decode_photo_none():
    assert _decode_photo("") is None

def test_decode_photo_invalid_returns_none():
    assert _decode_photo("not-valid-base64!!!") is None

def test_decode_photo_valid():
    import base64
    buf = io.BytesIO()
    Image.new("RGB", (100, 100), (255, 0, 0)).save(buf, format="JPEG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    result = _decode_photo(b64)
    assert result is not None
    assert result.mode == "RGBA"


# ── template registry ────────────────────────────────────────────────────────

def test_all_templates_registered():
    for tid in ["impact", "split", "gradient-bar", "bold-side", "minimal", "reaction", "neon", "cinematic"]:
        t = get_template(tid)
        assert t is not None

def test_unknown_template_falls_back_to_impact():
    from backend.services.thumbnail_templates.impact import ImpactTemplate
    assert isinstance(get_template("does-not-exist"), ImpactTemplate)


# ── each template composes without error ─────────────────────────────────────

@pytest.mark.parametrize("template_id", list(TEMPLATE_REGISTRY.keys()))
def test_template_compose_returns_rgb_image(template_id):
    bg = _solid_bg()
    ctx = _make_ctx(title="Test Title For Template", subtitle="Sottotitolo")
    template = get_template(template_id)
    result = template.compose(bg, ctx)
    assert result.mode == "RGB"
    assert result.size == (1280, 720)

@pytest.mark.parametrize("template_id", ["split", "reaction"])
def test_template_compose_with_subject_photo(template_id):
    bg = _solid_bg()
    photo = Image.new("RGBA", (400, 600), (200, 150, 100, 255))
    ctx = ThumbnailContext(title="Con Foto", subtitle=None, accent_color=(0, 100, 255), subject_photo=photo)
    result = get_template(template_id).compose(bg, ctx)
    assert result.size == (1280, 720)


# ── generate_thumbnail (mocked network) ──────────────────────────────────────

def test_generate_thumbnail_returns_png_bytes():
    with patch("backend.services.thumbnail_service._fetch_background", return_value=_solid_bg()):
        result = generate_thumbnail(
            template_id="impact",
            title="Titolo di Test",
            subtitle="Sottotitolo",
            accent_color="#3B82F6",
            subject_photo_b64=None,
        )
    assert isinstance(result, bytes)
    img = Image.open(io.BytesIO(result))
    assert img.format == "PNG"
    assert img.size == (1280, 720)

@pytest.mark.parametrize("template_id", ["impact", "split", "neon", "cinematic"])
def test_generate_thumbnail_all_templates(template_id):
    with patch("backend.services.thumbnail_service._fetch_background", return_value=_solid_bg()):
        result = generate_thumbnail(
            template_id=template_id,
            title="YouTube Video Title",
            subtitle="Scopri ora",
            accent_color="#FF0000",
            subject_photo_b64=None,
        )
    assert len(result) > 1000  # non-trivial PNG

def test_generate_thumbnail_pollinations_fallback():
    """If Pollinations fails, still returns a valid PNG using solid fallback."""
    with patch("backend.services.thumbnail_service.requests.get", side_effect=Exception("timeout")):
        result = generate_thumbnail(
            template_id="minimal",
            title="Fallback Test",
            subtitle=None,
            accent_color="#22C55E",
            subject_photo_b64=None,
        )
    assert isinstance(result, bytes)
    img = Image.open(io.BytesIO(result))
    assert img.size == (1280, 720)
```

- [ ] **Step 5.2 — Run new tests (should fail — service not yet imported)**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
python -m pytest backend/tests/services/test_thumbnail_service.py -v 2>&1 | tail -20
```

Expected: pass (service + templates already written in Tasks 1–4).

- [ ] **Step 5.3 — Update `test_thumbnail_routes.py`**

Replace the entire file to match the new 202 response + new request shape:
```python
from __future__ import annotations
import pytest


async def _register_and_get_token(client) -> str:
    resp = await client.post(
        "/auth/register",
        json={"email": "thumbuser@example.com", "password": "StrongPass1!", "display_name": "Thumb"},
    )
    return resp.json()["access_token"]


async def _create_project(client, token: str) -> str:
    resp = await client.post(
        "/projects/",
        json={"title": "Thumb Test"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_generate_thumbnail_returns_202(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "Test Title", "template_id": "impact"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 202
    data = resp.json()
    assert "job_id" in data
    assert data["status"] == "queued"


@pytest.mark.asyncio
async def test_generate_thumbnail_requires_auth(client):
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": "any", "title": "T"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_generate_thumbnail_title_required(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_thumbnail_invalid_accent_color(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "T", "accent_color": "not-a-color"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_thumbnail_wrong_project(client):
    token = await _register_and_get_token(client)
    resp = await client.post(
        "/thumbnails/generate",
        json={"project_id": "00000000-0000-0000-0000-000000000000", "title": "T"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_extract_frame_still_works(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    resp = await client.post(
        "/thumbnails/extract-frame",
        json={"project_id": project_id, "asset_id": "a1", "timestamp": 5.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_list_thumbnails(client):
    token = await _register_and_get_token(client)
    project_id = await _create_project(client, token)
    headers = {"Authorization": f"Bearer {token}"}
    await client.post(
        "/thumbnails/generate",
        json={"project_id": project_id, "title": "T1"},
        headers=headers,
    )
    resp = await client.get(f"/thumbnails/?project_id={project_id}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1
```

- [ ] **Step 5.4 — Run all thumbnail tests**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
python -m pytest backend/tests/services/test_thumbnail_service.py backend/tests/test_thumbnail_routes.py -v
```

Expected: all pass.

- [ ] **Step 5.5 — Run full test suite to check no regressions**

```bash
python -m pytest backend/tests/ -x -q 2>&1 | tail -20
```

- [ ] **Step 5.6 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add backend/tests/
git commit -m "test(thumbnails): add service unit tests, update route tests for 202"
```

---

## Task 6 — Frontend
**Agent: frontend** | Files: thumbnailApi.ts, ThumbnailGeneratorUI.tsx, tool/[id].tsx

- [ ] **Step 6.1 — Write `thumbnailApi.ts`**

Create `frontend/services/thumbnailApi.ts`:
```typescript
import { post, get } from './apiClient';

export interface ThumbnailGenerateParams {
  project_id: string;
  template_id: string;
  title: string;
  subtitle?: string;
  accent_color: string;
  subject_photo_b64?: string;
}

interface JobResponse {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  result?: { storage_key?: string; download_url?: string };
  error?: string;
}

async function pollJob(jobId: string, intervalMs = 2000, timeoutMs = 120000): Promise<JobResponse> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await get<JobResponse>(`/jobs/${jobId}`);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Timeout: generazione thumbnail troppo lenta.');
}

export async function generateThumbnail(params: ThumbnailGenerateParams): Promise<string> {
  const { job_id } = await post<{ job_id: string; status: string }>('/thumbnails/generate', params);
  const job = await pollJob(job_id);
  if (job.status === 'failed') throw new Error(job.error ?? 'Generazione fallita.');
  const url = job.result?.download_url ?? job.result?.storage_key;
  if (!url) throw new Error('Nessun URL nella risposta.');
  return url;
}
```

- [ ] **Step 6.2 — TypeScript check on new service**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public/frontend"
npx tsc --noEmit 2>&1 | grep thumbnailApi
```

Expected: no errors.

- [ ] **Step 6.3 — Write `ThumbnailGeneratorUI.tsx`**

Create `frontend/components/ThumbnailGeneratorUI.tsx`:
```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Platform, Image, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { generateThumbnail, type ThumbnailGenerateParams } from '@/services/thumbnailApi';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const TEMPLATES: Template[] = [
  { id: 'impact',       label: 'Impact',        icon: '💥', description: 'Testo centrato, sfondo pieno' },
  { id: 'split',        label: 'Split',          icon: '👤', description: 'Foto sinistra, testo destra' },
  { id: 'gradient-bar', label: 'Gradient Bar',   icon: '📊', description: 'Scena + barra testo in basso' },
  { id: 'bold-side',    label: 'Bold Side',      icon: '🎨', description: 'Pannello colorato + immagine' },
  { id: 'minimal',      label: 'Minimal',        icon: '✦',  description: 'Sfondo scuro, titolo centrato' },
  { id: 'reaction',     label: 'Reaction',       icon: '😱', description: 'Volto grande + testo breve' },
  { id: 'neon',         label: 'Neon',           icon: '⚡', description: 'Testo al neon su sfondo scuro' },
  { id: 'cinematic',    label: 'Cinematic',      icon: '🎬', description: 'Barre letterbox + scena' },
];

const ACCENT_COLORS = [
  { hex: '#FF0000', label: 'Rosso' },
  { hex: '#2563EB', label: 'Blu' },
  { hex: '#16A34A', label: 'Verde' },
  { hex: '#FFE633', label: 'Giallo' },
  { hex: '#7C3AED', label: 'Viola' },
  { hex: '#06B6D4', label: 'Ciano' },
];

interface ThumbnailGeneratorUIProps {
  projectId?: string;
  onSave?: (uri: string, filename: string) => void;
}

export function ThumbnailGeneratorUI({ projectId, onSave }: ThumbnailGeneratorUIProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('impact');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [accentColor, setAccentColor] = useState('#FF0000');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setPhotoPreview(dataUrl);
          setPhotoBase64(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      try {
        const ImagePicker = await import('expo-image-picker');
        const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
        if (res.canceled) return;
        const asset = res.assets[0];
        setPhotoPreview(asset.uri);
        setPhotoBase64(asset.base64 ?? null);
      } catch {
        setError('Impossibile aprire la galleria.');
      }
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) { setError('Inserisci un titolo.'); return; }
    if (!projectId) { setError('Apri un progetto per generare thumbnail.'); return; }
    setLoading(true);
    setError(null);
    setResultUri(null);
    setStatusText('Generando sfondo AI...');
    try {
      const params: ThumbnailGenerateParams = {
        project_id: projectId,
        template_id: selectedTemplate,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        accent_color: accentColor,
        subject_photo_b64: photoBase64 ?? undefined,
      };
      setStatusText('Compositing con Pillow...');
      const url = await generateThumbnail(params);
      setResultUri(url);
      setStatusText('');
    } catch (e: any) {
      setError(e?.message ?? 'Errore durante la generazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!resultUri || !onSave) return;
    onSave(resultUri, `thumbnail-${selectedTemplate}-${Date.now()}.png`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Template grid */}
      <Text style={styles.sectionLabel}>SCEGLI TEMPLATE</Text>
      <View style={styles.templateGrid}>
        {TEMPLATES.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTemplate(t.id)}
            style={({ pressed }) => [styles.templateCard, selectedTemplate === t.id && styles.templateCardSelected, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.templateIcon}>{t.icon}</Text>
            <Text style={[styles.templateLabel, selectedTemplate === t.id && { color: COLORS.neonCyan }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Title */}
      <Text style={styles.sectionLabel}>TITOLO *</Text>
      <TextInput
        style={styles.input}
        placeholder="Es: Come guadagnare €10K al mese"
        placeholderTextColor={COLORS.textMuted}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})
      />

      {/* Subtitle */}
      <Text style={styles.sectionLabel}>SOTTOTITOLO / BADGE (opzionale)</Text>
      <TextInput
        style={styles.input}
        placeholder="Es: Scopri ora, 5 consigli..."
        placeholderTextColor={COLORS.textMuted}
        value={subtitle}
        onChangeText={setSubtitle}
        maxLength={120}
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})
      />

      {/* Accent color */}
      <Text style={styles.sectionLabel}>COLORE ACCENTO</Text>
      <View style={styles.colorRow}>
        {ACCENT_COLORS.map(c => (
          <Pressable
            key={c.hex}
            onPress={() => setAccentColor(c.hex)}
            style={[styles.colorSwatch, { backgroundColor: c.hex }, accentColor === c.hex && styles.colorSwatchSelected]}
          />
        ))}
      </View>

      {/* Photo upload */}
      <Text style={styles.sectionLabel}>FOTO SOGGETTO (opzionale)</Text>
      <Pressable onPress={handlePickPhoto} style={styles.photoZone}>
        {photoPreview ? (
          <Image source={{ uri: photoPreview }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <Text style={styles.photoZoneText}>📸 Aggiungi foto (consigliato per Split / Reaction)</Text>
        )}
      </Pressable>

      {/* Generate button */}
      <Pressable onPress={handleGenerate} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }, { marginTop: SPACING.lg }]}>
        <LinearGradient
          colors={['#FF00E5', '#FFE633'] as unknown as [string, string]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.generateBtn}
        >
          {loading
            ? <><ActivityIndicator color="#000" size="small" /><Text style={styles.generateBtnText}>  {statusText || 'Generando...'}</Text></>
            : <Text style={styles.generateBtnText}>🎨 Genera Thumbnail</Text>
          }
        </LinearGradient>
      </Pressable>

      {/* Error */}
      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

      {/* Result */}
      {resultUri && (
        <View style={styles.resultSection}>
          <Image source={{ uri: resultUri }} style={styles.resultImage} resizeMode="contain" />
          <View style={styles.resultActions}>
            <Pressable onPress={handleGenerate} style={styles.regenBtn}>
              <Text style={styles.regenBtnText}>🔄 Rigenera</Text>
            </Pressable>
            {onSave && (
              <Pressable onPress={handleSave} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
                <LinearGradient
                  colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>💾 Salva in fase</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  sectionLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: SPACING.md },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  templateCard: { width: '22%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.bgCard, gap: 4 },
  templateCardSelected: { borderColor: COLORS.neonCyan, backgroundColor: COLORS.neonCyan + '15' },
  templateIcon: { fontSize: 20 },
  templateLabel: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  input: { fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  colorRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchSelected: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  photoZone: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 120, borderRadius: RADIUS.md },
  photoZoneText: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textMuted, padding: SPACING.md },
  generateBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: '#000' },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonPink, marginTop: SPACING.sm },
  resultSection: { gap: SPACING.md, marginTop: SPACING.lg },
  resultImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated },
  resultActions: { flexDirection: 'row', gap: SPACING.sm },
  regenBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  regenBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  saveBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
});
```

- [ ] **Step 6.4 — Update `tool/[id].tsx`**

In `frontend/app/tool/[id].tsx`, add the import at the top (after the `ImageGeneratorUI` import):
```typescript
import { ThumbnailGeneratorUI } from '@/components/ThumbnailGeneratorUI';
```

Replace the `ai-image` branch render:
```typescript
  // AI Image: full custom UI
  if (id === 'ai-image') {
    return (
      <View style={styles.container}>
        <CosmicBackground />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPad, maxWidth: contentMaxWidth, alignSelf: isDesktop ? 'center' : undefined, width: isDesktop ? '100%' : undefined }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <Pressable onPress={handleBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>{projectId ? 'Progetto' : 'Menu'}</Text>
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.toolHeader, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <LinearGradient colors={tool.gradient as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconLarge}>
              <Text style={styles.iconEmoji}>{tool.icon}</Text>
            </LinearGradient>
            <GradientText gradient={tool.gradient} style={TYPO.h1}>{tool.name}</GradientText>
            <Text style={styles.toolDescription}>{tool.description}</Text>
          </Animated.View>
          <ThumbnailGeneratorUI projectId={projectId} onSave={handleSaveImage} />
        </ScrollView>
      </View>
    );
  }
```

- [ ] **Step 6.5 — TypeScript check**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public/frontend"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing ones unrelated to thumbnail files).

- [ ] **Step 6.6 — Commit**

```bash
cd "D:/Projects/GIt repo/Creator-Suite-Public"
git add frontend/services/thumbnailApi.ts frontend/components/ThumbnailGeneratorUI.tsx frontend/app/tool/[id].tsx
git commit -m "feat(frontend): add ThumbnailGeneratorUI with 8 templates, polling, photo upload"
```

---

## Self-Review Checklist

- [x] All 8 templates implemented with complete Pillow code
- [x] `generate_thumbnail` in tasks.py adds `generate_thumbnail` action to existing `_handle_thumbnail_or_watermark`
- [x] Route returns 202 + `job_id` (not 201)
- [x] Frontend polls `/jobs/{job_id}` until `completed`
- [x] `subject_photo` passed through full stack (base64 → PIL.Image)
- [x] Fallback: Pollinations failure → solid color bg
- [x] Fonts fallback to PIL default if TTF missing
- [x] Existing `test_thumbnail_routes.py` updated for new response shape
- [x] No `requests` dependency added (already present in requirements)
- [x] No `Pillow` added (already in requirements)
- [x] `handleBack` fix already applied to `tool/[id].tsx` in this session
