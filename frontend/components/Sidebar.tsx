import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useThemeContext } from '@/context/ThemeContext';
import { useAuthContext } from '@/context/AuthContext';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;

interface NavItem {
  id: string;
  label: string;
  emoji: string;
  href: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'projects', label: 'Progetti', emoji: '📁', href: '/(tabs)' },
  { id: 'agents', label: 'Agenti', emoji: '🤖', href: '/(tabs)/agents' },
  { id: 'tools', label: 'Strumenti Rapidi', emoji: '⚡', href: '/(tabs)/quick-tools' },
  { id: 'activity', label: 'Attività', emoji: '📊', href: '/(tabs)/activity' },
  { id: 'analytics', label: 'Analisi', emoji: '📈', href: '/(tabs)/analytics' },
];

const ACCOUNT_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Impostazioni', emoji: '⚙️', href: '/(tabs)/settings' },
  { id: 'subscription', label: 'Abbonamento', emoji: '💳', href: '/(tabs)/settings' },
  { id: 'profile', label: 'Profilo', emoji: '👤', href: '/(tabs)/settings' },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onClose?: () => void;
}

export function Sidebar({ collapsed = false, onToggleCollapse, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { palette, isDark, toggleTheme } = useThemeContext();
  const { user } = useAuthContext();

  const showLabels = !collapsed;
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const isActive = (href: string): boolean => {
    const clean = href.replace('/(tabs)', '').replace(/^\//, '') || 'index';
    if (clean === 'index' || clean === '') {
      return pathname === '/' || pathname === '/index' || pathname === '';
    }
    return pathname.includes(clean);
  };

  const navigate = (href: string) => {
    router.push(href as any);
    onClose?.();
  };

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: sidebarWidth,
          backgroundColor: palette.bgSidebar,
          borderRightColor: palette.border,
        },
        Platform.OS === 'web' && (styles.sidebarWeb as any),
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        {showLabels && (
          <Text style={[styles.logo, { color: palette.cyan }]}>Creator Zone</Text>
        )}
        <Pressable
          onPress={onToggleCollapse ?? onClose}
          style={styles.hamburger}
          hitSlop={8}
        >
          <Text style={[styles.hamburgerIcon, { color: palette.textSecondary }]}>
            {collapsed ? '☰' : '✕'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main nav */}
        <View style={styles.navSection}>
          {showLabels && (
            <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
              WORKSPACE
            </Text>
          )}
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Pressable
                key={item.id}
                onPress={() => navigate(item.href)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                  styles.navItem,
                  { borderRadius: RADIUS.md },
                  active && { backgroundColor: palette.sidebarActive },
                  (pressed || hovered) && !active && { backgroundColor: palette.elevated },
                  collapsed && styles.navItemCollapsed,
                ]}
              >
                <Text style={[styles.navEmoji, collapsed && { marginRight: 0 }]}>
                  {item.emoji}
                </Text>
                {showLabels && (
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: active ? palette.cyan : palette.textSecondary,
                        fontFamily: active ? FONTS.bodySemiBold : FONTS.bodyMedium,
                      },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                )}
                {item.badge != null && item.badge > 0 && (
                  <View style={[styles.badge, { backgroundColor: palette.cyan }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                {active && (
                  <View
                    style={[
                      styles.activeBar,
                      { backgroundColor: palette.cyan },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Account section */}
        <View
          style={[
            styles.navSection,
            styles.accountSection,
            { borderTopColor: palette.border },
          ]}
        >
          {showLabels && (
            <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>
              ACCOUNT
            </Text>
          )}
          {ACCOUNT_ITEMS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigate(item.href)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.navItem,
                { borderRadius: RADIUS.md },
                (pressed || hovered) && { backgroundColor: palette.elevated },
                collapsed && styles.navItemCollapsed,
              ]}
            >
              <Text style={[styles.navEmoji, collapsed && { marginRight: 0 }]}>
                {item.emoji}
              </Text>
              {showLabels && (
                <Text
                  style={[
                    styles.navLabel,
                    { color: palette.textSecondary, fontFamily: FONTS.bodyMedium },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.label}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Theme toggle */}
      <View style={[styles.themeRow, { borderTopColor: palette.border }]}>
        <Pressable
          onPress={toggleTheme}
          style={({ pressed }: { pressed: boolean }) => [
            styles.themeButton,
            {
              backgroundColor: pressed ? palette.elevated : 'transparent',
              borderRadius: RADIUS.md,
            },
            collapsed && styles.navItemCollapsed,
          ]}
        >
          <Text style={styles.navEmoji}>{isDark ? '☀️' : '🌙'}</Text>
          {showLabels && (
            <View style={{ flex: 1 }}>
              <Text style={[styles.navLabel, { color: palette.textSecondary, fontFamily: FONTS.bodyMedium }]}>
                {isDark ? 'Tema chiaro' : 'Tema scuro'}
              </Text>
              {Platform.OS === 'web' && (
                <Text style={[styles.shortcut, { color: palette.textMuted }]}>
                  Ctrl+D
                </Text>
              )}
            </View>
          )}
        </Pressable>
      </View>

      {/* Profile card */}
      {showLabels && user && (
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: palette.elevated,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: palette.violet }]}>
            <Text style={styles.avatarText}>
              {(user.display_name || user.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <Text
              style={[styles.profileName, { color: palette.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {user.display_name || user.email}
            </Text>
            <Text style={[styles.profilePlan, { color: palette.cyan }]}>
              Piano Gratuito
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  sidebarWeb: {
    height: '100vh' as any,
    position: 'sticky' as any,
    top: 0,
    alignSelf: 'flex-start' as any,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: Platform.select({ ios: 52, android: 16, web: 16, default: 16 }),
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  logo: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    letterSpacing: -0.5,
    flex: 1,
  },
  hamburger: {
    padding: 4,
    borderRadius: RADIUS.sm,
  },
  hamburgerIcon: {
    fontSize: 18,
  },
  scrollContent: {
    paddingBottom: SPACING.sm,
  },
  navSection: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  accountSection: {
    borderTopWidth: 1,
    marginTop: SPACING.sm,
  },
  sectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    gap: SPACING.sm,
    position: 'relative',
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    gap: 0,
  },
  navEmoji: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  badge: {
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 10,
    color: '#000',
  },
  activeBar: {
    position: 'absolute',
    right: 0,
    top: '20%',
    bottom: '20%',
    width: 3,
    borderRadius: 2,
  },
  themeRow: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderTopWidth: 1,
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  shortcut: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    margin: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: Platform.select({ ios: 28, default: SPACING.sm }),
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#fff',
  },
  profileName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },
  profilePlan: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    marginTop: 1,
  },
});
