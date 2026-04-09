import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import type { Mode } from './StyleSelector';

interface ImageResultProps {
  imageUri: string | null;
  mode: Mode;
  loading: boolean;
  error: boolean;
  onRegenerate?: () => void;
  onSave?: () => void;
}

export function ImageResult({
  imageUri,
  mode,
  loading,
  error,
  onRegenerate,
  onSave,
}: ImageResultProps) {
  if (!imageUri && !loading) return null;

  return (
    <View style={styles.previewSection}>
      {loading ? (
        <View style={[styles.previewImage, styles.imageOverlay]}>
          <ActivityIndicator color={COLORS.neonCyan} size="large" />
          <Text style={styles.imageLoadingText}>✨ Generation in progress...</Text>
        </View>
      ) : error ? (
        <View style={[styles.previewImage, styles.imageOverlay]}>
          <Text style={styles.imageErrorIcon}>⚠️</Text>
          <Text style={styles.imageErrorText}>Generation failed. Try again.</Text>
        </View>
      ) : imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.previewImage,
            mode === 'thumbnail' && { aspectRatio: 3 / 2 },
            mode === 'logo' && { aspectRatio: 1 },
            mode === 'social-cover' && { aspectRatio: 3 / 4 },
          ]}
          resizeMode="contain"
        />
      ) : null}

      {imageUri && !error && (
        <View style={styles.previewActions}>
          {onRegenerate && (
            <Pressable
              onPress={onRegenerate}
              style={({ pressed }) => [styles.regenBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.regenBtnText}>🔄 Regenerate</Text>
            </Pressable>
          )}
          {onSave && (
            <Pressable
              onPress={onSave}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
            >
              <LinearGradient
                colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Text style={styles.saveBtnText}>💾 Save</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  previewSection: { gap: SPACING.md },
  previewImage: {
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
  previewActions: { flexDirection: 'row', gap: SPACING.sm },
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
