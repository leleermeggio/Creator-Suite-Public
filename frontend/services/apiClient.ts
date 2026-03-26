import AsyncStorage from '@react-native-async-storage/async-storage';

function resolveApiBase(): string {
  if (typeof window !== 'undefined' && window?.location?.hostname) {
    const { hostname, protocol } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  return 'http://127.0.0.1:8000';
}

export const API_BASE = resolveApiBase();

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  skipAuth?: boolean;
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem('auth_refresh_token');
  if (!refreshToken) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  await AsyncStorage.setItem('auth_access_token', data.access_token);
  await AsyncStorage.setItem('auth_refresh_token', data.refresh_token);
  return data.access_token as string;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  const token = options?.skipAuth
    ? null
    : await AsyncStorage.getItem('auth_access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  });

  // On 401 attempt a single token refresh and retry
  if (res.status === 401 && !options?.skipAuth) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.detail ?? data?.message ?? res.statusText;
    throw new ApiError(res.status, message);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>('GET', path, undefined, options);
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>('POST', path, body, options);
}

export function put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>('PUT', path, body, options);
}

export function del<T>(path: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>('DELETE', path, undefined, options);
}
