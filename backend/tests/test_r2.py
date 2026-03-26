from __future__ import annotations

from unittest.mock import patch

import pytest

from backend.storage.r2 import R2Client


@pytest.fixture
def r2():
    return R2Client(
        endpoint_url="https://fake.r2.cloudflarestorage.com",
        access_key_id="test-key",
        secret_access_key="test-secret",
        bucket_name="test-bucket",
    )


def test_generate_upload_url(r2):
    with patch.object(r2, "_client") as mock_client:
        mock_client.generate_presigned_url.return_value = "https://signed-upload-url"
        url = r2.generate_upload_url(
            key="media/user-1/proj-1/clip.mp4",
            content_type="video/mp4",
            expires_in=3600,
        )
        assert url == "https://signed-upload-url"
        mock_client.generate_presigned_url.assert_called_once_with(
            "put_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "media/user-1/proj-1/clip.mp4",
                "ContentType": "video/mp4",
            },
            ExpiresIn=3600,
        )


def test_generate_download_url(r2):
    with patch.object(r2, "_client") as mock_client:
        mock_client.generate_presigned_url.return_value = "https://signed-download-url"
        url = r2.generate_download_url(
            key="media/user-1/proj-1/clip.mp4",
            expires_in=3600,
        )
        assert url == "https://signed-download-url"
        mock_client.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={
                "Bucket": "test-bucket",
                "Key": "media/user-1/proj-1/clip.mp4",
            },
            ExpiresIn=3600,
        )


def test_storage_key_generation(r2):
    key = r2.make_storage_key("user-abc", "proj-123", "my video.mp4")
    assert key == "media/user-abc/proj-123/my video.mp4"
