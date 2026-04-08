import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/constants/theme';

const BAR_COUNT = 40;

interface BarProps {
  index: number;
  barWidth: number;
  maxHeight: number;
  color: string;
  playing: boolean;
  amplitude: number;
}

function WaveBar({ index, barWidth, maxHeight, color, playing, amplitude }: BarProps) {
  const scaleY = useSharedValue(0.2);

  useEffect(() => {
    if (playing) {
      const delay = (index * 40) % 800;
      const duration = 300 + Math.floor(Math.random() * 400);
      scaleY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(amplitude * (0.4 + Math.random() * 0.6), {
              duration,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(amplitude * (0.1 + Math.random() * 0.3), {
              duration,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1,
          false
        )
      );
    } else {
      scaleY.value = withTiming(0.2, { duration: 300 });
    }
  }, [playing, amplitude]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: barWidth,
          height: maxHeight,
          backgroundColor: color,
          borderRadius: barWidth / 2,
        },
        animStyle,
      ]}
    />
  );
}

interface WaveformVisualizerProps {
  playing?: boolean;
  barCount?: number;
  color?: string;
  height?: number;
  style?: ViewStyle;
  amplitudeData?: number[];
}

export function WaveformVisualizer({
  playing = false,
  barCount = BAR_COUNT,
  color = COLORS.neonCyan,
  height = 60,
  style,
  amplitudeData,
}: WaveformVisualizerProps) {
  const amplitudes = useMemo(() => {
    if (amplitudeData && amplitudeData.length === barCount) return amplitudeData;
    return Array.from({ length: barCount }, (_, i) => {
      const x = i / barCount;
      return 0.3 + 0.7 * Math.sin(Math.PI * x) * (0.5 + 0.5 * Math.random());
    });
  }, [barCount, amplitudeData]);

  const barWidth = Math.max(2, Math.floor((100 / barCount) * 0.6));
  const gap = Math.max(1, Math.floor((100 / barCount) * 0.4));

  return (
    <View style={[styles.container, { height }, style]}>
      {amplitudes.map((amp, i) => (
        <WaveBar
          key={i}
          index={i}
          barWidth={barWidth}
          maxHeight={height}
          color={color}
          playing={playing}
          amplitude={amp}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  bar: {
    transformOrigin: 'center',
  } as any,
});
