import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONTS, RADIUS } from '@/constants/theme';
import type { Phase } from '@/types';

interface PhaseTabBarProps {
  phases: Phase[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function PhaseTabBar({ phases, activeIndex, onSelect }: PhaseTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      style={styles.scroll}
    >
      {phases.map((phase, i) => {
        const isActive = i === activeIndex;
        const isCompleted = phase.status === 'completed';

        return (
          <Pressable
            key={phase.id}
            onPress={() => onSelect(i)}
            style={({ pressed }) => [
              { opacity: pressed ? 0.8 : 1 },
              Platform.OS === 'web' && { cursor: 'pointer' as any },
            ]}
          >
            {isActive ? (
              <LinearGradient
                colors={[phase.color, phase.color + 'AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.tab}
              >
                <Text style={styles.tabIcon}>{phase.icon}</Text>
                <Text style={[styles.tabName, { color: COLORS.bg }]}>{phase.name}</Text>
              </LinearGradient>
            ) : (
              <View style={[styles.tab, styles.tabInactive, { borderColor: isCompleted ? phase.color + '44' : 'rgba(255,255,255,0.08)' }]}>
                <Text style={[styles.tabIcon, !isCompleted && { opacity: 0.4 }]}>{phase.icon}</Text>
                {isCompleted
                  ? <Text style={[styles.completedCheck]}>✅</Text>
                  : <Text style={[styles.tabName, styles.tabNameInactive]}>{phase.name}</Text>
                }
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  container: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  tabInactive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  tabIcon: { fontSize: 14 },
  tabName: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    color: COLORS.bg,
  },
  tabNameInactive: {
    color: COLORS.textMuted,
  },
  completedCheck: { fontSize: 12 },
});
