"""
Seed mock analytics data (YouTube + TikTok + Instagram) for the dev user.
Run:  python -m backend.scripts.seed_mock_analytics
"""

from __future__ import annotations

import asyncio
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from backend.config import get_settings
from backend.database import create_engine, create_session_factory
from backend.models.creator_metric import CreatorMetric
from backend.models.creator_video import CreatorVideo
from backend.models.platform_connection import PlatformConnection
from backend.models.user import User

DEV_EMAIL = "dev@creatorzone.dev"

# ─── Mock video catalogues ───────────────────────────────────────────────────

YT_VIDEOS = [
    {
        "title": "Come Guadagnare con YouTube nel 2026",
        "views": 45200,
        "likes": 3100,
        "comments": 412,
        "duration": 924,
    },
    {
        "title": "5 Tool AI che Uso Ogni Giorno",
        "views": 38700,
        "likes": 2800,
        "comments": 305,
        "duration": 612,
    },
    {
        "title": "Tutorial Premiere Pro - Montaggio Veloce",
        "views": 29400,
        "likes": 2100,
        "comments": 198,
        "duration": 1080,
    },
    {
        "title": "Il Mio Setup da Creator 2026",
        "views": 67500,
        "likes": 5400,
        "comments": 620,
        "duration": 780,
    },
    {
        "title": "Reagisco ai Vostri Canali #3",
        "views": 52100,
        "likes": 4200,
        "comments": 890,
        "duration": 1440,
    },
    {
        "title": "Come Crescere da 0 a 10K Iscritti",
        "views": 81300,
        "likes": 6100,
        "comments": 730,
        "duration": 840,
    },
    {
        "title": "Vlog: Una Giornata da Content Creator",
        "views": 23800,
        "likes": 1900,
        "comments": 215,
        "duration": 660,
    },
    {
        "title": "Confronto Microfoni: Quale Scegliere?",
        "views": 31200,
        "likes": 2400,
        "comments": 187,
        "duration": 720,
    },
    {
        "title": "Le Migliori Thumbnail - Analisi Completa",
        "views": 41600,
        "likes": 3300,
        "comments": 290,
        "duration": 540,
    },
    {
        "title": "Q&A: Risposte alle Vostre Domande",
        "views": 18900,
        "likes": 1500,
        "comments": 430,
        "duration": 1200,
    },
]

TIKTOK_VIDEOS = [
    {
        "title": "POV: sei un content creator alle 3 di notte",
        "views": 312000,
        "likes": 28400,
        "comments": 1820,
        "duration": 45,
    },
    {
        "title": "5 hack per Premiere che non sapevi",
        "views": 189000,
        "likes": 15300,
        "comments": 940,
        "duration": 60,
    },
    {
        "title": "Il mio setup MINI per girare ovunque",
        "views": 254000,
        "likes": 21700,
        "comments": 1350,
        "duration": 38,
    },
    {
        "title": "Rispondo ai commenti piu assurdi",
        "views": 421000,
        "likes": 39200,
        "comments": 4100,
        "duration": 55,
    },
    {
        "title": "Come ho fatto esplodere il canale in 30 giorni",
        "views": 698000,
        "likes": 61000,
        "comments": 5200,
        "duration": 60,
    },
    {
        "title": "Transizione tutorial: effetto specchio",
        "views": 145000,
        "likes": 19800,
        "comments": 620,
        "duration": 28,
    },
    {
        "title": "Reaction: la thumbnail peggiore di sempre",
        "views": 278000,
        "likes": 24500,
        "comments": 2800,
        "duration": 52,
    },
    {
        "title": "Vlog rapido dal backstage",
        "views": 93000,
        "likes": 8700,
        "comments": 430,
        "duration": 35,
    },
]

IG_VIDEOS = [
    {
        "title": "Reel: Come creare hook efficaci",
        "views": 87400,
        "likes": 6200,
        "comments": 310,
        "duration": 30,
    },
    {
        "title": "Reel: Montaggio veloce in 3 step",
        "views": 54200,
        "likes": 4100,
        "comments": 195,
        "duration": 25,
    },
    {
        "title": "Reel: Il segreto della luce naturale",
        "views": 112000,
        "likes": 9800,
        "comments": 470,
        "duration": 22,
    },
    {
        "title": "Reel: Setup tour completo",
        "views": 143000,
        "likes": 12400,
        "comments": 680,
        "duration": 30,
    },
    {
        "title": "Reel: Preset Lightroom gratuiti",
        "views": 201000,
        "likes": 17600,
        "comments": 1120,
        "duration": 28,
    },
    {
        "title": "Reel: 3 errori da evitare su Instagram",
        "views": 76300,
        "likes": 5900,
        "comments": 245,
        "duration": 20,
    },
]

# ─── Platform seed config ─────────────────────────────────────────────────────

PLATFORM_CONFIGS = {
    "youtube": {
        "platform_user_id": "UC_MockCreator123",
        "platform_username": "@creatorzone_dev",
        "base_views": 1800,
        "base_subs": 22,
        "base_watch_time": 1100,  # minutes/day
        "base_revenue": 5.2,
        "metrics": [
            "views",
            "subscribers",
            "watch_time",
            "revenue",
            "ctr",
            "avg_duration",
            "cpm",
            "rpm",
        ],
    },
    "tiktok": {
        "platform_user_id": "tt_mock_7812345",
        "platform_username": "@creatorzone.dev",
        "base_views": 9500,
        "base_subs": 85,
        "base_watch_time": 3200,  # minutes/day (short-form = high volume)
        "base_revenue": 0.0,  # TikTok creator fund ~$0.02-0.04/1k views
        "metrics": ["views", "subscribers", "watch_time", "ctr", "avg_duration"],
    },
    "instagram": {
        "platform_user_id": "ig_mock_982341",
        "platform_username": "@creatorzone.dev",
        "base_views": 4200,
        "base_subs": 38,
        "base_watch_time": 1400,
        "base_revenue": 0.0,
        "metrics": ["views", "subscribers", "watch_time", "ctr", "avg_duration"],
    },
}

PLATFORM_VIDEOS = {
    "youtube": YT_VIDEOS,
    "tiktok": TIKTOK_VIDEOS,
    "instagram": IG_VIDEOS,
}


def _gen_metrics(user_id: str, platform: str, cfg: dict) -> list[CreatorMetric]:
    today = date.today()
    rows: list[CreatorMetric] = []

    for day_offset in range(60, -1, -1):
        d = today - timedelta(days=day_offset)
        trend = 1.0 + (60 - day_offset) * 0.009
        noise = random.uniform(0.65, 1.45)
        weekend = 1.3 if d.weekday() >= 5 else 1.0

        vals: dict[str, float] = {}

        if "views" in cfg["metrics"]:
            vals["views"] = int(cfg["base_views"] * trend * noise * weekend)
        if "subscribers" in cfg["metrics"]:
            vals["subscribers"] = int(
                cfg["base_subs"] * trend * random.uniform(0.4, 2.2)
            )
        if "watch_time" in cfg["metrics"]:
            vals["watch_time"] = round(
                cfg["base_watch_time"] * trend * noise * weekend, 1
            )
        if "revenue" in cfg["metrics"] and cfg["base_revenue"] > 0:
            vals["revenue"] = round(cfg["base_revenue"] * trend * noise * weekend, 2)
        if "ctr" in cfg["metrics"]:
            vals["ctr"] = round(random.uniform(3.5, 10.5), 2)
        if "avg_duration" in cfg["metrics"]:
            if platform == "tiktok":
                vals["avg_duration"] = round(random.uniform(20, 55), 1)
            elif platform == "instagram":
                vals["avg_duration"] = round(random.uniform(15, 30), 1)
            else:
                vals["avg_duration"] = round(random.uniform(180, 430), 1)
        if "cpm" in cfg["metrics"]:
            vals["cpm"] = round(random.uniform(3.0, 8.5), 2)
        if "rpm" in cfg["metrics"]:
            vals["rpm"] = round(random.uniform(1.8, 6.2), 2)

        for metric_type, value in vals.items():
            rows.append(
                CreatorMetric(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    platform=platform,
                    metric_type=metric_type,
                    value=value,
                    date=d,
                    video_id=None,
                )
            )

    return rows


def _gen_videos(user_id: str, platform: str) -> list[CreatorVideo]:
    today = date.today()
    catalog = PLATFORM_VIDEOS[platform]
    videos: list[CreatorVideo] = []

    for i, vdata in enumerate(catalog):
        pub_date = datetime(
            today.year,
            today.month,
            today.day,
            hour=random.randint(9, 20),
            minute=random.randint(0, 59),
            tzinfo=timezone.utc,
        ) - timedelta(days=random.randint(1, 28))

        videos.append(
            CreatorVideo(
                id=str(uuid.uuid4()),
                user_id=user_id,
                platform=platform,
                platform_video_id=f"{platform[:2]}_mock_{uuid.uuid4().hex[:8]}",
                title=vdata["title"],
                published_at=pub_date,
                thumbnail_url=f"https://picsum.photos/seed/{platform}{i}/320/180",
                duration_seconds=vdata["duration"],
                views=vdata["views"],
                likes=vdata["likes"],
                comments=vdata["comments"],
            )
        )

    return videos


async def seed():
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL)
    session_factory = create_session_factory(engine)

    async with session_factory() as db:
        result = await db.execute(select(User).where(User.email == DEV_EMAIL))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User {DEV_EMAIL} not found. Run: python -m backend.seeds.dev_user")
            return

        user_id = user.id
        print(f"Found user {user_id} ({user.email})")

        for platform, cfg in PLATFORM_CONFIGS.items():
            # Skip if connection already exists
            result = await db.execute(
                select(PlatformConnection).where(
                    PlatformConnection.user_id == user_id,
                    PlatformConnection.platform == platform,
                )
            )
            if result.scalar_one_or_none():
                print(f"  {platform}: connection exists, skipping")
                continue

            conn = PlatformConnection(
                id=str(uuid.uuid4()),
                user_id=user_id,
                platform=platform,
                access_token=f"mock_access_{platform}_dev",
                refresh_token=f"mock_refresh_{platform}_dev",
                token_expires_at=datetime.now(timezone.utc) + timedelta(days=365),
                platform_user_id=cfg["platform_user_id"],
                platform_username=cfg["platform_username"],
                scopes={"readonly": True},
                connected_at=datetime.now(timezone.utc),
                last_synced_at=datetime.now(timezone.utc),
            )
            db.add(conn)

            metrics = _gen_metrics(user_id, platform, cfg)
            db.add_all(metrics)

            videos = _gen_videos(user_id, platform)
            db.add_all(videos)

            print(f"  {platform}: +{len(metrics)} metrics, +{len(videos)} videos")

        await db.commit()
        print("Done — all mock data committed.")


if __name__ == "__main__":
    asyncio.run(seed())
