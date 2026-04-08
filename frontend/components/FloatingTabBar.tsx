import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SHADOWS, SPACING, FONTS, BORDERS } from '@/constants/theme';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const TAB_CONFIG = [
  { name: 'index',       icon: '📁', label: 'Progetti'  },
  { name: 'agents',      icon: '🤖', label: 'Agenti'    },
  { name: 'quick-tools', icon: '⚡', label: 'Strumenti' },
  { name: 'activity',   icon: '📊', label: 'Attività'  },
  { name: 'analytics',  icon: '📈', label: 'Analisi'   },
];

interface TabItemProps {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}

function TabItem({ icon, label, isActive, onPress, onLongPress }: TabItemProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    if (isActive) {
      glowOpacity.value = withTiming(1, { duration: 250 });
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 200 });
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  }, [isActive]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 12, stiffness: 400 });
  };
  const handlePressOut = () => {
    if (isActive) {
      scale.value = withSpring(1.0, { damping: 12, stiffness: 300 });
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItem}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      {/* Active glow indicator */}
      <Animated.View style={[styles.activeGlow, glowStyle]} />

      {/* Active dot */}
      {isActive && (
        <Animated.View style={[styles.activeDot, glowStyle]} />
      )}

      {/* Icon */}
      <Animated.Text style={[styles.tabIcon, iconStyle]}>
        {icon}
      </Animated.Text>

      {/* Label — only shown on active */}
      {isActive && (
        <Text style={styles.tabLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const visibleTabs = state.routes.filter(
    (route) => (descriptors[route.key]?.options as any)?.href !== null
  );

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={styles.container}>
        {Platform.OS !== 'web' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}

        <View style={[styles.pill, Platform.OS === 'web' && { backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as any]}>
          {visibleTabs.map((route, index) => {
            const routeIndex = state.routes.indexOf(route);
            const isActive = state.index === routeIndex;
            const config = TAB_CONFIG.find((t) => t.name === route.name);
            if (!config) return null;

            return (
              <TabItem
                key={route.key}
                icon={config.icon}
                label={config.label}
                isActive={isActive}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isActive && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const PILL_HEIGHT = 64;
const PILL_RADIUS = 32;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.select({ ios: 28, android: 16, default: 16 }),
    pointerEvents: 'box-none' as any,
  },
  container: {
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    ...SHADOWS.neonGlow(COLORS.neonCyan, 0.3),
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PILL_HEIGHT,
    paddingHorizontal: SPACING.md,
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(8, 8, 20, 0.88)'
        : 'rgba(8, 8, 20, 0.55)',
    gap: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.lg,
    minWidth: 52,
    position: 'relative',
  },
  activeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(0, 255, 208, 0.10)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: 'inset 0 0 12px rgba(0,255,208,0.15)',
        } as any)
      : {}),
  },
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.neonCyan,
    ...SHADOWS.neonGlow(COLORS.neonCyan, 0.8),
  },
  tabIcon: {
    fontSize: 22,
    textAlign: 'center',
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.neonCyan,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.3,
    marginTop: 1,
  },
});
