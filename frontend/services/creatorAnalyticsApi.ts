import { get, post } from '@/services/apiClient';

export interface MetricWithChange {
  value: number;
  previous_value: number;
  change_percent: number;
}

export interface PlatformOverview {
  views: MetricWithChange;
  subscribers: MetricWithChange;
  revenue: MetricWithChange | null;
  watch_time_hours: MetricWithChange;
}

export interface OverviewResponse {
  period: string;
  platforms: Record<string, PlatformOverview>;
}

export interface DataPoint {
  date: string;
  metrics: Record<string, number>;
}

export interface TimeSeriesResponse {
  period: string;
  granularity: string;
  platforms: Record<string, DataPoint[]>;
}

export interface CalendarPost {
  platform: string;
  video_id: string;
  title: string;
  views: number;
  thumbnail_url: string | null;
}

export interface CalendarDay {
  date: string;
  posts: CalendarPost[];
}

export interface CalendarResponse {
  month: string;
  days: CalendarDay[];
}

export function getOverview(period: string = 'month'): Promise<OverviewResponse> {
  return get<OverviewResponse>(`/creator-analytics/overview?period=${period}`);
}

export function getPerformance(period: string = 'month', granularity: string = 'daily'): Promise<TimeSeriesResponse> {
  return get<TimeSeriesResponse>(`/creator-analytics/performance?period=${period}&granularity=${granularity}`);
}

export function getGrowth(period: string = 'month', granularity: string = 'daily'): Promise<TimeSeriesResponse> {
  return get<TimeSeriesResponse>(`/creator-analytics/growth?period=${period}&granularity=${granularity}`);
}

export function getRevenue(period: string = 'month', granularity: string = 'daily'): Promise<TimeSeriesResponse> {
  return get<TimeSeriesResponse>(`/creator-analytics/revenue?period=${period}&granularity=${granularity}`);
}

export function getCalendar(month: string): Promise<CalendarResponse> {
  return get<CalendarResponse>(`/creator-analytics/calendar?month=${month}`);
}

export function syncMetrics(): Promise<{ job_id: string; status: string }> {
  return post<{ job_id: string; status: string }>('/creator-analytics/sync');
}
