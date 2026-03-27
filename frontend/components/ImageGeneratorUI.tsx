import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SOCIAL_FORMATS, type SocialFormat } from '@/services/pollinations';
import { post } from '@/services/apiClient';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

type Mode = 'thumbnail' | 'logo' | 'social-cover';

interface ImageGeneratorUIProps {
  onSave?: (uri: string, filename: string) => void;
  projectId?: string;
}

export function ImageGeneratorUI({ onSave, projectId }: ImageGeneratorUIProps) {
  const [mode, setMode] = useState<Mode>('thumbnail');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [batchResults, setBatchResults] = useState<Map<SocialFormat, string | null> | null>(null);

  const MODES: { id: Mode; label: string; icon: string; w: number; h: number }[] = [
    { id: 'thumbnail', label: 'Thumbnail', icon: '🖼️', w: 1280, h: 720 },
    { id: 'logo', label: 'Logo', icon: '💎', w: 512, h: 512 },
    { id: 'social-cover', label: 'Cover Social', icon: '📱', w: 1080, h: 1080 },
  ];

  const currentMode = MODES.find(m => m.id === mode)!;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setImageUri(null);
    setImageError(false);
    setImageLoading(false);
    try {
      const stylePrefix = mode === 'thumbnail'
        ? 'YouTube thumbnail style, bold text, expressive, high contrast, '
        : mode === 'logo'
        ? 'minimalist logo design, clean vector style, centered, '
        : 'social media cover image, vibrant, eye-catching, ';

      // Use mode-appropriate aspect ratios (backend caps at 768)
      const dims = mode === 'thumbnail'
        ? { width: 768, height: 512 }   // 3:2 landscape
        : mode === 'logo'
        ? { width: 512, height: 512 }   // 1:1 square
        : { width: 576, height: 768 };  // 3:4 portrait (social)

      const res = await post<{ image_base64: string; mime_type: string }>(
        '/tools/generate-image',
        { prompt: stylePrefix + prompt, ...dims },
      );
      setImageUri(`data:${res.mime_type};base64,${res.image_base64}`);
    } catch (e: any) {
      setImageError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    if (!prompt.trim()) return;
    setBatchLoading(true);
    setBatchResults(null);
    const results = new Map<SocialFormat, string | null>();
    const formats = Object.entries(SOCIAL_FORMATS) as [SocialFormat, (typeof SOCIAL_FORMATS)[SocialFormat]][];
    const stylePrefix = 'social media cover image, vibrant, eye-catching, ';

    for (let i = 0; i < formats.length; i++) {
      const [key, fmt] = formats[i];
      setBatchProgress(`Generando ${i + 1} di ${formats.length}... ${fmt.label}`);
      try {
        const w = fmt.width > 1024 ? 1024 : fmt.width;
        const h = fmt.height > 1024 ? 1024 : fmt.height;
        const res = await post<{ image_base64: string; mime_type: string }>(
          '/tools/generate-image',
          { prompt: stylePrefix + prompt, width: w, height: h },
        );
        results.set(key, `data:${res.mime_type};base64,${res.image_base64}`);
      } catch {
        results.set(key, null);
      }
    }
    setBatchResults(new Map(results));
    setBatchLoading(false);
    setBatchProgress('');
  };

  const handleSave = () => {
    if (!imageUri || !onSave) return;
    const filename = `ai-image-${mode}-${Date.now()}.jpg`;
    onSave(imageUri, filename);
  };

  const handleSaveBatch = () => {
    if (!batchResults || !onSave) return;
    batchResults.forEach((uri, key) => {
      if (uri) {
        const fmt = SOCIAL_FORMATS[key];
        onSave(uri, `ai-${mode}-${fmt.label.toLowerCase().replace(/ /g, '-')}-${Date.now()}.jpg`);
      }
    });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Mode selector */}
      <View style={styles.modeRow}>
        {MODES.map(m => (
          <Pressable
            key={m.id}
            onPress={() => setMode(m.id)}
            style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
          >
            {mode === m.id ? (
              <LinearGradient
                colors={['#FF00E5', '#FFE633'] as unknown as [string, string]}
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

      {/* Prompt input */}
      <TextInput
        style={styles.promptInput}
        placeholder="Descrivi l'immagine che vuoi generare..."
        placeholderTextColor={COLORS.textMuted}
        multiline
        value={prompt}
        onChangeText={setPrompt}
        numberOfLines={3}
      />

      {/* Generate buttons */}
      <View style={styles.btnRow}>
        <Pressable
          onPress={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={({ pressed }) => [{ flex: 1, opacity: pressed || !prompt.trim() ? 0.6 : 1 }]}
        >
          <LinearGradient
            colors={['#FF00E5', '#FFE633'] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateBtn}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} size="small" />
              : <Text style={styles.generateBtnText}>🎨 Genera</Text>
            }
          </LinearGradient>
        </Pressable>

        {mode === 'social-cover' && (
          <Pressable
            onPress={handleGenerateAll}
            disabled={batchLoading || !prompt.trim()}
            style={({ pressed }) => [{ flex: 1, opacity: pressed || !prompt.trim() ? 0.6 : 1 }]}
          >
            <View style={styles.allFormatsBtn}>
              {batchLoading
                ? <ActivityIndicator color={COLORS.neonMagenta} size="small" />
                : <Text style={styles.allFormatsBtnText}>📱 Tutti i formati</Text>
              }
            </View>
          </Pressable>
        )}
      </View>

      {loading && (
        <Text style={styles.progressText}>✨ Generazione in corso... (30–90 sec)</Text>
      )}
      {batchProgress ? (
        <Text style={styles.progressText}>{batchProgress}</Text>
      ) : null}

      {/* Single image preview */}
      {imageUri && !batchResults && (
        <View style={styles.previewSection}>
          <View>
            {imageError ? (
              <View style={[styles.previewImage, styles.imageOverlay]}>
                <Text style={styles.imageErrorIcon}>⚠️</Text>
                <Text style={styles.imageErrorText}>Generazione fallita. Riprova.</Text>
              </View>
            ) : (
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
            )}
          </View>
          <View style={styles.previewActions}>
            <Pressable
              onPress={handleGenerate}
              style={({ pressed }) => [styles.regenBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={styles.regenBtnText}>🔄 Rigenera</Text>
            </Pressable>
            {onSave && (
              <Pressable
                onPress={handleSave}
                style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}
              >
                <LinearGradient
                  colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>💾 Salva</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Batch results */}
      {batchResults && (
        <View style={styles.batchSection}>
          <View style={styles.batchGrid}>
            {(Object.entries(SOCIAL_FORMATS) as [SocialFormat, (typeof SOCIAL_FORMATS)[SocialFormat]][]).map(([key, fmt]) => {
              const uri = batchResults.get(key);
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
          {onSave && (
            <Pressable onPress={handleSaveBatch} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
              <LinearGradient
                colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Text style={styles.saveBtnText}>💾 Salva tutti</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: SPACING.md, paddingBottom: SPACING.xl },
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
  promptInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 80,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  btnRow: { flexDirection: 'row', gap: SPACING.sm },
  generateBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
  allFormatsBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF00E5' + '55',
  },
  allFormatsBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: '#FF00E5' },
  progressText: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  previewSection: { gap: SPACING.md },
  previewImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated, minHeight: 200 },
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
  batchSection: { gap: SPACING.md },
  batchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  batchItem: { width: '47%', gap: SPACING.xs },
  batchImage: { width: '100%', aspectRatio: 1, borderRadius: RADIUS.sm, backgroundColor: COLORS.bgElevated },
  batchError: { alignItems: 'center', justifyContent: 'center' },
  batchErrorText: { fontSize: 24, color: COLORS.textMuted },
  batchLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textMuted, textAlign: 'center' },
});
