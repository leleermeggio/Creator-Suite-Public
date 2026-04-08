from __future__ import annotations

import logging
from urllib.parse import urlencode

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

FB_AUTH_URL = "https://www.facebook.com/v19.0/dialog/oauth"
FB_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
FB_GRAPH_URL = "https://graph.facebook.com/v19.0"

SCOPES = (
    "instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement"
)


def get_auth_url(state: str) -> str:
    """Generate Facebook OAuth URL for Instagram Graph API."""
    settings = get_settings()
    params = {
        "client_id": settings.FACEBOOK_APP_ID,
        "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    return f"{FB_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for tokens."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            FB_TOKEN_URL,
            params={
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "code": code,
                "redirect_uri": settings.INSTAGRAM_REDIRECT_URI,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def get_long_lived_token(short_token: str) -> dict:
    """Exchange short-lived token for long-lived token (60 days)."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            FB_TOKEN_URL,
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "fb_exchange_token": short_token,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def get_instagram_account(access_token: str) -> dict:
    """Get the user's Instagram Business/Creator account via Facebook Pages."""
    async with httpx.AsyncClient() as client:
        # Get Facebook pages
        resp = await client.get(
            f"{FB_GRAPH_URL}/me/accounts",
            params={
                "access_token": access_token,
                "fields": "id,name,instagram_business_account",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        pages = resp.json().get("data", [])

        for page in pages:
            ig_account = page.get("instagram_business_account")
            if ig_account:
                # Get Instagram account details
                ig_resp = await client.get(
                    f"{FB_GRAPH_URL}/{ig_account['id']}",
                    params={
                        "access_token": access_token,
                        "fields": "id,username,followers_count,media_count",
                    },
                    timeout=30.0,
                )
                ig_resp.raise_for_status()
                return ig_resp.json()

        raise ValueError("No Instagram Business/Creator account found")


async def get_media_list(
    access_token: str, ig_user_id: str, limit: int = 25
) -> list[dict]:
    """Get recent Instagram media with insights."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FB_GRAPH_URL}/{ig_user_id}/media",
            params={
                "access_token": access_token,
                "fields": "id,caption,timestamp,media_type,thumbnail_url,permalink,like_count,comments_count",
                "limit": min(limit, 25),
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json().get("data", [])


async def get_media_insights(access_token: str, media_id: str) -> dict:
    """Get insights for a single Instagram media item."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{FB_GRAPH_URL}/{media_id}/insights",
            params={
                "access_token": access_token,
                "metric": "impressions,reach,saved,engagement",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json().get("data", [])
        return {item["name"]: item["values"][0]["value"] for item in data}
