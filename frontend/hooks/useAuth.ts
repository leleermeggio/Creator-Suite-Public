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
      } catch (err: any) {
        if (err?.status === 401) {
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

  return {
    user,
    loading,
    isLoggedIn: user !== null,
    login,
    logout,
  };
}
