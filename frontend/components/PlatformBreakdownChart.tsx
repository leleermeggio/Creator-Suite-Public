import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';

import type { OverviewResponse } from '@/services/creatorAnalyticsApi';
import { COLORS, FONTS, SPACING, RADIUS, BORDERS } from '@/constants/theme';

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  tiktok: '#FFFFFF',
  instagram: '#E1306C',
};
const FALLBACK_COLOR = '#00FFD0';

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export interface PlatformBreakdownChartProps {
  data: OverviewResponse;
  metric: 'views' | 'subscribers' | 'watch_time_hours';
  title: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function PlatformBreakdownChart({
  data,
  metric,
  title,
  height = 180,
  style,
}: PlatformBreakdownChartProps) {
  const platformEntries = useMemo(
    () => Object.entries(data.platforms),
    [data.platforms]
  );

  if (platformEntries.length === 0) {
    return (
      <View style={[styles.container, { height }, style]}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nessun dato disponibile</Text>
        </View>
      </View>
    );
  }

  const chartData = platformEntries.map(([platform, overview]) => ({
    platform,
    value: overview[metric].value,
    color: PLATFORM_COLORS[platform] || FALLBACK_COLOR,
  }));

  const maxValue = Math.max(...chartData.map((d) => d.value));
  const barWidthPercent = chartData.length > 1 ? (100 - (chartData.length - 1) * 8) / chartData.length : 25;

  return (
    <View style={[styles.container, { height }, style]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.chartContainer}>
        {chartData.map(({ platform, value, color }) => {
          const barHeightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
          const chartAreaHeight = height - SPACING.md - 48;

          return (
            <View key={platform} style={[styles.barGroup, { width: `${barWidthPercent}%` }]}>
              <Text style={[styles.valueLabel, { color }]}>{fmt(value)}</Text>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${barHeightPercent}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.platformLabel, { color }]}>{platform}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    padding: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 120,
  },
  emptyText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 'auto',
  },
  barGroup: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  valueLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 12,
    marginBottom: SPACING.xs,
  },
  barTrack: {
    flex: 1,
    width: '60%',
    backgroundColor: COLORS.bgElevated,
    borderRadius: RADIUS.sm,
    justifyContent: 'flex-end',
    minHeight: 80,
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  platformLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    marginTop: SPACING.xs,
    textTransform: 'capitalize' as const,
  },
});
