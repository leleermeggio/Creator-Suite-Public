import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

interface ThumbnailPreviewProps {
  resultUri: string | null;
  loading: boolean;
  error: string | null;
  statusText: string;
  onRegenerate?: () => void;
  onSave?: () => void;
}

export function ThumbnailPreview({
  resultUri,
  loading,
  error,
  statusText,
  onRegenerate,
  onSave,
}: ThumbnailPreviewProps) {
  if (!resultUri && !loading && !error) return null;

  return (
    <View style={styles.resultSection}>
      {loading ? (
        <View style={[styles.resultImage, styles.imageOverlay]}>
          <ActivityIndicator color={COLORS.neonCyan} size="large" />
          <Text style={styles.imageLoadingText}>✨ {statusText || 'Generation in progress...'}</Text>
        </View>
      ) : error ? (
        <View style={[styles.resultImage, styles.imageOverlay]}>
          <Text style={styles.imageErrorIcon}>⚠️</Text>
          <Text style={styles.imageErrorText}>{error}</Text>
        </View>
      ) : resultUri ? (
        <Image source={{ uri: resultUri }} style={styles.resultImage} resizeMode="contain" />
      ) : null}

      {resultUri && !error && (
        <View style={styles.resultActions}>
          {onRegenerate && (
            <Pressable onPress={onRegenerate} style={styles.regenBtn}>
              <Text style={styles.regenBtnText}>🔄 Regenerate</Text>
            </Pressable>
          )}
          {onSave && (
            <Pressable onPress={onSave} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
              <LinearGradient
                colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Text style={styles.saveBtnText}>💾 Save to phase</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

import { ActivityIndicator } from 'react-native';

const styles = StyleSheet.create({
  resultSection: { gap: SPACING.md, marginTop: SPACING.lg },
  resultImage: {
    width: '100%', 
    aspectRatio: 16 / 9, 
    borderRadius: RADIUS.md, 
    backgroundColor: COLORS.bgElevated,
    minHeight: 200,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bgElevated + 'DD',
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  imageLoadingText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  imageErrorIcon: { fontSize: 32 },
  imageErrorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonPink },
  resultActions: { flexDirection: 'row', gap: SPACING.sm },
  regenBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  saveBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
});
