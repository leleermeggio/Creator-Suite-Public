import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { InsightCardData } from '@/services/missionsApi';

const TYPE_META: Record<
  InsightCardData['type'],
  { emoji: string; label: string; color: string }
> = {
  quality: { emoji: '🔊', label: 'Qualità', color: '#00FFD0' },
  opportunity: { emoji: '💡', label: 'Opportunità', color: '#FFE633' },
  visual: { emoji: '🖼️', label: 'Visuale', color: '#9944FF' },
  cross_platform: { emoji: '🌐', label: 'Cross-Platform', color: '#FF00AA' },
};

interface InsightCardProps {
  insight: InsightCardData;
  onAccept?: () => void;
  onDismiss?: () => void;
  onSave?: () => void;
}

export function InsightCard({ insight, onAccept, onDismiss, onSave }: InsightCardProps) {
  const { palette } = useTheme();
  const meta = TYPE_META[insight.type] ?? TYPE_META.quality;
  const isPending = insight.status === 'PENDING';
  const confidencePct = Math.round(insight.confidence * 100);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.elevated,
          borderColor: isPending ? `${meta.color}33` : palette.border,
        },
      ]}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={[styles.typeBadge, { backgroundColor: `${meta.color}18` }]}>
          <Text style={styles.typeEmoji}>{meta.emoji}</Text>
          <Text style={[styles.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.confidenceRow}>
          <View
            style={[
              styles.confidenceBar,
              { backgroundColor: palette.border },
            ]}
          >
            <View
              style={[
                styles.confidenceFill,
                {
                  width: `${confidencePct}%` as any,
                  backgroundColor: meta.color,
                },
              ]}
            />
          </View>
          <Text style={[styles.confidenceText, { color: palette.textMuted }]}>
            {confidencePct}%
          </Text>
        </View>
      </View>

      {/* Message */}
      <Text style={[styles.message, { color: palette.text }]}>{insight.message}</Text>

      {/* Status badge for non-pending */}
      {!isPending && (
        <View style={[styles.statusBadge, { backgroundColor: palette.border }]}>
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            {insight.status === 'ACCEPTED'
              ? '✓ Applicata'
              : insight.status === 'DISMISSED'
              ? '✕ Ignorata'
              : '⏱ Salvata'}
          </Text>
        </View>
      )}

      {/* Actions */}
      {isPending && (
        <View style={styles.actions}>
          {onAccept && (
            <Pressable
              onPress={onAccept}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionPrimary,
                { borderColor: meta.color, backgroundColor: `${meta.color}18` },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionText, { color: meta.color }]}>Applica</Text>
            </Pressable>
          )}
          {onSave && (
            <Pressable
              onPress={onSave}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionText, { color: palette.textSecondary }]}>Dopo</Text>
            </Pressable>
          )}
          {onDismiss && (
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: palette.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.actionText, { color: palette.textMuted }]}>Ignora</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  typeEmoji: {
    fontSize: 12,
  },
  typeLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confidenceBar: {
    width: 48,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 3,
    borderRadius: 2,
  },
  confidenceText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
  },
  message: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  actionPrimary: {},
  actionText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});
