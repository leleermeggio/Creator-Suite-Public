import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { IMAGE_PROVIDERS, type ImageProvider } from '@/types';

interface ProviderSelectorProps {
  provider: ImageProvider;
  setProvider: (provider: ImageProvider) => void;
}

export function ProviderSelector({ provider, setProvider }: ProviderSelectorProps) {
  const selectedProvider = IMAGE_PROVIDERS.find(p => p.id === provider) ?? IMAGE_PROVIDERS[0];

  return (
    <View style={styles.providerSection}>
      <Text style={styles.providerLabel}>Image Provider</Text>
      <View style={styles.providerRow}>
        {IMAGE_PROVIDERS.map(p => (
          <Pressable
            key={p.id}
            onPress={() => setProvider(p.id)}
            style={({ pressed }) => [
              styles.providerCard,
              provider === p.id && styles.providerCardActive,
              { opacity: pressed ? 0.8 : 1, flex: 1 },
            ]}
          >
            <Text style={[styles.providerName, provider === p.id && styles.providerNameActive]}>
              {p.name}
            </Text>
            <Text style={styles.providerDesc}>{p.description}</Text>
          </Pressable>
        ))}
      </View>
      {selectedProvider.requiresKey && (
        <Text style={styles.providerWarning}>
          ⚠️ Configure API key in Settings
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  providerSection: { gap: SPACING.xs },
  providerLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textMuted },
  providerRow: { flexDirection: 'row' as const, gap: SPACING.sm },
  providerCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  providerCardActive: {
    borderColor: COLORS.neonCyan,
    backgroundColor: COLORS.neonCyan + '15',
  },
  providerName: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  providerNameActive: { color: COLORS.neonCyan },
  providerDesc: { fontFamily: FONTS.bodyRegular, fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
  providerWarning: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.neonOrange, marginTop: SPACING.xs },
});
