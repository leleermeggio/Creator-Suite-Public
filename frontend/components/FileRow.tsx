import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import { TOOLS } from '@/constants/tools';
import type { ProjectFile } from '@/types';

function mimeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('text')) return '📝';
  return '📁';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileRowProps {
  file: ProjectFile;
  onDelete: () => void;
  onMove?: () => void;
}

export function FileRow({ file, onDelete, onMove }: FileRowProps) {
  const sourceTool = file.sourceToolId ? TOOLS.find(t => t.id === file.sourceToolId) : null;

  const handleLongPress = () => {
    if (Platform.OS === 'web') {
      const action = window.confirm(`Eliminare "${file.filename}"?`);
      if (action) onDelete();
      return;
    }
    const options: any[] = [{ text: 'Annulla', style: 'cancel' }];
    if (onMove) options.push({ text: 'Sposta a...', onPress: onMove });
    options.push({ text: 'Elimina', style: 'destructive', onPress: onDelete });
    Alert.alert(file.filename, undefined, options);
  };

  return (
    <Pressable onLongPress={handleLongPress} delayLongPress={500}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.fileIcon}>{mimeIcon(file.mimeType)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.filename} numberOfLines={1}>{file.filename}</Text>
          <Text style={styles.meta}>{formatSize(file.size)}</Text>
        </View>
        <View style={[styles.badge, file.source === 'tool-output' ? styles.badgeTool : styles.badgeUpload]}>
          <Text style={styles.badgeText}>
            {file.source === 'tool-output' && sourceTool ? sourceTool.icon : '⬆️'}
            {' '}
            {file.source === 'tool-output' && sourceTool ? sourceTool.name : 'Caricato'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: SPACING.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIcon: { fontSize: 18 },
  info: { flex: 1 },
  filename: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  meta: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeUpload: {
    backgroundColor: COLORS.neonCyan + '11',
    borderColor: COLORS.neonCyan + '33',
  },
  badgeTool: {
    backgroundColor: COLORS.neonViolet + '11',
    borderColor: COLORS.neonViolet + '33',
  },
  badgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
});
