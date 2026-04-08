from __future__ import annotations

import io
from unittest.mock import patch

import pytest
from PIL import Image

from backend.services.thumbnail_service import (
    _decode_photo,
    _hex_to_rgb,
    generate_thumbnail,
)
from backend.services.thumbnail_templates import TEMPLATE_REGISTRY, get_template
from backend.services.thumbnail_templates.base import ThumbnailContext


def _solid_bg(color=(30, 20, 50)) -> Image.Image:
    """A 1280x720 solid color image — no network needed."""
    return Image.new("RGB", (1280, 720), color)


def _make_ctx(title="Test Title", subtitle=None, accent=(255, 0, 0)):
    return ThumbnailContext(
        title=title, subtitle=subtitle, accent_color=accent, subject_photo=None
    )


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
    for tid in [
        "impact",
        "split",
        "gradient-bar",
        "bold-side",
        "minimal",
        "reaction",
        "neon",
        "cinematic",
    ]:
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
    ctx = ThumbnailContext(
        title="Con Foto", subtitle=None, accent_color=(0, 100, 255), subject_photo=photo
    )
    result = get_template(template_id).compose(bg, ctx)
    assert result.size == (1280, 720)


# ── generate_thumbnail (mocked network) ──────────────────────────────────────


def test_generate_thumbnail_returns_png_bytes():
    with patch(
        "backend.services.thumbnail_service._fetch_background", return_value=_solid_bg()
    ):
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
    with patch(
        "backend.services.thumbnail_service._fetch_background", return_value=_solid_bg()
    ):
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
    with patch(
        "backend.services.thumbnail_service.requests.get",
        side_effect=Exception("timeout"),
    ):
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
