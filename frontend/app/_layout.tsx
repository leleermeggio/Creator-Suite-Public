import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  InterTight_400Regular,
  InterTight_500Medium,
  InterTight_600SemiBold,
  InterTight_700Bold,
} from '@expo-google-fonts/inter-tight';
import { COLORS } from '@/constants/theme';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuthContext();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inLogin = segments[0] === 'login';
    if (!isLoggedIn && !inLogin) {
      router.replace('/login');
    } else if (isLoggedIn && inLogin) {
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    InterTight_400Regular,
    InterTight_500Medium,
    InterTight_600SemiBold,
    InterTight_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  return (
    <AuthProvider>
      <AuthGate>
        <StatusBar style="light" />
        {Platform.OS === 'web' && <WebGlobalStyles />}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: COLORS.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tool/[id]" />
          <Stack.Screen name="project/[id]" />
          <Stack.Screen name="new-project/index" />
          <Stack.Screen name="new-project/ai-setup" />
          <Stack.Screen name="new-project/customize" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}

function WebGlobalStyles() {
  if (Platform.OS !== 'web') return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          * { box-sizing: border-box; margin: 0; padding: 0; }
          html, body, #root {
            height: 100%;
            background: ${COLORS.bg};
            overflow-x: hidden;
          }
          body {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          /* Scrollbar styling */
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.1);
            border-radius: 3px;
          }
          ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
          /* Card entrance animation */
          @keyframes cardAppear {
            0% {
              opacity: 0;
              transform: translateY(30px) scale(0.95);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes slideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `,
      }}
    />
  );
}
