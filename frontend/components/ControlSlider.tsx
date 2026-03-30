import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';
import { CONTROL_MODE_LABELS, type ControlMode } from '@/constants/agents';

const MODES: ControlMode[] = ['REGISTA', 'COPILOTA', 'AUTOPILOTA'];

interface ControlSliderProps {
  mode: ControlMode;
  onChange: (mode: ControlMode) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function ControlSlider({ mode, onChange, disabled = false, compact = false }: ControlSliderProps) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.elevated, borderColor: palette.border },
        compact && styles.containerCompact,
      ]}
    >
      {MODES.map((m) => {
        const isActive = m === mode;
        const meta = CONTROL_MODE_LABELS[m];
        return (
          <Pressable
            key={m}
            onPress={() => !disabled && onChange(m)}
            style={({ pressed }) => [
              styles.segment,
              compact && styles.segmentCompact,
              isActive && {
                backgroundColor: palette.sidebarActive,
                borderColor: palette.borderActive,
              },
              pressed && !disabled && { opacity: 0.8 },
              disabled && { opacity: 0.5 },
              Platform.OS === 'web' && ({ cursor: disabled ? 'default' : 'pointer' } as any),
            ]}
          >
            <Text style={[styles.emoji, compact && styles.emojiCompact]}>{meta.emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: isActive ? palette.cyan : palette.textSecondary },
                compact && styles.labelCompact,
              ]}
            >
              {meta.label}
            </Text>
            {!compact && (
              <Text style={[styles.desc, { color: palette.textMuted }]}>{meta.desc}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    gap: 1,
  },
  containerCompact: {
    borderRadius: RADIUS.md,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: RADIUS.md,
    gap: 2,
  },
  segmentCompact: {
    paddingVertical: 6,
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 18,
  },
  emojiCompact: {
    fontSize: 14,
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  labelCompact: {
    fontSize: 11,
  },
  desc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
