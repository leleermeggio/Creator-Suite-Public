# backend/services/thumbnail_templates/bold_side.py
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
            self.paste_subject(
                img, ctx.subject_photo, (LEFT_PANEL_W + 20, 0, W - LEFT_PANEL_W - 20, H)
            )

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
                draw,
                line,
                (24, start_y + i * line_h),
                font,
                fill=fill,
                stroke_width=0,
                stroke_fill=(0, 0, 0),
            )

        # Subtitle (small, white, bottom of panel)
        if ctx.subtitle:
            sfont = _load_font(SUB_FONT_PATH, 28)
            sy = H - 50
            draw.text(
                (24, sy), ctx.subtitle.upper(), font=sfont, fill=(255, 255, 255, 180)
            )

        return img
