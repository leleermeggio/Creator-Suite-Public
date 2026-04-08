import React, { useMemo, useEffect } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const STAR_COUNT = 80;

interface StarData {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  color: string;
}

function Star({ x, y, size, delay, duration, color }: StarData) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.15, { duration, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

const STAR_COLORS = [
  'rgba(255,255,255,0.9)',
  'rgba(0,245,255,0.8)',
  'rgba(139,92,246,0.7)',
  'rgba(255,0,229,0.6)',
];

/**
 * Full-screen cosmic background with twinkling stars and gradient orbs.
 */
export function CosmicBackground() {
  const { width, height } = useWindowDimensions();

  const stars = useMemo<StarData[]>(() => {
    const list: StarData[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      list.push({
        x: Math.random() * (width || 400),
        y: Math.random() * (height || 800),
        size: Math.random() * 2 + 0.8,
        delay: Math.floor(Math.random() * 3000),
        duration: 1500 + Math.floor(Math.random() * 2500),
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }
    return list;
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]} />

      {/* Twinkling stars */}
      {stars.map((s, i) => (
        <Star key={i} {...s} />
      ))}

      {/* Top-left cyan orb */}
      <View style={[styles.orb, styles.orbCyan, Platform.OS === 'web' && webOrb.cyan]} />

      {/* Bottom-right magenta orb */}
      <View style={[styles.orb, styles.orbMagenta, Platform.OS === 'web' && webOrb.magenta]} />

      {/* Center violet subtle */}
      <View style={[styles.orb, styles.orbViolet, Platform.OS === 'web' && webOrb.violet]} />

      {Platform.OS === 'web' && <View style={[styles.grid, webOrb.grid]} />}
      <View style={[styles.noise, Platform.OS === 'web' && webOrb.noise]} />
    </View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbCyan: {
    top: -120, left: -80, width: 400, height: 400,
    backgroundColor: COLORS.neonCyan, opacity: 0.06,
  },
  orbMagenta: {
    bottom: -100, right: -60, width: 350, height: 350,
    backgroundColor: COLORS.neonMagenta, opacity: 0.06,
  },
  orbViolet: {
    top: '40%', left: '30%', width: 300, height: 300,
    backgroundColor: COLORS.neonViolet, opacity: 0.04,
  },
  grid: {
    ...StyleSheet.absoluteFillObject, opacity: 0.03,
  },
  noise: {
    ...StyleSheet.absoluteFillObject, opacity: 0.015,
  },
});

// Web-only CSS applied inline to bypass StyleSheet validation
const webOrb: Record<string, any> = Platform.OS === 'web' ? {
  cyan: { filter: 'blur(120px)' },
  magenta: { filter: 'blur(100px)' },
  violet: { filter: 'blur(140px)' },
  grid: {
    backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
    backgroundSize: '60px 60px',
  },
  noise: {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat',
  },
} : {};
