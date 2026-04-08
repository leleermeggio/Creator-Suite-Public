import React from 'react';
import { Pressable, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';

interface ThemeToggleProps {
  compact?: boolean;
}

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { isDark, toggleTheme, palette } = useTheme();

  return (
    <Pressable
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.btn,
        compact ? styles.btnCompact : styles.btnFull,
        {
          backgroundColor: palette.elevated,
          borderColor: palette.border,
        },
        pressed && { opacity: 0.7 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Passa a tema chiaro' : 'Passa a tema scuro'}
    >
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      {!compact && (
        <Text style={[styles.label, { color: palette.textSecondary }]}>
          {isDark ? 'Tema chiaro' : 'Tema scuro'}
        </Text>
      )}
      {!compact && Platform.OS === 'web' && (
        <Text style={[styles.shortcut, { color: palette.textMuted }]}>Ctrl+D</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  btnFull: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  btnCompact: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    flex: 1,
  },
  shortcut: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
