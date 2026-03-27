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
