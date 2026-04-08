import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Platform } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING } from '@/constants/theme';
import type { MissionResponse } from '@/services/missionsApi';
import type { AgentResponse } from '@/services/agentsApi';

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'In attesa', color: '#FFE633' },
  RUNNING: { label: 'In esecuzione', color: '#00FFD0' },
  PAUSED: { label: 'In pausa', color: '#FF6B35' },
  COMPLETED: { label: 'Completata', color: '#00FFD0' },
  FAILED: { label: 'Fallita', color: '#FF00AA' },
};

const MODE_META: Record<string, { label: string; emoji: string }> = {
  REGISTA: { label: 'Regista', emoji: '🎬' },
  COPILOTA: { label: 'Copilota', emoji: '🤝' },
  AUTOPILOTA: { label: 'Autopilota', emoji: '🚀' },
};

interface MissionCardProps {
  mission: MissionResponse;
  agent?: AgentResponse | null;
  onPress?: () => void;
}

function LiveDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { backgroundColor: color, opacity }]} />;
}

export function MissionCard({ mission, agent, onPress }: MissionCardProps) {
  const { palette } = useTheme();
  const statusMeta = STATUS_META[mission.status] ?? { label: mission.status, color: palette.textMuted };
  const modeMeta = MODE_META[mission.mode] ?? { label: mission.mode, emoji: '🤖' };

  const steps = agent?.steps ?? [];
  const totalSteps = steps.length;
  const completedSteps = (mission.step_results ?? []).filter(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  ).length;
  const progressPct = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const pendingInsights = (mission.insights ?? []).filter((i) => i.status === 'PENDING');
  const isRunning = mission.status === 'RUNNING';

  // Build step dots array
  const stepDots = steps.map((step, i) => {
    const result = (mission.step_results ?? []).find((r) => r.step_index === i);
    const status = result?.status ?? (i === mission.current_step_index && isRunning ? 'RUNNING' : 'PENDING');
    return { label: step.label, status };
  });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: isRunning ? `${palette.cyan}44` : palette.border,
        },
        pressed && { opacity: 0.9 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.agentIcon}>{agent?.icon ?? '🤖'}</Text>
          <View style={styles.headerInfo}>
            <Text style={[styles.agentName, { color: palette.text }]} numberOfLines={1}>
              {agent?.name ?? 'Missione'}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: `${statusMeta.color}18`, borderColor: `${statusMeta.color}44` },
                ]}
              >
                {isRunning && <LiveDot color={statusMeta.color} />}
                <Text style={[styles.statusText, { color: statusMeta.color }]}>
                  {statusMeta.label}
                </Text>
              </View>
              <View style={[styles.modeBadge, { backgroundColor: palette.elevated }]}>
                <Text style={[styles.modeText, { color: palette.textSecondary }]}>
                  {modeMeta.emoji} {modeMeta.label}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      {totalSteps > 0 && (
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: palette.elevated }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progressPct}%` as any,
                  backgroundColor: isRunning ? palette.cyan : statusMeta.color,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressText, { color: palette.textMuted }]}>
            {completedSteps}/{totalSteps}
          </Text>
        </View>
      )}

      {/* Step dots */}
      {stepDots.length > 0 && (
        <View style={styles.dotsRow}>
          {stepDots.map((dot, i) => {
            const dotColor =
              dot.status === 'COMPLETED'
                ? palette.cyan
                : dot.status === 'RUNNING'
                ? palette.cyan
                : dot.status === 'FAILED'
                ? palette.magenta
                : dot.status === 'SKIPPED'
                ? palette.textMuted
                : palette.border;
            return (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor:
                      dot.status === 'PENDING' ? 'transparent' : dotColor,
                    borderColor: dotColor,
                  },
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Current step label */}
      {isRunning && steps[mission.current_step_index] && (
        <Text style={[styles.currentStep, { color: palette.cyan }]}>
          ⟶ {steps[mission.current_step_index].label}
        </Text>
      )}

      {/* Insight hint */}
      {pendingInsights.length > 0 && (
        <View style={[styles.insightHint, { backgroundColor: `${palette.violet}18`, borderColor: `${palette.violet}33` }]}>
          <Text style={[styles.insightHintText, { color: palette.violet }]}>
            💡 {pendingInsights.length} insight{pendingInsights.length > 1 ? 's' : ''} in attesa
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    flex: 1,
  },
  agentIcon: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  agentName: {
    fontFamily: FONTS.displayBold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  modeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    minWidth: 28,
    textAlign: 'right',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  currentStep: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  insightHint: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  insightHintText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.2,
  },
});
