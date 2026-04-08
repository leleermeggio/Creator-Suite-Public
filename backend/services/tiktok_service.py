from __future__ import annotations

import logging
from urllib.parse import urlencode

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

TIKTOK_AUTH_URL = "https://www.tiktok.com/v2/auth/authorize"
TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
TIKTOK_USER_URL = "https://open.tiktokapis.com/v2/user/info/"
TIKTOK_VIDEO_URL = "https://open.tiktokapis.com/v2/video/list/"


def get_auth_url(state: str) -> str:
    """Generate TikTok OAuth URL."""
    settings = get_settings()
    params = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "redirect_uri": settings.TIKTOK_REDIRECT_URI,
        "response_type": "code",
        "scope": "user.info.basic,video.list",
        "state": state,
    }
    return f"{TIKTOK_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for tokens."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TIKTOK_TOKEN_URL,
            data={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.TIKTOK_REDIRECT_URI,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TIKTOK_TOKEN_URL,
            data={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_info(access_token: str) -> dict:
    """Get TikTok user profile info."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            TIKTOK_USER_URL,
            params={
                "fields": "open_id,union_id,display_name,avatar_url,follower_count"
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json().get("data", {}).get("user", {})


async def get_video_list(access_token: str, max_count: int = 20) -> list[dict]:
    """Get the user's recent TikTok videos."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            TIKTOK_VIDEO_URL,
            json={"max_count": min(max_count, 20)},
            params={
                "fields": "id,title,create_time,cover_image_url,duration,view_count,like_count,comment_count,share_count",
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json().get("data", {}).get("videos", [])
