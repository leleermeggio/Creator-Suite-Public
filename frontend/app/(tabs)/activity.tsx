import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { useJobs } from '@/hooks/useJobs';
import { TOOLS } from '@/constants/tools';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

function getToolInfo(toolId: string) {
  return TOOLS.find((t) => t.id === toolId);
}

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Adesso';
  if (diffMin < 60) return `${diffMin}m fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h fa`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}g fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

const STATUS_CONFIG = {
  running: {
    label: 'In corso',
    bg: COLORS.neonCyan + '22',
    border: COLORS.neonCyan + '44',
    text: COLORS.neonCyan,
  },
  completed: {
    label: 'Completato',
    bg: COLORS.neonLime + '22',
    border: COLORS.neonLime + '44',
    text: COLORS.neonLime,
  },
  failed: {
    label: 'Errore',
    bg: COLORS.neonPink + '22',
    border: COLORS.neonPink + '44',
    text: COLORS.neonPink,
  },
} as const;

export default function ActivityScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { jobs, loading } = useJobs();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDesktop = width >= 1024;
  const horizontalPad = isDesktop ? 48 : 20;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const runningJobs = jobs.filter((j) => j.status === 'running');
  const recentJobs = jobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed',
  );

  const renderJobCard = (job: (typeof jobs)[0]) => {
    const tool = getToolInfo(job.toolId);
    const status = STATUS_CONFIG[job.status];

    return (
      <GlowCard
        key={job.id}
        gradient={tool?.gradient || COLORS.gradCyan}
        glowIntensity={job.status === 'running' ? 0.25 : 0.08}
        borderWidth={1}
        onPress={
          job.status === 'completed' && job.projectId
            ? () => router.push(`/project/${job.projectId}`)
            : undefined
        }
        style={{ marginBottom: SPACING.md }}
      >
        <View style={styles.jobRow}>
          <Text style={styles.jobIcon}>{tool?.icon || '🔧'}</Text>
          <View style={styles.jobInfo}>
            <Text style={styles.jobToolName}>
              {tool?.name || job.toolId}
            </Text>
            <Text style={styles.jobInput} numberOfLines={1}>
              {job.inputSummary}
            </Text>
            {job.error && (
              <Text style={styles.jobError} numberOfLines={1}>
                {job.error}
              </Text>
            )}
          </View>
          <View style={styles.jobRight}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: status.bg,
                  borderColor: status.border,
                },
              ]}
            >
              <Text style={[styles.statusText, { color: status.text }]}>
                {status.label}
              </Text>
            </View>
            <Text style={styles.jobTime}>
              {formatTimestamp(job.completedAt || job.startedAt)}
            </Text>
          </View>
        </View>
      </GlowCard>
    );
  };

  const isEmpty = jobs.length === 0 && !loading;

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPad,
            maxWidth: isDesktop ? 700 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
            Attività
          </GradientText>
          <Text style={styles.subtitle}>
            {isEmpty
              ? 'Nessuna attività recente'
              : `${jobs.length} operazion${jobs.length === 1 ? 'e' : 'i'}`}
          </Text>
        </Animated.View>

        {isEmpty && (
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Nessuna attività recente</Text>
            <Text style={styles.emptySubtitle}>
              Le operazioni eseguite con gli strumenti appariranno qui
            </Text>
          </Animated.View>
        )}

        {/* Running jobs */}
        {runningJobs.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>In corso</Text>
              <View style={styles.sectionLine} />
            </View>
            {runningJobs.map(renderJobCard)}
          </Animated.View>
        )}

        {/* Recent jobs */}
        {recentJobs.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recenti</Text>
              <View style={styles.sectionLine} />
            </View>
            {recentJobs.map(renderJobCard)}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Platform.select({ web: 40, default: 60 }),
    paddingBottom: 100,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  subtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitle: {
    ...TYPO.label,
    color: COLORS.textMuted,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  jobIcon: {
    fontSize: 28,
  },
  jobInfo: {
    flex: 1,
  },
  jobToolName: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  jobInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  jobError: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.neonPink,
    marginTop: 2,
  },
  jobRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  jobTime: {
    ...TYPO.caption,
    color: COLORS.textMuted,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPO.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
