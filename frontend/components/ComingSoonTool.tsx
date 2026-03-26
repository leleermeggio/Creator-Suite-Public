import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

interface ComingSoonToolProps {
  icon: string;
  name: string;
}

export function ComingSoonTool({ icon, name }: ComingSoonToolProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Disponibile prossimamente</Text>
      </View>
      <Text style={styles.hint}>Usa il bot Telegram @CazZoneBot</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.xxxl,
  },
  icon: {
    fontSize: 64,
    opacity: 0.4,
  },
  name: {
    ...TYPO.h2,
    color: COLORS.textSecondary,
  },
  badge: {
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  hint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});
