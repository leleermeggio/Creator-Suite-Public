import React from 'react';
import { Text, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS, FONTS } from '@/constants/theme';

function TabIcon({ emoji }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.neonCyan,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontFamily: FONTS.bodyMedium,
          fontSize: 11,
          letterSpacing: 0.3,
        },
        tabBarStyle: {
          backgroundColor: 'rgba(6, 6, 12, 0.80)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.06)',
          height: Platform.select({ ios: 88, android: 64, web: 64 }),
          paddingBottom: Platform.select({ ios: 24, default: 8 }),
          paddingTop: 8,
          ...(Platform.OS === 'web'
            ? {
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }
            : {}),
        } as any,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Progetti',
          tabBarIcon: ({ color }) => <TabIcon emoji="📁" color={color} />,
        }}
      />
      <Tabs.Screen
        name="quick-tools"
        options={{
          title: 'Quick Tools',
          tabBarIcon: ({ color }) => <TabIcon emoji="⚡" color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Attività',
          tabBarIcon: ({ color }) => <TabIcon emoji="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon emoji="⚙️" color={color} />,
        }}
      />
    </Tabs>
  );
}
