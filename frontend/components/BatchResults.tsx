import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { SOCIAL_FORMATS, type SocialFormat } from '@/services/pollinations';

interface BatchResultsProps {
  results: Map<SocialFormat, string | null>;
  onSaveAll?: () => void;
}

export function BatchResults({ results, onSaveAll }: BatchResultsProps) {
  return (
    <View style={styles.batchSection}>
      <View style={styles.batchGrid}>
        {(Object.entries(SOCIAL_FORMATS) as [SocialFormat, (typeof SOCIAL_FORMATS)[SocialFormat]][]).map(([key, fmt]) => {
          const uri = results.get(key);
          return (
            <View key={key} style={styles.batchItem}>
              {uri ? (
                <Image source={{ uri }} style={styles.batchImage} resizeMode="cover" />
              ) : (
                <View style={[styles.batchImage, styles.batchError]}>
                  <Text style={styles.batchErrorText}>✕</Text>
                </View>
              )}
              <Text style={styles.batchLabel}>{fmt.label}</Text>
            </View>
          );
        })}
      </View>
      {onSaveAll && (
        <Pressable onPress={onSaveAll} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
          <LinearGradient
            colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            <Text style={styles.saveBtnText}>💾 Save all</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  batchSection: { gap: SPACING.md },
  batchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  batchItem: { width: '47%', gap: SPACING.xs },
  batchImage: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgElevated },
  batchError: { alignItems: 'center', justifyContent: 'center' },
  batchErrorText: { fontSize: 24, color: COLORS.textMuted },
  batchLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
  saveBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
});
