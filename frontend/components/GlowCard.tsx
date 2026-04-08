import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ViewStyle,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING, SHADOWS, BORDERS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface GlowCardProps {
  children: React.ReactNode;
  variant?: 'glow' | 'subtle';
  gradient?: readonly string[];
  onPress?: () => void;
  style?: ViewStyle;
  glowIntensity?: number;
  borderWidth?: number;
  entranceDelay?: number;
}

export function GlowCard({
  children,
  variant = 'glow',
  gradient = COLORS.gradCyan,
  onPress,
  style,
  glowIntensity = 0.5,
  borderWidth = 1.5,
  entranceDelay = 0,
}: GlowCardProps) {
  const { palette } = useTheme();
  const scale = useSharedValue(1);
  const entrance = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      entrance.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
    }, entranceDelay);
    return () => clearTimeout(t);
  }, []);

  const animatedOuter = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateY: interpolate(entrance.value, [0, 1], [18, 0]) },
      { scale: scale.value },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 14, stiffness: 380 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 380 });
  };

  const isSubtle = variant === 'subtle';

  const content = isSubtle ? (
    <Animated.View
      style={[
        styles.outer,
        style,
        animatedOuter,
      ]}
    >
      <View
        style={[
          styles.subtleCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
      >
        {children}
      </View>
    </Animated.View>
  ) : (
    <Animated.View style={[styles.outer, style, animatedOuter]}>
      {/* Glow background */}
      <View style={[styles.glowBg, SHADOWS.neonGlow(gradient[0], glowIntensity)]} />
      {/* Gradient border */}
      <LinearGradient
        colors={gradient as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderGradient, { borderRadius: RADIUS.lg }]}
      >
        <View
          style={[
            styles.inner,
            { margin: borderWidth, borderRadius: RADIUS.lg - borderWidth, backgroundColor: palette.card },
          ]}
        >
          {children}
        </View>
      </LinearGradient>
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...(Platform.OS === 'web'
          ? ({
              style: { cursor: 'pointer', transition: 'opacity 0.15s ease' } as any,
            })
          : {})}
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
  subtleCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...(Platform.OS === 'web' ? {
      transition: 'border-color 0.3s ease',
    } as any : {}),
  },
});
