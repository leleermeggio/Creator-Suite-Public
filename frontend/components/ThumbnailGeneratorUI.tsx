import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Platform, Image, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { generateThumbnail, type ThumbnailGenerateParams } from '@/services/thumbnailApi';
import { post } from '@/services/apiClient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { IMAGE_PROVIDERS, type ImageProvider } from '@/types';
import { useSettings } from '@/hooks/useSettings';

interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const TEMPLATES: Template[] = [
  { id: 'impact',       label: 'Impact',        icon: '💥', description: 'Testo centrato, sfondo pieno' },
  { id: 'split',        label: 'Split',          icon: '👤', description: 'Foto sinistra, testo destra' },
  { id: 'gradient-bar', label: 'Gradient Bar',   icon: '📊', description: 'Scena + barra testo in basso' },
  { id: 'bold-side',    label: 'Bold Side',      icon: '🎨', description: 'Pannello colorato + immagine' },
  { id: 'minimal',      label: 'Minimal',        icon: '✦',  description: 'Sfondo scuro, titolo centrato' },
  { id: 'reaction',     label: 'Reaction',       icon: '😱', description: 'Volto grande + testo breve' },
  { id: 'neon',         label: 'Neon',           icon: '⚡', description: 'Testo al neon su sfondo scuro' },
  { id: 'cinematic',    label: 'Cinematic',      icon: '🎬', description: 'Barre letterbox + scena' },
];

const ACCENT_COLORS = [
  { hex: '#FF0000', label: 'Rosso' },
  { hex: '#2563EB', label: 'Blu' },
  { hex: '#16A34A', label: 'Verde' },
  { hex: '#FFE633', label: 'Giallo' },
  { hex: '#7C3AED', label: 'Viola' },
  { hex: '#06B6D4', label: 'Ciano' },
];

type ImageMode = 'thumbnail' | 'logo' | 'cover' | 'free';

interface ThumbnailGeneratorUIProps {
  projectId?: string;
  onSave?: (uri: string, filename: string) => void;
}

const IMAGE_MODES = [
  { id: 'thumbnail' as ImageMode, label: 'Thumbnail', icon: '🖼️', description: 'YouTube thumbnail con template' },
  { id: 'logo' as ImageMode, label: 'Logo', icon: '💎', description: 'Logo o icona (512×512)' },
  { id: 'cover' as ImageMode, label: 'Copertina', icon: '📱', description: 'Copertina social (1080×1080)' },
  { id: 'free' as ImageMode, label: 'Generazione Libera', icon: '✨', description: 'Genera immagini da descrizione' },
];

export function ThumbnailGeneratorUI({ projectId, onSave }: ThumbnailGeneratorUIProps) {
  const { settings } = useSettings();
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
  
  const [freePrompt, setFreePrompt] = useState('');
  const [provider, setProvider] = useState<ImageProvider>('nanobanana');

  const handlePickPhoto = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setPhotoPreview(dataUrl);
          setPhotoBase64(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } else {
      try {
        const ImagePicker = await import('expo-image-picker');
        const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.8 });
        if (res.canceled) return;
        const asset = res.assets[0];
        setPhotoPreview(asset.uri);
        setPhotoBase64(asset.base64 ?? null);
      } catch {
        setError('Impossibile aprire la galleria.');
      }
    }
  };

  const handleGenerate = async () => {
    if (!title.trim()) { setError('Inserisci un titolo.'); return; }
    if (!projectId) { setError('Apri un progetto per generare thumbnail.'); return; }
    setLoading(true);
    setError(null);
    setResultUri(null);
    setStatusText('Generando sfondo AI...');
    try {
      const params: ThumbnailGenerateParams = {
        project_id: projectId,
        template_id: selectedTemplate,
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        accent_color: accentColor,
        subject_photo_b64: photoBase64 ?? undefined,
      };
      setStatusText('Compositing con Pillow...');
      const url = await generateThumbnail(params);
      setResultUri(url);
      setStatusText('');
    } catch (e: any) {
      setError(e?.message ?? 'Errore durante la generazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFree = async () => {
    if (!freePrompt.trim()) { setError('Inserisci una descrizione.'); return; }
    setLoading(true);
    setError(null);
    setResultUri(null);
    setStatusText('Generando immagine AI...');
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
      setError(e?.message ?? 'Errore durante la generazione.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!resultUri || !onSave) return;
    onSave(resultUri, `${mode}-${selectedTemplate}-${Date.now()}.png`);
  };

  const availableTemplates = mode === 'thumbnail' 
    ? TEMPLATES 
    : mode === 'logo'
    ? TEMPLATES.filter(t => ['minimal', 'bold-side', 'neon'].includes(t.id))
    : TEMPLATES.filter(t => ['impact', 'minimal', 'gradient-bar'].includes(t.id));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Mode selector */}
      <Text style={styles.sectionLabel}>TIPO DI IMMAGINE</Text>
      <View style={styles.modeRow}>
        {IMAGE_MODES.map(m => (
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

      {mode !== 'thumbnail' && mode !== 'free' && (
        <Text style={styles.modeInfo}>
          {mode === 'logo' ? '💎 Formato quadrato 512×512px, ideale per loghi e icone' : '📱 Formato quadrato 1080×1080px, perfetto per post social'}
        </Text>
      )}

      {mode === 'free' && (
        <Text style={styles.modeInfo}>
          ✨ Genera immagini personalizzate da una descrizione testuale, senza vincoli di template
        </Text>
      )}

      {/* Template-based UI (thumbnail/logo/cover) */}
      {mode !== 'free' && (
        <>
          {/* Template grid */}
          <Text style={styles.sectionLabel}>SCEGLI TEMPLATE</Text>
          <View style={styles.templateGrid}>
            {availableTemplates.map(t => (
              <Pressable
                key={t.id}
                onPress={() => setSelectedTemplate(t.id)}
                style={({ pressed }) => [styles.templateCard, selectedTemplate === t.id && styles.templateCardSelected, { opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={styles.templateIcon}>{t.icon}</Text>
                <Text style={[styles.templateLabel, selectedTemplate === t.id && { color: COLORS.neonCyan }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.sectionLabel}>TITOLO *</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: Come guadagnare €10K al mese"
            placeholderTextColor={COLORS.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
          />

          {/* Subtitle */}
          <Text style={styles.sectionLabel}>SOTTOTITOLO / BADGE (opzionale)</Text>
          <TextInput
            style={styles.input}
            placeholder="Es: Scopri ora, 5 consigli..."
            placeholderTextColor={COLORS.textMuted}
            value={subtitle}
            onChangeText={setSubtitle}
            maxLength={120}
            {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
          />

          {/* Accent color */}
          <Text style={styles.sectionLabel}>COLORE ACCENTO</Text>
          <View style={styles.colorRow}>
            {ACCENT_COLORS.map(c => (
              <Pressable
                key={c.hex}
                onPress={() => setAccentColor(c.hex)}
                style={[styles.colorSwatch, { backgroundColor: c.hex }, accentColor === c.hex && styles.colorSwatchSelected]}
              />
            ))}
          </View>

          {/* Photo upload */}
          <Text style={styles.sectionLabel}>FOTO SOGGETTO (opzionale)</Text>
          <Pressable onPress={handlePickPhoto} style={styles.photoZone}>
            {photoPreview ? (
              <Image source={{ uri: photoPreview }} style={styles.photoPreview} resizeMode="cover" />
            ) : (
              <Text style={styles.photoZoneText}>📸 Aggiungi foto (consigliato per Split / Reaction)</Text>
            )}
          </Pressable>

          {/* Generate button */}
          <Pressable onPress={handleGenerate} disabled={loading} style={({ pressed }) => [{ opacity: pressed || loading ? 0.7 : 1 }, { marginTop: SPACING.lg }]}>
            <LinearGradient
              colors={['#FF00E5', '#FFE633'] as unknown as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.generateBtn}
            >
              {loading
                ? <><ActivityIndicator color="#000" size="small" /><Text style={styles.generateBtnText}>  {statusText || 'Generando...'}</Text></>
                : <Text style={styles.generateBtnText}>🎨 Genera Thumbnail</Text>
              }
            </LinearGradient>
          </Pressable>
        </>
      )}

      {/* Free generation UI */}
      {mode === 'free' && (
        <>
          {/* Provider selector */}
          <Text style={styles.sectionLabel}>PROVIDER IMMAGINI</Text>
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
              ⚠️ Configura API key NanoBanana in Impostazioni
            </Text>
          )}

          {/* Prompt input */}
          <Text style={styles.sectionLabel}>DESCRIZIONE IMMAGINE</Text>
          <TextInput
            style={styles.promptInput}
            placeholder="Descrivi l'immagine che vuoi generare..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            value={freePrompt}
            onChangeText={setFreePrompt}
            numberOfLines={4}
            {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
          />

          {/* Generate button */}
          <Pressable onPress={handleGenerateFree} disabled={loading || !freePrompt.trim()} style={({ pressed }) => [{ opacity: pressed || loading || !freePrompt.trim() ? 0.7 : 1 }, { marginTop: SPACING.lg }]}>
            <LinearGradient
              colors={['#FF00E5', '#FFE633'] as unknown as [string, string]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.generateBtn}
            >
              {loading
                ? <><ActivityIndicator color="#000" size="small" /><Text style={styles.generateBtnText}>  {statusText || 'Generando...'}</Text></>
                : <Text style={styles.generateBtnText}>✨ Genera Immagine</Text>
              }
            </LinearGradient>
          </Pressable>
        </>
      )}

      {/* Error */}
      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

      {/* Result */}
      {resultUri && (
        <View style={styles.resultSection}>
          <Image source={{ uri: resultUri }} style={styles.resultImage} resizeMode="contain" />
          <View style={styles.resultActions}>
            <Pressable onPress={mode === 'free' ? handleGenerateFree : handleGenerate} style={styles.regenBtn}>
              <Text style={styles.regenBtnText}>🔄 Rigenera</Text>
            </Pressable>
            {onSave && (
              <Pressable onPress={handleSave} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.7 : 1 }]}>
                <LinearGradient
                  colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>💾 Salva in fase</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      )}
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
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  templateCard: { width: '22%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.bgCard, gap: 4 },
  templateCardSelected: { borderColor: COLORS.neonCyan, backgroundColor: COLORS.neonCyan + '15' },
  templateIcon: { fontSize: 20 },
  templateLabel: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.textSecondary, textAlign: 'center' },
  input: { fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: RADIUS.md, padding: SPACING.md, backgroundColor: COLORS.bgCard },
  colorRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchSelected: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  photoZone: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.md, minHeight: 80, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 120, borderRadius: RADIUS.md },
  photoZoneText: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textMuted, padding: SPACING.md },
  generateBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: '#000' },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonPink, marginTop: SPACING.sm },
  resultSection: { gap: SPACING.md, marginTop: SPACING.lg },
  resultImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: RADIUS.md, backgroundColor: COLORS.bgElevated },
  resultActions: { flexDirection: 'row', gap: SPACING.sm },
  regenBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  regenBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  saveBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.sm, alignItems: 'center' },
  saveBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
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
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
});
