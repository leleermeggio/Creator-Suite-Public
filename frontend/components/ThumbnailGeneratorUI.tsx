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
import { generateThumbnail, type ThumbnailGenerateParams } from '@/services/thumbnailApi';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

// Sub-components
import { StyleSelector, Mode as ImageMode } from './StyleSelector';
import { TemplatePicker, TEMPLATES } from './TemplatePicker';
import { TextCustomizer } from './TextCustomizer';
import { ThumbnailPreview } from './ThumbnailPreview';
import { FreeGenerationUI } from './FreeGenerationUI';

interface ThumbnailGeneratorUIProps {
  projectId?: string;
  onSave?: (uri: string, filename: string) => void;
}

const IMAGE_MODES = [
  { id: 'thumbnail' as ImageMode, label: 'Thumbnail', icon: '🖼️', description: 'YouTube thumbnail with template' },
  { id: 'logo' as ImageMode, label: 'Logo', icon: '💎', description: 'Logo or icon (512×512)' },
  { id: 'cover' as ImageMode, label: 'Cover', icon: '📱', description: 'Social cover (1080×1080)' },
  { id: 'free' as ImageMode, label: 'Free Generation', icon: '✨', description: 'Generate images from description' },
];

export function ThumbnailGeneratorUI({ projectId, onSave }: ThumbnailGeneratorUIProps) {
  // State
  const [mode, setMode] = useState<ImageMode>('thumbnail');
  const [selectedTemplate, setSelectedTemplate] = useState('impact');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [accentColor, setAccentColor] = useState('#FF0000');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUri, setResultUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');

  // Free generation state (managed by sub-component)
  const [freePrompt, setFreePrompt] = useState('');
  const [provider, setProvider] = useState<'nanobanana' | 'stable-horde'>('nanobanana');

  // Generate thumbnail with template
  const handleGenerate = async () => {
    if (!title.trim()) { setError('Enter a title.'); return; }
    if (!projectId) { setError('Open a project to generate thumbnails.'); return; }
    setLoading(true);
    setError(null);
    setResultUri(null);
    setStatusText('Generating AI background...');
    try {
      const params: ThumbnailGenerateParams = {
        project_id: projectId,
        template_id: selectedTemplate,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        accent_color: accentColor,
        subject_photo_b64: photoBase64 ?? undefined,
      };
      setStatusText('Compositing with Pillow...');
      const url = await generateThumbnail(params);
      setResultUri(url);
      setStatusText('');
    } catch (e: any) {
      setError(e?.message ?? 'Error during generation.');
    } finally {
      setLoading(false);
    }
  };

  // Save result
  const handleSave = () => {
    if (!resultUri || !onSave) return;
    onSave(resultUri, `${mode}-${selectedTemplate}-${Date.now()}.png`);
  };

  // Get available templates based on mode
  const availableTemplates = mode === 'thumbnail' 
    ? TEMPLATES 
    : mode === 'logo'
    ? TEMPLATES.filter(t => ['minimal', 'bold-side', 'neon'].includes(t.id))
    : TEMPLATES.filter(t => ['impact', 'minimal', 'gradient-bar'].includes(t.id));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Mode selector */}
      <Text style={styles.sectionLabel}>IMAGE TYPE</Text>
      <View style={styles.modeRow}>
        {IMAGE_MODES.map(m => (
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

      {/* Mode info */}
      {mode !== 'thumbnail' && mode !== 'free' && (
        <Text style={styles.modeInfo}>
          {mode === 'logo' ? '💎 Square format 512×512px, ideal for logos and icons' : '📱 Square format 1080×1080px, perfect for social posts'}
        </Text>
      )}

      {mode === 'free' && (
        <Text style={styles.modeInfo}>
          ✨ Generate custom images from a text description, without template constraints
        </Text>
      )}

      {/* Template-based UI (thumbnail/logo/cover) */}
      {mode !== 'free' && (
        <>
          {/* Template grid */}
          <TemplatePicker 
            selectedTemplate={selectedTemplate} 
            setSelectedTemplate={setSelectedTemplate}
            availableTemplates={availableTemplates}
          />

          {/* Text customization */}
          <TextCustomizer
            title={title}
            setTitle={setTitle}
            subtitle={subtitle}
            setSubtitle={setSubtitle}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            photoBase64={photoBase64}
            photoPreview={photoPreview}
            setPhotoBase64={setPhotoBase64}
            setPhotoPreview={setPhotoPreview}
          />

          {/* Generate button */}
          <Pressable onPress={handleGenerate} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }, { marginTop: SPACING.lg }]}>
            <LinearGradient
              colors={[COLORS.neonMagenta, COLORS.neonYellow] as unknown as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.generateBtn}
            >
              {loading
                ? <><ActivityIndicator color="#000" size="small" /><Text style={styles.generateBtnText}>  {statusText || 'Generating...'}</Text></>
                : <Text style={styles.generateBtnText}>🎨 Generate Thumbnail</Text>
              }
            </LinearGradient>
          </Pressable>
        </>
      )}

      {/* Free generation UI */}
      {mode === 'free' && (
        <FreeGenerationUI
          mode="cover"
          loading={loading}
          statusText={statusText}
          error={error}
          resultUri={resultUri}
          setFreePrompt={setFreePrompt}
          setProvider={setProvider}
          setResultUri={setResultUri}
          setError={setError}
          setStatusText={setStatusText}
          setLoading={setLoading}
        />
      )}

      {/* Error display */}
      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

      {/* Result preview */}
      <ThumbnailPreview
        resultUri={resultUri}
        loading={loading}
        error={error}
        statusText={statusText}
        onRegenerate={mode === 'free' ? undefined : handleGenerate}
        onSave={handleSave}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.sm, paddingBottom: SPACING.xl },
  sectionLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5, marginTop: SPACING.md },
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
  modeInfo: { fontFamily: FONTS.bodyRegular, fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.xs },
  generateBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: '#000' },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonPink, marginTop: SPACING.sm },
});
