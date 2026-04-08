import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';
import { getPlatformDef } from '@/constants/platforms';
import type { AgentResponse } from '@/services/agentsApi';

interface AgentCardProps {
  agent: AgentResponse;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AgentCard({ agent, onPress, onEdit, onDelete }: AgentCardProps) {
  const { palette } = useTheme();
  const [hovered, setHovered] = useState(false);
  const steps = agent.steps ?? [];
  const platforms = (agent.target_platforms ?? []).slice(0, 3);

  return (
    <Pressable
      onPress={onPress}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          }
        : {})}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: hovered ? palette.borderActive : palette.border,
        },
        (pressed || hovered) && styles.cardHovered,
        Platform.OS === 'web' && ({
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        } as any),
      ]}
    >
      {/* Preset badge */}
      {agent.is_preset && (
        <View style={[styles.presetBadge, { backgroundColor: `${palette.violet}22`, borderColor: `${palette.violet}44` }]}>
          <Text style={[styles.presetText, { color: palette.violet }]}>Preset</Text>
        </View>
      )}

      {/* Icon */}
      <Text style={styles.icon}>{agent.icon}</Text>

      {/* Name + desc */}
      <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
        {agent.name}
      </Text>
      {agent.description && (
        <Text style={[styles.desc, { color: palette.textSecondary }]} numberOfLines={2}>
          {agent.description}
        </Text>
      )}

      {/* Platform tags */}
      {platforms.length > 0 && (
        <View style={styles.tagsRow}>
          {platforms.map((pid) => {
            const pdef = getPlatformDef(pid);
            return (
              <View
                key={pid}
                style={[styles.tag, { backgroundColor: `${pdef?.color ?? palette.border}22` }]}
              >
                <Text style={styles.tagEmoji}>{pdef?.emoji ?? '🌐'}</Text>
                <Text style={[styles.tagText, { color: pdef?.color ?? palette.textMuted }]}>
                  {pdef?.name ?? pid}
                </Text>
              </View>
            );
          })}
          {(agent.target_platforms ?? []).length > 3 && (
            <View style={[styles.tag, { backgroundColor: palette.elevated }]}>
              <Text style={[styles.tagText, { color: palette.textMuted }]}>
                +{(agent.target_platforms ?? []).length - 3}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Footer: step count + actions */}
      <View style={styles.footer}>
        <Text style={[styles.stepCount, { color: palette.textMuted }]}>
          {steps.length} {steps.length === 1 ? 'step' : 'steps'}
        </Text>
        <View style={styles.footerActions}>
          {onEdit && !agent.is_preset && (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onEdit(); }}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              hitSlop={6}
            >
              <Text style={[styles.iconBtnText, { color: palette.textSecondary }]}>✏️</Text>
            </Pressable>
          )}
          {onDelete && !agent.is_preset && (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onDelete(); }}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              hitSlop={6}
            >
              <Text style={[styles.iconBtnText, { color: palette.magenta }]}>🗑️</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Mode pill */}
      <View style={[styles.modePill, { backgroundColor: `${palette.cyan}15`, borderColor: `${palette.cyan}30` }]}>
        <Text style={[styles.modeText, { color: palette.cyan }]}>
          {agent.default_mode === 'REGISTA' ? '🎬' : agent.default_mode === 'AUTOPILOTA' ? '🚀' : '🤝'}{' '}
          {agent.default_mode === 'REGISTA' ? 'Regista' : agent.default_mode === 'AUTOPILOTA' ? 'Autopilota' : 'Copilota'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  cardHovered: {
    transform: [{ translateY: -2 }],
  },
  presetBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 32,
    marginBottom: 2,
  },
  name: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  desc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  tagEmoji: {
    fontSize: 10,
  },
  tagText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  stepCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 2,
  },
  iconBtnText: {
    fontSize: 13,
  },
  modePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 2,
  },
  modeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
