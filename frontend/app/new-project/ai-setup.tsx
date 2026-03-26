import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { GlowCard } from '@/components/GlowCard';
import { useSettings } from '@/hooks/useSettings';
import { generateProjectFromDescription } from '@/services/gemini';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';
import type { PhaseTemplate } from '@/types';
import { getPhaseColor } from '@/constants/phases';

export default function AiSetupScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { settings } = useSettings();
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    projectName: string;
    description: string;
    phases: Array<{ name: string; icon: string; suggestedToolIds: string[] }>;
  } | null>(null);

  const isDesktop = width >= 1024;

  const handleGenerate = async () => {
    if (!description.trim()) return;

    if (!settings.googleApiKey) {
      const msg = 'Inserisci la Google API Key nelle Impostazioni per usare l\'AI.';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('API Key mancante', msg); }
      router.push('/new-project/customize?templateId=custom');
      return;
    }

    setLoading(true);
    try {
      const res = await generateProjectFromDescription(
        settings.googleApiKey,
        settings.geminiModel,
        description,
      );
      setResult(res);
    } catch (e: any) {
      const msg = 'Errore nella generazione AI. Prova di nuovo o crea manualmente.';
      if (Platform.OS === 'web') { window.alert(msg); }
      else { Alert.alert('Errore', msg); }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    if (!result) return;
    const phases: PhaseTemplate[] = result.phases.map((p, i) => ({
      name: p.name,
      icon: p.icon,
      color: getPhaseColor(i),
      order: i,
      suggestedToolIds: p.suggestedToolIds,
    }));
    const encodedPhases = encodeURIComponent(JSON.stringify(phases));
    const encodedName = encodeURIComponent(result.projectName);
    router.push(`/new-project/customize?prefilledName=${encodedName}&prefilledPhases=${encodedPhases}`);
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
          <GradientText gradient={[COLORS.neonMagenta, COLORS.neonViolet]} style={TYPO.h1}>
            Setup AI
          </GradientText>
          <Text style={styles.subtitle}>
            Descrivi il tuo progetto e l'AI creerà le fasi per te
          </Text>
        </View>

        <GlowCard gradient={[COLORS.neonMagenta, COLORS.neonViolet]} glowIntensity={0.2}>
          <TextInput
            style={styles.input}
            placeholder="Es: Voglio creare un podcast settimanale su tecnologia. Ogni episodio dura 30 minuti..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            value={description}
            onChangeText={setDescription}
            numberOfLines={6}
          />
        </GlowCard>

        <Pressable
          onPress={handleGenerate}
          disabled={loading || !description.trim()}
          style={({ pressed }) => [
            { opacity: pressed || !description.trim() ? 0.6 : 1, marginTop: SPACING.lg },
          ]}
        >
          <LinearGradient
            colors={[COLORS.neonMagenta, COLORS.neonViolet] as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateBtn}
          >
            {loading
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={styles.generateBtnText}>✨ Genera progetto</Text>
            }
          </LinearGradient>
        </Pressable>

        {/* Result */}
        {result && (
          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>PROGETTO GENERATO</Text>
            <GlowCard gradient={COLORS.gradViolet} glowIntensity={0.15}>
              <Text style={styles.resultName}>{result.projectName}</Text>
              {result.description ? (
                <Text style={styles.resultDesc}>{result.description}</Text>
              ) : null}
              <View style={styles.resultPhases}>
                {result.phases.map((p, i) => (
                  <View key={i} style={styles.resultPhaseRow}>
                    <View style={[styles.resultPhaseDot, { backgroundColor: getPhaseColor(i) }]} />
                    <Text style={styles.resultPhaseIcon}>{p.icon}</Text>
                    <Text style={styles.resultPhaseName}>{p.name}</Text>
                  </View>
                ))}
              </View>
            </GlowCard>

            <View style={styles.resultActions}>
              <Pressable
                onPress={handleCreate}
                style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1, flex: 1 }]}
              >
                <LinearGradient
                  colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtn}
                >
                  <Text style={styles.actionBtnText}>✏️ Modifica fasi</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    paddingTop: Platform.select({ web: 40, default: 60 }),
    paddingBottom: 60,
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
  input: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 140,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  generateBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  generateBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: COLORS.bg },
  resultSection: { marginTop: SPACING.xl, gap: SPACING.lg },
  resultLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
  },
  resultName: { ...TYPO.h2, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  resultDesc: { ...TYPO.body, color: COLORS.textSecondary, marginBottom: SPACING.md },
  resultPhases: { gap: SPACING.sm },
  resultPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  resultPhaseDot: { width: 8, height: 8, borderRadius: 4 },
  resultPhaseIcon: { fontSize: 16 },
  resultPhaseName: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.textPrimary },
  resultActions: { flexDirection: 'row', gap: SPACING.md },
  actionBtn: { borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  actionBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 15, color: COLORS.bg },
});
