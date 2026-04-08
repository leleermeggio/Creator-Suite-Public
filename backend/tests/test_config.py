def test_settings_loads_from_env(monkeypatch):
    """Settings should load all required values from environment."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://example.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "test_key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "test_secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "test-bucket")
    monkeypatch.setenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")

    from backend.config import Settings

    s = Settings()
    assert s.DATABASE_URL == "postgresql+asyncpg://u:p@localhost/test"
    assert s.REDIS_URL == "redis://localhost:6379/0"
    assert s.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 15
    assert s.JWT_REFRESH_TOKEN_EXPIRE_DAYS == 30
    assert s.R2_BUCKET_NAME == "test-bucket"
    assert s.ALLOWED_ORIGINS == "http://localhost:3000"
    assert s.allowed_origins == ["http://localhost:3000"]


def test_settings_custom_origins(monkeypatch):
    """ALLOWED_ORIGINS should parse comma-separated string."""
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setenv("JWT_PRIVATE_KEY_PATH", "keys/private.pem")
    monkeypatch.setenv("JWT_PUBLIC_KEY_PATH", "keys/public.pem")
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://example.r2.cloudflarestorage.com")
    monkeypatch.setenv("R2_ACCESS_KEY_ID", "key")
    monkeypatch.setenv("R2_SECRET_ACCESS_KEY", "secret")
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket")
    monkeypatch.setenv(
        "ALLOWED_ORIGINS", "https://app.example.com,https://api.example.com"
    )

    from backend.config import Settings

    s = Settings()
    assert s.allowed_origins == ["https://app.example.com", "https://api.example.com"]
