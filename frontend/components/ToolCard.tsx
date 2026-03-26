import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlowCard } from './GlowCard';
import { COLORS, SPACING, RADIUS, TYPO, FONTS } from '@/constants/theme';
import type { Tool } from '@/constants/tools';

interface ToolCardProps {
  tool: Tool;
  onPress: () => void;
  index: number;
}

export function ToolCard({ tool, onPress, index }: ToolCardProps) {
  return (
    <GlowCard
      gradient={tool.gradient}
      onPress={onPress}
      glowIntensity={0.35}
      style={{
        ...(Platform.OS === 'web'
          ? {
              // @ts-ignore
              animationName: 'cardAppear',
              animationDuration: '0.6s',
              animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              animationFillMode: 'both',
              animationDelay: `${index * 0.08}s`,
            }
          : {}),
      }}
    >
      {/* Icon circle with gradient bg */}
      <View style={styles.iconRow}>
        <LinearGradient
          colors={tool.gradient as unknown as string[]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconCircle}
        >
          <Text style={styles.icon}>{tool.icon}</Text>
        </LinearGradient>
      </View>

      <Text style={styles.name}>{tool.name}</Text>
      <Text style={styles.description} numberOfLines={2}>
        {tool.description}
      </Text>

      {/* Bottom accent line */}
      <LinearGradient
        colors={tool.gradient as unknown as string[]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.accentLine}
      />
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  iconRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  name: {
    ...TYPO.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  description: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  accentLine: {
    height: 2,
    borderRadius: 1,
    opacity: 0.4,
  },
});
