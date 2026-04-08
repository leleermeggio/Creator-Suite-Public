import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, FONTS, SPACING, RADIUS, BORDERS, SHADOWS, TYPO } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useRouter } from 'expo-router';
import { usePlatforms } from '@/hooks/usePlatforms';
import { useCreatorAnalytics } from '@/hooks/useCreatorAnalytics';
import { GlowCard } from '@/components/GlowCard';
import { MetricsChart } from '@/components/MetricsChart';
import { PlatformBreakdownChart } from '@/components/PlatformBreakdownChart';
import type { MetricWithChange, PlatformOverview } from '@/services/creatorAnalyticsApi';

// ── Types ────────────────────────────────────────────────────────────────────

type Period = 'day' | 'week' | 'month' | 'year';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Giorno' },
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'year', label: 'Anno' },
];

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  tiktok: '#FFFFFF',
  instagram: '#E1306C',
};

const PLATFORM_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function formatCurrency(n: number): string {
  return `€${n.toFixed(2)}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TimeRangePicker({
  selected,
  onSelect,
}: {
  selected: Period;
  onSelect: (p: Period) => void;
}) {
  const { palette } = useTheme();
  return (
    <View style={styles.timeRange}>
      {PERIODS.map((p) => {
        const active = p.key === selected;
        return (
          <Pressable
            key={p.key}
            onPress={() => onSelect(p.key)}
            style={[
              styles.timeRangeBtn,
              {
                backgroundColor: active ? palette.cyan + '18' : 'transparent',
                borderColor: active ? palette.cyan + '40' : 'transparent',
              },
            ]}
          >
            <Text
              style={[
                styles.timeRangeText,
                { color: active ? palette.cyan : palette.textSecondary },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PlatformBadge({
  platform,
  connected,
  username,
  onConnect,
}: {
  platform: string;
  connected: boolean;
  username: string | null;
  onConnect: () => void;
}) {
  const { palette } = useTheme();
  const color = PLATFORM_COLORS[platform] ?? palette.cyan;

  if (connected) {
    return (
      <View style={[styles.platformBadge, { borderColor: color + '40' }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.platformBadgeText, { color: palette.text }]}>
          {PLATFORM_LABELS[platform]}
        </Text>
        <Text style={[styles.platformUsername, { color: palette.textSecondary }]}>
          {username ?? 'Connesso'}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onConnect}
      style={[styles.platformBadge, styles.connectBtn, { borderColor: palette.textMuted + '40' }]}
    >
      <Text style={[styles.platformBadgeText, { color: palette.textMuted }]}>
        + {PLATFORM_LABELS[platform]}
      </Text>
    </Pressable>
  );
}

function ChangeBadge({ change }: { change: number }) {
  const positive = change >= 0;
  const color = positive ? '#00E676' : '#FF5252';
  return (
    <View style={[styles.changeBadge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.changeText, { color }]}>
        {positive ? '+' : ''}{change.toFixed(1)}%
      </Text>
    </View>
  );
}

function KPICard({
  label,
  metric,
  format = 'number',
  delay = 0,
}: {
  label: string;
  metric: MetricWithChange;
  format?: 'number' | 'currency' | 'hours';
  delay?: number;
}) {
  const { palette } = useTheme();
  const formatted =
    format === 'currency'
      ? formatCurrency(metric.value)
      : format === 'hours'
        ? `${formatNumber(metric.value)}h`
        : formatNumber(metric.value);

  return (
    <GlowCard variant="subtle" entranceDelay={delay} style={styles.kpiCard}>
      <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: palette.text }]}>{formatted}</Text>
      <ChangeBadge change={metric.change_percent} />
    </GlowCard>
  );
}

function ExpandableSection({
  title,
  children,
  defaultExpanded = false,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  delay?: number;
}) {
  const { palette } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotation = useSharedValue(defaultExpanded ? 1 : 0);

  const toggleExpanded = () => {
    setExpanded((e) => !e);
    rotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 90}deg` }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)}>
      <Pressable onPress={toggleExpanded} style={styles.sectionHeader}>
        <Text style={[TYPO.h3, { color: palette.text }]}>{title}</Text>
        <Animated.Text style={[styles.chevron, chevronStyle, { color: palette.textSecondary }]}>
          ▶
        </Animated.Text>
      </Pressable>
      {expanded && <View style={styles.sectionContent}>{children}</View>}
    </Animated.View>
  );
}

function PlatformMetricRow({
  label,
  value,
  format = 'number',
}: {
  label: string;
  value: number | null;
  format?: 'number' | 'currency' | 'hours';
}) {
  const { palette } = useTheme();
  const formatted =
    value == null
      ? 'N/D'
      : format === 'currency'
        ? formatCurrency(value)
        : format === 'hours'
          ? `${formatNumber(value)}h`
          : formatNumber(value);

  return (
    <View style={styles.metricRow}>
      <Text style={[styles.metricRowLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.metricRowValue, { color: palette.text }]}>{formatted}</Text>
    </View>
  );
}

function PlatformColumn({
  platform,
  overview,
}: {
  platform: string;
  overview: PlatformOverview;
}) {
  const { palette } = useTheme();
  const color = PLATFORM_COLORS[platform] ?? palette.cyan;

  return (
    <GlowCard variant="subtle" style={styles.platformColumn}>
      <View style={styles.platformColumnHeader}>
        <View style={[styles.platformDot, { backgroundColor: color }]} />
        <Text style={[styles.platformColumnTitle, { color: palette.text }]}>
          {PLATFORM_LABELS[platform]}
        </Text>
      </View>
      <PlatformMetricRow label="Visualizzazioni" value={overview.views.value} />
      <PlatformMetricRow label="Iscritti" value={overview.subscribers.value} />
      <PlatformMetricRow label="Ore guardate" value={overview.watch_time_hours.value} format="hours" />
      {overview.revenue && (
        <PlatformMetricRow label="Entrate" value={overview.revenue.value} format="currency" />
      )}
    </GlowCard>
  );
}

function CalendarHeatmap({
  days,
}: {
  days: { date: string; posts: { platform: string; title: string; views: number }[] }[];
}) {
  const { palette } = useTheme();

  if (!days.length) {
    return (
      <Text style={[styles.emptyText, { color: palette.textMuted }]}>
        Nessun post questo mese
      </Text>
    );
  }

  return (
    <View style={styles.calendarGrid}>
      {days.map((day) => {
        const totalViews = day.posts.reduce((sum, p) => sum + p.views, 0);
        const intensity = Math.min(totalViews / 10000, 1);
        return (
          <View
            key={day.date}
            style={[
              styles.calendarDay,
              {
                backgroundColor: palette.cyan + Math.round(intensity * 40 + 10).toString(16).padStart(2, '0'),
                borderColor: palette.border,
              },
            ]}
          >
            <Text style={[styles.calendarDayNum, { color: palette.text }]}>
              {new Date(day.date).getDate()}
            </Text>
            <Text style={[styles.calendarDayPosts, { color: palette.textSecondary }]}>
              {day.posts.length}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function EmptyOnboarding({ onConnect }: { onConnect: (platform: string) => void }) {
  const { palette } = useTheme();

  return (
    <View style={styles.emptyContainer}>
      <GlowCard variant="subtle" style={styles.emptyCard}>
        <Text style={[TYPO.h2, styles.emptyTitle, { color: palette.text }]}>
          Connetti le tue piattaforme
        </Text>
        <Text style={[TYPO.body, styles.emptySubtitle, { color: palette.textSecondary }]}>
          Collega YouTube, TikTok e Instagram per visualizzare le tue analisi creatore in un unico posto.
        </Text>
        <View style={styles.emptyButtons}>
          {(['youtube', 'tiktok', 'instagram'] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => onConnect(p)}
              style={[
                styles.emptyConnectBtn,
                { borderColor: (PLATFORM_COLORS[p] ?? palette.cyan) + '40' },
              ]}
            >
              <Text style={[styles.emptyConnectText, { color: PLATFORM_COLORS[p] ?? palette.cyan }]}>
                Connetti {PLATFORM_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlowCard>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { width } = useWindowDimensions();
  const { palette } = useTheme();
  const [period, setPeriod] = useState<Period>('month');

  const { platforms, loading: platLoading } = usePlatforms();
  
  const router = useRouter();
  const handleConnectPress = (platform: string) => {
    router.push({ pathname: '/connect/[platform]' as never, params: { platform } });
  };
  const { overview, performance, growth, revenue, calendar, loading, error, refresh } =
    useCreatorAnalytics(period);

  const isDesktop = Platform.OS === 'web' && width >= 1024;
  const isTablet = width >= 768;
  const connectedPlatforms = platforms.filter((p) => p.connected);
  const hasConnections = connectedPlatforms.length > 0;

  // Responsive KPI grid columns
  const kpiColumns = isDesktop ? 3 : isTablet ? 3 : 1;
  const platformColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  if (platLoading && !platforms.length) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.cyan} />
      </View>
    );
  }

  if (!hasConnections && !platLoading) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: palette.bg }]}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Text style={[TYPO.h1, styles.screenTitle, { color: palette.text }]}>
            Analisi Creatore
          </Text>
        </Animated.View>
        <EmptyOnboarding onConnect={handleConnectPress} />
      </ScrollView>
    );
  }

  // Aggregate KPI totals across all platforms
  const totalViews: MetricWithChange = overview
    ? Object.values(overview.platforms).reduce(
        (acc, p) => ({
          value: acc.value + p.views.value,
          previous_value: acc.previous_value + p.views.previous_value,
          change_percent: 0,
        }),
        { value: 0, previous_value: 0, change_percent: 0 },
      )
    : { value: 0, previous_value: 0, change_percent: 0 };
  if (totalViews.previous_value > 0) {
    totalViews.change_percent =
      Math.round(((totalViews.value - totalViews.previous_value) / totalViews.previous_value) * 1000) / 10;
  }

  const totalSubs: MetricWithChange = overview
    ? Object.values(overview.platforms).reduce(
        (acc, p) => ({
          value: acc.value + p.subscribers.value,
          previous_value: acc.previous_value + p.subscribers.previous_value,
          change_percent: 0,
        }),
        { value: 0, previous_value: 0, change_percent: 0 },
      )
    : { value: 0, previous_value: 0, change_percent: 0 };
  if (totalSubs.previous_value > 0) {
    totalSubs.change_percent =
      Math.round(((totalSubs.value - totalSubs.previous_value) / totalSubs.previous_value) * 1000) / 10;
  }

  const totalRevenue: MetricWithChange | null = overview
    ? (() => {
        const revPlatforms = Object.values(overview.platforms).filter((p) => p.revenue);
        if (!revPlatforms.length) return null;
        const agg = revPlatforms.reduce(
          (acc, p) => ({
            value: acc.value + (p.revenue?.value ?? 0),
            previous_value: acc.previous_value + (p.revenue?.previous_value ?? 0),
            change_percent: 0,
          }),
          { value: 0, previous_value: 0, change_percent: 0 },
        );
        if (agg.previous_value > 0) {
          agg.change_percent =
            Math.round(((agg.value - agg.previous_value) / agg.previous_value) * 1000) / 10;
        }
        return agg;
      })()
    : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <Text style={[TYPO.h1, { color: palette.text }]}>Analisi Creatore</Text>
        <TimeRangePicker selected={period} onSelect={setPeriod} />
      </Animated.View>

      {/* Platform Bar */}
      <Animated.View entering={FadeInDown.delay(100).duration(350)} style={styles.platformBar}>
        {platforms.map((p) => (
          <PlatformBadge
            key={p.platform}
            platform={p.platform}
            connected={p.connected}
            username={p.username}
            onConnect={() => handleConnectPress(p.platform)}
          />
        ))}
        {loading && (
          <View style={styles.syncBadge}>
            <ActivityIndicator size="small" color={palette.cyan} />
            <Text style={[styles.syncText, { color: palette.textSecondary }]}>
              Aggiornamento...
            </Text>
          </View>
        )}
      </Animated.View>

      {/* Error */}
      {error && (
        <View style={[styles.errorBanner, { borderColor: '#FF5252' + '40' }]}>
          <Text style={[styles.errorText, { color: '#FF5252' }]}>{error}</Text>
          <Pressable onPress={refresh}>
            <Text style={[styles.retryText, { color: palette.cyan }]}>Riprova</Text>
          </Pressable>
        </View>
      )}

      {/* KPI Hero Grid */}
      {overview && (
        <View style={[styles.kpiGrid, { flexDirection: kpiColumns > 1 ? 'row' : 'column' }]}>
          <View style={kpiColumns > 1 ? { flex: 1 } : undefined}>
            <KPICard label="VISUALIZZAZIONI TOTALI" metric={totalViews} delay={150} />
          </View>
          <View style={kpiColumns > 1 ? { flex: 1 } : undefined}>
            <KPICard label="ISCRITTI TOTALI" metric={totalSubs} delay={200} />
          </View>
          <View style={kpiColumns > 1 ? { flex: 1 } : undefined}>
            {totalRevenue ? (
              <KPICard label="ENTRATE TOTALI" metric={totalRevenue} format="currency" delay={250} />
            ) : (
              <GlowCard variant="subtle" entranceDelay={250} style={styles.kpiCard}>
                <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>ENTRATE</Text>
                <Text style={[styles.kpiValue, { color: palette.textMuted }]}>N/D</Text>
                <Text style={[styles.kpiSubtext, { color: palette.textMuted }]}>
                  Solo YouTube (YPP)
                </Text>
              </GlowCard>
            )}
          </View>
        </View>
      )}

      {/* Performance Section */}
      {overview && performance && (
        <ExpandableSection title="Performance per Piattaforma" defaultExpanded={isDesktop} delay={300}>
          <MetricsChart
            data={performance}
            metric="views"
            title="Visualizzazioni nel tempo"
            height={200}
            style={{ marginBottom: SPACING.md }}
            loading={loading}
          />
          <PlatformBreakdownChart
            data={overview}
            metric="views"
            title="Visualizzazioni per piattaforma"
            style={{ marginBottom: SPACING.md }}
          />
          <View
            style={[
              styles.platformGrid,
              {
                flexDirection: platformColumns > 1 ? 'row' : 'column',
                flexWrap: platformColumns > 1 ? 'wrap' : 'nowrap',
              },
            ]}
          >
            {Object.entries(overview.platforms).map(([platform, data]) => (
              <View
                key={platform}
                style={platformColumns > 1 ? { width: `${100 / platformColumns}%` as any, padding: SPACING.xs } : { marginBottom: SPACING.sm }}
              >
                <PlatformColumn platform={platform} overview={data} />
              </View>
            ))}
          </View>
        </ExpandableSection>
      )}

      {/* Growth Section */}
      {overview && (
        <ExpandableSection title="Crescita" delay={400}>
          <View
            style={[
              styles.platformGrid,
              {
                flexDirection: platformColumns > 1 ? 'row' : 'column',
                flexWrap: platformColumns > 1 ? 'wrap' : 'nowrap',
              },
            ]}
          >
            {Object.entries(overview.platforms).map(([platform, data]) => (
              <View
                key={platform}
                style={platformColumns > 1 ? { width: `${100 / platformColumns}%` as any, padding: SPACING.xs } : { marginBottom: SPACING.sm }}
              >
                <GlowCard variant="subtle" style={styles.platformColumn}>
                  <View style={styles.platformColumnHeader}>
                    <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[platform] ?? palette.cyan }]} />
                    <Text style={[styles.platformColumnTitle, { color: palette.text }]}>
                      {PLATFORM_LABELS[platform]}
                    </Text>
                  </View>
                  <PlatformMetricRow label="Iscritti" value={data.subscribers.value} />
                  <ChangeBadge change={data.subscribers.change_percent} />
                </GlowCard>
              </View>
            ))}
          </View>
        </ExpandableSection>
      )}

      {/* Revenue Section */}
      {overview && (
        <ExpandableSection title="Entrate" delay={500}>
          <View
            style={[
              styles.platformGrid,
              {
                flexDirection: platformColumns > 1 ? 'row' : 'column',
                flexWrap: platformColumns > 1 ? 'wrap' : 'nowrap',
              },
            ]}
          >
            {Object.entries(overview.platforms).map(([platform, data]) => (
              <View
                key={platform}
                style={platformColumns > 1 ? { width: `${100 / platformColumns}%` as any, padding: SPACING.xs } : { marginBottom: SPACING.sm }}
              >
                <GlowCard variant="subtle" style={styles.platformColumn}>
                  <View style={styles.platformColumnHeader}>
                    <View style={[styles.platformDot, { backgroundColor: PLATFORM_COLORS[platform] ?? palette.cyan }]} />
                    <Text style={[styles.platformColumnTitle, { color: palette.text }]}>
                      {PLATFORM_LABELS[platform]}
                    </Text>
                  </View>
                  {data.revenue ? (
                    <>
                      <PlatformMetricRow label="Entrate" value={data.revenue.value} format="currency" />
                      <ChangeBadge change={data.revenue.change_percent} />
                    </>
                  ) : (
                    <Text style={[styles.emptyText, { color: palette.textMuted }]}>
                      Non disponibile
                    </Text>
                  )}
                </GlowCard>
              </View>
            ))}
          </View>
        </ExpandableSection>
      )}

      {/* Calendar Section */}
      {calendar && (
        <ExpandableSection title="Calendario Contenuti" delay={600}>
          <CalendarHeatmap days={calendar.days} />
        </ExpandableSection>
      )}

      {/* Bottom spacer */}
      <View style={{ height: SPACING.xxl }} />
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
    gap: SPACING.md,
  },

  // Time Range
  timeRange: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  timeRangeBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  timeRangeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 13,
  },

  // Platform Bar
  platformBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
    alignItems: 'center',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  connectBtn: {
    borderStyle: 'dashed' as any,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  platformBadgeText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },
  platformUsername: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  syncText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    flex: 1,
  },
  retryText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    marginLeft: SPACING.md,
  },

  // KPI Grid
  kpiGrid: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  kpiCard: {
    minHeight: 110,
    justifyContent: 'center',
  },
  kpiLabel: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  kpiValue: {
    fontFamily: FONTS.displayExtra,
    fontSize: 32,
    letterSpacing: -1,
    marginBottom: SPACING.sm,
  },
  kpiSubtext: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 12,
  },

  // Change Badge
  changeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  changeText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },
  chevron: {
    fontSize: 12,
  },
  sectionContent: {
    marginBottom: SPACING.lg,
  },

  // Platform Grid
  platformGrid: {
    gap: SPACING.sm,
  },
  platformColumn: {
    minHeight: 120,
  },
  platformColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  platformDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  platformColumnTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  metricRowLabel: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
  },
  metricRowValue: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
  },

  // Calendar
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  calendarDay: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDayNum: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 12,
  },
  calendarDayPosts: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 9,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl3,
  },
  emptyCard: {
    maxWidth: 480,
    width: '100%',
    alignItems: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emptyButtons: {
    gap: SPACING.md,
    width: '100%',
  },
  emptyConnectBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  emptyConnectText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 15,
  },
  emptyText: {
    fontFamily: FONTS.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
});
