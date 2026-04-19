# Avatar & Profile Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom avatar upload, a profile card in Settings, and an avatar badge in the FloatingTabBar.

**Architecture:** Backend adds `avatar_url` to the User model, a `PUT /auth/me` endpoint for name edits, and a `POST /auth/avatar` multipart upload endpoint serving files from `backend/static/avatars/`. Frontend adds a pure React Native `Avatar` component (initials fallback, neon glow ring), a profile card at the top of Settings, and replaces the Settings tab emoji with the live avatar in the FloatingTabBar.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React Native + Expo (frontend), `expo-image-picker` for gallery access, `fetch` for multipart upload.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `backend/models/user.py` | Modify | Add `avatar_url` column |
| `backend/auth/schemas.py` | Modify | Add `avatar_url` to `UserResponse`; add `ProfileUpdate` schema |
| `backend/auth/routes.py` | Modify | Add `PUT /auth/me`, `POST /auth/avatar` |
| `backend/main.py` | Modify | Mount `StaticFiles` at `/static` |
| `backend/static/avatars/.gitkeep` | Create | Seed the static directory |
| `backend/migrations/versions/a1b2c3d4e5f6_add_avatar_url.py` | Create | Alembic migration |
| `backend/tests/test_avatar_profile.py` | Create | Route tests |
| `frontend/services/authApi.ts` | Modify | Add `avatar_url` to `UserProfile`; add `updateMe`, `uploadAvatar` |
| `frontend/hooks/useAuth.ts` | Modify | Add `updateProfile` method |
| `frontend/context/AuthContext.tsx` | Modify | Expose `updateProfile` in context type |
| `frontend/components/Avatar.tsx` | Create | Reusable avatar component |
| `frontend/app/(tabs)/settings.tsx` | Modify | Add profile card section |
| `frontend/app/(tabs)/_layout.tsx` | Modify | Remove `href: null` from settings tab |
| `frontend/components/FloatingTabBar.tsx` | Modify | Replace settings emoji with Avatar |

---

## Task 1: Backend foundation — model, schemas, static dir

**Files:**
- Modify: `backend/models/user.py`
- Modify: `backend/auth/schemas.py`
- Create: `backend/static/avatars/.gitkeep`

- [ ] **Step 1: Add `avatar_url` to User model**

In `backend/models/user.py`, add after the `is_active` line:

```python
avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
```

Full updated file:
```python
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

- [ ] **Step 2: Update auth schemas**

Replace `backend/auth/schemas.py` entirely:

```python
from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}
```

**Note:** `LoginRequest.email` is kept as `EmailStr` — this matches the current test suite which expects 422 on invalid emails at login. Do not change it to `str`.

- [ ] **Step 3: Create static avatars directory**

```bash
mkdir -p backend/static/avatars
touch backend/static/avatars/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add backend/models/user.py backend/auth/schemas.py backend/static/avatars/.gitkeep
git commit -m "feat(backend): add avatar_url to User model and ProfileUpdate schema"
```

---

## Task 2: PUT /auth/me endpoint (TDD)

**Files:**
- Create: `backend/tests/test_avatar_profile.py`
- Modify: `backend/auth/routes.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_avatar_profile.py`:

```python
"""Tests for PUT /auth/me and POST /auth/avatar."""
from __future__ import annotations

import pytest


async def _register(client, email: str, display_name: str = "Test User") -> str:
    resp = await client.post(
        "/auth/register",
        json={"email": email, "password": "StrongPass1!", "display_name": display_name},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


# ── PUT /auth/me ──────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_me_display_name(client):
    token = await _register(client, "update@test.com", "Old Name")
    resp = await client.put(
        "/auth/me",
        json={"display_name": "New Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "New Name"
    assert "avatar_url" in data
    assert data["avatar_url"] is None


@pytest.mark.asyncio
async def test_update_me_requires_auth(client):
    resp = await client.put("/auth/me", json={"display_name": "Name"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_update_me_empty_name_rejected(client):
    token = await _register(client, "empty@test.com")
    resp = await client.put(
        "/auth/me",
        json={"display_name": ""},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_me_name_too_long_rejected(client):
    token = await _register(client, "long@test.com")
    resp = await client.put(
        "/auth/me",
        json={"display_name": "A" * 65},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_update_me_null_body_is_noop(client):
    token = await _register(client, "noop@test.com", "Unchanged")
    resp = await client.put(
        "/auth/me",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Unchanged"
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
cd backend && python -m pytest tests/test_avatar_profile.py::test_update_me_display_name -v
```

Expected: `FAILED` — `404 Not Found` (route doesn't exist yet)

- [ ] **Step 3: Add PUT /auth/me to routes**

In `backend/auth/routes.py`, add `ProfileUpdate` to the existing imports from `backend.auth.schemas`:

```python
from backend.auth.schemas import (
    LoginRequest,
    ProfileUpdate,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
```

Add the endpoint after the existing `GET /me`:

```python
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
```

- [ ] **Step 4: Run tests — expect all PUT /auth/me tests to pass**

```bash
cd backend && python -m pytest tests/test_avatar_profile.py -k "update_me" -v
```

Expected: 5 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/auth/routes.py backend/auth/schemas.py backend/tests/test_avatar_profile.py
git commit -m "feat(backend): add PUT /auth/me for display_name updates"
```

---

## Task 3: POST /auth/avatar endpoint (TDD)

**Files:**
- Modify: `backend/tests/test_avatar_profile.py` (append avatar tests)
- Modify: `backend/auth/routes.py`

- [ ] **Step 1: Add failing avatar upload tests**

Append to `backend/tests/test_avatar_profile.py`:

```python
# ── POST /auth/avatar ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_avatar_jpeg(client):
    token = await _register(client, "avatar@test.com", "Avatar User")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["avatar_url"] is not None
    assert data["avatar_url"].startswith("/static/avatars/")
    assert data["avatar_url"].endswith(".jpg")


@pytest.mark.asyncio
async def test_upload_avatar_png(client):
    token = await _register(client, "avatarpng@test.com", "PNG User")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.png", b"\x89PNG\r\n" + b"\x00" * 20, "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["avatar_url"].endswith(".png")


@pytest.mark.asyncio
async def test_upload_avatar_wrong_type_rejected(client):
    token = await _register(client, "wrongtype@test.com")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("file.txt", b"text content", "text/plain")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upload_avatar_too_large_rejected(client):
    token = await _register(client, "toolarge@test.com")
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("big.jpg", b"\xff" * (6 * 1024 * 1024), "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 413


@pytest.mark.asyncio
async def test_upload_avatar_requires_auth(client):
    resp = await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_me_returns_avatar_url(client):
    token = await _register(client, "mecheck@test.com", "Check User")
    await client.post(
        "/auth/avatar",
        files={"file": ("photo.jpg", b"\xff\xd8\xff\xe0" + b"\x00" * 20, "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
    )
    resp = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["avatar_url"] is not None
```

- [ ] **Step 2: Run and confirm they fail**

```bash
cd backend && python -m pytest tests/test_avatar_profile.py -k "avatar" -v
```

Expected: `FAILED` — 404 (route doesn't exist yet)

- [ ] **Step 3: Add POST /auth/avatar to routes**

Add these imports to `backend/auth/routes.py` (merge with existing top-level imports):

```python
from pathlib import Path

from fastapi import File, UploadFile
```

Add constants and endpoint after `update_me`:

```python
_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5 MB
_AVATARS_DIR = Path(__file__).resolve().parent.parent / "static" / "avatars"
_EXT_MAP = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@router.post("/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Unsupported file type. Use JPEG, PNG, or WebP.",
        )
    data = await file.read()
    if len(data) > _MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 5 MB.")

    ext = _EXT_MAP[file.content_type]
    _AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    dest = _AVATARS_DIR / f"{user.id}.{ext}"
    dest.write_bytes(data)

    user.avatar_url = f"/static/avatars/{user.id}.{ext}"
    await db.commit()
    await db.refresh(user)
    return user
```

- [ ] **Step 4: Run all avatar tests — expect all to pass**

```bash
cd backend && python -m pytest tests/test_avatar_profile.py -v
```

Expected: all 11 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/auth/routes.py backend/tests/test_avatar_profile.py
git commit -m "feat(backend): add POST /auth/avatar for profile image upload"
```

---

## Task 4: Mount StaticFiles in main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add StaticFiles mount**

In `backend/main.py`, add to the top-level imports:

```python
from pathlib import Path

from fastapi.staticfiles import StaticFiles
```

In `create_app()`, add these lines just before `return app` (currently the last line):

```python
    _static_dir = Path(__file__).parent / "static"
    _static_dir.mkdir(exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(_static_dir), check_dir=False), name="static")
```

- [ ] **Step 2: Verify app still starts**

```bash
cd backend && python -c "from backend.main import create_app; app = create_app(); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat(backend): mount /static for avatar file serving"
```

---

## Task 5: Alembic migration

**Files:**
- Create: `backend/migrations/versions/a1b2c3d4e5f6_add_avatar_url.py`

- [ ] **Step 1: Create migration file**

Create `backend/migrations/versions/a1b2c3d4e5f6_add_avatar_url.py`:

```python
"""add_avatar_url_to_users

Revision ID: a1b2c3d4e5f6
Revises: 1cd136f2d91c
Create Date: 2026-04-08

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "1cd136f2d91c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
```

- [ ] **Step 2: Apply migration**

```bash
cd backend && alembic upgrade head
```

Expected: `Running upgrade 1cd136f2d91c -> a1b2c3d4e5f6, add_avatar_url_to_users`

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/versions/a1b2c3d4e5f6_add_avatar_url.py
git commit -m "feat(backend): alembic migration — add avatar_url to users"
```

---

## Task 6: Frontend — authApi.ts update

**Files:**
- Modify: `frontend/services/authApi.ts`

- [ ] **Step 1: Update authApi.ts**

Replace `frontend/services/authApi.ts` entirely:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { post, get, put, ApiError, API_BASE } from './apiClient';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const tokens = await post<TokenResponse>('/auth/login', { email, password }, { skipAuth: true });
  await AsyncStorage.setItem('auth_access_token', tokens.access_token);
  await AsyncStorage.setItem('auth_refresh_token', tokens.refresh_token);
  return tokens;
}

export async function register(
  email: string,
  password: string,
  display_name: string,
): Promise<TokenResponse> {
  const tokens = await post<TokenResponse>(
    '/auth/register',
    { email, password, display_name },
    { skipAuth: true },
  );
  await AsyncStorage.setItem('auth_access_token', tokens.access_token);
  await AsyncStorage.setItem('auth_refresh_token', tokens.refresh_token);
  return tokens;
}

export async function refreshToken(refresh_token: string): Promise<TokenResponse> {
  const tokens = await post<TokenResponse>(
    '/auth/refresh',
    { refresh_token },
    { skipAuth: true },
  );
  await AsyncStorage.setItem('auth_access_token', tokens.access_token);
  await AsyncStorage.setItem('auth_refresh_token', tokens.refresh_token);
  return tokens;
}

export async function getMe(): Promise<UserProfile> {
  return get<UserProfile>('/auth/me');
}

export async function updateMe(patch: { display_name?: string }): Promise<UserProfile> {
  return put<UserProfile>('/auth/me', patch);
}

export async function uploadAvatar(imageUri: string): Promise<UserProfile> {
  const token = await AsyncStorage.getItem('auth_access_token');
  const filename = imageUri.split('/').pop() ?? 'avatar.jpg';
  const ext = (filename.split('.').pop() ?? 'jpg').toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  const mimeType = mimeMap[ext] ?? 'image/jpeg';

  const formData = new FormData();
  formData.append('file', { uri: imageUri, name: filename, type: mimeType } as unknown as Blob);

  const res = await fetch(`${API_BASE}/auth/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token ?? ''}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { detail?: string })?.detail ?? res.statusText);
  }
  return res.json() as Promise<UserProfile>;
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "authApi"
```

Expected: no errors mentioning authApi.ts

- [ ] **Step 3: Commit**

```bash
git add frontend/services/authApi.ts
git commit -m "feat(frontend): add avatar_url to UserProfile + updateMe/uploadAvatar"
```

---

## Task 7: Frontend — useAuth + AuthContext

**Files:**
- Modify: `frontend/hooks/useAuth.ts`
- Modify: `frontend/context/AuthContext.tsx`

- [ ] **Step 1: Update useAuth.ts**

Replace `frontend/hooks/useAuth.ts` entirely:

```typescript
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as authApi from '@/services/authApi';
import type { UserProfile } from '@/services/authApi';

const TOKEN_KEY = 'auth_access_token';
const REFRESH_KEY = 'auth_refresh_token';

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: { display_name?: string; avatar_url?: string }) => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        if (!token) return;
        const profile = await authApi.getMe();
        if (!cancelled) setUser(profile);
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 401) {
          await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, data.access_token],
      [REFRESH_KEY, data.refresh_token],
    ]);
    const profile = await authApi.getMe();
    setUser(profile);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (
    patch: { display_name?: string; avatar_url?: string },
  ) => {
    if (patch.avatar_url !== undefined) {
      setUser(prev => prev ? { ...prev, avatar_url: patch.avatar_url! } : prev);
      return;
    }
    const updated = await authApi.updateMe(patch);
    setUser(updated);
  }, []);

  return {
    user,
    loading,
    isLoggedIn: user !== null,
    login,
    logout,
    updateProfile,
  };
}
```

- [ ] **Step 2: Update AuthContext.tsx**

Replace `frontend/context/AuthContext.tsx` entirely:

```typescript
import React, { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { AuthState } from '@/hooks/useAuth';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "useAuth|AuthContext"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/hooks/useAuth.ts frontend/context/AuthContext.tsx
git commit -m "feat(frontend): add updateProfile to auth state"
```

---

## Task 8: Avatar component

**Files:**
- Create: `frontend/components/Avatar.tsx`

- [ ] **Step 1: Install expo-image-picker**

```bash
cd frontend && npx expo install expo-image-picker
```

- [ ] **Step 2: Create Avatar component**

Create `frontend/components/Avatar.tsx`:

```typescript
import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { FONTS, COLORS, SHADOWS } from '@/constants/theme';
import { API_BASE } from '@/services/apiClient';

const INITIALS_COLORS = [
  COLORS.neonCyan,
  COLORS.neonMagenta,
  COLORS.neonViolet,
  COLORS.neonOrange,
  COLORS.neonLime,
] as const;

export interface AvatarProps {
  uri?: string | null;
  displayName: string;
  size?: number;
  showOnline?: boolean;
  glowColor?: string;
  style?: StyleProp<ViewStyle>;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('');
}

function getBgColor(name: string): string {
  const index = (name.charCodeAt(0) ?? 0) % INITIALS_COLORS.length;
  return INITIALS_COLORS[index];
}

export function Avatar({
  uri,
  displayName,
  size = 40,
  showOnline = false,
  glowColor,
  style,
}: AvatarProps) {
  const resolvedUri = uri
    ? uri.startsWith('http') ? uri : `${API_BASE}${uri}`
    : null;

  const initials = getInitials(displayName || '?');
  const bgColor = getBgColor(displayName || '?');
  const dotSize = Math.round(size * 0.28);
  const fontSize = Math.round(size * 0.36);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        glowColor ? SHADOWS.neonGlow(glowColor, 0.6) : undefined,
        style,
      ]}
    >
      {resolvedUri ? (
        <Image
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor + '33' },
          ]}
        >
          <Text style={[styles.initials, { fontSize, color: bgColor }]}>
            {initials}
          </Text>
        </View>
      )}

      {showOnline && (
        <View
          style={[
            styles.onlineDot,
            { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'visible',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  initials: {
    fontFamily: FONTS.bodyBold,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.neonLime,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "Avatar"
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/Avatar.tsx
git commit -m "feat(frontend): add Avatar component with initials fallback and glow ring"
```

---

## Task 9: Settings profile card

**Files:**
- Modify: `frontend/app/(tabs)/settings.tsx`

- [ ] **Step 1: Add new imports**

Add to the existing imports in `frontend/app/(tabs)/settings.tsx` (do not re-import anything already imported):

```typescript
import * as ImagePicker from 'expo-image-picker';
import { Avatar } from '@/components/Avatar';
import * as authApi from '@/services/authApi';
```

- [ ] **Step 2: Expand useAuthContext destructuring and add state/handlers**

Find the existing line `const { logout } = useAuthContext();` and replace it with:

```typescript
const { user, logout, updateProfile } = useAuthContext();
```

Then add these state variables and handlers inside `SettingsScreen`, after the existing state declarations:

```typescript
const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
const [uploadingAvatar, setUploadingAvatar] = useState(false);
const [editingName, setEditingName] = useState(false);
const [nameInput, setNameInput] = useState('');

const handlePickAvatar = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return;
  const imageUri = result.assets[0].uri;
  setLocalAvatarUri(imageUri);
  setUploadingAvatar(true);
  try {
    const updated = await authApi.uploadAvatar(imageUri);
    await updateProfile({ avatar_url: updated.avatar_url ?? undefined });
  } catch {
    setLocalAvatarUri(null);
  } finally {
    setUploadingAvatar(false);
  }
};

const handleSaveName = async () => {
  setEditingName(false);
  const trimmed = nameInput.trim();
  if (!trimmed || trimmed === user?.display_name) return;
  try {
    await updateProfile({ display_name: trimmed });
  } catch {
    setNameInput(user?.display_name ?? '');
  }
};
```

- [ ] **Step 3: Add profile card JSX**

Inside the `ScrollView`, add this section as the **first child** (before the AI Provider section):

```tsx
{/* PROFILO */}
<View style={styles.section}>
  <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>PROFILO</Text>
  <GlowCard gradient={COLORS.gradAurora} glowIntensity={0.15} borderWidth={1}>
    <View style={styles.profileRow}>
      <Pressable
        onPress={handlePickAvatar}
        style={styles.avatarWrap}
        disabled={uploadingAvatar}
      >
        <Avatar
          uri={localAvatarUri ?? user?.avatar_url}
          displayName={user?.display_name ?? '?'}
          size={72}
          glowColor={COLORS.neonCyan}
        />
        <View style={styles.avatarEditBadge}>
          <Text style={styles.avatarEditIcon}>{uploadingAvatar ? '⏳' : '📷'}</Text>
        </View>
      </Pressable>

      <View style={styles.profileInfo}>
        {editingName ? (
          <TextInput
            style={[styles.nameEditInput, { color: palette.text, borderColor: palette.borderActive }]}
            value={nameInput}
            onChangeText={setNameInput}
            onBlur={handleSaveName}
            onSubmitEditing={handleSaveName}
            autoFocus
            returnKeyType="done"
            autoCapitalize="words"
          />
        ) : (
          <Pressable
            onPress={() => {
              setNameInput(user?.display_name ?? '');
              setEditingName(true);
            }}
            style={styles.nameRow}
          >
            <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={1}>
              {user?.display_name ?? '—'}
            </Text>
            <Text style={[styles.nameEditIcon, { color: palette.textMuted }]}>✎</Text>
          </Pressable>
        )}
        <Text style={[styles.profileEmail, { color: palette.textMuted }]} numberOfLines={1}>
          {user?.email ?? '—'}
        </Text>
      </View>
    </View>
  </GlowCard>
</View>
```

- [ ] **Step 4: Add styles**

Add these entries to the `StyleSheet.create({})` block:

```typescript
  profileRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  avatarWrap: {
    position: 'relative' as const,
  },
  avatarEditBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarEditIcon: {
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  profileName: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    lineHeight: 24,
  },
  nameEditIcon: {
    fontSize: 14,
  },
  nameEditInput: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    borderBottomWidth: 1.5,
    paddingVertical: 2,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  profileEmail: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
```

- [ ] **Step 5: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "settings"
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/app/(tabs)/settings.tsx
git commit -m "feat(frontend): add profile card with avatar upload to settings"
```

---

## Task 10: FloatingTabBar avatar badge + layout fix

**Files:**
- Modify: `frontend/app/(tabs)/_layout.tsx`
- Modify: `frontend/components/FloatingTabBar.tsx`

- [ ] **Step 1: Remove href:null from settings in _layout.tsx**

In `frontend/app/(tabs)/_layout.tsx`, change:

```tsx
// Before:
<Tabs.Screen name="settings" options={{ href: null }} />

// After:
<Tabs.Screen name="settings" options={{ title: 'Profilo' }} />
```

- [ ] **Step 2: Replace FloatingTabBar.tsx**

Replace `frontend/components/FloatingTabBar.tsx` entirely:

```typescript
import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS, BORDERS } from '@/constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuthContext } from '@/context/AuthContext';
import { Avatar } from '@/components/Avatar';

const TAB_CONFIG = [
  { name: 'index',       icon: '📁', label: 'Progetti'  },
  { name: 'agents',      icon: '🤖', label: 'Agenti'    },
  { name: 'quick-tools', icon: '⚡', label: 'Strumenti' },
  { name: 'activity',   icon: '📊', label: 'Attività'  },
  { name: 'analytics',  icon: '📈', label: 'Analisi'   },
  { name: 'settings',   icon: '👤', label: 'Profilo'   },
];

interface TabItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
  iconNode?: React.ReactNode;
}

function TabItem({ icon, label, isActive, onPress, onLongPress, iconNode }: TabItemProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    if (isActive) {
      glowOpacity.value = withTiming(1, { duration: 250 });
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 12, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(isActive ? 1.0 : 1, { damping: 12, stiffness: 300 });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.activeGlow, glowStyle]} />
      {isActive && <Animated.View style={[styles.activeDot, glowStyle]} />}

      <Animated.View style={iconStyle}>
        {iconNode ?? <Text style={styles.tabIcon}>{icon}</Text>}
      </Animated.View>

      {isActive && <Text style={styles.tabLabel}>{label}</Text>}
    </Pressable>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { user } = useAuthContext();

  const visibleTabs = state.routes.filter(
    (route) => (descriptors[route.key]?.options as any)?.href !== null
  );

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.container}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={[styles.pill, Platform.OS === 'web' && { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any]}>
          {visibleTabs.map((route) => {
            const routeIndex = state.routes.indexOf(route);
            const isActive = state.index === routeIndex;
            const config = TAB_CONFIG.find((t) => t.name === route.name);
            if (!config) return null;

            const avatarNode = route.name === 'settings' && user ? (
              <View style={[styles.avatarRing, isActive && styles.avatarRingActive]}>
                <Avatar
                  uri={user.avatar_url}
                  displayName={user.display_name}
                  size={24}
                />
              </View>
            ) : undefined;

            return (
              <TabItem
                key={route.key}
                icon={config.icon}
                label={config.label}
                isActive={isActive}
                iconNode={avatarNode}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isActive && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const PILL_HEIGHT = 64;
const PILL_RADIUS = 32;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.select({ ios: 28, android: 16, default: 16 }),
    pointerEvents: 'box-none' as any,
  },
  container: {
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    ...SHADOWS.neonGlow(COLORS.neonCyan, 0.3),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: SPACING.md,
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(8, 8, 20, 0.88)'
        : 'rgba(8, 8, 20, 0.55)',
    gap: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.lg,
    minWidth: 52,
    position: 'relative',
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(0, 255, 208, 0.10)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: 'inset 0 0 12px rgba(0,255,208,0.15)' } as any)
      : {}),
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neonCyan,
    ...SHADOWS.neonGlow(COLORS.neonCyan, 0.8),
  },
  tabIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.neonCyan,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  avatarRing: {
    borderRadius: 14,
    padding: 1,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarRingActive: {
    borderColor: COLORS.neonCyan,
  },
});
```

- [ ] **Step 3: Type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add frontend/app/(tabs)/_layout.tsx frontend/components/FloatingTabBar.tsx
git commit -m "feat(frontend): avatar badge in tab bar + profile tab visible"
```

---

## Task 11: Full verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && python -m pytest tests/ -x -q
```

Expected: all tests pass

- [ ] **Step 2: Frontend type-check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 3: Smoke-test web build**

```bash
cd frontend && npx expo export --platform web 2>&1 | tail -5
```

Expected: `Export was successful`
