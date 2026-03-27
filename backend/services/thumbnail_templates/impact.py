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
