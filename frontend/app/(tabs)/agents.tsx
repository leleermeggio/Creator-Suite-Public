import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, SPACING, RADIUS, BORDERS, type ThemePalette } from '@/constants/theme';
import { GlowCard } from '@/components/GlowCard';
import { useAgents } from '@/hooks/useAgents';
import { listMissions, type MissionResponse } from '@/services/missionsApi';
import { AgentCard } from '@/components/AgentCard';
import { AnimatedCard } from '@/components/animated';
import { MissionCard } from '@/components/MissionCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import type { AgentResponse } from '@/services/agentsApi';

function StatCard({ label, value, color }: { label: string; value: number | string; color: string; palette: ThemePalette }) {
  return (
    <GlowCard variant="subtle" style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlowCard>
  );
}

function SectionHeader({ title, action, onAction, palette }: { title: string; action?: string; onAction?: () => void; palette: ThemePalette }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: palette.cyan }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CreateAgentCard({ onPress, palette }: { onPress: () => void; palette: ThemePalette }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      {...(Platform.OS === 'web' ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      } : {})}
      style={({ pressed }) => [
        styles.createCard,
        {
          backgroundColor: hovered ? palette.elevated : palette.card,
          borderColor: hovered ? palette.borderActive : `${palette.border}`,
          borderStyle: 'dashed' as any,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[styles.createIconCircle, { backgroundColor: `${palette.cyan}18`, borderColor: `${palette.cyan}33` }]}>
        <Text style={styles.createIcon}>+</Text>
      </View>
      <Text style={[styles.createTitle, { color: palette.text }]}>Nuovo Agente</Text>
      <Text style={[styles.createDesc, { color: palette.textMuted }]}>Crea o genera con AI</Text>
    </Pressable>
  );
}

function PresetAgentCard({ agent, onPress, palette }: { agent: AgentResponse; onPress: () => void; palette: ThemePalette }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      {...(Platform.OS === 'web' ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      } : {})}
      style={({ pressed }) => [
        styles.presetCard,
        {
          backgroundColor: hovered ? palette.elevated : palette.card,
          borderColor: hovered ? palette.borderActive : palette.border,
        },
        pressed && { opacity: 0.85 },
        Platform.OS === 'web' && ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any),
      ]}
    >
      <Text style={styles.presetCardIcon}>{agent.icon}</Text>
      <Text style={[styles.presetCardName, { color: palette.text }]} numberOfLines={1}>
        {agent.name}
      </Text>
      <Text style={[styles.presetCardSteps, { color: palette.textMuted }]}>
        {(agent.steps ?? []).length} steps
      </Text>
      <Pressable
        onPress={onPress}
        style={[styles.presetStartBtn, { backgroundColor: `${palette.cyan}18`, borderColor: `${palette.cyan}33` }]}
      >
        <Text style={[styles.presetStartText, { color: palette.cyan }]}>Avvia →</Text>
      </Pressable>
    </Pressable>
  );
}

export default function AgentsScreen() {
  const { palette } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const numCols = isDesktop ? 3 : 2;

  const { agents, presets, loading: agentsLoading, refresh: refreshAgents } = useAgents();
  const [missions, setMissions] = useState<MissionResponse[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const agentMap = React.useMemo(() => {
    const map = new Map<string, AgentResponse>();
    [...agents, ...presets].forEach((a) => map.set(a.id, a));
    return map;
  }, [agents, presets]);

  const fetchMissions = useCallback(async () => {
    try {
      const data = await listMissions();
      setMissions(data);
    } catch {
      // offline or unauthenticated — silently skip
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMissions();
  }, [fetchMissions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshAgents(), fetchMissions()]);
    setRefreshing(false);
  }, [refreshAgents, fetchMissions]);

  const activeMissions = missions.filter(
    (m) => m.status === 'RUNNING' || m.status === 'PAUSED' || m.status === 'PENDING',
  );
  const completedMissions = missions.filter((m) => m.status === 'COMPLETED');

  const thisWeekCompleted = completedMissions.filter((m) => {
    if (!m.completed_at) return false;
    const d = new Date(m.completed_at);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;

  const isLoading = agentsLoading && missionsLoading && !refreshing;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {isDesktop && (
        <ScreenHeader
          title="I tuoi Agenti"
          subtitle="Automation Workspace"
          gradient={['#8B5CF6', '#3B82F6']}
        />
      )}
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.cyan}
          colors={[palette.cyan]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ─────────────────────────────────────── */}
      {!isDesktop && <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: palette.text }]}>I tuoi Agenti</Text>
          <Text style={[styles.headerSub, { color: palette.textSecondary }]}>
            Automation Workspace
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push('/activity' as any)}
            style={({ pressed }) => [
              styles.headerBtn,
              { borderColor: palette.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.headerBtnText, { color: palette.textSecondary }]}>📋 Cronologia</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/mission/launch' as any)}
            style={({ pressed }) => [
              styles.headerBtnPrimary,
              { backgroundColor: `${palette.violet}18`, borderColor: `${palette.violet}60` },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.headerBtnText, { color: palette.violet }]}>🚀 Nuova Missione</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/agent/new' as any)}
            style={({ pressed }) => [
              styles.headerBtnPrimary,
              { backgroundColor: `${palette.cyan}18`, borderColor: palette.borderActive },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.headerBtnText, { color: palette.cyan }]}>＋ Nuovo Agente</Text>
          </Pressable>
        </View>
      </View>}

      {/* ── Stats bar ──────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatCard label="Totale" value={agents.length} color={palette.text} palette={palette} />
        <StatCard label="Attivi" value={activeMissions.length} color={palette.cyan} palette={palette} />
        <StatCard label="Completate" value={completedMissions.length} color={palette.violet} palette={palette} />
        <StatCard label="Questa Settimana" value={thisWeekCompleted} color={palette.magenta} palette={palette} />
      </View>

      {/* ── Loading state ──────────────────────────────── */}
      {isLoading && (
        <View style={styles.skeletonContainer}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} style={{ marginBottom: 12 }} />
          ))}
        </View>
      )}

      {/* ── Missioni in corso ──────────────────────────── */}
      {activeMissions.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title="Missioni in corso"
            action="Vedi tutte"
            onAction={() => router.push('/activity' as any)}
            palette={palette}
          />
          <View style={styles.missionsList}>
            {activeMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                agent={agentMap.get(mission.agent_id) ?? null}
                onPress={() => router.push(`/mission/${mission.id}` as any)}
              />
            ))}
          </View>
        </View>
      )}

      {/* ── I tuoi agenti ─────────────────────────────── */}
      <View style={styles.section}>
        <SectionHeader
          title="I tuoi agenti"
          action={agents.length > 0 ? `${agents.length} salvati` : undefined}
          palette={palette}
        />

        {!agentsLoading && agents.length === 0 && (
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>Nessun agente creato</Text>
            <Text style={[styles.emptyDesc, { color: palette.textMuted }]}>
              Nessun agente creato. Inizia con un preset!
            </Text>
          </View>
        )}

        <View style={styles.agentGrid}>
          {agentsLoading && agents.length === 0
            ? Array.from({ length: numCols }).map((_, i) => (
                <View key={`skel-${i}`} style={{ width: `${100 / numCols - 1}%` as any }}>
                  <SkeletonCard rows={3} showAvatar />
                </View>
              ))
            : null}
          {agents.map((agent, index) => (
            <AnimatedCard
              key={agent.id}
              index={index}
              onPress={() => router.push(`/agent/${agent.id}` as any)}
              style={{ width: `${100 / numCols - 1}%` as any }}
            >
              <AgentCard
                agent={agent}
                onPress={() => router.push(`/agent/${agent.id}` as any)}
                onEdit={() => router.push(`/agent/${agent.id}` as any)}
              />
            </AnimatedCard>
          ))}
          <View style={{ width: `${100 / numCols - 1}%` as any }}>
            <CreateAgentCard
              onPress={() => router.push('/agent/new' as any)}
              palette={palette}
            />
          </View>
        </View>
      </View>

      {/* ── Inizia subito (preset scroll) ─────────────── */}
      {presets.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Inizia subito" palette={palette} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScroll}
          >
            {presets.map((preset) => (
              <PresetAgentCard
                key={preset.id}
                agent={preset}
                palette={palette}
                onPress={() => router.push(`/agent/${preset.id}` as any)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  headerTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  headerBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  headerBtnPrimary: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  headerBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
  },
  statValue: {
    fontFamily: FONTS.displayExtra,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  statLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: '#7777AA',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
  },
  loadingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  // Sections
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  // Missions
  missionsList: {
    gap: SPACING.sm,
  },
  // Agent grid
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  // Create card
  createCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    minHeight: 140,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  createIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  createIcon: {
    fontSize: 22,
    color: '#00FFD0',
  },
  createTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    textAlign: 'center',
  },
  createDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    textAlign: 'center',
  },
  // Empty state
  emptyBox: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
  },
  emptyDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  // Preset scroll
  presetsScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  presetCard: {
    width: 156,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
    alignItems: 'flex-start',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  presetCardIcon: {
    fontSize: 28,
  },
  presetCardName: {
    fontFamily: FONTS.displayBold,
    fontSize: 13,
    letterSpacing: -0.2,
  },
  presetCardSteps: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  presetStartBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginTop: 2,
  },
  presetStartText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  bottomPad: {
    height: SPACING.xl,
  },
  skeletonContainer: {
    padding: 20,
    gap: 12,
  },
});
