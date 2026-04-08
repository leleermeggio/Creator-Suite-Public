from __future__ import annotations

from backend.services.caption_export_service import (
    _seconds_to_srt_time,
    segments_to_srt,
)


def test_seconds_to_srt_time():
    assert _seconds_to_srt_time(0.0) == "00:00:00,000"
    assert _seconds_to_srt_time(65.5) == "00:01:05,500"
    assert _seconds_to_srt_time(3661.25) == "01:01:01,250"


def test_segments_to_srt():
    segments = [
        {"start": 0.0, "end": 3.0, "text": "Hello world"},
        {"start": 3.5, "end": 6.0, "text": "Second line"},
    ]
    srt = segments_to_srt(segments)
    assert "1\n00:00:00,000 --> 00:00:03,000\nHello world" in srt
    assert "2\n00:00:03,500 --> 00:00:06,000\nSecond line" in srt


def test_segments_to_srt_empty():
    assert segments_to_srt([]) == ""
