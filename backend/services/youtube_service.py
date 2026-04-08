from __future__ import annotations

import logging
from datetime import date
from urllib.parse import urlencode

import httpx

from backend.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
YOUTUBE_DATA_API = "https://www.googleapis.com/youtube/v3"
YOUTUBE_ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2"

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
]


def get_auth_url(state: str) -> str:
    """Generate Google OAuth URL for YouTube."""
    settings = get_settings()
    params = {
        "client_id": settings.YOUTUBE_CLIENT_ID,
        "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for tokens."""
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.YOUTUBE_CLIENT_ID,
                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": settings.YOUTUBE_REDIRECT_URI,
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
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.YOUTUBE_CLIENT_ID,
                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()


async def get_channel_info(access_token: str) -> dict:
    """Get the authenticated user's YouTube channel info."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{YOUTUBE_DATA_API}/channels",
            params={"part": "snippet,statistics", "mine": "true"},
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            raise ValueError("No YouTube channel found for this account")
        return items[0]


async def get_analytics(
    access_token: str,
    start_date: date,
    end_date: date,
    metrics: str = "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
    dimensions: str = "day",
) -> list[dict]:
    """Fetch YouTube Analytics data for a date range."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{YOUTUBE_ANALYTICS_API}/reports",
            params={
                "ids": "channel==MINE",
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
                "metrics": metrics,
                "dimensions": dimensions,
                "sort": "day",
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        columns = [h["name"] for h in data.get("columnHeaders", [])]
        rows = data.get("rows", [])
        return [dict(zip(columns, row)) for row in rows]


async def get_revenue_analytics(
    access_token: str,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Fetch YouTube revenue data (requires YPP membership)."""
    try:
        return await get_analytics(
            access_token,
            start_date,
            end_date,
            metrics="estimatedRevenue,estimatedAdRevenue,grossRevenue,cpm,playbackBasedCpm",
            dimensions="day",
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 403:
            logger.info("🎬 YouTube revenue not available — user not in YPP")
            return []
        raise


async def get_video_list(access_token: str, max_results: int = 50) -> list[dict]:
    """Get the user's recent uploaded videos."""
    async with httpx.AsyncClient() as client:
        # Get uploads playlist ID
        channel = await get_channel_info(access_token)
        uploads_id = channel["contentDetails"]["relatedPlaylists"]["uploads"]

        resp = await client.get(
            f"{YOUTUBE_DATA_API}/playlistItems",
            params={
                "part": "snippet,contentDetails",
                "playlistId": uploads_id,
                "maxResults": min(max_results, 50),
            },
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json().get("items", [])
