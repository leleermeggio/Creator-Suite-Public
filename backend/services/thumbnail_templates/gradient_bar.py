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
