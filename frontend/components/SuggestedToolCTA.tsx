import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

interface SuggestedToolCTAProps {
  icon: string;
  name: string;
  description: string;
  gradient: readonly string[];
  onPress: () => void;
}

export function SuggestedToolCTA({ icon, name, description, gradient, onPress }: SuggestedToolCTAProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        Platform.OS === 'web' && { cursor: 'pointer' as any, transition: 'all 0.15s ease' as any },
      ]}
    >
      <LinearGradient
        colors={gradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.left}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.label}>Prossimo passo</Text>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.desc} numberOfLines={1}>{description}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  left: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  right: { flex: 1, gap: 2 },
  label: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: 'rgba(0,0,0,0.6)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.bg,
  },
  desc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: 'rgba(0,0,0,0.55)',
  },
  arrow: {
    fontFamily: FONTS.displayBold,
    fontSize: 20,
    color: 'rgba(0,0,0,0.4)',
  },
});
