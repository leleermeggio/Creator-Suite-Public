import { useState, useEffect, useCallback } from 'react';
import {
  getOverview,
  getPerformance,
  getGrowth,
  getRevenue,
  getCalendar,
  OverviewResponse,
  TimeSeriesResponse,
  CalendarResponse,
} from '@/services/creatorAnalyticsApi';

type Period = 'day' | 'week' | 'month' | 'year';

export function useCreatorAnalytics(period: Period = 'month') {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [performance, setPerformance] = useState<TimeSeriesResponse | null>(null);
  const [growth, setGrowth] = useState<TimeSeriesResponse | null>(null);
  const [revenueData, setRevenueData] = useState<TimeSeriesResponse | null>(null);
  const [calendarData, setCalendarData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const [ov, perf, gr, rev, cal] = await Promise.all([
        getOverview(period),
        getPerformance(period),
        getGrowth(period),
        getRevenue(period),
        getCalendar(month),
      ]);

      setOverview(ov);
      setPerformance(perf);
      setGrowth(gr);
      setRevenueData(rev);
      setCalendarData(cal);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore caricamento analisi';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    overview,
    performance,
    growth,
    revenue: revenueData,
    calendar: calendarData,
    loading,
    error,
    refresh: fetchAll,
  };
}
