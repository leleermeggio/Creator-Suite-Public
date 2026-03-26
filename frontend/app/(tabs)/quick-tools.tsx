import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { ToolCard } from '@/components/ToolCard';
import { TOOLS } from '@/constants/tools';
import { COLORS, SPACING, TYPO } from '@/constants/theme';

export default function QuickToolsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const columns = isDesktop ? 4 : isTablet ? 3 : 2;
  const horizontalPad = isDesktop ? 48 : isTablet ? 32 : 20;
  const gap = isDesktop ? 20 : 14;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const cardWidth =
    (width - horizontalPad * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={styles.container}>
      <CosmicBackground />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
            Quick Tools
          </GradientText>
          <Text style={styles.subtitle}>
            Strumenti rapidi senza progetto
          </Text>
        </Animated.View>

        {/* Section divider */}
        <Animated.View
          style={[
            styles.sectionHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Strumenti</Text>
          <View style={styles.sectionLine} />
        </Animated.View>

        {/* Tool grid */}
        <View
          style={[
            styles.grid,
            { gap, maxWidth: isDesktop ? 1200 : undefined },
          ]}
        >
          {TOOLS.map((tool, index) => (
            <View key={tool.id} style={{ width: cardWidth }}>
              <ToolCard
                tool={tool}
                index={index}
                onPress={() => router.push(`/tool/${tool.id}`)}
              />
            </View>
          ))}
        </View>
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
  header: {
    marginBottom: SPACING.xl,
  },
  subtitle: {
    ...TYPO.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPO.label,
    color: COLORS.textMuted,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    width: '100%',
  },
});
