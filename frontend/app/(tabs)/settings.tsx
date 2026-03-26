import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Pressable,
  Switch,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/context/AuthContext';
import {
  COLORS,
  SPACING,
  TYPO,
  FONTS,
  RADIUS,
} from '@/constants/theme';

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

interface SettingRowProps {
  icon: string;
  label: string;
  sublabel?: string;
  value?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  accentColor?: string;
  children?: React.ReactNode;
}

function SettingRow({
  icon,
  label,
  sublabel,
  value,
  onToggle,
  onPress,
  accentColor = COLORS.neonCyan,
  children,
}: SettingRowProps) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        styles.settingRow,
        Platform.OS === 'web' && onPress && { cursor: 'pointer' as any },
      ]}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingTextCol}>
        <Text style={styles.settingLabel}>{label}</Text>
        {sublabel && (
          <Text style={styles.settingSublabel}>{sublabel}</Text>
        )}
        {children}
      </View>
      {onToggle !== undefined && value !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{
            false: COLORS.bgElevated,
            true: accentColor + '66',
          }}
          thumbColor={value ? accentColor : COLORS.textMuted}
        />
      )}
      {onPress && <Text style={styles.settingChevron}>›</Text>}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const { logout } = useAuthContext();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDesktop = width >= 1024;
  const horizontalPad = isDesktop ? 48 : 20;
  const contentMaxWidth = isDesktop ? 640 : undefined;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const cycleModel = () => {
    const idx = GEMINI_MODELS.indexOf(settings.geminiModel);
    const next = GEMINI_MODELS[(idx + 1) % GEMINI_MODELS.length];
    update({ geminiModel: next });
  };

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPad,
            maxWidth: contentMaxWidth,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
            Impostazioni
          </GradientText>
          <Text style={styles.subtitle}>
            Personalizza la tua esperienza
          </Text>
        </Animated.View>

        {/* Account section */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <GlowCard
            gradient={COLORS.gradCyan}
            glowIntensity={0.1}
            borderWidth={1}
          >
            <View style={styles.settingsGroup}>
              <SettingRow
                icon="🧠"
                label="Modello Gemini"
                sublabel={settings.geminiModel}
                onPress={cycleModel}
                accentColor={COLORS.neonViolet}
              />
            </View>
          </GlowCard>
        </Animated.View>

        {/* General section */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>GENERALI</Text>
          <GlowCard
            gradient={COLORS.gradViolet}
            glowIntensity={0.1}
            borderWidth={1}
          >
            <View style={styles.settingsGroup}>
              <SettingRow
                icon="🔔"
                label="Notifiche"
                sublabel="Ricevi avvisi al completamento"
                value={settings.notifications}
                onToggle={(val) => update({ notifications: val })}
              />
              <View style={styles.divider} />
              <SettingRow
                icon="⚡"
                label="Elaborazione automatica"
                sublabel="Avvia appena il file viene inviato"
                value={settings.autoProcess}
                onToggle={(val) => update({ autoProcess: val })}
                accentColor={COLORS.neonOrange}
              />
              <View style={styles.divider} />
              <SettingRow
                icon="💎"
                label="Alta qualità"
                sublabel="Usa modelli più precisi ma lenti"
                value={settings.highQuality}
                onToggle={(val) => update({ highQuality: val })}
                accentColor={COLORS.neonViolet}
              />
            </View>
          </GlowCard>
        </Animated.View>

        {/* Logout section */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Pressable
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
            style={({ pressed }) => [
              styles.logoutBtn,
              { opacity: pressed ? 0.7 : 1 },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            <Text style={styles.logoutText}>Esci</Text>
          </Pressable>
        </Animated.View>

        {/* Info section */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>INFO</Text>
          <GlowCard
            gradient={COLORS.gradMagenta}
            glowIntensity={0.1}
            borderWidth={1}
          >
            <View style={styles.settingsGroup}>
              <SettingRow
                icon="📖"
                label="Versione"
                sublabel="1.0.0"
                accentColor={COLORS.neonMagenta}
              />
              <View style={styles.divider} />
              <SettingRow
                icon="🐛"
                label="Segnala un bug"
                onPress={() => {}}
                accentColor={COLORS.neonMagenta}
              />
            </View>
          </GlowCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Platform.select({ web: 40, default: 60 }),
    paddingBottom: 100,
  },
  subtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionLabel: {
    ...TYPO.label,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  settingsGroup: {
    gap: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  settingIcon: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  settingTextCol: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  settingSublabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  settingChevron: {
    fontFamily: FONTS.displayBold,
    fontSize: 22,
    color: COLORS.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginLeft: 44,
  },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.neonPink + '66',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    backgroundColor: COLORS.neonPink + '0D',
  },
  logoutText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.neonPink,
    letterSpacing: 0.5,
  },
});
