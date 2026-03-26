import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { PhaseTabBar } from '@/components/PhaseTabBar';
import { PhaseContent } from '@/components/PhaseContent';
import { useProject } from '@/hooks/useProject';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { project, loading, advancePhase, setActivePhase, addFileToPhase, deleteFile, moveFile } = useProject(id);
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);

  const isDesktop = width >= 1024;

  useEffect(() => {
    if (project) {
      setSelectedPhaseIndex(project.currentPhaseIndex);
    }
  }, [project?.id]);

  const handleSelectPhase = (index: number) => {
    setSelectedPhaseIndex(index);
    if (project && project.phases[index].status === 'pending') {
      setActivePhase(index);
    }
  };

  const handleCompletePhase = () => {
    if (!project) return;
    const isLast = selectedPhaseIndex === project.phases.length - 1;
    const msg = isLast ? 'Completare il progetto?' : 'Avanzare alla fase successiva?';

    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
      advancePhase().then(() => {
        if (!isLast) setSelectedPhaseIndex(selectedPhaseIndex + 1);
      });
      return;
    }
    Alert.alert('Conferma', msg, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: isLast ? 'Completa' : 'Avanza',
        onPress: () => {
          advancePhase().then(() => {
            if (!isLast) setSelectedPhaseIndex(selectedPhaseIndex + 1);
          });
        },
      },
    ]);
  };

  const handleUpload = () => {
    // File upload — in v1 show alert since expo-document-picker needs native module
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file || !project) return;
        const phase = project.phases[selectedPhaseIndex];
        const uri = URL.createObjectURL(file);
        try {
          await addFileToPhase(phase.id, uri, file.name, file.type || 'application/octet-stream', file.size);
        } catch (err) {
          window.alert('Errore nel caricamento del file.');
        }
      };
      input.click();
      return;
    }
    Alert.alert(
      'Aggiungi file',
      'Seleziona la sorgente',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Documento', onPress: () => pickDocument() },
      ],
    );
  };

  const pickDocument = async () => {
    if (!project) return;
    try {
      // Dynamic import to avoid crash if module not installed
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      const phase = project.phases[selectedPhaseIndex];
      await addFileToPhase(phase.id, asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', asset.size ?? 0);
    } catch {
      Alert.alert('Errore', 'Impossibile aprire il documento.');
    }
  };

  const handleToolPress = (toolId: string) => {
    if (!project) return;
    const phase = project.phases[selectedPhaseIndex];
    router.push(`/tool/${toolId}?projectId=${project.id}&phaseId=${phase.id}`);
  };

  const handleDeleteFile = async (phaseId: string, fileId: string) => {
    await deleteFile(phaseId, fileId);
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
      if (idx >= 0 && idx < otherPhases.length) {
        await moveFile(fileId, fromPhaseId, otherPhases[idx].id);
      }
      return;
    }
    Alert.alert('Sposta in...', undefined,
      otherPhases.map(p => ({
        text: `${p.icon} ${p.name}`,
        onPress: () => moveFile(fileId, fromPhaseId, p.id),
      })).concat([{ text: 'Annulla', style: 'cancel' } as any]),
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

  return (
    <View style={styles.container}>
      <CosmicBackground />

      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.backArrow}>←</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.projectName} numberOfLines={1}>{project.name}</Text>
          <Text style={styles.phaseProgress}>
            Fase {selectedPhaseIndex + 1} di {project.phases.length}
          </Text>
        </View>

        {project.status === 'completed' && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedBadgeText}>✅ Completato</Text>
          </View>
        )}
      </View>

      {/* Phase tab bar */}
      <PhaseTabBar
        phases={project.phases}
        activeIndex={selectedPhaseIndex}
        onSelect={handleSelectPhase}
      />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Phase content */}
      {currentPhase && (
        <View style={[styles.phaseArea, isDesktop && styles.phaseAreaDesktop]}>
          <PhaseContent
            phase={currentPhase}
            project={project}
            onToolPress={handleToolPress}
            onUpload={handleUpload}
            onCompletePhase={handleCompletePhase}
            onDeleteFile={handleDeleteFile}
            onMoveFile={handleMoveFile}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.select({ web: 24, ios: 56, default: 40 }),
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  headerDesktop: {
    paddingTop: 24,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { fontFamily: FONTS.displayBold, fontSize: 18, color: COLORS.textSecondary },
  headerCenter: { flex: 1 },
  projectName: { ...TYPO.h3, color: COLORS.textPrimary },
  phaseProgress: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: COLORS.neonLime + '22',
    borderWidth: 1,
    borderColor: COLORS.neonLime + '44',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  completedBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.neonLime,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: SPACING.lg,
  },
  phaseArea: { flex: 1 },
  phaseAreaDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
});
