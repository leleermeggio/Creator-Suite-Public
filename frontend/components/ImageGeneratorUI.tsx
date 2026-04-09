import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { post } from '@/services/apiClient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { IMAGE_PROVIDERS, type ImageProvider } from '@/types';
import { useSettings } from '@/hooks/useSettings';
import { SOCIAL_FORMATS, type SocialFormat } from '@/services/pollinations';

// Sub-components
import { StyleSelector, Mode, getModeDimensions } from './StyleSelector';
import { ImagePromptInput } from './ImagePromptInput';
import { ProviderSelector } from './ProviderSelector';
import { ImageResult } from './ImageResult';
import { BatchResults } from './BatchResults';

interface ImageGeneratorUIProps {
  onSave?: (uri: string, filename: string) => void;
  projectId?: string;
}

export function ImageGeneratorUI({ onSave, projectId }: ImageGeneratorUIProps) {
  const { settings } = useSettings();
  
  // State
  const [mode, setMode] = useState<Mode>('thumbnail');
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<ImageProvider>('stable-horde');
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [batchResults, setBatchResults] = useState<Map<SocialFormat, string | null> | null>(null);

  // Get current mode dimensions
  const currentMode = getModeDimensions(mode);

  // Generate single image
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setImageUri(null);
    setImageError(false);
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
        { 
          prompt: stylePrefix + prompt, 
          ...dims,
          provider,
          api_key: provider === 'nanobanana' ? settings.nanobananaApiKey : undefined,
        },
      );
      setImageUri(`data:${res.mime_type};base64,${res.image_base64}`);
    } catch (e: any) {
      setImageError(true);
    } finally {
      setLoading(false);
    }
  };

  // Generate all social formats
  const handleGenerateAll = async () => {
    if (!prompt.trim()) return;
    setBatchLoading(true);
    setBatchResults(null);
    const results = new Map<SocialFormat, string | null>();
    const formats = Object.entries(SOCIAL_FORMATS) as [SocialFormat, (typeof SOCIAL_FORMATS)[SocialFormat]][];
    const stylePrefix = 'social media cover image, vibrant, eye-catching, ';

    for (let i = 0; i < formats.length; i++) {
      const [key, fmt] = formats[i];
      setBatchProgress(`Generating ${i + 1} of ${formats.length}... ${fmt.label}`);
      try {
        const w = fmt.width > 1024 ? 1024 : fmt.width;
        const h = fmt.height > 1024 ? 1024 : fmt.height;
        const res = await post<{ image_base64: string; mime_type: string }>(
          '/tools/generate-image',
          { 
            prompt: stylePrefix + prompt, 
            width: w, 
            height: h,
            provider,
            api_key: provider === 'nanobanana' ? settings.nanobananaApiKey : undefined,
          },
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

  // Save single image
  const handleSave = () => {
    if (!imageUri || !onSave) return;
    const filename = `ai-image-${mode}-${Date.now()}.jpg`;
    onSave(imageUri, filename);
  };

  // Save all batch images
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
      <StyleSelector mode={mode} setMode={setMode} />

      {/* Provider selector */}
      <ProviderSelector provider={provider} setProvider={setProvider} />

      {/* Prompt input */}
      <ImagePromptInput prompt={prompt} setPrompt={setPrompt} />

      {/* Generate buttons */}
      <View style={styles.btnRow}>
        <Pressable
          onPress={handleGenerate}
          disabled={loading || !prompt.trim()}
          style={({ pressed }) => [{ flex: 1, opacity: pressed || !prompt.trim() ? 0.6 : 1 }]}
        >
          <LinearGradient
            colors={[COLORS.neonMagenta, COLORS.neonYellow] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateBtn}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} size="small" />
              : <Text style={styles.generateBtnText}>🎨 Generate</Text>
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
                : <Text style={styles.allFormatsBtnText}>📱 All formats</Text>
              }
            </View>
          </Pressable>
        )}
      </View>

      {/* Progress text */}
      {loading && (
        <Text style={styles.progressText}>✨ Generation in progress... (30-90 sec)</Text>
      )}
      {batchProgress ? (
        <Text style={styles.progressText}>{batchProgress}</Text>
      ) : null}

      {/* Single image result */}
      {imageUri && !batchResults && (
        <ImageResult
          imageUri={imageUri}
          mode={mode}
          loading={loading}
          error={imageError}
          onRegenerate={handleGenerate}
          onSave={handleSave}
        />
      )}

      {/* Batch results */}
      {batchResults && (
        <BatchResults results={batchResults} onSaveAll={handleSaveBatch} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { gap: SPACING.md, paddingBottom: SPACING.xl },
  btnRow: { flexDirection: 'row', gap: SPACING.sm },
  generateBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
  allFormatsBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.neonMagenta + '55',
  },
  allFormatsBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.neonMagenta },
  progressText: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
