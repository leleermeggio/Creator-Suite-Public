from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.auth.dependencies import get_db
from backend.auth.routes import router as auth_router
from backend.config import get_settings
from backend.middleware.rate_limit import limiter
from backend.middleware.security import SecurityHeadersMiddleware
from backend.routes.health import router as health_router
from backend.routes.jobs import router as jobs_router
from backend.routes.media import router as media_router
from backend.routes.captions import router as captions_router
from backend.routes.exports import router as exports_router
from backend.routes.projects import router as projects_router
from backend.routes.audio import router as audio_router
from backend.routes.search import router as search_router
from backend.routes.graphics import router as graphics_router
from backend.routes.thumbnails import router as thumbnails_router
from backend.routes.analytics import router as analytics_router
from backend.routes.comments import router as comments_router
from backend.routes.reviews import router as reviews_router
from backend.routes.subscriptions import router as subscriptions_router
from backend.routes.teams import router as teams_router
from backend.routes.watermark import router as watermark_router
from backend.routes.tools import router as tools_router


def _get_db_dependency(session_factory: async_sessionmaker[AsyncSession]):
    async def dep():
        async with session_factory() as session:
            yield session
    return dep


def create_app(session_factory: async_sessionmaker[AsyncSession] | None = None) -> FastAPI:
    settings = get_settings()

    app = FastAPI(title="Creator Suite API", version="0.1.0")

    # Middleware (order matters — last added = first executed)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_origin_regex=(
            r"http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
            r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})"
            r":(8081|19006|3000|8000)"
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Database dependency — always configured (production uses settings, tests inject their own)
    if session_factory is None:
        from backend.database import Base, create_engine, create_session_factory
        engine = create_engine(settings.DATABASE_URL)
        session_factory = create_session_factory(engine)

        # Auto-create tables on startup (dev/SQLite mode)
        @app.on_event("startup")
        async def _create_tables():
            import backend.models  # noqa: F401 — ensure all models are imported
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)

    app.dependency_overrides[get_db] = _get_db_dependency(session_factory)

    # Routes
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(jobs_router)
    app.include_router(media_router)
    app.include_router(exports_router)
    app.include_router(captions_router)
    app.include_router(search_router)
    app.include_router(audio_router)
    app.include_router(thumbnails_router)
    app.include_router(graphics_router)
    app.include_router(watermark_router)
    app.include_router(teams_router)
    app.include_router(comments_router)
    app.include_router(reviews_router)
    app.include_router(analytics_router)
    app.include_router(subscriptions_router)
    app.include_router(tools_router, prefix="/tools")

    return app
