from __future__ import annotations

import os
from unittest.mock import patch

from backend.services.gemini_service import gemini_available


def test_gemini_available_false_without_key():
    with patch.dict(os.environ, {"GOOGLE_API_KEY": ""}, clear=False):
        assert gemini_available() is False


def test_gemini_available_true_with_key():
    with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}, clear=False):
        assert gemini_available() is True
