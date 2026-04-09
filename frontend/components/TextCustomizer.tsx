import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

const ACCENT_COLORS = [
  { hex: '#FF0000', label: 'Red' },
  { hex: '#2563EB', label: 'Blue' },
  { hex: '#16A34A', label: 'Green' },
  { hex: '#FFE633', label: 'Yellow' },
  { hex: '#7C3AED', label: 'Purple' },
  { hex: '#06B6D4', label: 'Cyan' },
];

interface TextCustomizerProps {
  title: string;
  setTitle: (value: string) => void;
  subtitle: string;
  setSubtitle: (value: string) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  photoBase64: string | null;
  photoPreview: string | null;
  setPhotoBase64: (b64: string | null) => void;
  setPhotoPreview: (preview: string | null) => void;
}

export function TextCustomizer({
  title,
  setTitle,
  subtitle,
  setSubtitle,
  accentColor,
  setAccentColor,
  photoBase64,
  photoPreview,
  setPhotoBase64,
  setPhotoPreview,
}: TextCustomizerProps) {
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
        // Error handled by parent
      }
    }
  };

  return (
    <>
      {/* Title */}
      <Text style={styles.sectionLabel}>TITLE *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: How to earn €10K per month"
        placeholderTextColor={COLORS.textMuted}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
      />

      {/* Subtitle */}
      <Text style={styles.sectionLabel}>SUBTITLE / BADGE (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Discover now, 5 tips..."
        placeholderTextColor={COLORS.textMuted}
        value={subtitle}
        onChangeText={setSubtitle}
        maxLength={120}
        {...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {})}
      />

      {/* Accent color */}
      <Text style={styles.sectionLabel}>ACCENT COLOR</Text>
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
      <Text style={styles.sectionLabel}>SUBJECT PHOTO (optional)</Text>
      <Pressable onPress={handlePickPhoto} style={styles.photoZone}>
        {photoPreview ? (
          <Image source={{ uri: photoPreview }} style={styles.photoPreview} resizeMode="cover" />
        ) : (
          <Text style={styles.photoZoneText}>📸 Add photo (recommended for Split / Reaction)</Text>
        )}
      </Pressable>
    </>
  );
}

export { ACCENT_COLORS };

const styles = StyleSheet.create({
  sectionLabel: { 
    fontFamily: FONTS.bodySemiBold, 
    fontSize: 11, 
    color: COLORS.textMuted, 
    letterSpacing: 1.5, 
    marginTop: SPACING.md 
  },
  input: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
  },
  colorRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchSelected: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  photoZone: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: RADIUS.md,
    minHeight: 80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  photoPreview: { width: '100%', height: 120, borderRadius: RADIUS.md },
  photoZoneText: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textMuted, padding: SPACING.md },
});
