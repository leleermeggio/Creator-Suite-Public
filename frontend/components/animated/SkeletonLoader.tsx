import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/constants/theme';

interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}

export function SkeletonLine({ width = '100%', height = 16, style }: SkeletonLineProps) {
  const shimmer = useSharedValue(0);

  React.useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.4,
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          backgroundColor: COLORS.bgElevated,
          borderRadius: RADIUS.sm,
        },
        shimmerStyle,
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  style?: ViewStyle;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  return (
    <View style={[styles.card, style]}>
      <SkeletonLine width="60%" height={18} style={{ marginBottom: 8 }} />
      <SkeletonLine width="90%" height={12} style={{ marginBottom: 6 }} />
      <SkeletonLine width="75%" height={12} />
    </View>
  );
}

export const SkeletonLoader = { Line: SkeletonLine, Card: SkeletonCard };

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
});
