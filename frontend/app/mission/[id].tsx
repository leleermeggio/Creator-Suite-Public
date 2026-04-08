import React, { useMemo, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useMission } from '@/hooks/useMission';
import { useAgent } from '@/hooks/useAgent';
import { ControlSlider } from '@/components/ControlSlider';
import { StepTimeline } from '@/components/StepTimeline';
import { InsightCard } from '@/components/InsightCard';
import { FONTS, RADIUS, SPACING, TYPO } from '@/constants/theme';
import type { ControlMode } from '@/constants/agents';
import { StepOutputPreview } from '@/components/StepOutputPreview';
import { AnimatedScreen } from '@/components/animated';
import type { StepResult, InsightCardData } from '@/services/missionsApi';
import type { StepDefinition } from '@/services/agentsApi';
import type { TimelineStep } from '@/components/StepTimeline';

/* ────────────────────────────── Status maps ────────────────────────────── */

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

const STEP_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'In attesa', color: '#FFE633' },
  RUNNING: { label: 'In esecuzione', color: '#00FFD0' },
  COMPLETED: { label: 'Completato', color: '#00FFD0' },
  SKIPPED: { label: 'Saltato', color: '#888888' },
  FAILED: { label: 'Fallito', color: '#FF00AA' },
};

/* ────────────────────────────── LiveDot ─────────────────────────────────── */

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

/* ────────────────────────────── Helpers ─────────────────────────────────── */

function formatDuration(startedAt: string, completedAt: string): string {
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function getStepResultStatus(
  stepIndex: number,
  stepResults: StepResult[] | null,
  currentStepIndex: number,
  missionStatus: string,
): string {
  const result = (stepResults ?? []).find((r) => r.step_index === stepIndex);
  if (result) return result.status;
  if (stepIndex === currentStepIndex && missionStatus === 'RUNNING') return 'RUNNING';
  return 'PENDING';
}

function renderOutputPreview(output: Record<string, unknown>, palette: { text: string; textMuted: string; textSecondary: string }) {
  const entries = Object.entries(output).slice(0, 6);
  return (
    <View style={styles.outputContainer}>
      {entries.map(([key, val]) => (
        <View key={key} style={styles.outputRow}>
          <Text style={[styles.outputKey, { color: palette.textMuted }]}>{key}:</Text>
          <Text style={[styles.outputValue, { color: palette.textSecondary }]} numberOfLines={2}>
            {typeof val === 'string' ? val : JSON.stringify(val)}
          </Text>
        </View>
      ))}
      {Object.keys(output).length > 6 && (
        <Text style={[styles.outputMore, { color: palette.textMuted }]}>
          +{Object.keys(output).length - 6} altri campi
        </Text>
      )}
    </View>
  );
}

/* ═══════════════════════════════ SCREEN ═══════════════════════════════════ */

export default function MissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const {
    mission,
    loading,
    error,
    isPolling,
    refresh,
    start,
    pause,
    resume,
    updateMode,
    executeStep,
    skipStep,
    acceptInsight,
    dismissInsight,
  } = useMission(id ?? null);

  const { agent } = useAgent(mission?.agent_id ?? null);

  const [insightHistoryOpen, setInsightHistoryOpen] = useState(false);

  const steps: StepDefinition[] = agent?.steps ?? [];
  const totalSteps = steps.length;
  const completedSteps = (mission?.step_results ?? []).filter(
    (s) => s.status === 'COMPLETED' || s.status === 'SKIPPED',
  ).length;

  const isRunning = mission?.status === 'RUNNING';
  const isDone = mission?.status === 'COMPLETED' || mission?.status === 'FAILED';

  /* ── Timeline steps ─────────────────────────────────────────────────── */

  const timelineSteps: TimelineStep[] = useMemo(() => {
    if (!mission) return [];
    return steps.map((step, i) => ({
      label: step.label,
      status: getStepResultStatus(i, mission.step_results, mission.current_step_index, mission.status) as TimelineStep['status'],
    }));
  }, [mission, steps]);

  /* ── Insights partition ─────────────────────────────────────────────── */

  const pendingInsights = useMemo(
    () => (mission?.insights ?? []).filter((i) => i.status === 'PENDING'),
    [mission?.insights],
  );
  const historyInsights = useMemo(
    () => (mission?.insights ?? []).filter((i) => i.status !== 'PENDING'),
    [mission?.insights],
  );
  const acceptedCount = useMemo(
    () => (mission?.insights ?? []).filter((i) => i.status === 'ACCEPTED').length,
    [mission?.insights],
  );

  /* ── Status meta ────────────────────────────────────────────────────── */

  const statusMeta = STATUS_META[mission?.status ?? 'PENDING'];
  const modeMeta = MODE_META[mission?.mode ?? 'COPILOTA'];

  /* ═══════════════════════ LOADING / ERROR STATES ════════════════════════ */

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.cyan} />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
          Caricamento missione...
        </Text>
      </View>
    );
  }

  if (error || !mission) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={[styles.errorText, { color: palette.magenta }]}>
          {error ?? 'Missione non trovata'}
        </Text>
        <Pressable
          onPress={() => refresh()}
          style={({ pressed }) => [
            styles.retryBtn,
            { borderColor: palette.cyan },
            pressed && { opacity: 0.7 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
        >
          <Text style={[styles.retryBtnText, { color: palette.cyan }]}>Riprova</Text>
        </Pressable>
      </View>
    );
  }

  /* ═══════════════════════════ RENDER ════════════════════════════════════ */

  return (
    <AnimatedScreen>
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. Header Bar ────────────────────────────────────────── */}
        <View style={styles.headerBar}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && { opacity: 0.7 },
              Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
            ]}
          >
            <Text style={[styles.backText, { color: palette.textSecondary }]}>
              {'←'} Missione
            </Text>
          </Pressable>

          <View style={styles.headerRight}>
            {/* Agent icon + name */}
            <Text style={styles.agentIcon}>{agent?.icon ?? '🤖'}</Text>
            <Text style={[styles.agentName, { color: palette.text }]} numberOfLines={1}>
              {agent?.name ?? 'Agente'}
            </Text>

            {/* Status badge */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: `${statusMeta.color}18`,
                  borderColor: `${statusMeta.color}44`,
                },
              ]}
            >
              {isRunning && <LiveDot color={statusMeta.color} />}
              <Text style={[styles.statusText, { color: statusMeta.color }]}>
                {statusMeta.label}
              </Text>
            </View>

            {/* Mode badge */}
            <View style={[styles.modeBadge, { backgroundColor: palette.elevated }]}>
              <Text style={[styles.modeText, { color: palette.textSecondary }]}>
                {modeMeta.emoji} {modeMeta.label}
              </Text>
            </View>
          </View>
        </View>

        {/* ── 2-7. Responsive main layout ──────────────────────────── */}
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>

        {/* LEFT column: controls + timeline */}
        <View style={[styles.leftCol, isDesktop && styles.leftColDesktop]}>

        {/* ── 2. Control Slider ────────────────────────────────────── */}
        <View style={styles.section}>
          <ControlSlider
            mode={mission.mode as ControlMode}
            onChange={(m) => updateMode(m)}
            disabled={isDone}
            compact={!isDesktop}
          />
        </View>

        {/* ── 3. Action Buttons ────────────────────────────────────── */}
        <View style={styles.actionRow}>
          {mission.status === 'PENDING' && (
            <Pressable
              onPress={() => start()}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionPrimary,
                { backgroundColor: `${palette.cyan}18`, borderColor: palette.cyan },
                pressed && { opacity: 0.7 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              ]}
            >
              <Text style={[styles.actionBtnText, { color: palette.cyan }]}>Avvia</Text>
            </Pressable>
          )}

          {mission.status === 'RUNNING' && (
            <Pressable
              onPress={() => pause()}
              style={({ pressed }) => [
                styles.actionBtn,
                { backgroundColor: '#FF6B3518', borderColor: '#FF6B35' },
                pressed && { opacity: 0.7 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              ]}
            >
              <Text style={[styles.actionBtnText, { color: '#FF6B35' }]}>Pausa</Text>
            </Pressable>
          )}

          {mission.status === 'PAUSED' && (
            <Pressable
              onPress={() => resume()}
              style={({ pressed }) => [
                styles.actionBtn,
                styles.actionPrimary,
                { backgroundColor: `${palette.cyan}18`, borderColor: palette.cyan },
                pressed && { opacity: 0.7 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              ]}
            >
              <Text style={[styles.actionBtnText, { color: palette.cyan }]}>Riprendi</Text>
            </Pressable>
          )}

          {mission.status === 'COMPLETED' && (
            <View style={[styles.staticBadge, { backgroundColor: `${palette.cyan}18`, borderColor: palette.cyan }]}>
              <Text style={[styles.staticBadgeText, { color: palette.cyan }]}>
                Missione completata
              </Text>
            </View>
          )}

          {mission.status === 'FAILED' && (
            <>
              <View style={[styles.staticBadge, { backgroundColor: '#FF00AA18', borderColor: '#FF00AA' }]}>
                <Text style={[styles.staticBadgeText, { color: '#FF00AA' }]}>
                  Missione fallita
                </Text>
              </View>
              <Pressable
                onPress={() => start()}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { backgroundColor: `${palette.cyan}18`, borderColor: palette.cyan },
                  pressed && { opacity: 0.7 },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
              >
                <Text style={[styles.actionBtnText, { color: palette.cyan }]}>Riprova</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ── 4. Step Timeline ─────────────────────────────────────── */}
        {totalSteps > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Pipeline</Text>
              <Text style={[styles.sectionCount, { color: palette.textMuted }]}>
                {completedSteps}/{totalSteps}
              </Text>
            </View>
            <StepTimeline
              steps={timelineSteps}
              currentIndex={mission.current_step_index}
            />
          </View>
        ) : (
          <View style={[styles.emptySteps, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emptyStepsIcon}>📋</Text>
            <Text style={[styles.emptyStepsTitle, { color: palette.textSecondary }]}>
              Nessuno step configurato
            </Text>
            <Text style={[styles.emptyStepsDesc, { color: palette.textMuted }]}>
              L'agente non ha step da eseguire.
            </Text>
          </View>
        )}

        </View>{/* end leftCol */}

        {/* RIGHT column: step cards + insights + summary */}
        <View style={styles.rightCol}>

        {/* ── 5. Expanded Step Cards ──────────────────────────────── */}
        {totalSteps > 0 && (
          <View style={styles.section}>
            {steps.map((step, i) => {
              const stepStatus = getStepResultStatus(
                i,
                mission.step_results,
                mission.current_step_index,
                mission.status,
              );
              const stepMeta = STEP_STATUS[stepStatus] ?? STEP_STATUS.PENDING;
              const result = (mission.step_results ?? []).find((r) => r.step_index === i);
              const isCurrent = i === mission.current_step_index;
              const canAct =
                (stepStatus === 'PENDING' || isCurrent) &&
                !isDone &&
                mission.status !== 'PENDING';
              const showManual =
                !step.auto_run || mission.mode === 'REGISTA';

              return (
                <View
                  key={i}
                  style={[
                    styles.stepCard,
                    {
                      backgroundColor: palette.card,
                      borderColor:
                        stepStatus === 'RUNNING'
                          ? `${palette.cyan}44`
                          : palette.border,
                    },
                  ]}
                >
                  {/* Step header */}
                  <View style={styles.stepCardHeader}>
                    <View style={styles.stepCardHeaderLeft}>
                      <Text style={[styles.stepNumber, { color: palette.textMuted }]}>
                        Step {i + 1}
                      </Text>
                      <Text style={[styles.stepLabel, { color: palette.text }]}>
                        {step.label}
                      </Text>
                    </View>

                    {/* Status pill */}
                    <View
                      style={[
                        styles.stepStatusPill,
                        {
                          backgroundColor: `${stepMeta.color}18`,
                          borderColor: `${stepMeta.color}44`,
                        },
                      ]}
                    >
                      {stepStatus === 'RUNNING' && <LiveDot color={stepMeta.color} />}
                      <Text style={[styles.stepStatusText, { color: stepMeta.color }]}>
                        {stepMeta.label}
                      </Text>
                    </View>
                  </View>

                  {/* Tool ID */}
                  <Text style={[styles.toolId, { color: palette.textMuted }]}>
                    {step.tool_id}
                  </Text>

                  {/* Badges row */}
                  <View style={styles.stepBadgeRow}>
                    {step.auto_run && (
                      <View style={[styles.stepBadge, { backgroundColor: palette.elevated }]}>
                        <Text style={[styles.stepBadgeText, { color: palette.textSecondary }]}>
                          Automatico
                        </Text>
                      </View>
                    )}
                    {!step.required && (
                      <View style={[styles.stepBadge, { backgroundColor: palette.elevated }]}>
                        <Text style={[styles.stepBadgeText, { color: palette.textMuted }]}>
                          Opzionale
                        </Text>
                      </View>
                    )}
                    {step.condition && (
                      <View style={[styles.stepBadge, { backgroundColor: palette.elevated }]}>
                        <Text style={[styles.stepBadgeText, { color: palette.textMuted }]}>
                          Condizione: {step.condition}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Running indicator */}
                  {stepStatus === 'RUNNING' && (
                    <View style={styles.stepRunning}>
                      <ActivityIndicator size="small" color={palette.cyan} />
                      <Text style={[styles.stepRunningText, { color: palette.cyan }]}>
                        In esecuzione...
                      </Text>
                    </View>
                  )}

                  {/* Output preview */}
                  {stepStatus === 'COMPLETED' && result?.output && (
                    <StepOutputPreview
                      toolId={step.tool_id ?? 'unknown'}
                      output={result.output as Record<string, unknown>}
                    />
                  )}

                  {/* Action buttons */}
                  {canAct && showManual && stepStatus !== 'RUNNING' && (
                    <View style={styles.stepActions}>
                      <Pressable
                        onPress={() => executeStep(i)}
                        style={({ pressed }) => [
                          styles.stepActionBtn,
                          {
                            backgroundColor: `${palette.cyan}18`,
                            borderColor: palette.cyan,
                          },
                          pressed && { opacity: 0.7 },
                          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                        ]}
                      >
                        <Text style={[styles.stepActionText, { color: palette.cyan }]}>
                          Esegui
                        </Text>
                      </Pressable>
                      {!step.required && (
                        <Pressable
                          onPress={() => skipStep(i)}
                          style={({ pressed }) => [
                            styles.stepActionBtn,
                            { borderColor: palette.border },
                            pressed && { opacity: 0.7 },
                            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                          ]}
                        >
                          <Text style={[styles.stepActionText, { color: palette.textMuted }]}>
                            Salta
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── 6. Insights Section ─────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Insight AI</Text>
            {pendingInsights.length > 0 && (
              <View style={[styles.insightCountBadge, { backgroundColor: `${palette.violet}22` }]}>
                <Text style={[styles.insightCountText, { color: palette.violet }]}>
                  {pendingInsights.length}
                </Text>
              </View>
            )}
          </View>

          {pendingInsights.length === 0 && historyInsights.length === 0 && (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>
              Nessun insight disponibile
            </Text>
          )}

          {pendingInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onAccept={() => acceptInsight(insight.id)}
              onDismiss={() => dismissInsight(insight.id)}
            />
          ))}

          {/* History (collapsed) */}
          {historyInsights.length > 0 && (
            <View style={styles.historySection}>
              <Pressable
                onPress={() => setInsightHistoryOpen((o) => !o)}
                style={({ pressed }) => [
                  styles.historyToggle,
                  pressed && { opacity: 0.7 },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
              >
                <Text style={[styles.historyToggleText, { color: palette.textSecondary }]}>
                  {insightHistoryOpen ? '▾' : '▸'} Cronologia ({historyInsights.length})
                </Text>
              </Pressable>
              {insightHistoryOpen &&
                historyInsights.map((insight) => (
                  <InsightCard key={insight.id} insight={insight} />
                ))}
            </View>
          )}
        </View>

        {/* ── 7. Mission Summary (COMPLETED) ──────────────────────── */}
        {mission.status === 'COMPLETED' && mission.completed_at && (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: palette.card, borderColor: `${palette.cyan}33` },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: palette.text }]}>
              Riepilogo missione
            </Text>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>
                Tempo totale
              </Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {formatDuration(mission.started_at, mission.completed_at)}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>
                Step completati
              </Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {completedSteps}/{totalSteps}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>
                Insight applicati
              </Text>
              <Text style={[styles.summaryValue, { color: palette.text }]}>
                {acceptedCount}
              </Text>
            </View>

            <Pressable
              onPress={() => router.push(`/project/${mission.project_id}`)}
              style={({ pressed }) => [
                styles.projectBtn,
                {
                  backgroundColor: `${palette.cyan}18`,
                  borderColor: palette.cyan,
                },
                pressed && { opacity: 0.7 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              ]}
            >
              <Text style={[styles.projectBtnText, { color: palette.cyan }]}>
                Vai al progetto
              </Text>
            </Pressable>
          </View>
        )}
        </View>{/* end rightCol */}
        </View>{/* end mainLayout */}
      </ScrollView>
    </View>
    </AnimatedScreen>
  );
}

/* ══════════════════════════════ STYLES ═══════════════════════════════════ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxxl,
    gap: SPACING.md,
  },
  scrollContentDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%' as any,
  },

  /* Center states */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  loadingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  errorEmoji: {
    fontSize: 40,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  retryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },

  /* Header */
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  backBtn: {
    paddingVertical: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  backText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    flex: 1,
    justifyContent: 'flex-end',
  },
  agentIcon: {
    fontSize: 22,
  },
  agentName: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    letterSpacing: -0.2,
    flexShrink: 1,
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

  /* Sections */
  section: {
    gap: SPACING.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },

  /* Action row */
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  actionPrimary: {},
  actionBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  staticBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  staticBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },

  /* Step cards */
  stepCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  stepCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  stepNumber: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepLabel: {
    fontFamily: FONTS.displayBold,
    fontSize: 14,
    letterSpacing: -0.1,
    flex: 1,
  },
  stepStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  stepStatusText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  toolId: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  stepBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  stepBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  stepRunning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  stepRunningText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
  },
  stepActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
  },
  stepActionBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  stepActionText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  /* Output preview */
  outputContainer: {
    gap: 4,
    paddingTop: SPACING.xs,
  },
  outputRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  outputKey: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
    minWidth: 60,
  },
  outputValue: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    flex: 1,
  },
  outputMore: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    fontStyle: 'italic',
  },

  /* Insights */
  insightCountBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightCountText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
  },
  emptyText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  historySection: {
    gap: SPACING.sm,
  },
  historyToggle: {
    paddingVertical: SPACING.xs,
  },
  historyToggleText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },

  /* Empty steps state */
  emptySteps: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyStepsIcon: {
    fontSize: 36,
  },
  emptyStepsTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStepsDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
  },

  /* Summary card */
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  summaryTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  summaryValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },
  projectBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  projectBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },

  /* Responsive 2-column layout */
  mainLayout: {
    gap: SPACING.md,
  },
  mainLayoutDesktop: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    gap: SPACING.lg,
  },
  leftCol: {
    gap: SPACING.md,
  },
  leftColDesktop: {
    flex: 1,
    minWidth: 280,
    maxWidth: 360,
  },
  rightCol: {
    flex: 1,
    gap: SPACING.md,
  },
});
