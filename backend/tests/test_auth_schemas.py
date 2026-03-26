from __future__ import annotations

import pytest
from pydantic import ValidationError

from backend.auth.schemas import RegisterRequest, LoginRequest


def test_register_rejects_short_password():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="short", display_name="X")


def test_register_rejects_invalid_email():
    with pytest.raises(ValidationError):
        RegisterRequest(email="not-an-email", password="StrongPass1!", display_name="X")


def test_register_rejects_empty_display_name():
    with pytest.raises(ValidationError):
        RegisterRequest(email="a@b.com", password="StrongPass1!", display_name="")


def test_register_accepts_valid_input():
    r = RegisterRequest(email="a@b.com", password="StrongPass1!", display_name="User")
    assert r.email == "a@b.com"


def test_login_rejects_invalid_email():
    with pytest.raises(ValidationError):
        LoginRequest(email="bad", password="whatever")
