import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';
import type { ContentBrief } from '@/types';

const PLATFORM_OPTIONS = [
  { id: 'youtube', label: 'YouTube', icon: '▶️' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵' },
  { id: 'reels', label: 'Reels', icon: '📸' },
  { id: 'shorts', label: 'Shorts', icon: '⚡' },
  { id: 'twitter', label: 'Twitter', icon: '🐦' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
];

const STATUS_OPTIONS: { id: ContentBrief['status']; label: string; color: string }[] = [
  { id: 'draft', label: 'Bozza', color: COLORS.textMuted },
  { id: 'scheduled', label: 'Pianificato', color: COLORS.neonYellow },
  { id: 'published', label: 'Pubblicato', color: COLORS.neonLime },
];

const DEFAULT_BRIEF: ContentBrief = {
  title: '',
  description: '',
  hashtags: [],
  platforms: [],
  status: 'draft',
};

interface ContentBriefPanelProps {
  brief?: ContentBrief;
  onSave: (brief: ContentBrief) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function ContentBriefPanel({ brief, onSave, collapsed = false, onToggle }: ContentBriefPanelProps) {
  const [editing, setEditing] = useState<ContentBrief>(brief ?? DEFAULT_BRIEF);
  const [hashtagInput, setHashtagInput] = useState('');
  const [dirty, setDirty] = useState(false);

  const update = (patch: Partial<ContentBrief>) => {
    setEditing(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '');
    if (!tag) return;
    update({ hashtags: [...editing.hashtags, tag] });
    setHashtagInput('');
  };

  const removeHashtag = (idx: number) => {
    update({ hashtags: editing.hashtags.filter((_, i) => i !== idx) });
  };

  const togglePlatform = (id: string) => {
    const has = editing.platforms.includes(id);
    update({ platforms: has ? editing.platforms.filter(p => p !== id) : [...editing.platforms, id] });
  };

  const handleSave = () => {
    onSave(editing);
    setDirty(false);
  };

  const statusMeta = STATUS_OPTIONS.find(s => s.id === editing.status) ?? STATUS_OPTIONS[0];

  return (
    <View style={styles.container}>
      {/* Panel header */}
      <Pressable onPress={onToggle} style={styles.panelHeader}>
        <View style={styles.panelHeaderLeft}>
          <Text style={styles.panelIcon}>📋</Text>
          <Text style={styles.panelTitle}>Content Brief</Text>
          <View style={[styles.statusDot, { backgroundColor: statusMeta.color }]} />
          <Text style={[styles.statusLabel, { color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>
        <Text style={styles.chevron}>{collapsed ? '▶' : '▼'}</Text>
      </Pressable>

      {!collapsed && (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TITOLO</Text>
            <TextInput
              value={editing.title}
              onChangeText={v => update({ title: v })}
              placeholder="Titolo del contenuto..."
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DESCRIZIONE / CAPTION</Text>
            <TextInput
              value={editing.description}
              onChangeText={v => update({ description: v })}
              placeholder="Scrivi la descrizione..."
              placeholderTextColor={COLORS.textMuted}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Hashtags */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>HASHTAG</Text>
            <View style={styles.hashtagRow}>
              <TextInput
                value={hashtagInput}
                onChangeText={setHashtagInput}
                onSubmitEditing={addHashtag}
                placeholder="#aggiungi..."
                placeholderTextColor={COLORS.textMuted}
                style={[styles.input, { flex: 1 }]}
                returnKeyType="done"
              />
              <Pressable onPress={addHashtag} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+</Text>
              </Pressable>
            </View>
            {editing.hashtags.length > 0 && (
              <View style={styles.tagCloud}>
                {editing.hashtags.map((tag, i) => (
                  <Pressable key={i} onPress={() => removeHashtag(i)} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                    <Text style={styles.tagRemove}>✕</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Platforms */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PIATTAFORME</Text>
            <View style={styles.platformGrid}>
              {PLATFORM_OPTIONS.map(p => {
                const active = editing.platforms.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => togglePlatform(p.id)}
                    style={[styles.platformChip, active && styles.platformChipActive]}
                  >
                    <Text style={styles.platformIcon}>{p.icon}</Text>
                    <Text style={[styles.platformLabel, active && { color: COLORS.neonCyan }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Publish date */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DATA PUBBLICAZIONE</Text>
            <TextInput
              value={editing.publishDate ?? ''}
              onChangeText={v => update({ publishDate: v })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />
          </View>

          {/* Status */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>STATO</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => update({ status: s.id })}
                  style={[
                    styles.statusChip,
                    editing.status === s.id && { borderColor: s.color, backgroundColor: s.color + '18' },
                  ]}
                >
                  <View style={[styles.statusDot, { backgroundColor: s.color }]} />
                  <Text style={[styles.statusChipLabel, editing.status === s.id && { color: s.color }]}>
                    {s.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Published URL */}
          {editing.status === 'published' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>URL PUBBLICATO</Text>
              <TextInput
                value={editing.publishedUrl ?? ''}
                onChangeText={v => update({ publishedUrl: v })}
                placeholder="https://..."
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Save / AI fill buttons */}
          <View style={styles.actionRow}>
            <Pressable style={styles.aiBtn}>
              <Text style={styles.aiBtnText}>✨ Auto-fill con AI</Text>
            </Pressable>
            {dirty && (
              <Pressable onPress={handleSave} style={styles.saveWrap}>
                <LinearGradient
                  colors={[COLORS.neonCyan, COLORS.neonViolet] as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  <Text style={styles.saveBtnText}>Salva</Text>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  panelIcon: { fontSize: 16 },
  panelTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.textPrimary },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11 },
  chevron: { fontSize: 10, color: COLORS.textMuted },
  body: { maxHeight: 480 },
  field: { padding: SPACING.md, paddingBottom: 0 },
  fieldLabel: {
    fontFamily: FONTS.bodySemiBold, fontSize: 10,
    color: COLORS.textMuted, letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },
  input: {
    fontFamily: FONTS.bodyRegular, fontSize: 13,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.select({ ios: 10, default: 8 }),
  },
  inputMultiline: { height: 90, textAlignVertical: 'top', paddingTop: SPACING.sm },
  hashtagRow: { flexDirection: 'row', gap: SPACING.sm },
  addBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  addBtnText: { fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.neonCyan },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full, borderWidth: 1,
    backgroundColor: COLORS.neonViolet + '18', borderColor: COLORS.neonViolet + '44',
  },
  tagText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.neonViolet },
  tagRemove: { fontSize: 9, color: COLORS.textMuted },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  platformChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: COLORS.bgElevated,
  },
  platformChipActive: {
    borderColor: COLORS.neonCyan + '66', backgroundColor: COLORS.neonCyan + '12',
  },
  platformIcon: { fontSize: 13 },
  platformLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textSecondary },
  statusRow: { flexDirection: 'row', gap: SPACING.sm },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: SPACING.md, paddingVertical: 6,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statusChipLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textSecondary },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    padding: SPACING.md,
  },
  aiBtn: {
    flex: 1, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1,
    borderColor: COLORS.neonViolet + '44', backgroundColor: COLORS.neonViolet + '10',
    alignItems: 'center',
  },
  aiBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.neonViolet },
  saveWrap: {},
  saveBtn: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  saveBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.bg },
});
