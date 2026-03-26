from __future__ import annotations

from backend.services.caption_burnin_service import (
    _hex_to_ass_color,
    _seconds_to_ass_time,
    generate_ass_subtitle,
    STYLE_PRESETS,
)


def test_hex_to_ass_color_rgb():
    assert _hex_to_ass_color("#FFFFFF") == "&HFFFFFF&"
    assert _hex_to_ass_color("#FF0000") == "&H0000FF&"
    assert _hex_to_ass_color("#00FF00") == "&H00FF00&"


def test_hex_to_ass_color_argb():
    assert _hex_to_ass_color("#80FF0000") == "&H800000FF&"


def test_seconds_to_ass_time():
    assert _seconds_to_ass_time(0.0) == "0:00:00.00"
    assert _seconds_to_ass_time(65.5) == "0:01:05.50"
    assert _seconds_to_ass_time(3661.25) == "1:01:01.25"


def test_generate_ass_subtitle_default():
    segments = [
        {"start": 0.0, "end": 3.0, "text": "Hello world"},
        {"start": 3.5, "end": 6.0, "text": "Second line"},
    ]
    ass = generate_ass_subtitle(segments)
    assert "[Script Info]" in ass
    assert "[V4+ Styles]" in ass
    assert "[Events]" in ass
    assert "Hello world" in ass
    assert "Second line" in ass
    assert "0:00:00.00" in ass
    assert "0:00:03.00" in ass


def test_generate_ass_subtitle_custom_style():
    segments = [{"start": 1.0, "end": 2.0, "text": "Custom"}]
    ass = generate_ass_subtitle(
        segments,
        style_preset="tiktok",
        font_size=36,
        color="#FF0000",
        position="top",
    )
    assert "Fontsize" not in ass or "36" in ass  # fontsize embedded in style line
    assert "Custom" in ass


def test_style_presets_exist():
    expected = {"default", "bold_center", "tiktok", "youtube", "minimal"}
    assert expected.issubset(set(STYLE_PRESETS.keys()))
