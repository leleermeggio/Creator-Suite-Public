import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { PhaseTabBar } from '@/components/PhaseTabBar';
import { PhaseContent } from '@/components/PhaseContent';
import { ContentBriefPanel } from '@/components/ContentBriefPanel';
import { CaptionEditor, type CaptionSegment } from '@/components/CaptionEditor';
import { useProject } from '@/hooks/useProject';
import { COLORS, SPACING, TYPO, FONTS, RADIUS, BORDERS } from '@/constants/theme';
import { AnimatedScreen } from '@/components/animated';
import type { ContentBrief } from '@/types';

const TABS = ['Fasi', 'Captions'] as const;
type Tab = (typeof TABS)[number];

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { project, loading, advancePhase, setActivePhase, addFileToPhase, deleteFile, moveFile, updateBrief } = useProject(id);
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [showBriefPanel, setShowBriefPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('Fasi');
  const [captionSegments, setCaptionSegments] = useState<CaptionSegment[]>([]);

  const isDesktop = width >= 1024;

  useEffect(() => {
    if (project) setSelectedPhaseIndex(project.currentPhaseIndex);
  }, [project?.id]);

  const handleSelectPhase = (index: number) => {
    setSelectedPhaseIndex(index);
    if (project && project.phases[index].status === 'pending') setActivePhase(index);
  };

  const handleCompletePhase = () => {
    if (!project) return;
    const isLast = selectedPhaseIndex === project.phases.length - 1;
    const msg = isLast ? 'Completare il progetto?' : 'Avanzare alla fase successiva?';
    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      advancePhase().then(() => { if (!isLast) setSelectedPhaseIndex(selectedPhaseIndex + 1); });
      return;
    }
    Alert.alert('Conferma', msg, [
      { text: 'Annulla', style: 'cancel' },
      { text: isLast ? 'Completa' : 'Avanza', onPress: () => advancePhase().then(() => { if (!isLast) setSelectedPhaseIndex(selectedPhaseIndex + 1); }) },
    ]);
  };

  const handleUpload = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file || !project) return;
        const phase = project.phases[selectedPhaseIndex];
        try {
          await addFileToPhase(phase.id, URL.createObjectURL(file), file.name, file.type || 'application/octet-stream', file.size);
        } catch { window.alert('Errore nel caricamento del file.'); }
      };
      input.click();
      return;
    }
    Alert.alert('Aggiungi file', 'Seleziona la sorgente', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Documento', onPress: pickDocument },
    ]);
  };

  const pickDocument = async () => {
    if (!project) return;
    try {
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const phase = project.phases[selectedPhaseIndex];
      await addFileToPhase(phase.id, asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', asset.size ?? 0);
    } catch { Alert.alert('Errore', 'Impossibile aprire il documento.'); }
  };

  const handleToolPress = (toolId: string) => {
    if (!project) return;
    const phase = project.phases[selectedPhaseIndex];
    router.push(`/tool/${toolId}?projectId=${project.id}&phaseId=${phase.id}`);
  };

  const handleAgentPress = (presetId: string) => {
    if (!project) return;
    router.push(`/agent/new?preset=${presetId}&projectId=${project.id}` as any);
  };

  const handleMoveFile = async (fileId: string, fromPhaseId: string) => {
    if (!project) return;
    const otherPhases = project.phases.filter(p => p.id !== fromPhaseId);
    if (otherPhases.length === 0) return;
    if (Platform.OS === 'web') {
      const names = otherPhases.map((p, i) => `${i + 1}. ${p.icon} ${p.name}`).join('\n');
      const input = window.prompt(`Sposta in quale fase?\n${names}\n\nScrivi il numero:`);
      if (!input) return;
      const idx = parseInt(input) - 1;
      if (idx >= 0 && idx < otherPhases.length) await moveFile(fileId, fromPhaseId, otherPhases[idx].id);
      return;
    }
    Alert.alert('Sposta in...', undefined,
      otherPhases.map(p => ({ text: `${p.icon} ${p.name}`, onPress: () => moveFile(fileId, fromPhaseId, p.id) }))
        .concat([{ text: 'Annulla', style: 'cancel' } as any]),
    );
  };

  if (loading || !project) {
    return (
      <View style={styles.loadingContainer}>
        <CosmicBackground />
        <ActivityIndicator color={COLORS.neonCyan} size="large" />
      </View>
    );
  }

  const currentPhase = project.phases[selectedPhaseIndex];
  const completedPhases = project.phases.filter(p => p.status === 'completed').length;
  const progressPct = project.phases.length > 0 ? Math.round((completedPhases / project.phases.length) * 100) : 0;
  const briefStatus = project.contentBrief?.status;

  const briefPanelNode = (
    <ContentBriefPanel
      brief={project.contentBrief}
      onSave={(b: ContentBrief) => updateBrief(b)}
      collapsed={briefCollapsed}
      onToggle={() => setBriefCollapsed(v => !v)}
    />
  );

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <AnimatedScreen>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
          <View style={styles.headerMeta}>
            <View style={styles.progressBarWrap}>
              <View style={[styles.progressBarFill, { width: `${progressPct}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{progressPct}%</Text>
            <Text style={styles.phaseSep}>·</Text>
            <Text style={styles.phaseLabel}>
              {project.status === 'completed' ? '✅ Completato' : `Fase ${selectedPhaseIndex + 1}/${project.phases.length}`}
            </Text>
          </View>
        </View>

        {/* Launch agent button */}
        <Pressable
          onPress={() => router.push(`/mission/launch?projectId=${id}` as any)}
          style={styles.launchAgentBtn}
        >
          <Text style={styles.launchAgentText}>🤖 Agente</Text>
        </Pressable>

        {/* Brief toggle button */}
        <Pressable
          onPress={() => setShowBriefPanel(v => !v)}
          style={[styles.briefToggleBtn, showBriefPanel && styles.briefToggleBtnActive]}
        >
          <Text style={styles.briefToggleIcon}>📋</Text>
          {briefStatus === 'scheduled' && <View style={[styles.briefDot, { backgroundColor: COLORS.neonYellow }]} />}
          {briefStatus === 'published' && <View style={[styles.briefDot, { backgroundColor: COLORS.neonLime }]} />}
        </Pressable>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabSwitcher}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabSwitcherBtn, activeTab === tab && styles.tabSwitcherBtnActive]}
          >
            <Text style={[styles.tabSwitcherText, activeTab === tab && styles.tabSwitcherTextActive]}>
              {tab === 'Fasi' ? '📋 Fasi' : '💬 Captions'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Phase tab bar (only on Fasi tab) */}
      {activeTab === 'Fasi' && (
        <PhaseTabBar
          phases={project.phases}
          activeIndex={selectedPhaseIndex}
          onSelect={handleSelectPhase}
        />
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {activeTab === 'Fasi' ? (
        /* Phase content */
        currentPhase && (
          <View style={[styles.phaseArea, isDesktop && styles.phaseAreaDesktop]}>
            <PhaseContent
              phase={currentPhase}
              project={project}
              onToolPress={handleToolPress}
              onUpload={handleUpload}
              onCompletePhase={handleCompletePhase}
              onDeleteFile={(phaseId, fileId) => deleteFile(phaseId, fileId)}
              onMoveFile={handleMoveFile}
              onAgentPress={handleAgentPress}
            />
          </View>
        )
      ) : (
        /* Caption editor */
        <View style={[styles.phaseArea, isDesktop && styles.phaseAreaDesktop]}>
          <CaptionEditor
            segments={captionSegments}
            onChange={setCaptionSegments}
            onExport={(segs) => {
              const srt = segs
                .map((s, i) => {
                  const fmt = (t: number) => {
                    const h = Math.floor(t / 3600);
                    const m = Math.floor((t % 3600) / 60);
                    const sec = Math.floor(t % 60);
                    const ms = Math.floor((t % 1) * 1000);
                    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
                  };
                  return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${s.text}`;
                })
                .join('\n\n');
              if (Platform.OS === 'web') {
                const blob = new Blob([srt], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project.name}.srt`;
                a.click();
              } else {
                Alert.alert('Export SRT', 'Funzione disponibile su web.');
              }
            }}
          />
        </View>
      )}
      </AnimatedScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.select({ web: 20, ios: 52, default: 36 }),
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BORDERS.subtle,
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.textSecondary },
  headerCenter: { flex: 1 },
  projectName: { ...TYPO.h3, color: COLORS.textPrimary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4 },
  progressBarWrap: {
    width: 60, height: 4, borderRadius: 2,
    backgroundColor: BORDERS.subtle, overflow: 'hidden',
  },
  progressBarFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.neonCyan },
  progressLabel: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.neonCyan },
  phaseSep: { fontSize: 11, color: COLORS.textMuted },
  phaseLabel: { fontFamily: FONTS.bodyRegular, fontSize: 11, color: COLORS.textMuted },

  // Launch agent button
  launchAgentBtn: {
    height: 36, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(0,255,208,0.08)',
    borderWidth: 1, borderColor: BORDERS.active,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  launchAgentText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.neonCyan,
  },

  // Brief toggle
  briefToggleBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: BORDERS.subtle,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
    position: 'relative',
  },
  briefToggleBtnActive: {
    backgroundColor: COLORS.neonViolet + '18',
    borderColor: COLORS.neonViolet + '44',
  },
  briefToggleIcon: { fontSize: 16 },
  briefDot: {
    position: 'absolute', top: 4, right: 4,
    width: 6, height: 6, borderRadius: 3,
  },

  divider: { height: 1, backgroundColor: BORDERS.subtle, marginHorizontal: SPACING.lg },

  // Split pane (desktop)
  splitPane: { flex: 1, flexDirection: 'row' },
  mainPane: { flex: 1 },
  briefPane: {
    width: 300,
    borderLeftWidth: 1,
    borderLeftColor: BORDERS.subtle,
    padding: SPACING.lg,
  },

  // Brief panel (mobile)
  briefPanelMobile: {
    margin: SPACING.md,
  },
  phaseArea: { flex: 1 },
  phaseAreaDesktop: { maxWidth: 900, alignSelf: 'center', width: '100%' },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  tabSwitcherBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    backgroundColor: 'transparent',
  },
  tabSwitcherBtnActive: {
    backgroundColor: 'rgba(0,255,208,0.08)',
    borderColor: BORDERS.active,
  },
  tabSwitcherText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
    letterSpacing: 0.2,
  },
  tabSwitcherTextActive: {
    color: COLORS.neonCyan,
    fontFamily: FONTS.bodySemiBold,
  },
});
