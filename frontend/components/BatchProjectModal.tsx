import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS, TYPO } from '@/constants/theme';
import { BUILT_IN_TEMPLATES } from '@/constants/templates';
import type { PhaseTemplate } from '@/types';

const MAX_BATCH = 20;

interface BatchProjectModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (items: BatchItem[]) => Promise<void>;
}

export interface BatchItem {
  name: string;
  phaseTemplates: PhaseTemplate[];
  templateId: string;
}

function generateNames(pattern: string, start: number, count: number): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const name = pattern
      .replace(/\{n\}/gi, String(n))
      .replace(/\{nn\}/gi, String(n).padStart(2, '0'))
      .replace(/\{nnn\}/gi, String(n).padStart(3, '0'))
      .trim() || `Progetto ${n}`;
    names.push(name);
  }
  return names;
}

export function BatchProjectModal({ visible, onClose, onConfirm }: BatchProjectModalProps) {
  const [pattern, setPattern] = useState('Episodio {n}');
  const [start, setStart] = useState('1');
  const [count, setCount] = useState('5');
  const [selectedTemplateId, setSelectedTemplateId] = useState(BUILT_IN_TEMPLATES[0].id);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const countNum = Math.min(MAX_BATCH, Math.max(1, parseInt(count) || 1));
  const startNum = Math.max(1, parseInt(start) || 1);

  const previews = useMemo(() => generateNames(pattern, startNum, countNum), [pattern, startNum, countNum]);

  const selectedTemplate = BUILT_IN_TEMPLATES.find(t => t.id === selectedTemplateId) ?? BUILT_IN_TEMPLATES[0];

  const handleCreate = async () => {
    if (!pattern.trim()) { setError('Inserisci un nome o pattern.'); return; }
    setError(null);
    setCreating(true);
    try {
      const items: BatchItem[] = previews.map(name => ({
        name,
        phaseTemplates: selectedTemplate.defaultPhases as PhaseTemplate[],
        templateId: selectedTemplate.id,
      }));
      await onConfirm(items);
      onClose();
    } catch {
      setError('Errore durante la creazione. Riprova.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.dragBar} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Crea Serie</Text>
          <Text style={styles.subtitle}>Crea più progetti in blocco con nomi numerati</Text>
        </View>

        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Name pattern */}
          <View style={styles.field}>
            <Text style={styles.label}>PATTERN NOME</Text>
            <TextInput
              value={pattern}
              onChangeText={setPattern}
              placeholder="Episodio {n}"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Usa <Text style={styles.code}>{'{n}'}</Text> per numero intero,{' '}
              <Text style={styles.code}>{'{nn}'}</Text> per 2 cifre,{' '}
              <Text style={styles.code}>{'{nnn}'}</Text> per 3 cifre
            </Text>
          </View>

          {/* Start number + count */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>INIZIA DA</Text>
              <TextInput
                value={start}
                onChangeText={setStart}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="1"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.label}>QUANTITÀ (max {MAX_BATCH})</Text>
              <TextInput
                value={count}
                onChangeText={v => setCount(String(Math.min(MAX_BATCH, parseInt(v) || 1)))}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="5"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Template picker */}
          <View style={styles.field}>
            <Text style={styles.label}>TEMPLATE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
              {BUILT_IN_TEMPLATES.map(t => {
                const active = t.id === selectedTemplateId;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setSelectedTemplateId(t.id)}
                    style={[styles.templateChip, active && styles.templateChipActive]}
                  >
                    <Text style={styles.templateIcon}>{t.icon}</Text>
                    <Text style={[styles.templateName, active && { color: COLORS.neonCyan }]}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.templateDesc} numberOfLines={1}>{selectedTemplate.description}</Text>
          </View>

          {/* Preview */}
          <View style={styles.field}>
            <Text style={styles.label}>ANTEPRIMA ({previews.length})</Text>
            <View style={styles.previewBox}>
              {previews.slice(0, 8).map((name, i) => (
                <View key={i} style={styles.previewRow}>
                  <View style={[styles.previewDot, { backgroundColor: COLORS.neonCyan }]} />
                  <Text style={styles.previewName} numberOfLines={1}>{name}</Text>
                </View>
              ))}
              {previews.length > 8 && (
                <Text style={styles.previewMore}>+{previews.length - 8} altri...</Text>
              )}
            </View>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {/* CTA */}
        <View style={styles.footer}>
          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Annulla</Text>
          </Pressable>
          <Pressable onPress={handleCreate} disabled={creating} style={styles.confirmWrap}>
            <LinearGradient
              colors={[COLORS.neonCyan, COLORS.neonViolet] as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={[styles.confirmBtn, creating && { opacity: 0.6 }]}
            >
              {creating ? (
                <ActivityIndicator color={COLORS.bg} size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Crea {countNum} progetti</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.bgCard,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '88%',
    paddingBottom: Platform.select({ ios: 34, default: SPACING.lg }),
  },
  dragBar: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginTop: SPACING.md,
  },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.xs },
  title: { ...TYPO.h2, color: COLORS.textPrimary },
  subtitle: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  body: { paddingHorizontal: SPACING.lg },
  field: { marginTop: SPACING.md },
  label: {
    fontFamily: FONTS.bodySemiBold, fontSize: 10,
    color: COLORS.textMuted, letterSpacing: 1.2, marginBottom: SPACING.xs,
  },
  hint: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  code: { fontFamily: FONTS.bodyMedium, color: COLORS.neonCyan },
  input: {
    fontFamily: FONTS.bodyRegular, fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
  },
  row: { flexDirection: 'row', gap: SPACING.md },
  templateRow: { gap: SPACING.sm, paddingVertical: 2 },
  templateChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.bgElevated,
  },
  templateChipActive: {
    borderColor: COLORS.neonCyan + '55', backgroundColor: COLORS.neonCyan + '12',
  },
  templateIcon: { fontSize: 14 },
  templateName: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textSecondary },
  templateDesc: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  previewBox: {
    backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    padding: SPACING.md, gap: SPACING.xs,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  previewDot: { width: 5, height: 5, borderRadius: 3 },
  previewName: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textPrimary, flex: 1 },
  previewMore: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted, paddingTop: 2 },
  errorText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.neonMagenta, marginTop: SPACING.sm },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.textSecondary },
  confirmWrap: { flex: 1 },
  confirmBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  confirmBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.bg },
});
