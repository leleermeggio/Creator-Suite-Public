import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';
import { useAgent } from '@/hooks/useAgent';
import { FONTS, RADIUS, SPACING, TYPO } from '@/constants/theme';
import { CONTROL_MODE_LABELS, type ControlMode } from '@/constants/agents';
import { getPlatformDef } from '@/constants/platforms';
import { ControlSlider } from '@/components/ControlSlider';
import { AnimatedScreen } from '@/components/animated';
import type { StepDefinition } from '@/services/agentsApi';

export default function AgentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const { agent, loading, error, refresh, update, remove } = useAgent(id ?? null);

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMode_ctrl, setEditModeCtrl] = useState<ControlMode>('COPILOTA');

  const isDesktop = width >= 1024;

  const enterEditMode = () => {
    if (!agent) return;
    setEditName(agent.name);
    setEditDescription(agent.description ?? '');
    setEditModeCtrl((agent.default_mode as ControlMode) ?? 'COPILOTA');
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await update({
        name: editName.trim() || agent.name,
        description: editDescription.trim() || undefined,
        default_mode: editMode_ctrl,
      });
      setEditMode(false);
    } catch {
      if (Platform.OS === 'web') {
        window.alert('Errore durante il salvataggio. Riprova.');
      } else {
        Alert.alert('Errore', 'Impossibile salvare le modifiche. Riprova.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const message = `Eliminare "${agent?.name}"? Questa azione non può essere annullata.`;
    if (Platform.OS === 'web') {
      if (!window.confirm(message)) return;
      remove().then(() => router.back());
      return;
    }
    Alert.alert('Sei sicuro?', message, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => remove().then(() => router.back()),
      },
    ]);
  };

  const handleStartMission = () => {
    if (!agent) return;
    router.push(`/mission/launch?agentId=${agent.id}`);
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.cyan} size="large" />
        <Text style={[styles.loadingText, { color: palette.textSecondary }]}>Caricamento...</Text>
      </View>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error || !agent) {
    return (
      <View style={[styles.centered, { backgroundColor: palette.bg }]}>
        <Text style={[styles.errorEmoji]}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: palette.text }]}>Errore</Text>
        <Text style={[styles.errorMsg, { color: palette.textSecondary }]}>
          {error ?? 'Agente non trovato.'}
        </Text>
        <Pressable
          onPress={refresh}
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

  const isPreset = agent.is_preset;
  const defaultMode = (agent.default_mode as ControlMode) ?? 'COPILOTA';
  const modeInfo = CONTROL_MODE_LABELS[defaultMode] ?? CONTROL_MODE_LABELS.COPILOTA;
  const steps: StepDefinition[] = agent.steps ?? [];
  const platforms: string[] = agent.target_platforms ?? [];

  return (
    <AnimatedScreen>
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: 'rgba(255,255,255,0.06)' },
            pressed && { opacity: 0.6 },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}
        >
          <Text style={[styles.backArrow, { color: palette.textSecondary }]}>←</Text>
        </Pressable>

        <View style={styles.headerIcon}>
          <Text style={styles.iconEmoji}>{agent.icon}</Text>
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.agentName, { color: palette.text }]} numberOfLines={1}>
            {agent.name}
          </Text>
          {isPreset && (
            <View style={[styles.presetBadge, { backgroundColor: palette.violet + '22', borderColor: palette.violet + '55' }]}>
              <Text style={[styles.presetBadgeText, { color: palette.violet }]}>PRESET</Text>
            </View>
          )}
        </View>

        {!isPreset && !editMode && (
          <Pressable
            onPress={enterEditMode}
            style={({ pressed }) => [
              styles.editBtn,
              { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: palette.border },
              pressed && { opacity: 0.6 },
              Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
            ]}
          >
            <Text style={[styles.editBtnText, { color: palette.cyan }]}>✏️ Modifica</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── EDIT MODE ────────────────────────────────────────────────────── */}
        {editMode ? (
          <View style={styles.section}>
            {/* Name */}
            <Text style={[styles.fieldLabel, { color: palette.textMuted }]}>Nome</Text>
            <TextInput
              style={[
                styles.textInput,
                { color: palette.text, backgroundColor: palette.card, borderColor: palette.borderActive },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Nome agente"
              placeholderTextColor={palette.textMuted}
              maxLength={255}
            />

            {/* Description */}
            <Text style={[styles.fieldLabel, { color: palette.textMuted, marginTop: SPACING.md }]}>Descrizione</Text>
            <TextInput
              style={[
                styles.textInput,
                styles.textInputMultiline,
                { color: palette.text, backgroundColor: palette.card, borderColor: palette.borderActive },
              ]}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Descrivi cosa fa questo agente..."
              placeholderTextColor={palette.textMuted}
              maxLength={1000}
              multiline
              numberOfLines={4}
            />

            {/* Mode */}
            <Text style={[styles.fieldLabel, { color: palette.textMuted, marginTop: SPACING.md }]}>Modalità predefinita</Text>
            <ControlSlider
              mode={editMode_ctrl}
              onChange={setEditModeCtrl}
              disabled={saving}
            />

            {/* Steps note */}
            <View style={[styles.stepsNote, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
              <Text style={[styles.stepsNoteText, { color: palette.textSecondary }]}>
                ✏️ Modifica gli step nel builder
              </Text>
            </View>

            {/* Save / Cancel */}
            <View style={styles.editActions}>
              <Pressable
                onPress={cancelEdit}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { borderColor: palette.border },
                  pressed && { opacity: 0.7 },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
              >
                <Text style={[styles.cancelBtnText, { color: palette.textSecondary }]}>Annulla</Text>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: palette.cyan },
                  (pressed || saving) && { opacity: 0.7 },
                  Platform.OS === 'web' && ({ cursor: saving ? 'default' : 'pointer' } as any),
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#04040A" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Salva</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── VIEW MODE ───────────────────────────────────────────────────── */
          <>
            {/* Description */}
            {agent.description ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>Descrizione</Text>
                <Text style={[styles.descriptionText, { color: palette.textSecondary }]}>
                  {agent.description}
                </Text>
              </View>
            ) : null}

            {/* Mode pill */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>Modalità predefinita</Text>
              <View style={[
                styles.modePill,
                { backgroundColor: palette.cyan + '18', borderColor: palette.cyan + '44' },
              ]}>
                <Text style={styles.modeEmoji}>{modeInfo.emoji}</Text>
                <Text style={[styles.modeLabel, { color: palette.cyan }]}>{modeInfo.label}</Text>
                <Text style={[styles.modeDesc, { color: palette.textMuted }]}>{modeInfo.desc}</Text>
              </View>
            </View>

            {/* Platform tags */}
            {platforms.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>Piattaforme target</Text>
                <View style={styles.platformsRow}>
                  {platforms.map((pid) => {
                    const def = getPlatformDef(pid);
                    const color = def?.color ?? palette.textMuted;
                    return (
                      <View
                        key={pid}
                        style={[
                          styles.platformTag,
                          { backgroundColor: color + '18', borderColor: color + '44' },
                        ]}
                      >
                        <Text style={styles.platformEmoji}>{def?.emoji ?? '🔗'}</Text>
                        <Text style={[styles.platformName, { color }]}>{def?.name ?? pid}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Steps list */}
            {steps.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>Step</Text>
                <View style={[styles.stepsContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  {steps.map((step, index) => (
                    <View key={`${step.tool_id}-${index}`}>
                      {index > 0 && (
                        <View style={[styles.stepDivider, { backgroundColor: palette.border }]} />
                      )}
                      <View style={styles.stepRow}>
                        {/* Step number */}
                        <View style={[styles.stepNumber, { backgroundColor: palette.elevated, borderColor: palette.border }]}>
                          <Text style={[styles.stepNumberText, { color: palette.textSecondary }]}>
                            {index + 1}
                          </Text>
                        </View>

                        {/* Step info */}
                        <View style={styles.stepInfo}>
                          <Text style={[styles.stepLabel, { color: palette.text }]}>{step.label}</Text>
                          <Text style={[styles.stepToolId, { color: palette.textMuted }]}>{step.tool_id}</Text>

                          {/* Badges row */}
                          <View style={styles.stepBadges}>
                            {step.required && (
                              <View style={[styles.badge, { backgroundColor: palette.magenta + '18', borderColor: palette.magenta + '44' }]}>
                                <Text style={[styles.badgeText, { color: palette.magenta }]}>Obbligatorio</Text>
                              </View>
                            )}
                            {step.auto_run && (
                              <View style={[styles.badge, { backgroundColor: palette.cyan + '18', borderColor: palette.cyan + '44' }]}>
                                <Text style={[styles.badgeText, { color: palette.cyan }]}>Automatico</Text>
                              </View>
                            )}
                            {step.condition && (
                              <View style={[styles.badge, { backgroundColor: palette.violet + '18', borderColor: palette.violet + '44' }]}>
                                <Text style={[styles.badgeText, { color: palette.violet }]}>
                                  Condizione: {step.condition}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Avvia Missione button */}
            <View style={styles.section}>
              <Pressable
                onPress={handleStartMission}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: palette.cyan },
                  pressed && { opacity: 0.8 },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: '#04040A' }]}>🚀 Avvia Missione</Text>
              </Pressable>
            </View>

            {/* Delete button (non-preset only) */}
            {!isPreset && (
              <View style={[styles.section, styles.deleteSection]}>
                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { borderColor: palette.magenta + '66' },
                    pressed && { opacity: 0.7 },
                    Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                  ]}
                >
                  <Text style={[styles.deleteBtnText, { color: palette.magenta }]}>🗑 Elimina agente</Text>
                </Pressable>
              </View>
            )}

            {/* Bottom spacing */}
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
    </View>
    </AnimatedScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.xl,
  },
  loadingText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  errorTitle: {
    ...TYPO.h2,
    marginBottom: SPACING.xs,
  },
  errorMsg: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  retryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.select({ web: 24, ios: 56, default: 40 }),
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  headerDesktop: {
    paddingTop: 24,
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 28,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  agentName: {
    ...TYPO.h3,
  },
  presetBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  presetBadgeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  editBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  editBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginHorizontal: SPACING.lg,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  scrollContentDesktop: {
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },

  // Sections
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    ...TYPO.label,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    ...TYPO.label,
    marginBottom: SPACING.xs,
  },
  descriptionText: {
    ...TYPO.body,
  },

  // Mode pill
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  modeEmoji: {
    fontSize: 20,
  },
  modeLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },
  modeDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    flex: 1,
  },

  // Platforms
  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  platformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    gap: 4,
  },
  platformEmoji: {
    fontSize: 12,
  },
  platformName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },

  // Steps
  stepsContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  stepDivider: {
    height: 1,
    marginHorizontal: SPACING.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  stepInfo: {
    flex: 1,
    gap: 2,
  },
  stepLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  stepToolId: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  stepBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  badge: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },

  // Steps note (edit mode)
  stepsNote: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
  },
  stepsNoteText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
  },

  // Edit actions
  editActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  saveBtn: {
    flex: 2,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: '#04040A',
  },

  // Text inputs
  textInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },

  // Primary button
  primaryBtn: {
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 0 20px rgba(0,255,208,0.3), 0 0 60px rgba(0,255,208,0.1)' } as any
      : {}),
  },
  primaryBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // Delete
  deleteSection: {
    marginTop: SPACING.sm,
  },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },

  bottomSpacer: {
    height: SPACING.xxl,
  },
});
