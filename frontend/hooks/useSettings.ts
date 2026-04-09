import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '@/services/storage';
import type { AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSettings();
        setSettings(s);
      } catch (error: unknown) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await saveSettings(updated);
  }, [settings]);

  return { settings, loading, update };
}
