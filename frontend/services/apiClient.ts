import AsyncStorage from '@react-native-async-storage/async-storage';

function resolveApiBase(): string {
  // Prefer explicit env var (set in .env.production or .env.development)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  // Web: use same host as the app, port 8000
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
  timeoutMs?: number; // Default: 30000 (30 seconds)
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

// Check if device is online before making requests
function checkOnlineStatus(): void {
  if (!navigator.onLine) {
    throw new ApiError(0, 'No internet connection. Check your network.');
  }
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<T> {
  // Check online status before request
  checkOnlineStatus();

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

  // Create AbortController for timeout
  const timeoutMs = options?.timeoutMs ?? 30000; // Default 30 seconds
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    let res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: options?.signal ?? abortController.signal,
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
          signal: options?.signal ?? abortController.signal,
        });
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const raw = data?.detail ?? data?.message ?? res.statusText;
      const message = Array.isArray(raw)
        ? raw.map((e: any) => e?.msg ?? String(e)).join(', ')
        : typeof raw === 'string'
          ? raw
          : String(raw);
      throw new ApiError(res.status, message);
    }

    // Handle 204 No Content
    if (res.status === 204) return undefined as unknown as T;

    clearTimeout(timeoutId);
    return res.json() as Promise<T>;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Check for timeout error
    if (error?.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs / 1000} seconds. Please try again.`);
    }
    
    // Re-throw other errors
    throw error;
  }
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
