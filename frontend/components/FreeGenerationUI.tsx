import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator } from 'react-native';
import { post } from '@/services/apiClient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { IMAGE_PROVIDERS, type ImageProvider } from '@/types';
import { useSettings } from '@/hooks/useSettings';

interface FreeGenerationUIProps {
  mode: 'logo' | 'cover';
  loading: boolean;
  statusText: string;
  error: string | null;
  resultUri: string | null;
  setFreePrompt: (prompt: string) => void;
  setProvider: (provider: ImageProvider) => void;
  setResultUri: (uri: string | null) => void;
  setError: (error: string | null) => void;
  setStatusText: (text: string) => void;
  setLoading: (loading: boolean) => void;
}

export function FreeGenerationUI({
  mode,
  loading,
  statusText,
  error,
  resultUri,
  setFreePrompt,
  setProvider,
  setResultUri,
  setError,
  setStatusText,
  setLoading,
}: FreeGenerationUIProps) {
  const { settings } = useSettings();
  const [freePrompt, setLocalFreePrompt] = React.useState('');
  const [provider, setLocalProvider] = React.useState<ImageProvider>('nanobanana');

  // Sync with parent state
  React.useEffect(() => {
    setFreePrompt(freePrompt);
  }, [freePrompt]);

  const handleGenerateFree = async () => {
    if (!freePrompt.trim()) { setError('Enter a description.'); return; }
    setLoading(true);
    setError(null);
    setResultUri(null);
    setStatusText('Generating AI image...');
    try {
      const dims = mode === 'logo' 
        ? { width: 512, height: 512 } 
        : mode === 'cover'
        ? { width: 1080, height: 1080 }
        : { width: 1280, height: 720 };

      const res = await post<{ image_base64: string; mime_type: string }>(
        '/tools/generate-image',
        { 
          prompt: freePrompt.trim(), 
          ...dims,
          provider,
          api_key: provider === 'nanobanana' ? settings.nanobananaApiKey : undefined,
        },
      );
      setResultUri(`data:${res.mime_type};base64,${res.image_base64}`);
      setStatusText('');
    } catch (e: any) {
      setError(e?.message ?? 'Error during generation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Provider selector */}
      <Text style={styles.sectionLabel}>IMAGE PROVIDER</Text>
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
      {provider === 'nanobanana' && !settings.nanobananaApiKey && (
        <Text style={styles.providerWarning}>
          ⚠️ Configure NanoBanana API key in Settings
        </Text>
      )}

      {/* Prompt input */}
      <Text style={styles.sectionLabel}>IMAGE DESCRIPTION</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="Describe the image you want to generate..."
        placeholderTextColor={COLORS.textMuted}
        multiline
        value={freePrompt}
        onChangeText={(val) => { setLocalFreePrompt(val); setFreePrompt(val); }}
        numberOfLines={4}
      />

      {/* Generate button */}
      <Pressable 
        onPress={handleGenerateFree} 
        disabled={loading || !freePrompt.trim()} 
        style={({ pressed }) => [{ opacity: pressed || loading || !freePrompt.trim() ? 0.7 : 1 }, { marginTop: SPACING.lg }]}
      >
        <LinearGradient
          colors={[COLORS.neonMagenta, COLORS.neonYellow] as unknown as [string, string]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={styles.generateBtn}
        >
          {loading
            ? <><ActivityIndicator color="#000" size="small" /><Text style={styles.generateBtnText}>  {statusText || 'Generating...'}</Text></>
            : <Text style={styles.generateBtnText}>✨ Generate Image</Text>
          }
        </LinearGradient>
      </Pressable>

      {/* Error display */}
      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { 
    fontFamily: FONTS.bodySemiBold, 
    fontSize: 11, 
    color: COLORS.textMuted, 
    letterSpacing: 1.5, 
    marginTop: SPACING.md 
  },
  providerRow: { flexDirection: 'row', gap: SPACING.sm },
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
  promptInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: COLORS.bgCard,
  },
  generateBtn: { 
    borderRadius: RADIUS.full, 
    paddingVertical: SPACING.md, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center' 
  },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: '#000' },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonPink, marginTop: SPACING.sm },
});
