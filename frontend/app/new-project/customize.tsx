import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { useProjects } from '@/hooks/useProjects';
import { BUILT_IN_TEMPLATES } from '@/constants/templates';
import { PHASE_COLORS, getPhaseColor } from '@/constants/phases';
import { TOOLS } from '@/constants/tools';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';
import type { PhaseTemplate } from '@/types';

const EMOJI_OPTIONS = ['🎬','🎙️','📝','✂️','✨','🚀','💡','📱','🎨','🔊','📦','🔄','🌍','👁️','📊','🎯','🏆','⚡','🔥','💎','🎵','📸','🖥️','📡','🎤'];

interface PhaseEditor {
  name: string;
  icon: string;
  color: string;
  suggestedToolIds: string[];
}

export default function CustomizeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { templateId, prefilledName, prefilledPhases } = useLocalSearchParams<{
    templateId?: string;
    prefilledName?: string;
    prefilledPhases?: string;
  }>();
  const { createProject } = useProjects();

  const [projectName, setProjectName] = useState('');
  const [phases, setPhases] = useState<PhaseEditor[]>([]);
  const [emojiPickerIndex, setEmojiPickerIndex] = useState<number | null>(null);
  const [toolPickerIndex, setToolPickerIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const isDesktop = width >= 1024;

  useEffect(() => {
    if (prefilledPhases) {
      try {
        const parsed: PhaseTemplate[] = JSON.parse(decodeURIComponent(prefilledPhases));
        setPhases(parsed.map(p => ({ name: p.name, icon: p.icon, color: p.color, suggestedToolIds: p.suggestedToolIds })));
        if (prefilledName) setProjectName(decodeURIComponent(prefilledName));
        return;
      } catch {}
    }
    if (templateId && templateId !== 'custom') {
      const tpl = BUILT_IN_TEMPLATES.find(t => t.id === templateId);
      if (tpl) {
        setProjectName(tpl.name);
        setPhases(tpl.defaultPhases.map(p => ({ name: p.name, icon: p.icon, color: p.color, suggestedToolIds: p.suggestedToolIds })));
        return;
      }
    }
    // Custom: start with one empty phase
    setPhases([{ name: '', icon: '📁', color: getPhaseColor(0), suggestedToolIds: [] }]);
  }, []);

  const updatePhase = (i: number, update: Partial<PhaseEditor>) => {
    setPhases(prev => prev.map((p, pi) => pi === i ? { ...p, ...update } : p));
  };

  const addPhase = () => {
    setPhases(prev => [...prev, { name: '', icon: '📁', color: getPhaseColor(prev.length), suggestedToolIds: [] }]);
  };

  const removePhase = (i: number) => {
    const phase = phases[i];
    const hasSuggested = phase.suggestedToolIds.length > 0;

    const doRemove = () => setPhases(prev => prev.filter((_, pi) => pi !== i));

    if (hasSuggested) {
      if (Platform.OS === 'web') {
        if (window.confirm('Questa fase contiene strumenti suggeriti. Eliminare?')) doRemove();
      } else {
        Alert.alert('Eliminare fase?', 'Questa fase contiene strumenti suggeriti.', [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Elimina', style: 'destructive', onPress: doRemove },
        ]);
      }
    } else {
      doRemove();
    }
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    setPhases(prev => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
  };

  const moveDown = (i: number) => {
    if (i === phases.length - 1) return;
    setPhases(prev => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      const msg = 'Inserisci un nome per il progetto.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Attenzione', msg);
      return;
    }
    if (phases.some(p => !p.name.trim())) {
      const msg = 'Dai un nome a tutte le fasi.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Attenzione', msg);
      return;
    }
    setCreating(true);
    try {
      const tplPhases: PhaseTemplate[] = phases.map((p, i) => ({
        name: p.name,
        icon: p.icon,
        color: p.color,
        order: i,
        suggestedToolIds: p.suggestedToolIds,
      }));
      const id = await createProject(projectName.trim(), tplPhases, undefined, templateId);
      router.replace(`/project/${id}`);
    } catch (e) {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: isDesktop ? 48 : 20,
            maxWidth: isDesktop ? 700 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Indietro</Text>
        </Pressable>

        <View style={styles.header}>
          <GradientText gradient={COLORS.gradCyan} style={TYPO.h1}>
            Personalizza
          </GradientText>
          <Text style={styles.subtitle}>Configura il tuo workflow</Text>
        </View>

        {/* Project name */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>NOME PROGETTO</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="Es: Video YouTube Maggio"
            placeholderTextColor={COLORS.textMuted}
            value={projectName}
            onChangeText={setProjectName}
          />
        </View>

        {/* Phases */}
        <Text style={styles.fieldLabel}>FASI</Text>
        {phases.map((phase, i) => (
          <View key={i} style={styles.phaseCard}>
            {/* Phase header */}
            <View style={styles.phaseHeader}>
              <Pressable onPress={() => setEmojiPickerIndex(i)} style={styles.emojiBtn}>
                <Text style={styles.emojiText}>{phase.icon}</Text>
              </Pressable>
              <TextInput
                style={styles.phaseNameInput}
                placeholder={`Fase ${i + 1}`}
                placeholderTextColor={COLORS.textMuted}
                value={phase.name}
                onChangeText={v => updatePhase(i, { name: v })}
              />
              <View style={styles.phaseActions}>
                <Pressable onPress={() => moveUp(i)} style={styles.phaseAction} disabled={i === 0}>
                  <Text style={[styles.phaseActionText, i === 0 && { opacity: 0.2 }]}>▲</Text>
                </Pressable>
                <Pressable onPress={() => moveDown(i)} style={styles.phaseAction} disabled={i === phases.length - 1}>
                  <Text style={[styles.phaseActionText, i === phases.length - 1 && { opacity: 0.2 }]}>▼</Text>
                </Pressable>
                <Pressable onPress={() => removePhase(i)} style={styles.phaseAction}>
                  <Text style={[styles.phaseActionText, { color: COLORS.neonPink }]}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Color picker */}
            <View style={styles.colorRow}>
              {PHASE_COLORS.map(c => (
                <Pressable
                  key={c}
                  onPress={() => updatePhase(i, { color: c })}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    phase.color === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>

            {/* Tools */}
            <Pressable onPress={() => setToolPickerIndex(i)} style={styles.toolsBtn}>
              {phase.suggestedToolIds.length === 0
                ? <Text style={styles.toolsBtnText}>+ Strumenti suggeriti</Text>
                : (
                  <View style={styles.toolChips}>
                    {phase.suggestedToolIds.map(tid => {
                      const t = TOOLS.find(x => x.id === tid);
                      return t ? (
                        <View key={tid} style={styles.toolChip}>
                          <Text style={styles.toolChipText}>{t.icon} {t.name}</Text>
                        </View>
                      ) : null;
                    })}
                    <Text style={styles.editToolsText}>Modifica</Text>
                  </View>
                )
              }
            </Pressable>
          </View>
        ))}

        <Pressable onPress={addPhase} style={styles.addPhaseBtn}>
          <Text style={styles.addPhaseBtnText}>+ Aggiungi fase</Text>
        </Pressable>

        {/* Pipeline preview */}
        {phases.length > 0 && (
          <View style={styles.pipeline}>
            <Text style={styles.fieldLabel}>ANTEPRIMA</Text>
            <View style={styles.pipelineRow}>
              {phases.map((p, i) => (
                <React.Fragment key={i}>
                  <View style={[styles.pipelinePhase, { borderColor: p.color + '66' }]}>
                    <Text style={styles.pipelineIcon}>{p.icon}</Text>
                    <Text style={[styles.pipelineName, { color: p.color }]} numberOfLines={1}>
                      {p.name || `Fase ${i + 1}`}
                    </Text>
                  </View>
                  {i < phases.length - 1 && <Text style={styles.pipelineArrow}>→</Text>}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Create button */}
        <Pressable
          onPress={handleCreate}
          disabled={creating}
          style={({ pressed }) => [{ opacity: pressed || creating ? 0.7 : 1, marginTop: SPACING.xl }]}
        >
          <LinearGradient
            colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createBtn}
          >
            <Text style={styles.createBtnText}>
              {creating ? '⏳ Creazione...' : '🚀 Crea progetto'}
            </Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>

      {/* Emoji picker modal */}
      {emojiPickerIndex !== null && (
        <Modal transparent animationType="fade" onRequestClose={() => setEmojiPickerIndex(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setEmojiPickerIndex(null)}>
            <View style={styles.emojiModal}>
              <Text style={styles.modalTitle}>Scegli emoji</Text>
              <View style={styles.emojiGrid}>
                {EMOJI_OPTIONS.map(e => (
                  <Pressable
                    key={e}
                    onPress={() => { updatePhase(emojiPickerIndex, { icon: e }); setEmojiPickerIndex(null); }}
                    style={styles.emojiOption}
                  >
                    <Text style={styles.emojiOptionText}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Tool picker modal */}
      {toolPickerIndex !== null && (
        <Modal transparent animationType="fade" onRequestClose={() => setToolPickerIndex(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setToolPickerIndex(null)}>
            <View style={styles.toolModal}>
              <Text style={styles.modalTitle}>Strumenti suggeriti</Text>
              {TOOLS.map(t => {
                const selected = phases[toolPickerIndex]?.suggestedToolIds.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => {
                      const current = phases[toolPickerIndex].suggestedToolIds;
                      const next = selected
                        ? current.filter(x => x !== t.id)
                        : [...current, t.id];
                      updatePhase(toolPickerIndex, { suggestedToolIds: next });
                    }}
                    style={[styles.toolOption, selected && styles.toolOptionSelected]}
                  >
                    <Text style={styles.toolOptionIcon}>{t.icon}</Text>
                    <Text style={styles.toolOptionName}>{t.name}</Text>
                    {selected && <Text style={styles.toolCheck}>✓</Text>}
                  </Pressable>
                );
              })}
              <Pressable onPress={() => setToolPickerIndex(null)} style={styles.modalClose}>
                <Text style={styles.modalCloseText}>Fatto</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    paddingTop: Platform.select({ web: 40, default: 60 }),
    paddingBottom: 80,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    alignSelf: 'flex-start',
  },
  backArrow: { fontFamily: FONTS.displayBold, fontSize: 20, color: COLORS.textSecondary },
  backText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textSecondary },
  header: { marginBottom: SPACING.xl },
  subtitle: { ...TYPO.body, color: COLORS.textSecondary, marginTop: SPACING.xs },
  field: { marginBottom: SPACING.xl },
  fieldLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  nameInput: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 17,
    color: COLORS.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    paddingVertical: SPACING.sm,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  phaseCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: SPACING.sm,
  },
  phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  emojiBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 20 },
  phaseNameInput: {
    flex: 1,
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textPrimary,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  phaseActions: { flexDirection: 'row', gap: SPACING.xs },
  phaseAction: { padding: SPACING.xs },
  phaseActionText: { fontSize: 14, color: COLORS.textSecondary },
  colorRow: { flexDirection: 'row', gap: SPACING.sm },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: { borderColor: COLORS.textPrimary },
  toolsBtn: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  toolsBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.textMuted },
  toolChips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, alignItems: 'center' },
  toolChip: {
    backgroundColor: COLORS.bgElevated,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  toolChipText: { fontFamily: FONTS.bodyMedium, fontSize: 11, color: COLORS.textSecondary },
  editToolsText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.neonCyan },
  addPhaseBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  addPhaseBtnText: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textSecondary },
  pipeline: { marginBottom: SPACING.xl },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.xs },
  pipelinePhase: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    minWidth: 60,
  },
  pipelineIcon: { fontSize: 16 },
  pipelineName: { fontFamily: FONTS.bodyMedium, fontSize: 10, marginTop: 2, maxWidth: 60 },
  pipelineArrow: { fontFamily: FONTS.bodyRegular, fontSize: 14, color: COLORS.textMuted },
  createBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md + 2, alignItems: 'center' },
  createBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: COLORS.bg },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emojiModal: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 360,
  },
  toolModal: {
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    gap: SPACING.xs,
  },
  modalTitle: { ...TYPO.h3, color: COLORS.textPrimary, marginBottom: SPACING.md },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emojiOption: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  emojiOptionText: { fontSize: 22 },
  toolOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  toolOptionSelected: { backgroundColor: COLORS.neonViolet + '22' },
  toolOptionIcon: { fontSize: 18, width: 28 },
  toolOptionName: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textPrimary },
  toolCheck: { fontSize: 16, color: COLORS.neonLime },
  modalClose: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.neonCyan + '22',
  },
  modalCloseText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.neonCyan },
});
