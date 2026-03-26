import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/theme';

/**
 * Full-screen cosmic background with layered gradient orbs.
 */
export function CosmicBackground() {
  return (
    <View style={styles.container} pointerEvents="none">
      {/* Base dark */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.bg }]} />

      {/* Top-left cyan orb */}
      <View style={[styles.orb, styles.orbCyan]} />

      {/* Bottom-right magenta orb */}
      <View style={[styles.orb, styles.orbMagenta]} />

      {/* Center violet subtle */}
      <View style={[styles.orb, styles.orbViolet]} />

      {/* Grid overlay (web only) */}
      {Platform.OS === 'web' && <View style={styles.grid} />}

      {/* Noise texture overlay */}
      <View style={styles.noise} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 9999,
  },
  orbCyan: {
    top: -120,
    left: -80,
    width: 400,
    height: 400,
    backgroundColor: COLORS.neonCyan,
    opacity: 0.06,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore
          filter: 'blur(120px)',
        }
      : {}),
  },
  orbMagenta: {
    bottom: -100,
    right: -60,
    width: 350,
    height: 350,
    backgroundColor: COLORS.neonMagenta,
    opacity: 0.06,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore
          filter: 'blur(100px)',
        }
      : {}),
  },
  orbViolet: {
    top: '40%',
    left: '30%',
    width: 300,
    height: 300,
    backgroundColor: COLORS.neonViolet,
    opacity: 0.04,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore
          filter: 'blur(140px)',
        }
      : {}),
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }
      : {}),
  },
  noise: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.015,
    ...(Platform.OS === 'web'
      ? {
          // @ts-ignore
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }
      : {}),
  },
});
