import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Pressable,
  Switch,
  TextInput,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/context/AuthContext';
import { AI_PROVIDERS } from '@/types';
import type { AiProvider } from '@/types';
import {
  COLORS,
  SPACING,
  TYPO,
  FONTS,
  RADIUS,
} from '@/constants/theme';

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
  const [apiKeyInput, setApiKeyInput] = useState('');
  const { logout } = useAuthContext();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDesktop = width >= 1024;
  const horizontalPad = isDesktop ? 48 : 20;
  const contentMaxWidth = isDesktop ? 640 : undefined;

  const selectedProvider = AI_PROVIDERS.find(p => p.id === settings.aiProvider) ?? AI_PROVIDERS[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Sync API key input with selected provider's stored key
  useEffect(() => {
    if (settings.aiProvider === 'gemini') setApiKeyInput(settings.googleApiKey ?? '');
    else if (settings.aiProvider === 'groq') setApiKeyInput(settings.groqApiKey ?? '');
    else if (settings.aiProvider === 'openrouter') setApiKeyInput(settings.openrouterApiKey ?? '');
    else setApiKeyInput('');
  }, [settings.aiProvider, settings.googleApiKey, settings.groqApiKey, settings.openrouterApiKey]);

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    if (settings.aiProvider === 'gemini') update({ googleApiKey: key });
    else if (settings.aiProvider === 'groq') update({ groqApiKey: key });
    else if (settings.aiProvider === 'openrouter') update({ openrouterApiKey: key });
  };

  const handleSelectProvider = (id: AiProvider) => {
    const provider = AI_PROVIDERS.find(p => p.id === id);
    if (provider) {
      update({ aiProvider: id, aiModel: provider.defaultModel });
    }
  };

  const openSignup = () => {
    if (selectedProvider.signupUrl) {
      if (Platform.OS === 'web') {
        window.open(selectedProvider.signupUrl, '_blank');
      } else {
        Linking.openURL(selectedProvider.signupUrl);
      }
    }
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

        {/* AI Provider section */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>PROVIDER AI</Text>
          <GlowCard gradient={COLORS.gradCyan} glowIntensity={0.1} borderWidth={1}>
            <View style={styles.settingsGroup}>
              {/* Provider selector */}
              <View style={styles.settingRow}>
                <Text style={styles.settingIcon}>🤖</Text>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Provider</Text>
                  <Text style={styles.settingSublabel}>
                    {selectedProvider.description}
                  </Text>
                  <View style={styles.providerCards}>
                    {AI_PROVIDERS.map(p => {
                      const isActive = settings.aiProvider === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => handleSelectProvider(p.id)}
                          style={[
                            styles.providerCard,
                            isActive && styles.providerCardActive,
                            Platform.OS === 'web' && { cursor: 'pointer' as any },
                          ]}
                        >
                          <Text style={[
                            styles.providerName,
                            isActive && styles.providerNameActive,
                          ]}>
                            {p.name}
                          </Text>
                          <Text style={styles.providerDesc}>
                            {p.requiresKey ? 'Chiave richiesta' : 'Nessuna chiave'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* API Key input (only if provider requires key) */}
              {selectedProvider.requiresKey && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.settingRow}>
                    <Text style={styles.settingIcon}>🔑</Text>
                    <View style={styles.settingTextCol}>
                      <Text style={styles.settingLabel}>
                        {selectedProvider.name} API Key
                      </Text>
                      <Pressable onPress={openSignup} style={Platform.OS === 'web' ? { cursor: 'pointer' as any } : undefined}>
                        <Text style={styles.signupLink}>
                          Ottieni chiave gratuita →
                        </Text>
                      </Pressable>
                      <TextInput
                        style={styles.apiKeyInput}
                        value={apiKeyInput}
                        onChangeText={setApiKeyInput}
                        onBlur={handleSaveApiKey}
                        placeholder={
                          settings.aiProvider === 'gemini' ? 'AIza...'
                          : settings.aiProvider === 'groq' ? 'gsk_...'
                          : 'sk-or-...'
                        }
                        placeholderTextColor={COLORS.textMuted}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {apiKeyInput.trim().length > 0 && (
                        <Text style={styles.apiKeyStatus}>✅ Key salvata</Text>
                      )}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.divider} />

              {/* Model selector */}
              <View style={styles.settingRow}>
                <Text style={styles.settingIcon}>🧠</Text>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingLabel}>Modello</Text>
                  <Text style={styles.settingSublabel}>{settings.aiModel}</Text>
                  <View style={styles.modelChips}>
                    {selectedProvider.models.map(m => (
                      <Pressable
                        key={m}
                        onPress={() => update({ aiModel: m })}
                        style={[
                          styles.modelChip,
                          settings.aiModel === m && styles.modelChipActive,
                          Platform.OS === 'web' && { cursor: 'pointer' as any },
                        ]}
                      >
                        <Text style={[
                          styles.modelChipText,
                          settings.aiModel === m && styles.modelChipTextActive,
                        ]}>
                          {m.replace('gemini-', '').replace('meta-llama/', '').replace('mistralai/', '').replace('google/', '').replace(':free', '')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
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
  providerCards: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  providerCard: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    minWidth: 120,
  },
  providerCardActive: {
    borderColor: COLORS.neonCyan,
    backgroundColor: COLORS.neonCyan + '15',
  },
  providerName: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  providerNameActive: {
    color: COLORS.neonCyan,
  },
  providerDesc: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  signupLink: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    color: COLORS.neonCyan,
    marginTop: 4,
  },
  apiKeyInput: {
    marginTop: SPACING.sm,
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.bgElevated,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  apiKeyStatus: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 11,
    color: COLORS.neonLime,
    marginTop: SPACING.xs,
  },
  modelChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  modelChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modelChipActive: {
    borderColor: COLORS.neonCyan,
    backgroundColor: COLORS.neonCyan + '15',
  },
  modelChipText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  modelChipTextActive: {
    color: COLORS.neonCyan,
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
