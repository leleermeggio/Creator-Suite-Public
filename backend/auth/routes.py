from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
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


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if body.display_name is not None:
        user.display_name = body.display_name
    await db.commit()
    await db.refresh(user)
    return user
