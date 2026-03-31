import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GlowCard } from '@/components/GlowCard';
import { GradientText } from '@/components/GradientText';
import { useProjects } from '@/hooks/useProjects';
import { COLORS, SPACING, TYPO, FONTS, RADIUS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function ProjectsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const { projects, loading, deleteProject, archiveProject, unarchiveProject } =
    useProjects();
  const [showArchived, setShowArchived] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isDesktop = width >= 1024;
  const horizontalPad = isDesktop ? 48 : 20;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const activeProjects = projects.filter((p) => p.status !== 'archived');
  const archivedProjects = projects.filter((p) => p.status === 'archived');

  const handleLongPress = (id: string, name: string) => {
    if (Platform.OS === 'web') {
      // Web doesn't support Alert well, use confirm
      const action = window.prompt(
        `Progetto "${name}"\nScrivi "elimina" per eliminare o "archivia" per archiviare:`,
      );
      if (action?.toLowerCase() === 'elimina') deleteProject(id);
      else if (action?.toLowerCase() === 'archivia') archiveProject(id);
      return;
    }
    Alert.alert(name, 'Cosa vuoi fare?', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Archivia',
        onPress: () => archiveProject(id),
      },
      {
        text: 'Elimina',
        style: 'destructive',
        onPress: () => deleteProject(id),
      },
    ]);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Adesso';
    if (diffMin < 60) return `${diffMin}m fa`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h fa`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}g fa`;
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
  };

  const renderProjectCard = ({
    item,
  }: {
    item: (typeof projects)[0];
  }) => {
    const phaseDots = Array.from({ length: item.phaseCount }, (_, i) => {
      if (i < item.currentPhaseIndex) return COLORS.neonLime;
      if (i === item.currentPhaseIndex) return COLORS.neonCyan;
      return COLORS.textMuted;
    });

    return (
      <GlowCard
        gradient={COLORS.gradCyan}
        glowIntensity={0.15}
        borderWidth={1}
        onPress={() => router.push(`/project/${item.id}`)}
        style={{ marginBottom: SPACING.md }}
      >
        <Pressable
          onLongPress={() => handleLongPress(item.id, item.name)}
          delayLongPress={500}
          style={styles.cardInner}
        >
          {/* Top row: icon + name + time */}
          <View style={styles.cardTopRow}>
            <Text style={styles.templateIcon}>
              {item.templateIcon || '📁'}
            </Text>
            <View style={styles.cardTitleCol}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.projectTime}>
                {formatTime(item.updatedAt)}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === 'completed'
                      ? COLORS.neonLime + '22'
                      : COLORS.neonCyan + '22',
                  borderColor:
                    item.status === 'completed'
                      ? COLORS.neonLime + '44'
                      : COLORS.neonCyan + '44',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === 'completed'
                        ? COLORS.neonLime
                        : COLORS.neonCyan,
                  },
                ]}
              >
                {item.status === 'completed' ? 'Completato' : 'Attivo'}
              </Text>
            </View>
          </View>

          {/* Phase dots */}
          <View style={styles.phaseDots}>
            {phaseDots.map((color, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: color }]}
              />
            ))}
          </View>
        </Pressable>
      </GlowCard>
    );
  };

  const renderEmptyState = () => (
    <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
      <Text style={styles.emptyIcon}>🎬</Text>
      <Text style={styles.emptyTitle}>Crea il tuo primo progetto</Text>
      <Text style={styles.emptySubtitle}>
        Organizza il tuo workflow creativo con fasi, strumenti e file
      </Text>
      <Pressable
        onPress={() => router.push('/new-project')}
        style={({ pressed }) => [
          styles.emptyCta,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <LinearGradient
          colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyCtaGradient}
        >
          <Text style={styles.emptyCtaText}>+ Nuovo Progetto</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
      <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
        I tuoi Progetti
      </GradientText>
      <Text style={styles.subtitle}>
        {activeProjects.length === 0
          ? 'Nessun progetto attivo'
          : `${activeProjects.length} progett${activeProjects.length === 1 ? 'o' : 'i'} attiv${activeProjects.length === 1 ? 'o' : 'i'}`}
      </Text>
    </Animated.View>
  );

  const renderArchivedSection = () => {
    if (archivedProjects.length === 0) return null;
    return (
      <View style={styles.archivedSection}>
        <Pressable
          onPress={() => setShowArchived(!showArchived)}
          style={styles.archivedHeader}
        >
          <Text style={styles.archivedLabel}>
            Archiviati ({archivedProjects.length})
          </Text>
          <Text style={styles.archivedChevron}>
            {showArchived ? '▼' : '▶'}
          </Text>
        </Pressable>
        {showArchived &&
          archivedProjects.map((item) => (
            <GlowCard
              key={item.id}
              gradient={COLORS.gradViolet}
              glowIntensity={0.08}
              borderWidth={1}
              onPress={() => router.push(`/project/${item.id}`)}
              style={{ marginBottom: SPACING.md, opacity: 0.7 }}
            >
              <Pressable
                onLongPress={() => {
                  if (Platform.OS === 'web') {
                    if (window.confirm(`Ripristinare "${item.name}"?`)) {
                      unarchiveProject(item.id);
                    }
                    return;
                  }
                  Alert.alert(item.name, 'Ripristinare il progetto?', [
                    { text: 'Annulla', style: 'cancel' },
                    {
                      text: 'Ripristina',
                      onPress: () => unarchiveProject(item.id),
                    },
                  ]);
                }}
                delayLongPress={500}
                style={styles.cardInner}
              >
                <View style={styles.cardTopRow}>
                  <Text style={styles.templateIcon}>
                    {item.templateIcon || '📁'}
                  </Text>
                  <View style={styles.cardTitleCol}>
                    <Text style={styles.projectName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.projectTime}>
                      {formatTime(item.updatedAt)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </GlowCard>
          ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <CosmicBackground />
      <FlatList
        data={activeProjects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading ? null : renderEmptyState}
        ListFooterComponent={renderArchivedSection}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPad,
            maxWidth: isDesktop ? 700 : undefined,
            alignSelf: isDesktop ? 'center' : undefined,
            width: isDesktop ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB */}
      {activeProjects.length > 0 && (
        <Pressable
          onPress={() => router.push('/new-project')}
          style={({ pressed }) => [
            styles.fab,
            { transform: [{ scale: pressed ? 0.93 : 1 }] },
            Platform.OS === 'web' && {
              cursor: 'pointer' as any,
              transition: 'transform 0.15s ease' as any,
            },
          ]}
        >
          <LinearGradient
            colors={[COLORS.neonCyan, COLORS.neonViolet] as unknown as string[]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fabGradient}
          >
            <Text style={styles.fabText}>+ Nuovo Progetto</Text>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: Platform.select({ web: 40, default: 60 }),
    paddingBottom: 120,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  subtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  cardInner: {
    gap: SPACING.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  templateIcon: {
    fontSize: 28,
  },
  cardTitleCol: {
    flex: 1,
  },
  projectName: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
  },
  projectTime: {
    ...TYPO.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  phaseDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.xs,
    marginLeft: 44,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    ...TYPO.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyCta: {
    marginTop: SPACING.lg,
  },
  emptyCtaGradient: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  emptyCtaText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 16,
    color: COLORS.bg,
    textAlign: 'center',
  },
  // Archived
  archivedSection: {
    marginTop: SPACING.xl,
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  archivedLabel: {
    ...TYPO.label,
    color: COLORS.textMuted,
  },
  archivedChevron: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: Platform.select({ ios: 100, default: 80 }),
    right: 20,
  },
  fabGradient: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    shadowColor: COLORS.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  fabText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
    color: COLORS.bg,
  },
});
