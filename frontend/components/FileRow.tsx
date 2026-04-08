import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { TOOLS } from '@/constants/tools';
import type { ProjectFile } from '@/types';

function getMimeCategory(mime: string): 'video' | 'audio' | 'image' | 'text' | 'other' {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  if (mime.includes('text') || mime.includes('json') || mime.includes('pdf')) return 'text';
  return 'other';
}

const CATEGORY_META: Record<ReturnType<typeof getMimeCategory>, { icon: string; color: string; bg: string }> = {
  video: { icon: '🎬', color: COLORS.neonMagenta, bg: COLORS.neonMagenta + '12' },
  audio: { icon: '🎵', color: COLORS.neonViolet, bg: COLORS.neonViolet + '12' },
  image: { icon: '�️', color: COLORS.neonCyan, bg: COLORS.neonCyan + '12' },
  text:  { icon: '📝', color: COLORS.neonYellow, bg: COLORS.neonYellow + '12' },
  other: { icon: '📁', color: COLORS.textMuted, bg: 'rgba(255,255,255,0.06)' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

interface FileRowProps {
  file: ProjectFile;
  onDelete: () => void;
  onMove?: () => void;
}

export function FileRow({ file, onDelete, onMove }: FileRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sourceTool = file.sourceToolId ? TOOLS.find(t => t.id === file.sourceToolId) : null;
  const category = getMimeCategory(file.mimeType);
  const meta = CATEGORY_META[category];
  const isTool = file.source === 'tool-output';

  const openMenu = () => {
    if (Platform.OS === 'web') {
      setMenuOpen(v => !v);
      return;
    }
    const options: any[] = [{ text: 'Annulla', style: 'cancel' }];
    if (onMove) options.push({ text: '↔ Sposta a...', onPress: onMove });
    options.push({ text: '🗑 Elimina', style: 'destructive', onPress: onDelete });
    Alert.alert(file.filename, undefined, options);
  };

  return (
    <View style={styles.card}>
      {/* Type strip */}
      <View style={[styles.typeStrip, { backgroundColor: meta.color }]} />

      {/* Icon area */}
      <View style={[styles.iconArea, { backgroundColor: meta.bg }]}>
        <Text style={styles.typeIcon}>{meta.icon}</Text>
        {category === 'video' && (
          <View style={styles.playOverlay}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>{file.filename}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatSize(file.size)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatDate(file.createdAt)}</Text>
        </View>
        {/* Source badge */}
        <View style={[styles.sourceBadge, isTool ? styles.sourceBadgeTool : styles.sourceBadgeUpload]}>
          <Text style={styles.sourceBadgeText}>
            {isTool && sourceTool ? `${sourceTool.icon} ${sourceTool.name}` : '⬆ Caricato'}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <Pressable onPress={openMenu} style={styles.menuBtn} hitSlop={8}>
        <Text style={styles.menuIcon}>⋮</Text>
      </Pressable>

      {/* Web dropdown menu */}
      {menuOpen && Platform.OS === 'web' && (
        <View style={styles.dropdown}>
          {onMove && (
            <Pressable onPress={() => { setMenuOpen(false); onMove?.(); }} style={styles.dropdownItem}>
              <Text style={styles.dropdownText}>↔ Sposta a...</Text>
            </Pressable>
          )}
          <Pressable onPress={() => { setMenuOpen(false); onDelete(); }} style={styles.dropdownItem}>
            <Text style={[styles.dropdownText, { color: COLORS.neonMagenta }]}>🗑 Elimina</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  typeStrip: {
    width: 3,
    alignSelf: 'stretch',
  },
  iconArea: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  typeIcon: { fontSize: 22 },
  playOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { fontSize: 7, color: '#fff' },
  info: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    gap: 3,
  },
  filename: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted },
  metaDot: { fontSize: 11, color: COLORS.textMuted },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 2,
  },
  sourceBadgeUpload: { backgroundColor: COLORS.neonCyan + '11', borderColor: COLORS.neonCyan + '33' },
  sourceBadgeTool: { backgroundColor: COLORS.neonViolet + '11', borderColor: COLORS.neonViolet + '33' },
  sourceBadgeText: { fontFamily: FONTS.bodyMedium, fontSize: 10, color: COLORS.textSecondary },
  menuBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: { fontSize: 18, color: COLORS.textMuted },
  dropdown: {
    position: 'absolute',
    right: 8,
    top: 40,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 100,
    minWidth: 150,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dropdownText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textPrimary },
});
