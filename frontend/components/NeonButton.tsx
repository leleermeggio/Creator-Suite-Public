import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  Platform,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, FONTS, SHADOWS } from '@/constants/theme';

interface NeonButtonProps {
  label: string;
  onPress: () => void;
  gradient?: readonly string[];
  style?: ViewStyle;
  size?: 'sm' | 'md' | 'lg';
}

export function NeonButton({
  label,
  onPress,
  gradient = COLORS.gradCyan,
  style,
  size = 'md',
}: NeonButtonProps) {
  const padV = size === 'sm' ? 10 : size === 'md' ? 14 : 18;
  const padH = size === 'sm' ? 20 : size === 'md' ? 28 : 36;
  const fontSize = size === 'sm' ? 13 : size === 'md' ? 15 : 17;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { transform: [{ scale: pressed ? 0.96 : 1 }] },
        Platform.OS === 'web' && {
          cursor: 'pointer' as any,
          transition: 'all 0.2s ease' as any,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingVertical: padV,
            paddingHorizontal: padH,
          },
          SHADOWS.neonGlow(gradient[0], 0.4),
        ]}
      >
        <Text style={[styles.label, { fontSize }]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
});
