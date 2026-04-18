import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, { useAnimatedStyle, SharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { CosmicBackground } from '@/components/CosmicBackground';
import { GradientText } from '@/components/GradientText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ToolCard } from '@/components/ToolCard';
import { TOOLS } from '@/constants/tools';
import { useEntranceAnimation, useStaggeredEntry } from '@/hooks/useAnimations';
import { COLORS, SPACING, TYPO, BORDERS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

interface ToolGridItemProps {
  tool: (typeof TOOLS)[0];
  index: number;
  cardWidth: number;
  progress: SharedValue<number>;
  getItemStyle: (index: number, total: number) => object;
  onPress: () => void;
}

function ToolGridItem({ tool, index, cardWidth, progress, getItemStyle, onPress }: ToolGridItemProps) {
  const animStyle = useAnimatedStyle(() => getItemStyle(index, TOOLS.length));
  const baseStyle = { width: cardWidth, opacity: tool.available ? 1 : 0.45 };
  if (Platform.OS === 'web') {
    return (
      <View style={baseStyle}>
        <ToolCard tool={tool} index={index} onPress={onPress} />
      </View>
    );
  }
  return (
    <Animated.View style={[baseStyle, animStyle]}>
      <ToolCard tool={tool} index={index} onPress={onPress} />
    </Animated.View>
  );
}

export default function QuickToolsScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768;
  const columns = isDesktop ? 4 : isTablet ? 3 : 2;
  const horizontalPad = isDesktop ? 48 : isTablet ? 32 : SPACING.lg;
  const gap = isDesktop ? SPACING.lg : SPACING.md;
  const cardWidth = (width - horizontalPad * 2 - gap * (columns - 1)) / columns;
  const headerStyle = useEntranceAnimation(0);
  const { progress, getItemStyle } = useStaggeredEntry(TOOLS.length, 50);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <CosmicBackground />
      {isDesktop && (
        <ScreenHeader
          title="Quick Tools"
          subtitle="Strumenti rapidi senza progetto"
          gradient={COLORS.gradMagenta}
        />
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (mobile only) */}
        {!isDesktop && (
          <Animated.View style={[styles.header, headerStyle]}>
            <GradientText gradient={COLORS.gradAurora} style={TYPO.h1}>
              Quick Tools
            </GradientText>
            <Text style={styles.subtitle}>Strumenti rapidi senza progetto</Text>
          </Animated.View>
        )}

        {/* Section divider */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Strumenti</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Tool grid with staggered entry */}
        <View style={[styles.grid, { gap, maxWidth: isDesktop ? 1200 : undefined }]}>
          {TOOLS.map((tool, index) => (
            <ToolGridItem
              key={tool.id}
              tool={tool}
              index={index}
              cardWidth={cardWidth}
              progress={progress}
              getItemStyle={getItemStyle}
              onPress={() => router.push(`/tool/${tool.id}`)}
            />
          ))}
        </View>
      </ScrollView>
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
    backgroundColor: BORDERS.subtle,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'center',
    width: '100%',
  },
});
