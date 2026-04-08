import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { PROJECT_TEMPLATES } from '@/constants/projectTemplates';
import { useEntranceAnimation } from '@/hooks/useAnimations';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';

export default function NewProjectScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const headerAnim = useEntranceAnimation(0);
  const aiCardAnim = useEntranceAnimation(80);
  const gridAnim = useEntranceAnimation(160);

  const handleTemplate = (templateId: string) => {
    router.push(`/new-project/customize?templateId=${templateId}`);
  };

  const handleAI = () => {
    router.push('/new-project/ai-setup');
  };

  const handleCustom = () => {
    router.push('/new-project/customize?templateId=custom');
  };

  return (
    <View style={styles.container}>
      <CosmicBackground />
      {isDesktop && (
        <ScreenHeader
          title="Nuovo Progetto"
          subtitle="Scegli un template o descrivilo con AI"
          showBack
          gradient={COLORS.gradAurora}
        />
      )}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: isDesktop ? 48 : 20,
            maxWidth: isDesktop ? 800 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back (mobile) */}
        {!isDesktop && (
          <Animated.View style={headerAnim}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>Indietro</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Header (mobile) */}
        {!isDesktop && (
          <Animated.View style={[styles.header, headerAnim]}>
            <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
              Nuovo Progetto
            </GradientText>
            <Text style={styles.subtitle}>Scegli un template o descrivilo con AI</Text>
          </Animated.View>
        )}

        {/* AI setup CTA */}
        <Animated.View style={[{ marginBottom: SPACING.xl }, aiCardAnim]}>
          <Pressable
            onPress={handleAI}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <LinearGradient
              colors={[COLORS.neonMagenta, COLORS.neonViolet] as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.aiCard}
            >
              <Text style={styles.aiIcon}>✨</Text>
              <View style={styles.aiText}>
                <Text style={styles.aiTitle}>Descrivi con AI</Text>
                <Text style={styles.aiSubtitle}>
                  Racconta il tuo progetto e l'AI crea le fasi per te
                </Text>
              </View>
              <Text style={styles.aiArrow}>→</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* Templates */}
        <Animated.View style={gridAnim}>
          <Text style={styles.sectionLabel}>TEMPLATE</Text>
          <View style={styles.templateGrid}>
            {PROJECT_TEMPLATES.map((tpl) => (
              <Pressable
                key={tpl.id}
                onPress={() => handleTemplate(tpl.id)}
                style={({ pressed }) => [
                  styles.templateCard,
                  { opacity: pressed ? 0.8 : 1 },
                  Platform.OS === 'web' && ({ cursor: 'pointer', transition: 'all 0.15s ease' } as any),
                ]}
              >
                {/* Gradient top bar */}
                <LinearGradient
                  colors={tpl.gradient as unknown as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tplGradientBar}
                />
                <View style={styles.tplBody}>
                  <View style={styles.tplTopRow}>
                    <Text style={styles.tplIcon}>{tpl.icon}</Text>
                    <View style={styles.tplBadge}>
                      <Text style={styles.tplBadgeText}>{tpl.defaultExportPreset}</Text>
                    </View>
                  </View>
                  <Text style={styles.tplName}>{tpl.name}</Text>
                  <Text style={styles.tplDesc} numberOfLines={2}>{tpl.description}</Text>
                  <View style={styles.tplTags}>
                    {tpl.tags.slice(0, 3).map((tag) => (
                      <View key={tag} style={styles.tplTag}>
                        <Text style={styles.tplTagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.tplPhases}>
                    {tpl.phases.map((p, pi) => (
                      <View key={pi} style={[styles.tplPhaseDot, { backgroundColor: p.color }]} />
                    ))}
                    <Text style={styles.tplToolCount}>
                      {tpl.suggestedTools.length} tool
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}

            {/* Custom */}
            <Pressable
              onPress={handleCustom}
              style={({ pressed }) => [
                styles.templateCard,
                styles.customCard,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={styles.tplBody}>
                <Text style={styles.tplIcon}>⚙️</Text>
                <Text style={styles.tplName}>Personalizzato</Text>
                <Text style={styles.tplDesc} numberOfLines={2}>
                  Crea il tuo workflow da zero con fasi personalizzate
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
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
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  aiIcon: { fontSize: 32 },
  aiText: { flex: 1 },
  aiTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 17, color: COLORS.bg },
  aiSubtitle: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: 'rgba(0,0,0,0.55)', marginTop: 2 },
  aiArrow: { fontFamily: FONTS.displayBold, fontSize: 22, color: 'rgba(0,0,0,0.4)' },
  sectionLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },
  templateGrid: { gap: SPACING.md },
  templateCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tplGradientBar: {
    height: 3,
  },
  tplBody: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  tplTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tplBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tplBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  tplTags: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  tplTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(0,245,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
  },
  tplTagText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    color: COLORS.neonCyan,
    letterSpacing: 0.3,
  },
  tplToolCount: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
    marginLeft: SPACING.sm,
    alignSelf: 'center',
  },
  customCard: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tplIcon: { fontSize: 32 },
  tplName: { ...TYPO.h3, color: COLORS.textPrimary },
  tplDesc: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.textSecondary },
  tplPhases: { flexDirection: 'row', gap: 6, marginTop: SPACING.xs, alignItems: 'center' },
  tplPhaseDot: { width: 8, height: 8, borderRadius: 4 },
});
