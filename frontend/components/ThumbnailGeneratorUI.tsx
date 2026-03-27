import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Platform, Image, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { generateThumbnail, type ThumbnailGenerateParams } from '@/services/thumbnailApi';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

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

interface ThumbnailGeneratorUIProps {
  projectId?: string;
  onSave?: (uri: string, filename: string) => void;
}

export function ThumbnailGeneratorUI({ projectId, onSave }: ThumbnailGeneratorUIProps) {
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

  const handleSave = () => {
    if (!resultUri || !onSave) return;
    onSave(resultUri, `thumbnail-${selectedTemplate}-${Date.now()}.png`);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      {/* Template grid */}
      <Text style={styles.sectionLabel}>SCEGLI TEMPLATE</Text>
      <View style={styles.templateGrid}>
        {TEMPLATES.map(t => (
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

      {/* Error */}
      {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

      {/* Result */}
      {resultUri && (
        <View style={styles.resultSection}>
          <Image source={{ uri: resultUri }} style={styles.resultImage} resizeMode="contain" />
          <View style={styles.resultActions}>
            <Pressable onPress={handleGenerate} style={styles.regenBtn}>
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
});
