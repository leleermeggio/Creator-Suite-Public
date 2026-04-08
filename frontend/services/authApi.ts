import AsyncStorage from '@react-native-async-storage/async-storage';
import { post, get } from './apiClient';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
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
