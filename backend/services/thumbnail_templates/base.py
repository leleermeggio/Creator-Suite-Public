from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

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
    accent_color: tuple[int, int, int]  # RGB
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
        draw.text(
            (x + padding, y + padding // 2), text, font=font, fill=(255, 255, 255)
        )
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
        oy = ry + (rh - nh)  # anchor to bottom of region
        if subject.mode == "RGBA":
            base.paste(subject, (ox, oy), subject)
        else:
            base.paste(subject, (ox, oy))
        return base
