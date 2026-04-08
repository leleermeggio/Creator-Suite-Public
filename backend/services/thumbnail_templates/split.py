# backend/services/thumbnail_templates/split.py
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

PANEL_W = 550  # right text panel width
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
                draw, line, (LEFT_W + 28, y), font, fill=(255, 255, 255), stroke_width=3
            )

        # Accent underline
        uy = start_y + len(lines) * line_h + 12
        draw.rectangle([LEFT_W + 28, uy, LEFT_W + 80, uy + 3], fill=ctx.accent_color)

        return img
