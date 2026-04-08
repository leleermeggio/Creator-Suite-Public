# backend/services/thumbnail_templates/cinematic.py
from __future__ import annotations

from PIL import Image, ImageDraw

from backend.services.thumbnail_templates.base import (
    SUB_FONT_PATH,
    TITLE_FONT_PATH,
    BaseThumbnailTemplate,
    H,
    ThumbnailContext,
    W,
    _load_font,
)

TOP_BAR_H = int(H * 0.17)  # ~122px
BOT_BAR_H = int(H * 0.22)  # ~158px
SCENE_Y = TOP_BAR_H
SCENE_H = H - TOP_BAR_H - BOT_BAR_H


class CinematicTemplate(BaseThumbnailTemplate):
    """Black letterbox bars. Category in top bar, title in bottom bar."""

    def compose(self, bg: Image.Image, ctx: ThumbnailContext) -> Image.Image:
        img = self.resize_cover(bg)

        # Crop to scene area then re-place
        scene = img.crop((0, 0, W, H))
        # Subtle vignette on scene
        scene = self.apply_gradient_overlay(
            scene, "bottom", start_alpha=0, end_alpha=80
        )

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
