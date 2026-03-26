import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';

interface GlowCardProps {
  children: React.ReactNode;
  gradient?: readonly string[];
  onPress?: () => void;
  style?: ViewStyle;
  glowIntensity?: number;
  borderWidth?: number;
}

export function GlowCard({
  children,
  gradient = COLORS.gradCyan,
  onPress,
  style,
  glowIntensity = 0.5,
  borderWidth = 1.5,
}: GlowCardProps) {
  const [hovered, setHovered] = useState(false);

  const content = (
    <View style={[styles.outer, style]}>
      {/* Glow background */}
      <View
        style={[
          styles.glowBg,
          SHADOWS.neonGlow(gradient[0], glowIntensity),
        ]}
      />
      {/* Gradient border */}
      <LinearGradient
        colors={gradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderGradient, { borderRadius: RADIUS.lg }]}
      >
        <View
          style={[
            styles.inner,
            {
              margin: borderWidth,
              borderRadius: RADIUS.lg - borderWidth,
            },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        {...(Platform.OS === 'web' ? {
          onMouseEnter: () => setHovered(true),
          onMouseLeave: () => setHovered(false),
        } : {})}
        style={({ pressed }) => [
          { transform: [{ scale: pressed ? 0.97 : hovered ? 1.015 : 1 }] },
          Platform.OS === 'web' && {
            cursor: 'pointer' as any,
            transition: 'transform 0.15s ease' as any,
          },
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
  },
  glowBg: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    bottom: '5%',
    borderRadius: RADIUS.lg,
  },
  borderGradient: {
    overflow: 'hidden',
  },
  inner: {
    backgroundColor: COLORS.bgCard,
    padding: SPACING.lg,
  },
});
