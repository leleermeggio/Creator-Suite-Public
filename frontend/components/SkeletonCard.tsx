import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';

interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

function SkeletonLine({ width = '100%', height = 14, style }: SkeletonLineProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.85]),
  }));

  return (
    <Animated.View
      style={[
        styles.line,
        { width: width as any, height },
        animStyle,
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  rows?: number;
  showAvatar?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({ rows = 3, showAvatar = false, style }: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      {showAvatar && (
        <View style={styles.row}>
          <View style={styles.avatar} />
          <View style={styles.avatarLines}>
            <SkeletonLine width="60%" height={12} />
            <SkeletonLine width="40%" height={10} style={{ marginTop: 6 }} />
          </View>
        </View>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === rows - 1 ? '65%' : '100%'}
          height={14}
          style={{ marginTop: i === 0 && !showAvatar ? 0 : 10 }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  line: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  avatarLines: {
    flex: 1,
  },
});
