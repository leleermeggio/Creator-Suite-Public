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
