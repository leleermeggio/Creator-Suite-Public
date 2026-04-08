import React from 'react';
import { Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

interface ToolPillProps {
  icon: string;
  name: string;
  gradient: readonly string[];
  onPress: () => void;
  dimmed?: boolean;
}

export function ToolPill({ icon, name, gradient, onPress, dimmed }: ToolPillProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.75 : dimmed ? 0.45 : 1 },
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      <LinearGradient
        colors={gradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.pill}
      >
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.name}>{name}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  icon: {
    fontSize: 14,
  },
  name: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.bg,
  },
});
