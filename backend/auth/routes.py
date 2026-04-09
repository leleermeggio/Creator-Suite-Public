from __future__ import annotations

from pathlib import Path

import anyio
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.dependencies import get_current_user, get_db
from backend.auth.jwt import create_access_token, create_refresh_token, decode_token
from backend.auth.passwords import hash_password, verify_password
from backend.auth.schemas import (
    LoginRequest,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from backend.config import get_settings
from backend.middleware.rate_limit import limiter
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _read_key(path: str) -> str:
    p = Path(path)
    if not p.is_absolute():
        p = Path(__file__).resolve().parent.parent / p
    return p.read_text()


def _make_tokens(user_id: str) -> TokenResponse:
    settings = get_settings()
    private_key = _read_key(settings.JWT_PRIVATE_KEY_PATH)
    return TokenResponse(
        access_token=create_access_token(
            user_id, private_key, settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        ),
        refresh_token=create_refresh_token(
            user_id, private_key, settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        ),
    )


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("5/minute")
async def register(
    request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)
):
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    await db.refresh(user)
    return _make_tokens(user.id)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return _make_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("5/minute")
async def refresh(request: Request, body: RefreshRequest):
    settings = get_settings()
    public_key = _read_key(settings.JWT_PUBLIC_KEY_PATH)
    try:
        payload = decode_token(body.refresh_token, public_key)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    return _make_tokens(payload["sub"])


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def update_me(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.display_name is not None:
        user.display_name = body.display_name
    await db.commit()
    await db.refresh(user)
    return user


_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB
_AVATARS_DIR = Path(__file__).resolve().parent.parent / "static" / "avatars"
_EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

_MAGIC_BYTES: dict[bytes, str] = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
}
_WEBP_SIG = (b"RIFF", b"WEBP")


def _validate_magic(data: bytes, content_type: str) -> bool:
    if content_type == "image/webp":
        return data[:4] == _WEBP_SIG[0] and data[8:12] == _WEBP_SIG[1]
    for magic, ctype in _MAGIC_BYTES.items():
        if ctype == content_type and data[: len(magic)] == magic:
            return True
    return False


@router.post("/avatar", response_model=UserResponse, status_code=status.HTTP_200_OK)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported file type. Use JPEG, PNG, or WebP.",
        )
    data = await file.read()
    if len(data) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    if not _validate_magic(data, file.content_type):
        raise HTTPException(
            status_code=422,
            detail="File content does not match declared content type.",
        )

    ext = _EXT_MAP[file.content_type]
    dest = _AVATARS_DIR / f"{user.id}.{ext}"

    def _write_avatar() -> None:
        _AVATARS_DIR.mkdir(parents=True, exist_ok=True)
        for old in _AVATARS_DIR.glob(f"{user.id}.*"):
            old.unlink(missing_ok=True)
        dest.write_bytes(data)

    await anyio.to_thread.run_sync(_write_avatar)

    user.avatar_url = f"/static/avatars/{user.id}.{ext}"
    await db.commit()
    await db.refresh(user)
    return user
