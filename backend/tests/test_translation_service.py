from __future__ import annotations

from backend.services.translation_service import _split_for_translation


def test_split_short_text():
    chunks = _split_for_translation("Hello world")
    assert len(chunks) == 1
    assert chunks[0] == "Hello world"


def test_split_long_text():
    # Create text longer than 4900 chars
    text = "This is a sentence. " * 300  # ~6000 chars
    chunks = _split_for_translation(text)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk) <= 4900
    # Reassembled text should contain all original content
    reassembled = " ".join(chunks)
    assert "This is a sentence" in reassembled


def test_split_empty_text():
    chunks = _split_for_translation("")
    assert chunks == []
