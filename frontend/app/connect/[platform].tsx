import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { COLORS, FONTS, SPACING, RADIUS, TYPO } from '@/constants/theme';
import { GlowCard } from '@/components/GlowCard';
import { usePlatforms } from '@/hooks/usePlatforms';
import type { PlatformStatusItem } from '@/services/platformsApi';

interface PlatformConfig {
  label: string;
  color: string;
  description: string;
  permissions: string[];
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    description: 'Visualizza statistiche di visualizzazioni, iscritti, ore guardate ed entrate.',
    permissions: [
      'Lettura statistiche canale (sola lettura)',
      'Accesso alla lista video',
      'Dati analytics aggregati',
    ],
  },
  tiktok: {
    label: 'TikTok',
    color: '#FFFFFF',
    description: 'Visualizza visualizzazioni, follower e performance dei video.',
    permissions: [
      'Lettura profilo pubblico',
      'Statistiche video (sola lettura)',
      'Conteggio follower',
    ],
  },
  instagram: {
    label: 'Instagram',
    color: '#E1306C',
    description: 'Visualizza reach, impressioni e statistiche dei contenuti.',
    permissions: [
      'Accesso Instagram Business/Creator',
      'Statistiche post e storie (sola lettura)',
      'Dati reach e impressioni',
    ],
  },
};

export function ConnectPlatformScreen() {
  const { platform } = useLocalSearchParams<{ platform: string }>();
  const router = useRouter();
  const { platforms, loading, error, connect, disconnect, refresh } = usePlatforms();

  const config = PLATFORM_CONFIG[platform ?? ''];

  const statusItem = useMemo(
    () => platforms.find((p: PlatformStatusItem) => p.platform === platform),
    [platforms, platform],
  );

  const isConnected = statusItem?.connected === true;

  if (!config) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>← Indietro</Text>
          </Pressable>
          <View style={styles.centeredContent}>
            <GlowCard variant="subtle">
              <Text style={[TYPO.body, { color: COLORS.textPrimary }]}>
                Piattaforma non supportata
              </Text>
            </GlowCard>
          </View>
        </ScrollView>
      </View>
    );
  }

  const brandColor = config.color === '#FFFFFF' ? COLORS.neonCyan : config.color;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => refresh()}>
            <Text style={styles.retryText}>Riprova</Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Indietro</Text>
        </Pressable>

        <GlowCard variant="subtle" style={styles.headerCard}>
          <View style={[styles.platformCircle, { backgroundColor: brandColor + '22', borderColor: brandColor + '40' }]}>
            <Text style={[styles.platformInitial, { color: brandColor }]}>
              {config.label.charAt(0)}
            </Text>
          </View>
          <Text style={[TYPO.h1, styles.platformLabel]}>{config.label}</Text>
          <Text style={[TYPO.body, styles.descriptionText]}>{config.description}</Text>
        </GlowCard>

        <View style={styles.statusSection}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#00E676' : COLORS.textMuted },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? `@${statusItem?.username ?? 'Connesso'}` : 'Non connesso'}
          </Text>
          {isConnected && statusItem?.connected_at && (
            <Text style={styles.connectedDateText}>
              {'  ·  Connesso il '}
              {new Date(statusItem.connected_at).toLocaleDateString('it-IT')}
            </Text>
          )}
        </View>

        <GlowCard variant="subtle" style={styles.permissionsCard}>
          <Text style={[TYPO.h3, styles.permissionsTitle]}>Permessi richiesti</Text>
          {config.permissions.map((permission, index) => (
            <Text key={index} style={styles.permissionItem}>
              {'• '}{permission}
            </Text>
          ))}
        </GlowCard>

        <View style={styles.actionsSection}>
          {!isConnected ? (
            <Pressable
              style={[styles.actionButton, { borderColor: brandColor + '60' }]}
              onPress={() => connect(platform ?? '')}
              disabled={loading}
            >
              <Text style={[styles.actionButtonText, { color: brandColor }]}>
                Connetti {config.label}
              </Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.refreshButton}
                onPress={() => refresh()}
                disabled={loading}
              >
                <Text style={styles.refreshButtonText}>Aggiorna dati</Text>
              </Pressable>

              <Pressable
                style={[styles.actionButton, { borderColor: '#FF525240' }]}
                onPress={() => disconnect(platform ?? '').then(() => router.back())}
                disabled={loading}
              >
                <Text style={[styles.actionButtonText, { color: '#FF5252' }]}>
                  Disconnetti
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={brandColor} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  backButton: {
    marginBottom: SPACING.lg,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FF525240',
    backgroundColor: COLORS.bgCard,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: '#FF5252',
    flex: 1,
  },
  retryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: '#FF5252',
    marginLeft: SPACING.md,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  platformCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  platformInitial: {
    fontFamily: FONTS.displayExtra,
    fontSize: 32,
  },
  platformLabel: {
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  descriptionText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  connectedDateText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  permissionsCard: {
    paddingVertical: SPACING.md,
  },
  permissionsTitle: {
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  permissionItem: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  actionsSection: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  actionButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  refreshButton: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.bgElevated,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ConnectPlatformScreen;
