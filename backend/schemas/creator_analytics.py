from __future__ import annotations

from pydantic import BaseModel


class MetricWithChange(BaseModel):
    value: float
    previous_value: float
    change_percent: float


class PlatformOverview(BaseModel):
    views: MetricWithChange
    subscribers: MetricWithChange
    revenue: MetricWithChange | None = None
    watch_time_hours: MetricWithChange


class OverviewResponse(BaseModel):
    period: str
    platforms: dict[str, PlatformOverview]


class DataPoint(BaseModel):
    date: str
    metrics: dict[str, float]


class TimeSeriesResponse(BaseModel):
    period: str
    granularity: str
    platforms: dict[str, list[DataPoint]]


class CalendarPost(BaseModel):
    platform: str
    video_id: str
    title: str
    views: int
    thumbnail_url: str | None = None


class CalendarDay(BaseModel):
    date: str
    posts: list[CalendarPost]


class CalendarResponse(BaseModel):
    month: str
    days: list[CalendarDay]
