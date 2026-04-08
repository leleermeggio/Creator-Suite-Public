from __future__ import annotations

import pytest
from fastapi import HTTPException

from backend.utils.url_safety import assert_safe_url


def test_valid_https_url_passes():
    assert_safe_url("https://example.com/video.mp4")


def test_valid_http_url_passes():
    assert_safe_url("http://example.com/video.mp4")


def test_rejects_file_scheme():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("file:///etc/passwd")
    assert exc_info.value.status_code == 400


def test_rejects_ftp_scheme():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("ftp://example.com/file")
    assert exc_info.value.status_code == 400


def test_rejects_loopback_ip():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://127.0.0.1:8000/internal")
    assert exc_info.value.status_code == 400


def test_rejects_rfc1918_10_block():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://10.0.0.1/metadata")
    assert exc_info.value.status_code == 400


def test_rejects_rfc1918_192_168_block():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://192.168.1.1/admin")
    assert exc_info.value.status_code == 400


def test_rejects_link_local():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("http://169.254.169.254/latest/meta-data/")
    assert exc_info.value.status_code == 400


def test_rejects_empty_string():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("")
    assert exc_info.value.status_code == 400


def test_rejects_no_host():
    with pytest.raises(HTTPException) as exc_info:
        assert_safe_url("https:///path/only")
    assert exc_info.value.status_code == 400
