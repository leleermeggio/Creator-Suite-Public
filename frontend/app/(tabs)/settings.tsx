import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Pressable,
  Switch,
  TextInput,
  useWindowDimensions,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AnimatedScreen } from '@/components/animated';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { Avatar } from '@/components/Avatar';
import { useSettings } from '@/hooks/useSettings';
import { useAuthContext } from '@/context/AuthContext';
import { AI_PROVIDERS } from '@/types';
import type { AiProvider } from '@/types';
import * as authApi from '@/services/authApi';
import {
  COLORS,
  SPACING,
  TYPO,
  FONTS,
  RADIUS,
} from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

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
  const { palette } = useTheme();
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
        <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.settingSublabel, { color: palette.textMuted }]}>{sublabel}</Text>
        )}
        {children}
      </View>
      {onToggle !== undefined && value !== undefined && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{
            false: palette.elevated,
            true: accentColor + '66',
          }}
          thumbColor={value ? accentColor : palette.textMuted}
        />
      )}
      {onPress && <Text style={[styles.settingChevron, { color: palette.textMuted }]}>›</Text>}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const { settings, update } = useSettings();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const { user, logout, updateProfile } = useAuthContext();
  const router = useRouter();
  const isDesktop = width >= 1024;

  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const imageUri = result.assets[0].uri;
    setLocalAvatarUri(imageUri);
    setUploadingAvatar(true);
    try {
      const updated = await authApi.uploadAvatar(imageUri);
      await updateProfile({ avatar_url: updated.avatar_url ?? undefined });
    } catch {
      setLocalAvatarUri(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveName = async () => {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === user?.display_name) return;
    try {
      await updateProfile({ display_name: trimmed });
    } catch {
      setNameInput(user?.display_name ?? '');
    }
  };
  const horizontalPad = isDesktop ? 48 : 20;
  const contentMaxWidth = isDesktop ? 640 : undefined;

  const selectedProvider = AI_PROVIDERS.find(p => p.id === settings.aiProvider) ?? AI_PROVIDERS[0];

  // Sync API key input with selected provider's stored key
  useEffect(() => {
    if (settings.aiProvider === 'gemini') setApiKeyInput(settings.googleApiKey ?? '');
    else if (settings.aiProvider === 'groq') setApiKeyInput(settings.groqApiKey ?? '');
    else if (settings.aiProvider === 'openrouter') setApiKeyInput(settings.openrouterApiKey ?? '');
    else setApiKeyInput('');
  }, [settings.aiProvider, settings.googleApiKey, settings.groqApiKey, settings.openrouterApiKey, settings.nanobananaApiKey]);

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
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <CosmicBackground />
      <AnimatedScreen>
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
        <View>
          <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
            Impostazioni
          </GradientText>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Personalizza la tua esperienza
          </Text>
        </View>

        {/* PROFILO */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>PROFILO</Text>
          <GlowCard gradient={COLORS.gradAurora} glowIntensity={0.15} borderWidth={1}>
            <View style={styles.profileRow}>
              <Pressable
                onPress={handlePickAvatar}
                style={styles.avatarWrap}
                disabled={uploadingAvatar}
              >
                <Avatar
                  uri={localAvatarUri ?? user?.avatar_url}
                  displayName={user?.display_name ?? '?'}
                  size={72}
                  glowColor={COLORS.neonCyan}
                />
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditIcon}>{uploadingAvatar ? '⏳' : '📷'}</Text>
                </View>
              </Pressable>

              <View style={styles.profileInfo}>
                {editingName ? (
                  <TextInput
                    style={[styles.nameEditInput, { color: palette.text, borderColor: palette.borderActive }]}
                    value={nameInput}
                    onChangeText={setNameInput}
                    onBlur={handleSaveName}
                    onSubmitEditing={handleSaveName}
                    autoFocus
                    returnKeyType="done"
                    autoCapitalize="words"
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      setNameInput(user?.display_name ?? '');
                      setEditingName(true);
                    }}
                    style={styles.nameRow}
                  >
                    <Text style={[styles.profileName, { color: palette.text }]} numberOfLines={1}>
                      {user?.display_name ?? '—'}
                    </Text>
                    <Text style={[styles.nameEditIcon, { color: palette.textMuted }]}>✎</Text>
                  </Pressable>
                )}
                <Text style={[styles.profileEmail, { color: palette.textMuted }]} numberOfLines={1}>
                  {user?.email ?? '—'}
                </Text>
              </View>
            </View>
          </GlowCard>
        </View>

        {/* AI Provider section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>PROVIDER AI</Text>
          <GlowCard gradient={COLORS.gradCyan} glowIntensity={0.1} borderWidth={1}>
            <View style={styles.settingsGroup}>
              {/* Provider selector */}
              <View style={styles.settingRow}>
                <Text style={styles.settingIcon}>🤖</Text>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>Provider</Text>
                  <Text style={[styles.settingSublabel, { color: palette.textMuted }]}>
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
                            { color: isActive ? palette.cyan : palette.textSecondary },
                          ]}>
                            {p.name}
                          </Text>
                          <Text style={[styles.providerDesc, { color: palette.textMuted }]}>
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
                      <Text style={[styles.settingLabel, { color: palette.text }]}>
                        {selectedProvider.name} API Key
                      </Text>
                      <Pressable onPress={openSignup} style={Platform.OS === 'web' ? { cursor: 'pointer' as any } : undefined}>
                        <Text style={styles.signupLink}>
                          Ottieni chiave gratuita →
                        </Text>
                      </Pressable>
                      <TextInput
                        style={[styles.apiKeyInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.elevated }]}
                        value={apiKeyInput}
                        onChangeText={setApiKeyInput}
                        onBlur={handleSaveApiKey}
                        placeholder={
                          settings.aiProvider === 'gemini' ? 'AIza...'
                          : settings.aiProvider === 'groq' ? 'gsk_...'
                          : 'sk-or-...'
                        }
                        placeholderTextColor={palette.textMuted}
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
                  <Text style={[styles.settingLabel, { color: palette.text }]}>Modello</Text>
                  <Text style={[styles.settingSublabel, { color: palette.textMuted }]}>{settings.aiModel}</Text>
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
                          { color: settings.aiModel === m ? palette.cyan : palette.textMuted },
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
        </View>

        {/* Image Generation section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>GENERAZIONE IMMAGINI</Text>
          <GlowCard gradient={COLORS.gradMagenta} glowIntensity={0.1} borderWidth={1}>
            <View style={styles.settingsGroup}>
              <View style={styles.settingRow}>
                <Text style={styles.settingIcon}>🍌</Text>
                <View style={styles.settingTextCol}>
                  <Text style={[styles.settingLabel, { color: palette.text }]}>NanoBanana API Key</Text>
                  <Text style={[styles.settingSublabel, { color: palette.textMuted }]}>
                    Gemini-powered image generation
                  </Text>
                  <Pressable 
                    onPress={() => {
                      const url = 'https://nanobananaapi.ai/api-key';
                      if (Platform.OS === 'web') {
                        window.open(url, '_blank');
                      } else {
                        Linking.openURL(url);
                      }
                    }}
                    style={Platform.OS === 'web' ? { cursor: 'pointer' as any } : undefined}
                  >
                    <Text style={styles.signupLink}>
                      Ottieni crediti gratuiti →
                    </Text>
                  </Pressable>
                  <TextInput
                    style={[styles.apiKeyInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.elevated }]}
                    value={settings.nanobananaApiKey}
                    onChangeText={(value) => update({ nanobananaApiKey: value })}
                    placeholder="nb_..."
                    placeholderTextColor={palette.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {settings.nanobananaApiKey.trim().length > 0 && (
                    <Text style={styles.apiKeyStatus}>✅ Key salvata</Text>
                  )}
                </View>
              </View>
            </View>
          </GlowCard>
        </View>

        {/* General section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>GENERALI</Text>
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
        </View>

        {/* Logout section */}
        <View style={styles.section}>
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
        </View>

        {/* Info section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>INFO</Text>
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
        </View>
      </ScrollView>
      </AnimatedScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    backgroundColor: 'rgba(128,128,128,0.15)',
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
    borderColor: 'rgba(128,128,128,0.2)',
    backgroundColor: 'rgba(128,128,128,0.05)',
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
    borderColor: 'rgba(128,128,128,0.2)',
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
  profileRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  avatarWrap: {
    position: 'relative' as const,
  },
  avatarEditBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarEditIcon: {
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: SPACING.sm,
  },
  profileName: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    lineHeight: 24,
  },
  nameEditIcon: {
    fontSize: 14,
  },
  nameEditInput: {
    fontFamily: FONTS.displayBold,
    fontSize: 18,
    borderBottomWidth: 1.5,
    paddingVertical: 2,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  profileEmail: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
});
