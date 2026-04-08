import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: 'folder', inactive: 'folder-outline' },
  agents: { active: 'hardware-chip', inactive: 'hardware-chip-outline' },
  'quick-tools': { active: 'flash', inactive: 'flash-outline' },
  activity: { active: 'bar-chart', inactive: 'bar-chart-outline' },
};

const TAB_LABELS: Record<string, string> = {
  index: 'Progetti',
  agents: 'Agenti',
  'quick-tools': 'Strumenti',
  activity: 'Attività',
};

function TabItem({
  route,
  isFocused,
  onPress,
}: {
  route: string;
  isFocused: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(isFocused ? 1.15 : 1);
  const opacity = useSharedValue(isFocused ? 1 : 0.5);

  React.useEffect(() => {
    scale.value = withSpring(isFocused ? 1.15 : 1, { damping: 15, stiffness: 200 });
    opacity.value = withTiming(isFocused ? 1 : 0.5, { duration: 200 });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Animated.View style={animatedStyle}>
        <Ionicons
          name={(isFocused ? TAB_ICONS[route]?.active : TAB_ICONS[route]?.inactive) ?? 'ellipse-outline'}
          size={22}
          color={isFocused ? COLORS.neonCyan : COLORS.textMuted}
        />
      </Animated.View>
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused ? COLORS.neonCyan : COLORS.textMuted },
        ]}
      >
        {TAB_LABELS[route] ?? route}
      </Text>
    </Pressable>
  );
}

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const visibleRoutes = state.routes.filter((r) => TAB_ICONS[r.name]);
  const tabCount = visibleRoutes.length;
  const tabWidth = width / tabCount;

  // Compute visible index to avoid miscalculation when state.routes contains hidden routes
  const visibleIndex = visibleRoutes.findIndex((r) => r.key === state.routes[state.index]?.key);
  const safeIndex = visibleIndex >= 0 ? visibleIndex : 0;

  const indicatorX = useSharedValue(safeIndex * tabWidth);

  React.useEffect(() => {
    const vi = visibleRoutes.findIndex((r) => r.key === state.routes[state.index]?.key);
    const si = vi >= 0 ? vi : 0;
    indicatorX.value = withSpring(si * tabWidth, {
      damping: 20,
      stiffness: 200,
    });
  }, [state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.bgSidebar,
          borderTopColor: palette.border,
          paddingBottom: insets.bottom || 8,
        },
        Platform.OS === 'web' && ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        } as any), // web-only CSS props, not in RN types
      ]}
    >
      {/* Sliding neon indicator */}
      <Animated.View style={[styles.indicator, { width: tabWidth }, indicatorStyle]} />

      {visibleRoutes.map((route, index) => (
        <TabItem
          key={route.key}
          route={route.name}
          isFocused={state.index === state.routes.indexOf(route)}
          onPress={() => navigation.navigate(route.name)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    height: Platform.select({ ios: 88, default: 64 }),
    paddingTop: 8,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 2,
    backgroundColor: COLORS.neonCyan,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIcon: {
    fontSize: 20,
  }, // kept for fallback
  tabLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
