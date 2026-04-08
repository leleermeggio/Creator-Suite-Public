import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAgents } from '@/hooks/useAgents';
import { useProjects } from '@/hooks/useProjects';
import { FONTS, RADIUS, SPACING, TYPO } from '@/constants/theme';
import {
  PRESET_AGENTS,
  CONTROL_MODE_LABELS,
  type ControlMode,
} from '@/constants/agents';
import { ControlSlider } from '@/components/ControlSlider';
import { GlowCard } from '@/components/GlowCard';
import { NeonButton } from '@/components/NeonButton';
import { MediaUploader } from '@/components/MediaUploader';
import { createMission, startMission } from '@/services/missionsApi';
import { uploadFileDirect } from '@/services/mediaApi';
import type { AgentResponse } from '@/services/agentsApi';
import type { PresetAgentDef } from '@/constants/agents';

/* ──────────────────────────────── types ────────────────────────────────── */

type WizardStep = 'agent' | 'project' | 'media' | 'mode' | 'launch';

const WIZARD_STEPS: WizardStep[] = ['agent', 'project', 'media', 'mode', 'launch'];

const STEP_LABELS: Record<WizardStep, string> = {
  agent: 'Agente',
  project: 'Progetto',
  media: 'Media',
  mode: 'Modalità',
  launch: 'Lancio',
};

/* ──────────────────────────── WizardDots ───────────────────────────────── */

function WizardDots({
  steps,
  current,
}: {
  steps: WizardStep[];
  current: WizardStep;
}) {
  const { palette } = useTheme();
  const currentIdx = steps.indexOf(current);
  return (
    <View style={styles.dotsRow}>
      {steps.map((s, i) => {
        const isActive = s === current;
        const isPast = i < currentIdx;
        return (
          <View
            key={s}
            style={[
              styles.dot,
              {
                backgroundColor: isActive
                  ? palette.cyan
                  : isPast
                    ? palette.violet
                    : palette.border,
                width: isActive ? 24 : 8,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/* ─────────────────────────── AgentCard item ────────────────────────────── */

function AgentItem({
  icon,
  name,
  description,
  selected,
  onPress,
}: {
  icon: string;
  name: string;
  description: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.agentItem,
        {
          backgroundColor: selected ? `${palette.cyan}18` : palette.card,
          borderColor: selected ? palette.cyan : palette.border,
        },
        pressed && { opacity: 0.8 },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
      ]}
    >
      <Text style={styles.agentIcon}>{icon}</Text>
      <Text style={[styles.agentName, { color: selected ? palette.cyan : palette.text }]}>
        {name}
      </Text>
      {description ? (
        <Text style={[styles.agentDesc, { color: palette.textMuted }]} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* ─────────────────────────────── main screen ───────────────────────────── */

export default function MissionLaunchScreen() {
  const { palette } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ agentId?: string; projectId?: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const numCols = isDesktop ? 3 : 2;

  const { agents, presets, loading: agentsLoading } = useAgents();
  const { projects, loading: projectsLoading, createProject } = useProjects();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(params.agentId ?? '');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId ?? '');
  const [newProjectName, setNewProjectName] = useState('');
  const [createNewProject, setCreateNewProject] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<ControlMode>('COPILOTA');
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentStepIdx = WIZARD_STEPS.indexOf(currentStep);

  /* ── derive selected agent info ── */
  const allAgents: Array<AgentResponse | PresetAgentDef> = [
    ...(agents as AgentResponse[]),
    ...(presets as AgentResponse[]),
    ...PRESET_AGENTS,
  ];

  // Deduplicate by name to avoid showing preset_id duplicates from BE + local
  const seenNames = new Set<string>();
  const deduped = allAgents.filter((a) => {
    if (seenNames.has(a.name)) return false;
    seenNames.add(a.name);
    return true;
  });

  const selectedAgent = deduped.find(
    (a) => ('id' in a ? a.id : a.preset_id) === selectedAgentId,
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  /* ── navigation ── */
  const goBack = useCallback(() => {
    if (currentStepIdx === 0) {
      router.back();
    } else {
      setCurrentStep(WIZARD_STEPS[currentStepIdx - 1]);
    }
    setError(null);
  }, [currentStepIdx, router]);

  const goNext = useCallback(async () => {
    setError(null);

    if (currentStep === 'agent' && !selectedAgentId) {
      setError('Seleziona un agente per continuare.');
      return;
    }

    if (currentStep === 'project') {
      if (createNewProject) {
        if (!newProjectName.trim()) {
          setError('Inserisci un nome per il nuovo progetto.');
          return;
        }
        try {
          const id = await createProject(newProjectName.trim(), []);
          setSelectedProjectId(id);
        } catch {
          setError('Impossibile creare il progetto. Riprova.');
          return;
        }
      } else if (!selectedProjectId) {
        setError('Seleziona un progetto per continuare.');
        return;
      }
    }

    if (currentStep === 'media' && mediaFile && selectedProjectId) {
      setUploading(true);
      try {
        await uploadFileDirect(selectedProjectId, mediaFile);
      } catch {
        // best-effort — media upload failure should not block mission launch
      } finally {
        setUploading(false);
      }
    }

    if (currentStep === 'launch') {
      await handleLaunch();
      return;
    }

    setCurrentStep(WIZARD_STEPS[currentStepIdx + 1]);
  }, [
    currentStep,
    currentStepIdx,
    selectedAgentId,
    selectedProjectId,
    createNewProject,
    newProjectName,
    mediaFile,
    createProject,
  ]);

  const handleLaunch = useCallback(async () => {
    if (!selectedAgentId || !selectedProjectId) {
      setError('Agente e progetto sono obbligatori.');
      return;
    }
    setLaunching(true);
    setError(null);
    try {
      const mission = await createMission({
        agent_id: selectedAgentId,
        project_id: selectedProjectId,
        mode,
      });
      await startMission(mission.id);
      router.replace(`/mission/${mission.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore durante il lancio della missione.');
      setLaunching(false);
    }
  }, [selectedAgentId, selectedProjectId, mode, router]);

  /* ── next button label ── */
  const nextLabel =
    currentStep === 'launch'
      ? 'Lancia Missione 🚀'
      : currentStep === 'mode'
        ? 'Avanti'
        : 'Avanti';

  const canProceed =
    currentStep === 'agent'
      ? !!selectedAgentId
      : currentStep === 'project'
        ? createNewProject ? newProjectName.trim().length > 0 : !!selectedProjectId
        : true;

  /* ────────────────────────────── render ────────────────────────────────── */

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.backText, { color: palette.cyan }]}>← Indietro</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Nuova Missione</Text>
        <WizardDots steps={WIZARD_STEPS} current={currentStep} />
        <Text style={[styles.stepLabel, { color: palette.textMuted }]}>
          {currentStepIdx + 1}/{WIZARD_STEPS.length} · {STEP_LABELS[currentStep]}
        </Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step: Agent ── */}
        {currentStep === 'agent' && (
          <View>
            <Text style={[TYPO.h2, { color: palette.text, marginBottom: SPACING.sm }]}>
              Scegli un Agente
            </Text>
            <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
              Ogni agente ha un flusso di lavoro ottimizzato per un tipo di contenuto.
            </Text>
            {agentsLoading ? (
              <ActivityIndicator color={palette.cyan} style={{ marginTop: SPACING.xl }} />
            ) : (
              <View style={[styles.agentGrid, { gap: SPACING.sm }]}>
                {deduped.map((a) => {
                  const id = 'id' in a ? a.id : a.preset_id;
                  return (
                    <View
                      key={id}
                      style={{ width: `${Math.floor(100 / numCols) - 1}%` as unknown as number }}
                    >
                      <AgentItem
                        icon={a.icon}
                        name={a.name}
                        description={a.description ?? null}
                        selected={selectedAgentId === id}
                        onPress={() => setSelectedAgentId(id)}
                      />
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Step: Project ── */}
        {currentStep === 'project' && (
          <View>
            <Text style={[TYPO.h2, { color: palette.text, marginBottom: SPACING.sm }]}>
              Scegli il Progetto
            </Text>
            <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
              Seleziona un progetto esistente o creane uno nuovo.
            </Text>

            {/* Toggle */}
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setCreateNewProject(false)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: !createNewProject ? palette.elevated : 'transparent',
                    borderColor: !createNewProject ? palette.cyan : palette.border,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: !createNewProject ? palette.cyan : palette.textSecondary }]}>
                  Esistente
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCreateNewProject(true)}
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor: createNewProject ? palette.elevated : 'transparent',
                    borderColor: createNewProject ? palette.cyan : palette.border,
                  },
                ]}
              >
                <Text style={[styles.toggleText, { color: createNewProject ? palette.cyan : palette.textSecondary }]}>
                  Nuovo
                </Text>
              </Pressable>
            </View>

            {createNewProject ? (
              <View style={styles.newProjectInput}>
                <Text style={[styles.inputLabel, { color: palette.textSecondary }]}>
                  Nome del progetto
                </Text>
                <TextInput
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  placeholder="es. Vlog Roma, Podcast Ep.12…"
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                      color: palette.text,
                    },
                  ]}
                  autoFocus
                />
              </View>
            ) : (
              <View style={{ gap: SPACING.sm, marginTop: SPACING.md }}>
                {projectsLoading ? (
                  <ActivityIndicator color={palette.cyan} />
                ) : projects.length === 0 ? (
                  <Text style={[styles.emptyText, { color: palette.textMuted }]}>
                    Nessun progetto trovato. Crea un nuovo progetto.
                  </Text>
                ) : (
                  projects.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedProjectId(p.id)}
                      style={({ pressed }) => [
                        styles.projectRow,
                        {
                          backgroundColor:
                            selectedProjectId === p.id ? `${palette.cyan}14` : palette.card,
                          borderColor:
                            selectedProjectId === p.id ? palette.cyan : palette.border,
                        },
                        pressed && { opacity: 0.8 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
                      ]}
                    >
                      <Text style={[styles.projectName, { color: selectedProjectId === p.id ? palette.cyan : palette.text }]}>
                        {p.name}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Step: Media ── */}
        {currentStep === 'media' && (
          <View>
            <Text style={[TYPO.h2, { color: palette.text, marginBottom: SPACING.sm }]}>
              Carica Media (opzionale)
            </Text>
            <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
              Carica ora il file su cui lavorerà l'agente, oppure salta questo passaggio.
            </Text>
            <View style={{ marginTop: SPACING.md }}>
              <MediaUploader
                onFileSelected={(file) => setMediaFile(file)}
                uploading={uploading}
                label="Trascina video, audio o immagine"
              />
            </View>
            {mediaFile && !uploading && (
              <Text style={[styles.fileNote, { color: palette.textSecondary }]}>
                Il file verrà caricato al progetto selezionato.
              </Text>
            )}
          </View>
        )}

        {/* ── Step: Mode ── */}
        {currentStep === 'mode' && (
          <View>
            <Text style={[TYPO.h2, { color: palette.text, marginBottom: SPACING.sm }]}>
              Modalità di Controllo
            </Text>
            <Text style={[styles.stepDesc, { color: palette.textSecondary }]}>
              Scegli quanto vuoi essere coinvolto nell'esecuzione.
            </Text>
            <View style={{ marginTop: SPACING.lg }}>
              <ControlSlider mode={mode} onChange={setMode} />
            </View>
            <View style={{ marginTop: SPACING.lg }}>
              <Text style={[styles.modeSummaryTitle, { color: palette.textMuted }]}>
                {CONTROL_MODE_LABELS[mode].emoji} {CONTROL_MODE_LABELS[mode].label}
              </Text>
              <Text style={[styles.modeSummaryDesc, { color: palette.textSecondary }]}>
                {CONTROL_MODE_LABELS[mode].desc}
              </Text>
            </View>

            {/* Summary card */}
            <GlowCard style={{ marginTop: SPACING.lg }}>
              <Text style={[styles.summaryTitle, { color: palette.textMuted }]}>
                Riepilogo missione
              </Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Agente</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {selectedAgent ? `${selectedAgent.icon} ${selectedAgent.name}` : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Progetto</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {(selectedProject?.name ?? newProjectName) || '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Media</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {mediaFile ? mediaFile.name : 'Nessuno'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Modalità</Text>
                <Text style={[styles.summaryValue, { color: palette.cyan }]}>
                  {CONTROL_MODE_LABELS[mode].emoji} {CONTROL_MODE_LABELS[mode].label}
                </Text>
              </View>
            </GlowCard>
          </View>
        )}

        {/* ── Step: Launch ── */}
        {currentStep === 'launch' && (
          <View style={styles.launchStep}>
            <Text style={styles.launchEmoji}>🚀</Text>
            <Text style={[TYPO.h1, { color: palette.text, textAlign: 'center' }]}>
              Pronto al lancio!
            </Text>
            <Text style={[styles.stepDesc, { color: palette.textSecondary, textAlign: 'center' }]}>
              Controlla il riepilogo e premi "Lancia Missione" per avviare.
            </Text>

            <GlowCard style={{ marginTop: SPACING.lg, width: '100%' }}>
              <Text style={[styles.summaryTitle, { color: palette.textMuted }]}>
                Riepilogo missione
              </Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Agente</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {selectedAgent ? `${selectedAgent.icon} ${selectedAgent.name}` : '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Progetto</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {(selectedProject?.name ?? newProjectName) || '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Media</Text>
                <Text style={[styles.summaryValue, { color: palette.text }]}>
                  {mediaFile ? mediaFile.name : 'Nessuno'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>Modalità</Text>
                <Text style={[styles.summaryValue, { color: palette.cyan }]}>
                  {CONTROL_MODE_LABELS[mode].emoji} {CONTROL_MODE_LABELS[mode].label}
                </Text>
              </View>
            </GlowCard>
          </View>
        )}

        {/* Error message */}
        {error && (
          <View style={[styles.errorBox, { borderColor: palette.magenta, backgroundColor: `${palette.magenta}11` }]}>
            <Text style={[styles.errorText, { color: palette.magenta }]}>⚠️ {error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: palette.border, backgroundColor: palette.bg }, isDesktop && styles.footerDesktop]}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [styles.secondaryBtn, { borderColor: palette.border }, pressed && { opacity: 0.7 }]}
        >
          <Text style={[styles.secondaryBtnText, { color: palette.textSecondary }]}>
            {currentStepIdx === 0 ? 'Annulla' : 'Indietro'}
          </Text>
        </Pressable>

        {launching ? (
          <ActivityIndicator color={palette.cyan} style={{ flex: 1, justifyContent: 'center' } as object} />
        ) : (
          <View style={!canProceed && styles.disabledOverlay}>
            <NeonButton
              label={nextLabel}
              onPress={canProceed ? goNext : () => {}}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/* ───────────────────────────────── styles ───────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.xs,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  backText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    marginTop: SPACING.xs,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  dot: {
    height: 8,
    borderRadius: RADIUS.full,
  },
  stepLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  scrollContentDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%',
  },
  stepDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  agentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  agentItem: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  agentIcon: {
    fontSize: 24,
  },
  agentName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },
  agentDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  newProjectInput: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  inputLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    height: 48,
  },
  emptyText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  projectRow: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  projectName: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
  fileNote: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  modeSummaryTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    marginBottom: SPACING.xs,
  },
  modeSummaryDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  summaryTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    gap: SPACING.sm,
  },
  summaryLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
  summaryValue: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },
  launchStep: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.xl,
  },
  launchEmoji: {
    fontSize: 56,
    marginBottom: SPACING.sm,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  footerDesktop: {
    maxWidth: 720,
    alignSelf: 'center',
    width: '100%' as any,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  secondaryBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
  disabledOverlay: {
    opacity: 0.4,
  },
});
