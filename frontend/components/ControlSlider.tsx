import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
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
  const activeIndex = MODES.indexOf(mode);

  // Animated highlight position
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      useNativeDriver: false,
      tension: 180,
      friction: 20,
    }).start();
  }, [activeIndex, slideAnim]);

  const handleChange = (m: ControlMode) => {
    if (disabled || m === mode) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onChange(m);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.elevated, borderColor: palette.border },
        compact && styles.containerCompact,
      ]}
    >
      {MODES.map((m, idx) => {
        const isActive = m === mode;
        const meta = CONTROL_MODE_LABELS[m];
        return (
          <Pressable
            key={m}
            onPress={() => handleChange(m)}
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
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            accessibilityLabel={meta.label}
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
    // Minimum touch target: 44pt tall (Apple HIG)
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: RADIUS.md,
    gap: 2,
  },
  segmentCompact: {
    minHeight: 44,
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
