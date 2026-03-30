import React, { useState } from 'react';
import {
  Text,
  Platform,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Tabs } from 'expo-router';
import { FONTS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from '@/components/Sidebar';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isDesktop = Platform.OS === 'web' && width >= 1024;

  const tabBarStyle = {
    backgroundColor: palette.bgSidebar,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    height: Platform.select({ ios: 88, android: 64, web: 64 }),
    paddingBottom: Platform.select({ ios: 24, default: 8 }),
    paddingTop: 8,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }
      : {}),
  };

  return (
    <View
      style={[
        styles.root,
        {
          flexDirection: isDesktop ? 'row' : 'column',
          backgroundColor: palette.bg,
        },
      ]}
    >
      {/* Desktop: persistent sidebar */}
      {isDesktop && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      )}

      {/* Mobile: overlay + drawer */}
      {!isDesktop && sidebarOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.overlay]}
          onPress={() => setSidebarOpen(false)}
        />
      )}
      {!isDesktop && sidebarOpen && (
        <View style={styles.mobileDrawer}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </View>
      )}

      {/* Main tab content */}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: !isDesktop,
            headerStyle: { backgroundColor: palette.bgSidebar },
            headerTintColor: palette.text,
            headerTitleStyle: {
              fontFamily: FONTS.displayBold,
              fontSize: 18,
              color: palette.text,
            },
            headerRight: !isDesktop
              ? () => (
                  <Pressable
                    onPress={() => setSidebarOpen(true)}
                    style={styles.hamburgerBtn}
                    hitSlop={8}
                  >
                    <Text style={[styles.hamburgerIcon, { color: palette.text }]}>☰</Text>
                  </Pressable>
                )
              : undefined,
            tabBarActiveTintColor: palette.cyan,
            tabBarInactiveTintColor: palette.textMuted,
            tabBarLabelStyle: {
              fontFamily: FONTS.bodyMedium,
              fontSize: 11,
              letterSpacing: 0.3,
            },
            tabBarStyle: isDesktop ? { display: 'none' } : (tabBarStyle as any),
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Progetti',
              tabBarIcon: () => <TabIcon emoji="📁" />,
            }}
          />
          <Tabs.Screen
            name="agents"
            options={{
              title: 'Agenti',
              tabBarIcon: () => <TabIcon emoji="🤖" />,
            }}
          />
          <Tabs.Screen
            name="quick-tools"
            options={{
              title: 'Strumenti',
              tabBarIcon: () => <TabIcon emoji="⚡" />,
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: 'Attività',
              tabBarIcon: () => <TabIcon emoji="📊" />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
  },
  mobileDrawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 101,
  },
  hamburgerBtn: {
    marginRight: 16,
    padding: 4,
  },
  hamburgerIcon: {
    fontSize: 22,
  },
});
