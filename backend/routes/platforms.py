from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.models.platform_connection import PlatformConnection
from backend.models.user import User
from backend.schemas.platforms import (
    PlatformConnectResponse,
    PlatformStatusItem,
    PlatformStatusResponse,
)
from backend.services import instagram_service, tiktok_service, youtube_service
from backend.services.token_encryption import decrypt_token, encrypt_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/platforms", tags=["platforms"])

SUPPORTED_PLATFORMS = {"youtube", "tiktok", "instagram"}

SERVICE_MAP = {
    "youtube": youtube_service,
    "tiktok": tiktok_service,
    "instagram": instagram_service,
}


@router.post("/{platform}/connect", response_model=PlatformConnectResponse)
async def connect_platform(
    platform: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=422, detail=f"Unsupported platform: {platform}")

    # Generate state token for CSRF protection
    state = f"{user.id}:{uuid.uuid4()}"

    service = SERVICE_MAP[platform]
    auth_url = service.get_auth_url(state)

    logger.info("🔗 Platform connect initiated: %s for user %s", platform, user.id)
    return PlatformConnectResponse(auth_url=auth_url)


@router.get("/{platform}/callback")
async def platform_callback(
    platform: str,
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=422, detail=f"Unsupported platform: {platform}")

    # Extract user_id from state
    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    user_id = parts[0]

    service = SERVICE_MAP[platform]

    try:
        # Exchange code for tokens
        token_data = await service.exchange_code(code)

        access_token = token_data.get("access_token", "")
        refresh_token = token_data.get("refresh_token", "")

        # Get platform user info
        if platform == "youtube":
            channel = await youtube_service.get_channel_info(access_token)
            platform_user_id = channel["id"]
            platform_username = channel["snippet"]["title"]
        elif platform == "tiktok":
            user_info = await tiktok_service.get_user_info(access_token)
            platform_user_id = user_info.get("open_id", "")
            platform_username = user_info.get("display_name", "")
        elif platform == "instagram":
            # Exchange for long-lived token
            long_token = await instagram_service.get_long_lived_token(access_token)
            access_token = long_token.get("access_token", access_token)
            ig_account = await instagram_service.get_instagram_account(access_token)
            platform_user_id = ig_account["id"]
            platform_username = ig_account.get("username", "")

        # Upsert platform connection
        result = await db.execute(
            select(PlatformConnection).where(
                PlatformConnection.user_id == user_id,
                PlatformConnection.platform == platform,
            )
        )
        conn = result.scalar_one_or_none()

        if conn:
            conn.access_token = encrypt_token(access_token)
            conn.refresh_token = encrypt_token(refresh_token)
            conn.platform_user_id = platform_user_id
            conn.platform_username = platform_username
        else:
            conn = PlatformConnection(
                user_id=user_id,
                platform=platform,
                access_token=encrypt_token(access_token),
                refresh_token=encrypt_token(refresh_token),
                platform_user_id=platform_user_id,
                platform_username=platform_username,
            )
            db.add(conn)

        await db.commit()
        logger.info("✅ Platform connected: %s for user %s", platform, user_id)

        # Redirect back to app
        return {"status": "connected", "platform": platform}

    except Exception as e:
        logger.error("❌ Platform callback failed: %s — %s", platform, str(e))
        raise HTTPException(status_code=502, detail=f"Failed to connect {platform}")


@router.delete("/{platform}/disconnect", status_code=204)
async def disconnect_platform(
    platform: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status_code=422, detail=f"Unsupported platform: {platform}")

    result = await db.execute(
        select(PlatformConnection).where(
            PlatformConnection.user_id == user.id,
            PlatformConnection.platform == platform,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail="Platform not connected")

    await db.delete(conn)
    await db.commit()
    logger.info("🔌 Platform disconnected: %s for user %s", platform, user.id)


@router.get("/status", response_model=PlatformStatusResponse)
async def platform_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PlatformConnection).where(PlatformConnection.user_id == user.id)
    )
    connections = {c.platform: c for c in result.scalars().all()}

    platforms = []
    for p in SUPPORTED_PLATFORMS:
        conn = connections.get(p)
        platforms.append(
            PlatformStatusItem(
                platform=p,
                connected=conn is not None,
                username=conn.platform_username if conn else None,
                connected_at=conn.connected_at if conn else None,
                last_synced_at=conn.last_synced_at if conn else None,
            )
        )

    return PlatformStatusResponse(platforms=platforms)
