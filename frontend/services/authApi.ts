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
  if (!token) throw new ApiError(401, 'Not authenticated');
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
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { detail?: string })?.detail ?? res.statusText);
  }
  return res.json() as Promise<UserProfile>;
}
