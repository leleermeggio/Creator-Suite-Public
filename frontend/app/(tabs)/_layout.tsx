import React, { useState } from 'react';
import { Text, Platform, View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { FONTS, COLORS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { Sidebar } from '@/components/Sidebar';
import { GestureDrawer } from '@/components/animated';
import { FloatingTabBar } from '@/components/FloatingTabBar';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isDesktop = Platform.OS === 'web' && width >= 1024;

  return (
    <View
      style={[
        styles.root,
        { flexDirection: isDesktop ? 'row' : 'column', backgroundColor: palette.bg },
      ]}
    >
      {/* Desktop: persistent sidebar */}
      {isDesktop && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
      )}

      {/* Mobile: gesture-driven drawer */}
      {!isDesktop && sidebarOpen && (
        <GestureDrawer isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </GestureDrawer>
      )}

      {/* Main tab content */}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={isDesktop ? undefined : (props: BottomTabBarProps) => <FloatingTabBar {...props} />}
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
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Progetti' }} />
          <Tabs.Screen name="agents" options={{ title: 'Agenti' }} />
          <Tabs.Screen name="quick-tools" options={{ title: 'Strumenti' }} />
          <Tabs.Screen name="activity" options={{ title: 'Attività' }} />
          <Tabs.Screen name="analytics" options={{ title: 'Analisi' }} />
          <Tabs.Screen name="settings" options={{ title: 'Profilo' }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hamburgerBtn: { marginRight: 16, padding: 4 },
  hamburgerIcon: { fontSize: 22 },
});
