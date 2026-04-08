import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { AnimatedScreen, AnimatedCard, SkeletonCard } from '@/components/animated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { MissionCard } from '@/components/MissionCard';
import { BatchProjectModal, type BatchItem } from '@/components/BatchProjectModal';
import { ContentCalendarStrip } from '@/components/ContentCalendarStrip';
import { useProjects } from '@/hooks/useProjects';
import { listMissions } from '@/services/missionsApi';
import { COLORS, SPACING, TYPO, FONTS, RADIUS, BORDERS, SHADOWS } from '@/constants/theme';
import { GlowCard } from '@/components/GlowCard';
import { useTheme } from '@/hooks/useTheme';
import type { MissionResponse } from '@/services/missionsApi';

type ViewMode = 'grid' | 'list';

export default function ProjectsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const { projects, loading, createProject, deleteProject, archiveProject, unarchiveProject } = useProjects();
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [activeMissions, setActiveMissions] = useState<MissionResponse[]>([]);
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const horizontalPad = isDesktop ? 48 : SPACING.lg;
  const numColumns = viewMode === 'grid' ? (isDesktop ? 3 : isTablet ? 2 : 2) : 1;

  useEffect(() => {
    listMissions()
      .then((all) => setActiveMissions(all.filter((m) => m.status === 'RUNNING' || m.status === 'PAUSED')))
      .catch(() => {});
  }, []);

  const activeProjects = projects
    .filter((p) => p.status !== 'archived')
    .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const archivedProjects = projects.filter((p) => p.status === 'archived');
  const completedCount = projects.filter((p) => p.status === 'completed').length;

  const handleBatchCreate = async (items: BatchItem[]) => {
    for (const item of items) {
      await createProject(item.name, item.phaseTemplates, undefined, item.templateId);
    }
  };

  const handleLongPress = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      const action = window.prompt(
        `Progetto "${name}"\nScrivi "elimina" per eliminare o "archivia" per archiviare:`,
      );
      if (action?.toLowerCase() === 'elimina') deleteProject(id);
      else if (action?.toLowerCase() === 'archivia') archiveProject(id);
      return;
    }
    Alert.alert(name, 'Cosa vuoi fare?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Archivia', onPress: () => archiveProject(id) },
      { text: 'Elimina', style: 'destructive', onPress: () => deleteProject(id) },
    ]);
  };

  const formatTime = (iso: string) => {
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
  };

  const renderProgressRing = (current: number, total: number, color: string) => {
    if (total === 0) return null;
    const pct = Math.round((current / total) * 100);
    return (
      <View style={styles.progressRingWrap}>
        <View style={[styles.progressRingOuter, { borderColor: color + '33' }]}>
          <View style={[styles.progressRingInner, { borderColor: color, borderTopColor: 'transparent', transform: [{ rotate: `${(current / total) * 360}deg` }] }]} />
        </View>
        <Text style={[styles.progressPct, { color }]}>{pct}%</Text>
      </View>
    );
  };

  const renderProjectCard = ({ item, index }: { item: (typeof projects)[0]; index: number }) => {
    const isList = viewMode === 'list';
    const accentColor = item.status === 'completed' ? COLORS.neonLime : COLORS.neonCyan;
    const phasesCompleted = item.currentPhaseIndex;
    const phaseIcons = item.phaseIcons ?? Array.from({ length: item.phaseCount }, () => '●');

    return (
      <AnimatedCard
        index={index}
        onPress={() => router.push(`/project/${item.id}`)}
        style={isList ? styles.projectCardList : styles.projectCardGrid}
      >
      <Pressable
        onLongPress={() => handleLongPress(item.id, item.name)}
        delayLongPress={500}
        style={[
          styles.projectCard,
          isList ? styles.projectCardList : styles.projectCardGrid,
          Platform.OS === 'web' && ({ cursor: 'pointer', transition: 'transform 0.15s ease' } as any),
        ]}
      >

        {/* Card content */}
        <View style={isList ? styles.cardBodyList : styles.cardBodyGrid}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>{item.templateIcon || '📁'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.cardTime}>{formatTime(item.updatedAt)}</Text>
            </View>
            {isList && renderProgressRing(phasesCompleted, item.phaseCount, accentColor)}
          </View>

          {/* Phase flow dots */}
          <View style={styles.phaseFlow}>
            {phaseIcons.map((icon, i) => {
              const done = i < item.currentPhaseIndex;
              const active = i === item.currentPhaseIndex;
              return (
                <React.Fragment key={i}>
                  <View style={[
                    styles.phaseDot,
                    done && styles.phaseDotDone,
                    active && styles.phaseDotActive,
                  ]}>
                    <Text style={[styles.phaseDotIcon, { fontSize: active ? 11 : 9, opacity: done ? 1 : active ? 1 : 0.35 }]}>
                      {icon}
                    </Text>
                  </View>
                  {i < phaseIcons.length - 1 && (
                    <View style={[styles.phaseConnector, { backgroundColor: done ? COLORS.neonLime + '66' : COLORS.textMuted + '33' }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <View style={[styles.statusPill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
              <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
              <Text style={[styles.statusLabel, { color: accentColor }]}>
                {item.status === 'completed' ? 'Completato' : `Fase ${item.currentPhaseIndex + 1}/${item.phaseCount}`}
              </Text>
            </View>
            {!isList && renderProgressRing(phasesCompleted, item.phaseCount, accentColor)}
          </View>
        </View>
      </Pressable>
      </AnimatedCard>
    );
  };

  const renderHeader = () => (
    <View>
      {/* ── Zone 1: Title + Stats ── */}
      <View style={[styles.hubHeader, { paddingHorizontal: horizontalPad }]}>
        <View style={{ flex: 1 }}>
          <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
            Creator Zone
          </GradientText>
          <Text style={styles.hubSubtitle}>Il tuo studio creativo</Text>
        </View>
        <View style={styles.headerBtns}>
          <Pressable
            onPress={() => setShowBatchModal(true)}
            style={({ pressed }) => [styles.batchBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.batchBtnText}>⚡ Serie</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/new-project')}
            style={({ pressed }) => [styles.newBtn, { opacity: pressed ? 0.8 : 1 }]}
          >
            <LinearGradient
              colors={[COLORS.neonCyan, COLORS.neonViolet] as any}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.newBtnGrad}
            >
              <Text style={styles.newBtnText}>+ Nuovo</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {/* KPI cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={{ paddingHorizontal: horizontalPad, gap: SPACING.md }}>
        {[
          { label: 'Totale', value: projects.length, color: COLORS.neonCyan },
          { label: 'Attivi', value: activeProjects.length, color: COLORS.neonViolet },
          { label: 'Completati', value: completedCount, color: COLORS.neonLime },
          { label: 'Missioni', value: activeMissions.length, color: COLORS.neonMagenta },
        ].map((stat) => (
          <GlowCard key={stat.label} variant="subtle" style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.kpiLabel}>{stat.label}</Text>
          </GlowCard>
        ))}
      </ScrollView>

      {/* ── Zone 2: Active Missions ── */}
      {activeMissions.length > 0 && (
        <View style={[styles.sectionBlock, { paddingHorizontal: horizontalPad }]}>
          <Text style={styles.sectionTitle}>⚡ Missioni in corso</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.sm }} contentContainerStyle={{ gap: SPACING.md }}>
            {activeMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onPress={() => router.push(`/mission/${m.id}` as any)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Zone 2.5: Content Calendar ── */}
      <View style={[styles.sectionBlock, { paddingHorizontal: horizontalPad }]}>
        <ContentCalendarStrip
          projects={projects.filter(p => p.status !== 'archived' && p.publishDate)}
          onProjectPress={(id) => router.push(`/project/${id}`)}
        />
      </View>

      {/* ── Zone 3: Projects section header ── */}
      <View style={[styles.projectsHeaderRow, { paddingHorizontal: horizontalPad }]}>
        <Text style={styles.sectionTitle}>📁 I tuoi Progetti</Text>
        <View style={styles.viewToggle}>
          {(['grid', 'list'] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={[styles.viewToggleBtn, viewMode === mode && styles.viewToggleBtnActive]}
            >
              <Text style={[styles.viewToggleIcon, viewMode === mode && { color: COLORS.neonCyan }]}>
                {mode === 'grid' ? '⊞' : '☰'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Search bar */}
      <View style={[styles.searchRow, { paddingHorizontal: horizontalPad }]}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Cerca progetti..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={styles.searchClear}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { paddingHorizontal: horizontalPad }]}>
      <Text style={styles.emptyIcon}>🎬</Text>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'Nessun risultato' : 'Crea il tuo primo progetto'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `Nessun progetto trovato per "${searchQuery}"`
          : 'Organizza il tuo workflow creativo con fasi, strumenti AI e file'}
      </Text>
      {!searchQuery && (
        <Pressable
          onPress={() => router.push('/new-project')}
          style={({ pressed }) => [styles.emptyCta, { opacity: pressed ? 0.8 : 1 }]}
        >
          <LinearGradient
            colors={[COLORS.neonCyan, COLORS.neonViolet] as any}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.emptyCtaGradient}
          >
            <Text style={styles.emptyCtaText}>+ Nuovo Progetto</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );

  const renderArchivedSection = () => {
    if (archivedProjects.length === 0) return null;
    return (
      <View style={[styles.archivedSection, { paddingHorizontal: horizontalPad }]}>
        <Pressable onPress={() => setShowArchived(!showArchived)} style={styles.archivedHeader}>
          <Text style={styles.archivedLabel}>Archiviati ({archivedProjects.length})</Text>
          <Text style={styles.archivedChevron}>{showArchived ? '▼' : '▶'}</Text>
        </Pressable>
        {showArchived && archivedProjects.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/project/${item.id}`)}
            onLongPress={() => {
              if (Platform.OS === 'web') {
                if (window.confirm(`Ripristinare "${item.name}"?`)) unarchiveProject(item.id);
                return;
              }
              Alert.alert(item.name, 'Ripristinare il progetto?', [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Ripristina', onPress: () => unarchiveProject(item.id) },
              ]);
            }}
            delayLongPress={500}
            style={styles.archivedCard}
          >
            <Text style={styles.cardIcon}>{item.templateIcon || '📁'}</Text>
            <Text style={[styles.cardTitle, { opacity: 0.6 }]} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.archivedTag}>Archiviato</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <CosmicBackground />
      <BatchProjectModal
        visible={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        onConfirm={handleBatchCreate}
      />
      <FlatList
        key={viewMode}
        data={activeProjects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        numColumns={numColumns}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? () => (
          <View style={{ padding: 20, gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} style={{ marginBottom: 12 }} />)}
          </View>
        ) : renderEmptyState}
        ListFooterComponent={renderArchivedSection}
        columnWrapperStyle={viewMode === 'grid' && activeProjects.length > 0 ? { gap: SPACING.sm, paddingHorizontal: horizontalPad } : undefined}
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'list' && { paddingHorizontal: horizontalPad },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingTop: Platform.select({ web: 32, default: 56 }), paddingBottom: 120 },

  // Hub header
  hubHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  hubSubtitle: { ...TYPO.caption, color: COLORS.textSecondary, marginTop: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  batchBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, borderWidth: 1,
    borderColor: COLORS.neonYellow + '44', backgroundColor: COLORS.neonYellow + '0E',
  },
  batchBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.neonYellow },
  newBtn: {},
  newBtnGrad: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
  newBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.bg },

  // KPI cards
  statsRow: { marginBottom: SPACING.lg },
  kpiCard: { minWidth: 88 },
  kpiValue: { fontFamily: FONTS.displayExtra, fontSize: 28, lineHeight: 34, textAlign: 'center' as const },
  kpiLabel: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' as const },

  // Section headers
  sectionBlock: { marginBottom: SPACING.lg },
  sectionTitle: { ...TYPO.label, color: COLORS.textSecondary, fontSize: 12 },
  projectsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },

  // View toggle
  viewToggle: { flexDirection: 'row', gap: 4, backgroundColor: COLORS.bgElevated, borderRadius: RADIUS.sm, padding: 3 },
  viewToggleBtn: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm - 2 },
  viewToggleBtnActive: { backgroundColor: COLORS.bgCard },
  viewToggleIcon: { fontSize: 16, color: COLORS.textMuted },

  // Search
  searchRow: { marginBottom: SPACING.md },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg, paddingVertical: Platform.select({ ios: 12, default: 10 }),
    borderWidth: 1, borderColor: BORDERS.subtle,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.textPrimary },
  searchClear: { fontSize: 12, color: COLORS.textMuted },

  // Project card (grid)
  projectCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, overflow: 'hidden',
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: BORDERS.subtle,
  },
  projectCardGrid: { flex: 1 },
  projectCardList: { width: '100%' },
  cardBodyGrid: { padding: SPACING.lg, gap: SPACING.sm },
  cardBodyList: { padding: SPACING.lg, gap: SPACING.xs, flexDirection: 'column' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardIcon: { fontSize: 26 },
  cardTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.textPrimary, lineHeight: 20 },
  cardTime: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textMuted, marginTop: 1 },

  // Phase flow
  phaseFlow: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xs },
  phaseDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  phaseDotDone: { backgroundColor: COLORS.neonLime + '22' },
  phaseDotActive: { backgroundColor: COLORS.neonCyan + '22', borderWidth: 1.5, borderColor: COLORS.neonCyan },
  phaseDotIcon: { lineHeight: 14 },
  phaseConnector: { flex: 1, height: 1.5, marginHorizontal: 2 },

  // Card footer
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11 },

  // Progress ring (CSS-based approximation)
  progressRingWrap: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  progressRingOuter: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2.5 },
  progressRingInner: { position: 'absolute', width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderLeftColor: 'transparent', borderBottomColor: 'transparent' },
  progressPct: { fontFamily: FONTS.bodyBold, fontSize: 9 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.md },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: { ...TYPO.h2, color: COLORS.textPrimary, textAlign: 'center' },
  emptySubtitle: { ...TYPO.body, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 300 },
  emptyCta: { marginTop: SPACING.lg },
  emptyCtaGradient: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.full },
  emptyCtaText: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: COLORS.bg, textAlign: 'center' },

  // Archived
  archivedSection: { marginTop: SPACING.xl },
  archivedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.md, marginBottom: SPACING.sm },
  archivedLabel: { ...TYPO.label, color: COLORS.textMuted },
  archivedChevron: { fontSize: 12, color: COLORS.textMuted },
  archivedCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm, opacity: 0.6 },
  archivedTag: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textMuted, marginLeft: 'auto' as any },
});
