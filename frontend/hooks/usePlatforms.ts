import { useState, useEffect, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  getPlatformStatus,
  connectPlatform,
  disconnectPlatform,
  PlatformStatusItem,
} from '@/services/platformsApi';

export function usePlatforms() {
  const [platforms, setPlatforms] = useState<PlatformStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPlatformStatus();
      setPlatforms(data.platforms);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore caricamento piattaforme';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connect = useCallback(async (platform: string) => {
    try {
      const { auth_url } = await connectPlatform(platform);
      await WebBrowser.openBrowserAsync(auth_url);
      // Refresh status after OAuth flow completes
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore connessione piattaforma';
      setError(msg);
    }
  }, [refresh]);

  const disconnect = useCallback(async (platform: string) => {
    try {
      await disconnectPlatform(platform);
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore disconnessione piattaforma';
      setError(msg);
    }
  }, [refresh]);

  return { platforms, loading, error, connect, disconnect, refresh };
}
