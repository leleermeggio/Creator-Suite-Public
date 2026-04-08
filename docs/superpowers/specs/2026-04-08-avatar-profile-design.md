# Avatar & Profile Section — Design Spec
**Date:** 2026-04-08  
**Status:** Approved  
**Scope:** Custom user avatar with backend upload, profile card in Settings, avatar badge in FloatingTabBar

---

## 1. Overview

Add a custom avatar system to CreatorZone. Users can upload a profile photo from their device. The avatar appears in two places: a new profile card at the top of the Settings screen, and as a replacement for the Settings tab icon in the FloatingTabBar.

---

## 2. Backend Changes

### 2.1 User Model (`backend/models/user.py`)
Add `avatar_url` column:
```python
avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True, default=None)
```

### 2.2 Alembic Migration
New migration adding `avatar_url VARCHAR(512) NULL` to the `users` table.

### 2.3 Auth Schemas (`backend/schemas/auth.py`)
- `UserResponse`: add `avatar_url: str | None = None`
- New schema `ProfileUpdate`: `display_name: str | None = None` (1–64 chars)

### 2.4 New Endpoints (`backend/routes/auth.py`)

**`PUT /auth/me`**
- Auth required
- Body: `ProfileUpdate` (`display_name` optional)
- Updates `user.display_name` in DB
- Returns updated `UserResponse`
- Status 200

**`POST /auth/avatar`**
- Auth required
- Body: `multipart/form-data` with field `file` (image)
- Accepts: `image/jpeg`, `image/png`, `image/webp` — rejects others with 422
- Max size: 5 MB — rejects larger with 413
- Saves to `backend/static/avatars/{user_id}.{ext}` (overwrites previous)
- Sets `user.avatar_url = "/static/avatars/{user_id}.{ext}"`
- Returns `UserResponse`
- Status 200

**Static file serving**
Mount `backend/static/` at `/static` in `main.py` via `StaticFiles` — this does not exist yet and must be added:
```python
from fastapi.staticfiles import StaticFiles
app.mount("/static", StaticFiles(directory="static", check_dir=False), name="static")
```
Create `backend/static/avatars/` directory (add a `.gitkeep`).

---

## 3. Frontend Changes

### 3.1 `UserProfile` interface (`frontend/services/authApi.ts`)
```ts
export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;  // new
  is_active: boolean;
}
```

### 3.2 Auth context (`frontend/hooks/useAuth.ts` + `frontend/context/AuthContext.tsx`)
Add one method to `AuthState`:
```ts
updateProfile: (patch: { display_name?: string; avatar_url?: string }) => Promise<void>
```
Implementation: calls `PUT /auth/me` or receives the updated `UserProfile` from `POST /auth/avatar`, then calls `setUser(updatedProfile)` directly — no full re-fetch.

Add two API functions to `authApi.ts`:
```ts
export async function updateMe(patch: { display_name?: string }): Promise<UserProfile>
export async function uploadAvatar(imageUri: string): Promise<UserProfile>
```
`uploadAvatar` builds a `FormData` object from the local image URI and posts to `/auth/avatar`.

**Avatar URL resolution:** The backend stores and returns a relative path (e.g. `/static/avatars/abc123.jpg`). The `Avatar` component must construct the full URI by prepending `API_BASE` from `@/services/apiClient`:
```ts
import { API_BASE } from '@/services/apiClient';
const resolvedUri = uri?.startsWith('http') ? uri : `${API_BASE}${uri}`;
```
This means `avatar_url` values starting with `http` (future CDN/R2 URLs) pass through unchanged.

### 3.3 `Avatar` component (`frontend/components/Avatar.tsx`)

**Props:**
```ts
interface AvatarProps {
  uri?: string | null;
  displayName: string;
  size?: number;          // default 40
  showOnline?: boolean;   // green dot, default false
  glowColor?: string;     // neon ring, default none
  style?: StyleProp<ViewStyle>;
}
```

**Rendering:**
- Circle of `size × size`, `borderRadius: size / 2`
- If `uri` → `Image` source `{ uri }` filling the circle
- If no `uri` → initials fallback: max 2 chars from `displayName` (first char of each word), centered on a solid background. Background color is deterministically chosen from a fixed neon palette based on `displayName.charCodeAt(0) % palette.length` — same name always gets same color
- `showOnline`: absolute `size * 0.28` circle, `COLORS.neonLime`, 2px white border, `bottom: 0, right: 0`
- `glowColor`: applies `SHADOWS.neonGlow(glowColor, 0.6)` to outer container

**No external dependencies.** Uses React Native `Image`, `View`, `Text`, `StyleSheet` only.

### 3.4 Profile card in Settings (`frontend/app/(tabs)/settings.tsx`)

New section inserted above the AI Provider section:

```
┌─────────────────────────────────────┐  ← GlowCard (gradAurora, glowIntensity 0.15)
│                                     │
│  [Avatar 72px]   Leo Partis    ✎   │  ← tap ✎ to edit name inline
│   tap to change  dev@...            │
│                                     │
└─────────────────────────────────────┘
```

Behaviour:
- **Avatar tap** → `expo-image-picker` opens gallery (request permission if needed) → optimistic local preview immediately (set local URI state) → `uploadAvatar()` in background → on success `updateProfile({ avatar_url })` updates auth context → on failure revert local preview
- **Name edit** → tap ✎ icon → `display_name` becomes a `TextInput` (same font/style) → on blur or Enter → `updateMe({ display_name })` → `updateProfile({ display_name })` updates auth context
- **Email** → read-only `Text`, no edit affordance
- Section label: `PROFILO` (same style as other section labels)

Dependencies: `expo-image-picker` (install if not present)

### 3.5 FloatingTabBar (`frontend/components/FloatingTabBar.tsx`)

- Add `'settings'` to `TAB_CONFIG` with label `'Profilo'`
- Remove `href: null` from settings tab in `_layout.tsx` so it appears in the bar
- When user is loaded: render `<Avatar uri={user.avatar_url} displayName={user.display_name} size={24} />` wrapped in a `View` with a `1.5px` `COLORS.neonCyan` ring border when the tab is active
- When user is null or loading: render the `'👤'` emoji fallback unchanged

---

## 4. File Checklist

| File | Change |
|------|--------|
| `backend/models/user.py` | Add `avatar_url` column |
| `backend/auth/schemas.py` | Add `avatar_url` to response; add `ProfileUpdate` schema |
| `backend/auth/routes.py` | Add `PUT /auth/me`, `POST /auth/avatar` |
| `backend/main.py` | Mount `StaticFiles` at `/static` |
| `backend/migrations/versions/xxx_add_avatar_url.py` | Alembic migration |
| `frontend/services/authApi.ts` | Add `avatar_url` to `UserProfile`; add `updateMe`, `uploadAvatar` |
| `frontend/hooks/useAuth.ts` | Add `updateProfile` method |
| `frontend/context/AuthContext.tsx` | Expose `updateProfile` via context |
| `frontend/components/Avatar.tsx` | New component |
| `frontend/app/(tabs)/settings.tsx` | Add profile card section |
| `frontend/components/FloatingTabBar.tsx` | Replace Settings icon with Avatar |

---

## 5. Dependencies to Install

```bash
cd frontend && npx expo install expo-image-picker
```

No new backend dependencies (uses stdlib `shutil`, `pathlib`, FastAPI's `UploadFile`).

---

## 6. Error Handling

| Scenario | Handling |
|----------|----------|
| Image > 5 MB | Backend returns 413; frontend reverts optimistic preview |
| Non-image file type | Backend returns 422; frontend reverts optimistic preview |
| Upload fails (network) | Revert optimistic avatar preview |
| `PUT /auth/me` fails | Revert inline name edit |
| No camera/gallery permission | expo-image-picker handles denial gracefully |

---

## 7. Out of Scope

- Avatar cropping UI (use full image as-is)
- Profile photo from camera (gallery only for now)
- Avatar deletion / reset to initials
- Image compression before upload
