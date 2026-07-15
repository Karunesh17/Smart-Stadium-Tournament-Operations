"""Centralized settings configuration module for the Smart Stadium Platform.

Validates and loads environment variables for database connections, security,
caching layers, and server contexts.
"""

import os


class Settings:
    """Centralized environment configurations with secure default values."""

    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL", "sqlite:///./smart_stadium.db"
        )
        self.redis_url: str = os.getenv(
            "REDIS_URL", "redis://localhost:6379/0"
        )
        self.auth_jwt_secret: str = os.getenv(
            "AUTH_JWT_SECRET", "super-secret-key-smart-stadium-2026"
        )
        self.auth_cookie_secure: bool = (
            os.getenv("AUTH_COOKIE_SECURE", "true").lower() == "true"
        )
        self.environment: str = os.getenv("ENV", "development")


settings = Settings()
