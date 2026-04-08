import { get, post, del } from '@/services/apiClient';

export interface PlatformStatusItem {
  platform: string;
  connected: boolean;
  username: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
}

export interface PlatformStatusResponse {
  platforms: PlatformStatusItem[];
}

export interface PlatformConnectResponse {
  auth_url: string;
}

export function getPlatformStatus(): Promise<PlatformStatusResponse> {
  return get<PlatformStatusResponse>('/platforms/status');
}

export function connectPlatform(platform: string): Promise<PlatformConnectResponse> {
  return post<PlatformConnectResponse>(`/platforms/${platform}/connect`);
}

export function disconnectPlatform(platform: string): Promise<void> {
  return del<void>(`/platforms/${platform}/disconnect`);
}
