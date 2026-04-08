import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FileRow } from './FileRow';
import { SuggestedToolCTA } from './SuggestedToolCTA';
import { ToolPill } from './ToolPill';
import { EmptyState } from './EmptyState';
import { TOOLS } from '@/constants/tools';
import { PRESET_AGENTS } from '@/constants/agents';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';
import type { Phase, Project, ProjectFile } from '@/types';

interface PhaseContentProps {
  phase: Phase;
  project: Project;
  onToolPress: (toolId: string) => void;
  onUpload: () => void;
  onCompletePhase: () => void;
  onDeleteFile: (phaseId: string, fileId: string) => void;
  onMoveFile: (fileId: string, fromPhaseId: string) => void;
  onAgentPress?: (presetId: string) => void;
}

export function PhaseContent({
  phase,
  project,
  onToolPress,
  onUpload,
  onCompletePhase,
  onDeleteFile,
  onMoveFile,
  onAgentPress,
}: PhaseContentProps) {
  const [showAllTools, setShowAllTools] = useState(false);

  const suggestedTools = phase.suggestedToolIds
    .map(id => TOOLS.find(t => t.id === id))
    .filter(Boolean) as typeof TOOLS;

  const otherTools = TOOLS.filter(
    t => !phase.suggestedToolIds.includes(t.id) && t.available,
  );

  const primaryTool = suggestedTools[0];
  const restSuggested = suggestedTools.slice(1);

  const isCompleted = phase.status === 'completed';
  const isLastPhase = project.currentPhaseIndex === project.phases.length - 1;

  const handleMoveFile = (file: ProjectFile) => {
    const otherPhases = project.phases.filter(p => p.id !== phase.id);
    if (otherPhases.length === 0) return;

    if (Platform.OS === 'web') {
      const names = otherPhases.map((p, i) => `${i + 1}. ${p.icon} ${p.name}`).join('\n');
      const input = window.prompt(`Sposta in quale fase?\n${names}\n\nScrivi il numero:`);
      if (!input) return;
      const idx = parseInt(input) - 1;
      if (idx >= 0 && idx < otherPhases.length) {
        onMoveFile(file.id, phase.id);
      }
      return;
    }

    Alert.alert('Sposta in...', undefined,
      otherPhases.map(p => ({
        text: `${p.icon} ${p.name}`,
        onPress: () => onMoveFile(file.id, phase.id),
      })).concat([{ text: 'Annulla', style: 'cancel' } as any]),
    );
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Primary suggested tool CTA */}
      {primaryTool && !isCompleted && (
        <View style={styles.section}>
          <SuggestedToolCTA
            icon={primaryTool.icon}
            name={primaryTool.name}
            description={primaryTool.description}
            gradient={primaryTool.gradient}
            onPress={() => onToolPress(primaryTool.id)}
          />
        </View>
      )}

      {/* Files */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>FILE</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.fileCount}>{phase.files.length}</Text>
        </View>

        {phase.files.length === 0 ? (
          <Pressable onPress={onUpload}>
            <View style={styles.emptyFiles}>
              <Text style={styles.emptyFilesIcon}>📎</Text>
              <Text style={styles.emptyFilesText}>Aggiungi un file</Text>
            </View>
          </Pressable>
        ) : (
          phase.files.map(file => (
            <FileRow
              key={file.id}
              file={file}
              onDelete={() => onDeleteFile(phase.id, file.id)}
              onMove={() => handleMoveFile(file)}
            />
          ))
        )}

        {/* Upload button */}
        <Pressable
          onPress={onUpload}
          style={({ pressed }) => [
            styles.uploadBtn,
            { opacity: pressed ? 0.7 : 1 },
            Platform.OS === 'web' && { cursor: 'pointer' as any },
          ]}
        >
          <Text style={styles.uploadBtnText}>+ Aggiungi file</Text>
        </Pressable>
      </View>

      {/* Tool pills */}
      {(restSuggested.length > 0 || otherTools.length > 0) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>STRUMENTI</Text>
            <View style={styles.sectionLine} />
          </View>
          <View style={styles.toolPills}>
            {restSuggested.map(t => (
              <ToolPill
                key={t.id}
                icon={t.icon}
                name={t.name}
                gradient={t.gradient}
                onPress={() => onToolPress(t.id)}
              />
            ))}
            {showAllTools
              ? otherTools.map(t => (
                  <ToolPill
                    key={t.id}
                    icon={t.icon}
                    name={t.name}
                    gradient={t.gradient}
                    onPress={() => onToolPress(t.id)}
                    dimmed
                  />
                ))
              : null}
            {otherTools.length > 0 && (
              <Pressable
                onPress={() => setShowAllTools(!showAllTools)}
                style={styles.showMorePill}
              >
                <Text style={styles.showMoreText}>
                  {showAllTools ? '▲ Meno' : `+ Tutti (${otherTools.length})`}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Complete phase button */}
      {!isCompleted && (
        <Pressable
          onPress={onCompletePhase}
          style={({ pressed }) => [
            { opacity: pressed ? 0.85 : 1, marginTop: SPACING.lg },
          ]}
        >
          <LinearGradient
            colors={[phase.color, phase.color + 'AA'] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.completeBtn}
          >
            <Text style={styles.completeBtnText}>
              {isLastPhase ? '🏁 Completa progetto' : '→ Fase successiva'}
            </Text>
          </LinearGradient>
        </Pressable>
      )}

      {isCompleted && (
        <View style={styles.completedBanner}>
          <Text style={styles.completedBannerText}>✅ Fase completata</Text>
        </View>
      )}

      {/* ── Agent quick-launch ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AGENTI AI</Text>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionHint}>avvia missione</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.agentScrollContent}
        >
          {PRESET_AGENTS.slice(0, 6).map((agent) => (
            <Pressable
              key={agent.preset_id}
              onPress={() => onAgentPress?.(agent.preset_id)}
              style={({ pressed }) => [
                styles.agentChip,
                { opacity: pressed ? 0.75 : 1 },
                !onAgentPress && styles.agentChipDisabled,
              ]}
            >
              <Text style={styles.agentChipIcon}>{agent.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.agentChipName} numberOfLines={1}>{agent.name}</Text>
                <Text style={styles.agentChipSteps}>{agent.steps.length} step</Text>
              </View>
              <View style={[styles.modePip, { backgroundColor: agent.default_mode === 'AUTOPILOTA' ? COLORS.neonLime + '33' : COLORS.neonCyan + '22' }]}>
                <Text style={[styles.modePipText, { color: agent.default_mode === 'AUTOPILOTA' ? COLORS.neonLime : COLORS.neonCyan }]}>
                  {agent.default_mode === 'REGISTA' ? '🎬' : agent.default_mode === 'COPILOTA' ? '🤝' : '🚀'}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sectionHint: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.neonViolet,
    letterSpacing: 0.5,
  },
  agentScrollContent: { gap: SPACING.sm, paddingVertical: 2 },
  agentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.neonViolet + '33',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    width: 160,
  },
  agentChipDisabled: { opacity: 0.45 },
  agentChipIcon: { fontSize: 20 },
  agentChipName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    color: COLORS.textPrimary,
    lineHeight: 16,
  },
  agentChipSteps: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 10,
    color: COLORS.textMuted,
  },
  modePip: {
    width: 22, height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePipText: { fontSize: 10 },
  fileCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyFiles: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
  },
  emptyFilesIcon: { fontSize: 28, opacity: 0.5 },
  emptyFilesText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  uploadBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  uploadBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  toolPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  showMorePill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  showMoreText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  completeBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  completeBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.bg,
  },
  completedBanner: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.neonLime + '11',
    borderWidth: 1,
    borderColor: COLORS.neonLime + '33',
  },
  completedBannerText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.neonLime,
  },
});
