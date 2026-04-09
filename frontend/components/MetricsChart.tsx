import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

// victory-native uses Skia APIs (XYWHRect) not available on web
const CartesianChart = Platform.OS !== 'web'
  ? require('victory-native').CartesianChart
  : null;
const Line = Platform.OS !== 'web'
  ? require('victory-native').Line
  : null;

import type { TimeSeriesResponse } from '@/services/creatorAnalyticsApi';
import { FONTS, SPACING, RADIUS, BORDERS } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  tiktok: '#FFFFFF',
  instagram: '#E1306C',
};

const FALLBACK_COLORS = ['#00FFD0', '#FF00AA', '#9944FF', '#FFE633'];

interface MetricsChartProps {
  data: TimeSeriesResponse;
  metric: 'views' | 'subscribers' | 'watch_time_hours';
  title: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
}

type ChartRow = { x: number } & Record<string, number>;

function getPlatformKey(platformName: string): string {
  const n = platformName.toLowerCase();
  if (n.startsWith('you')) return 'yt';
  if (n.startsWith('tik')) return 'tk';
  if (n.startsWith('ins') || n === 'ig') return 'ig';
  return n.slice(0, 2);
}

function getPlatformColor(platformName: string, index: number): string {
  return PLATFORM_COLORS[platformName.toLowerCase()] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function MetricsChart({
  data,
  metric,
  title,
  height = 200,
  style,
  loading,
}: MetricsChartProps) {
  const { palette } = useTheme();

  const containerStyle = [
    styles.container,
    { backgroundColor: palette.card },
    style,
  ];

  const titleEl = (
    <Text style={[styles.title, { color: palette.textSecondary }]}>
      {title.toUpperCase()}
    </Text>
  );

  if (loading) {
    return (
      <View style={containerStyle}>
        {titleEl}
        <View style={[styles.centeredBox, { height }]}>
          <ActivityIndicator color={palette.cyan} />
        </View>
      </View>
    );
  }

  // platforms is Record<string, DataPoint[]>
  const platformEntries = Object.entries(data.platforms);

  if (platformEntries.length === 0) {
    return (
      <View style={containerStyle}>
        {titleEl}
        <View style={[styles.centeredBox, { height }]}>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>
            Nessun dato disponibile
          </Text>
        </View>
      </View>
    );
  }

  // Collect all unique dates across all platforms
  const allDates = new Set<string>();
  for (const [, points] of platformEntries) {
    for (const pt of points) {
      allDates.add(pt.date);
    }
  }

  const sortedDates = Array.from(allDates).sort();

  if (sortedDates.length === 0) {
    return (
      <View style={containerStyle}>
        {titleEl}
        <View style={[styles.centeredBox, { height }]}>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>
            Nessun dato disponibile
          </Text>
        </View>
      </View>
    );
  }

  // Build chart data: one row per date, one numeric key per platform
  const platformKeys = platformEntries.map(([name]) => getPlatformKey(name));
  const lineColors = platformEntries.map(([name], i) => getPlatformColor(name, i));

  const chartData: ChartRow[] = sortedDates.map((date, index) => {
    const row: ChartRow = { x: index };
    for (const [name, points] of platformEntries) {
      const key = getPlatformKey(name);
      const pt = points.find((p) => p.date === date);
      row[key] = typeof pt?.metrics[metric] === 'number' ? pt.metrics[metric] : 0;
    }
    return row;
  });

  // Web fallback: render a simple bar-style text chart
  const renderChart = () => {
    if (Platform.OS === 'web' || !CartesianChart || !Line) {
      const maxVal = Math.max(
        1,
        ...chartData.flatMap(row => platformKeys.map(k => (row[k] as number) ?? 0))
      );
      return (
        <View style={{ height, justifyContent: 'flex-end', gap: 4, paddingTop: 8 }}>
          {chartData.slice(-8).map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {platformKeys.map((key, pi) => {
                const val = (row[key] as number) ?? 0;
                const pct = Math.max(4, (val / maxVal) * 100);
                return (
                  <View
                    key={key}
                    style={{
                      height: 8,
                      width: `${pct}%` as any,
                      backgroundColor: lineColors[pi],
                      borderRadius: 4,
                      opacity: 0.85,
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      );
    }
    return (
      <CartesianChart
        data={chartData}
        xKey="x"
        yKeys={platformKeys}
        domainPadding={{ top: 20, bottom: 0 }}
      >
        {({ points }: any) =>
          platformKeys.map((key, i) => (
            <Line
              key={key}
              points={points[key]}
              color={lineColors[i]}
              strokeWidth={2}
              animate={{ type: 'timing', duration: 300 }}
            />
          ))
        }
      </CartesianChart>
    );
  };

  return (
    <View style={containerStyle}>
      {titleEl}
      <View style={{ height }}>
        {renderChart()}
      </View>
      <View style={styles.legend}>
        {platformEntries.map(([name], i) => (
          <View key={name} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: lineColors[i] }]} />
            <Text style={[styles.legendText, { color: palette.textSecondary }]}>{name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BORDERS.subtle,
    padding: SPACING.md,
  },
  title: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  centeredBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
});
