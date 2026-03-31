# backend/services/thumbnail_templates/minimal.py
from __future__ import annotations

from PIL import Image, ImageDraw, ImageEnhance

from backend.services.thumbnail_templates.base import (
    SUB_FONT_PATH,
    TITLE_FONT_PATH,
    BaseThumbnailTemplate,
    H,
    ThumbnailContext,
    W,
    _load_font,
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
        draw.rectangle(
            [(W // 2 - 30, uy), (W // 2 + 30, uy + 3)], fill=ctx.accent_color
        )

        return img
