import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';

export interface Template {
  id: string;
  label: string;
  icon: string;
  description: string;
}

const TEMPLATES: Template[] = [
  { id: 'impact',       label: 'Impact',        icon: '💥', description: 'Centered text, solid background' },
  { id: 'split',        label: 'Split',          icon: '👤', description: 'Photo left, text right' },
  { id: 'gradient-bar', label: 'Gradient Bar',   icon: '📊', description: 'Scene + text bar at bottom' },
  { id: 'bold-side',    label: 'Bold Side',      icon: '🎨', description: 'Colored panel + image' },
  { id: 'minimal',      label: 'Minimal',        icon: '✦',  description: 'Dark background, centered title' },
  { id: 'reaction',     label: 'Reaction',       icon: '😱', description: 'Large face + short text' },
  { id: 'neon',         label: 'Neon',           icon: '⚡', description: 'Neon text on dark background' },
  { id: 'cinematic',    label: 'Cinematic',      icon: '🎬', description: 'Letterbox bars + scene' },
];

interface TemplatePickerProps {
  selectedTemplate: string;
  setSelectedTemplate: (id: string) => void;
  availableTemplates?: Template[];
}

export function TemplatePicker({ 
  selectedTemplate, 
  setSelectedTemplate,
  availableTemplates = TEMPLATES 
}: TemplatePickerProps) {
  return (
    <>
      <Text style={styles.sectionLabel}>CHOOSE TEMPLATE</Text>
      <View style={styles.templateGrid}>
        {availableTemplates.map(t => (
          <Pressable
            key={t.id}
            onPress={() => setSelectedTemplate(t.id)}
            style={({ pressed }) => [
              styles.templateCard,
              selectedTemplate === t.id && styles.templateCardSelected,
              { opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <Text style={styles.templateIcon}>{t.icon}</Text>
            <Text 
              style={[
                styles.templateLabel, 
                selectedTemplate === t.id && { color: COLORS.neonCyan } 
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export { TEMPLATES };

const styles = StyleSheet.create({
  sectionLabel: { 
    fontFamily: FONTS.bodySemiBold, 
    fontSize: 11, 
    color: COLORS.textMuted, 
    letterSpacing: 1.5, 
    marginTop: SPACING.md 
  },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  templateCard: {
    width: '22%', 
    aspectRatio: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    borderRadius: RADIUS.md, 
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: COLORS.bgCard,
    gap: 4,
  },
  templateCardSelected: { 
    borderColor: COLORS.neonCyan, 
    backgroundColor: COLORS.neonCyan + '15' 
  },
  templateIcon: { fontSize: 20 },
  templateLabel: { 
    fontFamily: FONTS.bodyMedium, 
    fontSize: 10, 
    color: COLORS.textSecondary, 
    textAlign: 'center' 
  },
});
