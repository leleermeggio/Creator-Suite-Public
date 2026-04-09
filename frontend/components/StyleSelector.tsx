import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

export type Mode = 'thumbnail' | 'logo' | 'social-cover' | 'free' | 'cover';

interface StyleSelectorProps {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

const MODES: { id: Mode; label: string; icon: string; w: number; h: number }[] = [
  { id: 'thumbnail', label: 'Thumbnail', icon: '🖼️', w: 1280, h: 720 },
  { id: 'logo', label: 'Logo', icon: '💎', w: 512, h: 512 },
  { id: 'social-cover', label: 'Social Cover', icon: '📱', w: 1080, h: 1080 },
];

export function StyleSelector({ mode, setMode }: StyleSelectorProps) {
  return (
    <View style={styles.modeRow}>
      {MODES.map(m => (
        <Pressable
          key={m.id}
          onPress={() => setMode(m.id)}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
        >
          {mode === m.id ? (
            <LinearGradient
              colors={[COLORS.neonMagenta, COLORS.neonYellow] as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modeBtn}
            >
              <Text style={styles.modeBtnIcon}>{m.icon}</Text>
              <Text style={[styles.modeBtnLabel, { color: COLORS.bg }]}>{m.label}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.modeBtn, styles.modeBtnInactive]}>
              <Text style={styles.modeBtnIcon}>{m.icon}</Text>
              <Text style={[styles.modeBtnLabel, { color: COLORS.textMuted }]}>{m.label}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function getModeDimensions(mode: Mode) {
  return MODES.find(m => m.id === mode)!;
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: SPACING.sm },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  modeBtnInactive: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeBtnIcon: { fontSize: 14 },
  modeBtnLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
});
