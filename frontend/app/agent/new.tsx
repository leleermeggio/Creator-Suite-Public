import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, RADIUS, SPACING, TYPO } from '@/constants/theme';
import {
  CONTROL_MODE_LABELS,
  PRESET_AGENTS,
  type ControlMode,
  type PresetStepDef,
} from '@/constants/agents';
import { PLATFORMS } from '@/constants/platforms';
import { ControlSlider } from '@/components/ControlSlider';
import {
  createAgent,
  generateAgent,
  type AgentCreate,
  type StepDefinition,
} from '@/services/agentsApi';

// ── Available tools ───────────────────────────────────────────────────────────

const AVAILABLE_TOOLS = [
  { id: 'transcribe', label: 'Trascrivi' },
  { id: 'translate', label: 'Traduci' },
  { id: 'download', label: 'Download' },
  { id: 'summarize', label: 'Riassumi' },
  { id: 'ocr', label: 'OCR' },
  { id: 'tts', label: 'Text-to-Speech' },
  { id: 'convert', label: 'Converti' },
  { id: 'jumpcut', label: 'Jumpcut' },
  { id: 'ai-image', label: 'Immagine AI' },
  { id: 'captions', label: 'Captions' },
  { id: 'thumbnail', label: 'Thumbnail' },
  { id: 'export', label: 'Esporta' },
  { id: 'analyze-media', label: 'Analizza Media' },
  { id: 'extract-audio', label: 'Estrai Audio' },
  { id: 'normalize', label: 'Normalizza Audio' },
  { id: 'denoise', label: 'Rimuovi Rumore' },
  { id: 'reattach', label: 'Riattacca Video' },
  { id: 'ai-highlights', label: 'AI Highlights' },
  { id: 'cut', label: 'Taglia Segmenti' },
  { id: 'ai-clips', label: 'AI Trova Clip' },
  { id: 'export-text', label: 'Esporta Testo' },
] as const;

// ── Helper ────────────────────────────────────────────────────────────────────

function toolLabel(id: string): string {
  return AVAILABLE_TOOLS.find((t) => t.id === id)?.label ?? id;
}

function makeBlankStep(): StepDefinition {
  return {
    tool_id: 'transcribe',
    label: 'Nuovo step',
    parameters: {},
    auto_run: false,
    required: true,
    condition: null,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SectionLabelProps {
  text: string;
  color: string;
}
function SectionLabel({ text, color }: SectionLabelProps) {
  return (
    <Text style={[styles.sectionLabel, { color }]}>{text}</Text>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NewAgentScreen() {
  const { palette } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 1024;

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');

  // ── AI-Assisted state ───────────────────────────────────────────────────────
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [generatedName, setGeneratedName] = useState('');
  const [generatedIcon, setGeneratedIcon] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generatedSteps, setGeneratedSteps] = useState<StepDefinition[]>([]);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);

  // ── Manual editor state ─────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [description, setDescription] = useState('');
  const [defaultMode, setDefaultMode] = useState<ControlMode>('COPILOTA');
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [steps, setSteps] = useState<StepDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Tool picker per step
  const [openPickerIndex, setOpenPickerIndex] = useState<number | null>(null);

  // ── Handlers: AI tab ────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await generateAgent(aiPrompt.trim());
      setGeneratedId(result.id);
      setGeneratedName(result.name);
      setGeneratedIcon(result.icon ?? '🤖');
      setGeneratedDescription(result.description ?? '');
      setGeneratedSteps(result.steps ?? []);
      setHasGenerated(true);
    } catch {
      setAiError('Errore durante la generazione. Riprova.');
    } finally {
      setAiGenerating(false);
    }
  }

  function handleRegenerate() {
    setHasGenerated(false);
    setGeneratedId(null);
    setGeneratedName('');
    setGeneratedIcon('');
    setGeneratedDescription('');
    setGeneratedSteps([]);
  }

  async function handleAiSave() {
    if (!generatedName.trim() || generatedSteps.length === 0) return;
    setAiSaving(true);
    setAiError(null);
    try {
      const payload: AgentCreate = {
        name: generatedName.trim(),
        icon: generatedIcon || '🤖',
        description: generatedDescription.trim() || undefined,
        steps: generatedSteps,
        default_mode: 'COPILOTA',
        target_platforms: [],
      };
      const created = await createAgent(payload);
      router.replace(`/agent/${created.id}` as any);
    } catch {
      setAiError('Errore durante il salvataggio. Riprova.');
    } finally {
      setAiSaving(false);
    }
  }

  // ── Handlers: Manual tab ────────────────────────────────────────────────────

  function applyPreset(presetId: string) {
    const preset = PRESET_AGENTS.find((p) => p.preset_id === presetId);
    if (!preset) return;
    setName(preset.name);
    setIcon(preset.icon);
    setDescription(preset.description);
    setDefaultMode(preset.default_mode);
    setTargetPlatforms(preset.target_platforms);
    setSteps(
      preset.steps.map((s: PresetStepDef) => ({
        tool_id: s.tool_id,
        label: s.label,
        parameters: s.parameters,
        auto_run: s.auto_run,
        required: s.required,
        condition: s.condition,
      })),
    );
    setOpenPickerIndex(null);
  }

  function startBlank() {
    setName('');
    setIcon('🤖');
    setDescription('');
    setDefaultMode('COPILOTA');
    setTargetPlatforms([]);
    setSteps([]);
    setOpenPickerIndex(null);
  }

  function togglePlatform(id: string) {
    setTargetPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function addStep() {
    setSteps((prev) => [...prev, makeBlankStep()]);
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    if (openPickerIndex === index) setOpenPickerIndex(null);
  }

  function updateStep<K extends keyof StepDefinition>(
    index: number,
    field: K,
    value: StepDefinition[K],
  ) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function selectStepTool(index: number, toolId: string) {
    const label = toolLabel(toolId);
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, tool_id: toolId, label: s.label === toolLabel(s.tool_id) ? label : s.label }
          : s,
      ),
    );
    setOpenPickerIndex(null);
  }

  async function handleManualSave() {
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: AgentCreate = {
        name: name.trim(),
        icon: icon || '🤖',
        description: description.trim() || undefined,
        steps,
        default_mode: defaultMode,
        target_platforms: targetPlatforms,
      };
      const created = await createAgent(payload);
      router.replace(`/agent/${created.id}` as any);
    } catch {
      setSaveError('Errore durante il salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const canManualSave = name.trim().length > 0 && steps.length > 0 && !saving;
  const canAiSave =
    hasGenerated && generatedName.trim().length > 0 && generatedSteps.length > 0 && !aiSaving;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { borderBottomColor: palette.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.backBtnText, { color: palette.textSecondary }]}>← Indietro</Text>
        </Pressable>
        <Text style={[styles.screenTitle, { color: palette.text }]}>Crea Nuovo Agente</Text>
        <View style={styles.topBarSpacer} />
      </View>

      {/* ── Tab selector ─────────────────────────────────────────────────────── */}
      <View style={[styles.tabRow, { backgroundColor: palette.elevated, borderBottomColor: palette.border }]}>
        {(['ai', 'manual'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === 'ai' ? '🤖 AI Assistente' : '🛠️ Editor Manuale';
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={({ pressed }) => [
                styles.tabBtn,
                isActive && { borderBottomColor: palette.cyan, borderBottomWidth: 2 },
                pressed && { opacity: 0.75 },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
              ]}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  { color: isActive ? palette.cyan : palette.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'ai' ? (
          // ──────────────────────────────────────────────────────────────────
          // AI ASSISTENTE
          // ──────────────────────────────────────────────────────────────────
          <View style={styles.tabContent}>
            <Text style={[styles.tabHint, { color: palette.textSecondary }]}>
              Descrivi il tuo workflow e l'AI creerà un agente personalizzato per te.
            </Text>

            {/* Prompt input */}
            <View style={styles.fieldGroup}>
              <SectionLabel text="Descrivi il tuo workflow..." color={palette.textSecondary} />
              <TextInput
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder={
                  'Es: Voglio un agente che prende un video lungo, lo trascrive, trova i momenti migliori e crea 3 clip con captions per TikTok'
                }
                placeholderTextColor={palette.textMuted}
                multiline
                numberOfLines={4}
                style={[
                  styles.input,
                  styles.inputMultiline,
                  {
                    color: palette.text,
                    backgroundColor: palette.elevated,
                    borderColor: palette.border,
                  },
                ]}
                maxLength={2000}
                editable={!aiGenerating}
              />
            </View>

            {/* Generate button */}
            {!hasGenerated && (
              <Pressable
                onPress={handleGenerate}
                disabled={!aiPrompt.trim() || aiGenerating}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor:
                      aiPrompt.trim() && !aiGenerating ? palette.cyan : palette.textMuted,
                  },
                  pressed && { opacity: 0.8 },
                  Platform.OS === 'web' &&
                    ({
                      cursor: aiPrompt.trim() && !aiGenerating ? 'pointer' : 'default',
                    } as any),
                ]}
              >
                {aiGenerating ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator size="small" color="#04040A" />
                    <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>
                      Generazione in corso...
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>Genera Agente</Text>
                )}
              </Pressable>
            )}

            {/* Error */}
            {aiError && (
              <Text style={[styles.errorText, { color: palette.magenta }]}>{aiError}</Text>
            )}

            {/* Generated result */}
            {hasGenerated && (
              <View style={styles.generatedSection}>
                <Text style={[styles.generatedHeading, { color: palette.text }]}>
                  Agente generato — revisionalo prima di salvare
                </Text>

                {/* Preview card */}
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.borderActive,
                    },
                  ]}
                >
                  {/* Icon + Name */}
                  <View style={styles.cardHeader}>
                    <View style={styles.fieldGroup}>
                      <SectionLabel text="Icona" color={palette.textSecondary} />
                      <TextInput
                        value={generatedIcon}
                        onChangeText={setGeneratedIcon}
                        style={[
                          styles.input,
                          styles.inputIcon,
                          {
                            color: palette.text,
                            backgroundColor: palette.elevated,
                            borderColor: palette.border,
                          },
                        ]}
                        maxLength={10}
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1 }]}>
                      <SectionLabel text="Nome" color={palette.textSecondary} />
                      <TextInput
                        value={generatedName}
                        onChangeText={setGeneratedName}
                        style={[
                          styles.input,
                          {
                            color: palette.text,
                            backgroundColor: palette.elevated,
                            borderColor: palette.border,
                          },
                        ]}
                        maxLength={255}
                      />
                    </View>
                  </View>

                  {/* Description */}
                  <View style={styles.fieldGroup}>
                    <SectionLabel text="Descrizione" color={palette.textSecondary} />
                    <TextInput
                      value={generatedDescription}
                      onChangeText={setGeneratedDescription}
                      multiline
                      numberOfLines={3}
                      style={[
                        styles.input,
                        styles.inputMultiline,
                        {
                          color: palette.text,
                          backgroundColor: palette.elevated,
                          borderColor: palette.border,
                        },
                      ]}
                      maxLength={1000}
                    />
                  </View>

                  {/* Steps preview */}
                  <View style={styles.fieldGroup}>
                    <SectionLabel
                      text={`Steps (${generatedSteps.length})`}
                      color={palette.textSecondary}
                    />
                    {generatedSteps.map((step, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.stepPreviewRow,
                          { backgroundColor: palette.elevated, borderColor: palette.border },
                        ]}
                      >
                        <Text style={[styles.stepIndex, { color: palette.textMuted }]}>
                          {idx + 1}
                        </Text>
                        <Text style={[styles.stepPreviewLabel, { color: palette.text }]}>
                          {step.label}
                        </Text>
                        <Text style={[styles.stepPreviewTool, { color: palette.cyan }]}>
                          {toolLabel(step.tool_id)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.generatedActions}>
                  <Pressable
                    onPress={handleRegenerate}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      { borderColor: palette.border },
                      pressed && { opacity: 0.7 },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: palette.textSecondary }]}>
                      Rigenera
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleAiSave}
                    disabled={!canAiSave}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      styles.primaryBtnFlex,
                      {
                        backgroundColor: canAiSave ? palette.cyan : palette.textMuted,
                      },
                      pressed && { opacity: 0.8 },
                      Platform.OS === 'web' &&
                        ({
                          cursor: canAiSave ? 'pointer' : 'default',
                        } as any),
                    ]}
                  >
                    {aiSaving ? (
                      <View style={styles.btnRow}>
                        <ActivityIndicator size="small" color="#04040A" />
                        <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>
                          Creazione in corso...
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>
                        Usa questo agente
                      </Text>
                    )}
                  </Pressable>
                </View>

                {aiError && (
                  <Text style={[styles.errorText, { color: palette.magenta }]}>{aiError}</Text>
                )}
              </View>
            )}
          </View>
        ) : (
          // ──────────────────────────────────────────────────────────────────
          // EDITOR MANUALE
          // ──────────────────────────────────────────────────────────────────
          <View style={styles.tabContent}>
            {/* ── Template picker ─────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <SectionLabel text="Da template" color={palette.textSecondary} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScroll}
              >
                <Pressable
                  onPress={startBlank}
                  style={({ pressed }) => [
                    styles.presetPill,
                    {
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                    },
                    pressed && { opacity: 0.75 },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                >
                  <Text style={[styles.presetPillText, { color: palette.textSecondary }]}>
                    ✨ Inizia da zero
                  </Text>
                </Pressable>

                {PRESET_AGENTS.map((preset) => (
                  <Pressable
                    key={preset.preset_id}
                    onPress={() => applyPreset(preset.preset_id)}
                    style={({ pressed }) => [
                      styles.presetPill,
                      {
                        backgroundColor: `${palette.cyan}12`,
                        borderColor: `${palette.cyan}33`,
                      },
                      pressed && { opacity: 0.75 },
                      Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                    ]}
                  >
                    <Text style={styles.presetPillEmoji}>{preset.icon}</Text>
                    <Text style={[styles.presetPillText, { color: palette.text }]}>
                      {preset.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* ── Name + Icon ──────────────────────────────────────────────── */}
            <View style={styles.rowGroup}>
              <View style={styles.fieldGroup}>
                <SectionLabel text="Icona" color={palette.textSecondary} />
                <TextInput
                  value={icon}
                  onChangeText={setIcon}
                  style={[
                    styles.input,
                    styles.inputIcon,
                    {
                      color: palette.text,
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                    },
                  ]}
                  maxLength={10}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <SectionLabel text="Nome" color={palette.textSecondary} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Nome agente..."
                  placeholderTextColor={palette.textMuted}
                  style={[
                    styles.input,
                    {
                      color: palette.text,
                      backgroundColor: palette.elevated,
                      borderColor: palette.border,
                    },
                  ]}
                  maxLength={255}
                />
              </View>
            </View>

            {/* ── Description ─────────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <SectionLabel text="Descrizione" color={palette.textSecondary} />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Descrizione opzionale..."
                placeholderTextColor={palette.textMuted}
                multiline
                numberOfLines={3}
                style={[
                  styles.input,
                  styles.inputMultiline,
                  {
                    color: palette.text,
                    backgroundColor: palette.elevated,
                    borderColor: palette.border,
                  },
                ]}
                maxLength={1000}
              />
            </View>

            {/* ── Default mode ─────────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <SectionLabel text="Modalità predefinita" color={palette.textSecondary} />
              <ControlSlider mode={defaultMode} onChange={setDefaultMode} />
            </View>

            {/* ── Target platforms ─────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <SectionLabel text="Piattaforme target" color={palette.textSecondary} />
              <View style={styles.platformRow}>
                {PLATFORMS.map((p) => {
                  const selected = targetPlatforms.includes(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => togglePlatform(p.id)}
                      style={({ pressed }) => [
                        styles.pill,
                        selected
                          ? { backgroundColor: `${p.color}22`, borderColor: `${p.color}66` }
                          : { borderColor: palette.border, backgroundColor: palette.elevated },
                        pressed && { opacity: 0.75 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                    >
                      <Text style={styles.pillEmoji}>{p.emoji}</Text>
                      <Text
                        style={[
                          styles.pillText,
                          { color: selected ? p.color : palette.textSecondary },
                        ]}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Steps editor ─────────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <View style={styles.stepsHeader}>
                <SectionLabel
                  text={`Steps${steps.length > 0 ? ` (${steps.length})` : ''}`}
                  color={palette.textSecondary}
                />
                <Pressable
                  onPress={addStep}
                  style={({ pressed }) => [
                    styles.addStepBtn,
                    {
                      backgroundColor: `${palette.cyan}18`,
                      borderColor: `${palette.cyan}33`,
                    },
                    pressed && { opacity: 0.75 },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                >
                  <Text style={[styles.addStepBtnText, { color: palette.cyan }]}>
                    + Aggiungi step
                  </Text>
                </Pressable>
              </View>

              {steps.length === 0 && (
                <View
                  style={[
                    styles.emptySteps,
                    { borderColor: palette.border, backgroundColor: palette.elevated },
                  ]}
                >
                  <Text style={[styles.emptyStepsText, { color: palette.textMuted }]}>
                    Nessuno step ancora. Aggiungine uno o usa un template.
                  </Text>
                </View>
              )}

              {steps.map((step, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.stepCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  {/* Step header */}
                  <View style={styles.stepCardHeader}>
                    <View
                      style={[
                        styles.stepIndexBadge,
                        { backgroundColor: `${palette.cyan}22`, borderColor: `${palette.cyan}44` },
                      ]}
                    >
                      <Text style={[styles.stepIndexText, { color: palette.cyan }]}>{idx + 1}</Text>
                    </View>
                    <Pressable
                      onPress={() => removeStep(idx)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.removeStepBtn,
                        pressed && { opacity: 0.6 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                    >
                      <Text style={[styles.removeStepText, { color: palette.magenta }]}>🗑</Text>
                    </Pressable>
                  </View>

                  {/* Strumento */}
                  <View style={styles.fieldGroup}>
                    <SectionLabel text="Strumento" color={palette.textMuted} />
                    <Pressable
                      onPress={() =>
                        setOpenPickerIndex(openPickerIndex === idx ? null : idx)
                      }
                      style={({ pressed }) => [
                        styles.toolPickerBtn,
                        {
                          backgroundColor: palette.elevated,
                          borderColor:
                            openPickerIndex === idx ? palette.borderActive : palette.border,
                        },
                        pressed && { opacity: 0.8 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                    >
                      <Text style={[styles.toolPickerText, { color: palette.text }]}>
                        {toolLabel(step.tool_id)}
                      </Text>
                      <Text style={[styles.toolPickerChevron, { color: palette.textMuted }]}>
                        {openPickerIndex === idx ? '▲' : '▼'}
                      </Text>
                    </Pressable>

                    {openPickerIndex === idx && (
                      <View
                        style={[
                          styles.toolDropdown,
                          {
                            backgroundColor: palette.elevated,
                            borderColor: palette.border,
                          },
                        ]}
                      >
                        {AVAILABLE_TOOLS.map((tool) => (
                          <Pressable
                            key={tool.id}
                            onPress={() => selectStepTool(idx, tool.id)}
                            style={({ pressed }) => [
                              styles.toolDropdownItem,
                              step.tool_id === tool.id && {
                                backgroundColor: `${palette.cyan}18`,
                              },
                              pressed && { opacity: 0.75 },
                              Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                            ]}
                          >
                            <Text
                              style={[
                                styles.toolDropdownText,
                                {
                                  color:
                                    step.tool_id === tool.id ? palette.cyan : palette.text,
                                },
                              ]}
                            >
                              {tool.label}
                            </Text>
                            <Text
                              style={[styles.toolDropdownId, { color: palette.textMuted }]}
                            >
                              {tool.id}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Etichetta */}
                  <View style={styles.fieldGroup}>
                    <SectionLabel text="Etichetta" color={palette.textMuted} />
                    <TextInput
                      value={step.label}
                      onChangeText={(v) => updateStep(idx, 'label', v)}
                      placeholder="Nome dello step..."
                      placeholderTextColor={palette.textMuted}
                      style={[
                        styles.input,
                        styles.inputSm,
                        {
                          color: palette.text,
                          backgroundColor: palette.elevated,
                          borderColor: palette.border,
                        },
                      ]}
                      maxLength={120}
                    />
                  </View>

                  {/* Condizione */}
                  <View style={styles.fieldGroup}>
                    <SectionLabel text="Condizione (opzionale)" color={palette.textMuted} />
                    <TextInput
                      value={step.condition ?? ''}
                      onChangeText={(v) => updateStep(idx, 'condition', v.length > 0 ? v : null)}
                      placeholder="Es: se durata > 60s..."
                      placeholderTextColor={palette.textMuted}
                      style={[
                        styles.input,
                        styles.inputSm,
                        {
                          color: palette.text,
                          backgroundColor: palette.elevated,
                          borderColor: palette.border,
                        },
                      ]}
                      maxLength={255}
                    />
                  </View>

                  {/* Toggles */}
                  <View style={styles.stepToggles}>
                    {/* Automatico */}
                    <Pressable
                      onPress={() => updateStep(idx, 'auto_run', !step.auto_run)}
                      style={({ pressed }) => [
                        styles.togglePill,
                        step.auto_run
                          ? { backgroundColor: `${palette.cyan}22`, borderColor: `${palette.cyan}55` }
                          : { backgroundColor: palette.elevated, borderColor: palette.border },
                        pressed && { opacity: 0.75 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          { color: step.auto_run ? palette.cyan : palette.textMuted },
                        ]}
                      >
                        ⚡ Automatico
                      </Text>
                    </Pressable>

                    {/* Obbligatorio */}
                    <Pressable
                      onPress={() => updateStep(idx, 'required', !step.required)}
                      style={({ pressed }) => [
                        styles.togglePill,
                        step.required
                          ? { backgroundColor: `${palette.violet}22`, borderColor: `${palette.violet}55` }
                          : { backgroundColor: palette.elevated, borderColor: palette.border },
                        pressed && { opacity: 0.75 },
                        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                      ]}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          { color: step.required ? palette.violet : palette.textMuted },
                        ]}
                      >
                        ✔ Obbligatorio
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>

            {/* Save error */}
            {saveError && (
              <Text style={[styles.errorText, { color: palette.magenta }]}>{saveError}</Text>
            )}

            {/* Bottom spacer for action bar */}
            <View style={styles.actionBarSpacer} />
          </View>
        )}
      </ScrollView>

      {/* ── Bottom action bar (Manual tab only) ──────────────────────────────── */}
      {activeTab === 'manual' && (
        <View
          style={[
            styles.actionBar,
            {
              backgroundColor: palette.bg,
              borderTopColor: palette.border,
            },
          ]}
        >
          <Pressable
            onPress={handleManualSave}
            disabled={!canManualSave}
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.actionBarBtn,
              {
                backgroundColor: canManualSave ? palette.cyan : palette.textMuted,
              },
              pressed && { opacity: 0.8 },
              Platform.OS === 'web' &&
                ({
                  cursor: canManualSave ? 'pointer' : 'default',
                } as any),
            ]}
          >
            {saving ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#04040A" />
                <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>
                  Creazione in corso...
                </Text>
              </View>
            ) : (
              <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>Crea Agente</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  backBtn: {
    minWidth: 72,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  backBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  screenTitle: {
    ...TYPO.h3,
    flex: 1,
    textAlign: 'center',
  },
  topBarSpacer: {
    minWidth: 72,
  },
  // Tab row
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  scrollContentDesktop: {
    maxWidth: 720,
    alignSelf: 'center' as any,
    width: '100%',
  },
  tabContent: {
    gap: SPACING.xl,
  },
  tabHint: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    lineHeight: 20,
  },
  // Field group
  fieldGroup: {
    gap: SPACING.xs,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-end',
  },
  sectionLabel: {
    ...TYPO.label,
  },
  // Inputs
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  inputSm: {
    paddingVertical: 7,
    fontSize: 14,
  },
  inputIcon: {
    width: 52,
    textAlign: 'center',
    fontSize: 22,
    paddingHorizontal: SPACING.xs,
  },
  // Buttons
  primaryBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnFlex: {
    flex: 1,
  },
  primaryBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    letterSpacing: 0.3,
  },
  btnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  // Error
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  // Generated section
  generatedSection: {
    gap: SPACING.lg,
  },
  generatedHeading: {
    fontFamily: FONTS.displayBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-end',
  },
  generatedActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  // Step preview (AI tab)
  stepPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  stepIndex: {
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
    width: 20,
    textAlign: 'center',
  },
  stepPreviewLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    flex: 1,
  },
  stepPreviewTool: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  // Preset pills
  presetsScroll: {
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  presetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  presetPillEmoji: {
    fontSize: 16,
  },
  presetPillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  // Platform pills
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  // Steps
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addStepBtn: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  addStepBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  emptySteps: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed' as any,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyStepsText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  stepCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepIndexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIndexText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
  },
  removeStepBtn: {
    padding: 4,
  },
  removeStepText: {
    fontSize: 16,
  },
  // Tool picker
  toolPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  toolPickerText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
  toolPickerChevron: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    marginLeft: SPACING.xs,
  },
  toolDropdown: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 2,
    maxHeight: 260,
  },
  toolDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  toolDropdownText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
  toolDropdownId: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  // Step toggles
  stepToggles: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  togglePill: {
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  togglePillText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  // Action bar
  actionBar: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
  },
  actionBarBtn: {
    width: '100%',
  },
  actionBarSpacer: {
    height: SPACING.xxl,
  },
});
