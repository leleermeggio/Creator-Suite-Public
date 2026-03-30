import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { FONTS, SPACING } from '@/constants/theme';

export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';

export interface TimelineStep {
  label: string;
  status: StepStatus;
}

interface StepTimelineProps {
  steps: TimelineStep[];
  currentIndex: number;
  compact?: boolean;
}

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  return (
    <View style={styles.pulseContainer}>
      <Animated.View
        style={[
          styles.pulseRing,
          { borderColor: color, transform: [{ scale }], opacity },
        ]}
      />
      <View style={[styles.dot, styles.dotActive, { backgroundColor: color }]} />
    </View>
  );
}

function getDotColor(status: StepStatus, palette: any): string {
  switch (status) {
    case 'COMPLETED': return palette.cyan;
    case 'RUNNING': return palette.cyan;
    case 'FAILED': return palette.magenta;
    case 'SKIPPED': return palette.textMuted;
    default: return palette.border;
  }
}

export function StepTimeline({ steps, currentIndex, compact = false }: StepTimelineProps) {
  const { palette } = useTheme();

  if (steps.length === 0) return null;

  return (
    <View style={styles.container}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dotColor = getDotColor(step.status, palette);
        const isCurrent = i === currentIndex && step.status === 'RUNNING';

        return (
          <View key={i} style={styles.stepRow}>
            {/* Dot */}
            <View style={styles.dotCol}>
              {isCurrent ? (
                <PulseDot color={palette.cyan} />
              ) : (
                <View
                  style={[
                    styles.dot,
                    compact ? styles.dotCompact : undefined,
                    step.status === 'COMPLETED' && styles.dotCompleted,
                    { backgroundColor: step.status === 'PENDING' ? 'transparent' : dotColor,
                      borderColor: dotColor },
                  ]}
                >
                  {step.status === 'COMPLETED' && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                  {step.status === 'FAILED' && (
                    <Text style={styles.checkmark}>✕</Text>
                  )}
                </View>
              )}
              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    compact && styles.connectorCompact,
                    { backgroundColor: step.status === 'COMPLETED' ? palette.cyan : palette.border },
                  ]}
                />
              )}
            </View>

            {/* Label */}
            {!compact && (
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color:
                      step.status === 'COMPLETED'
                        ? palette.text
                        : step.status === 'RUNNING'
                        ? palette.cyan
                        : step.status === 'FAILED'
                        ? palette.magenta
                        : palette.textMuted,
                  },
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 2,
  },
  stepRow: {
    alignItems: 'center',
    flex: 1,
    maxWidth: 80,
  },
  dotCol: {
    alignItems: 'center',
  },
  pulseContainer: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCompleted: {
    borderWidth: 0,
  },
  dotCompact: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  checkmark: {
    fontSize: 7,
    color: '#04040A',
    fontFamily: FONTS.bodyBold,
    lineHeight: 10,
  },
  connector: {
    width: 1.5,
    height: SPACING.sm,
    marginTop: 2,
  },
  connectorCompact: {
    height: 4,
  },
  stepLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
