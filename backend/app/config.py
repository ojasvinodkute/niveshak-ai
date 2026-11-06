"""Niveshak AI — application configuration.

Loads settings from environment variables / .env file using pydantic-settings.
"""

from __future__ import annotations

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the Niveshak AI backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Niveshak AI"
    debug: bool = False

    # SQLite cache
    db_path: str = "data/cache.db"

    # Cache TTLs (seconds)
    cache_ttl_market_hours: int = 900   # 15 minutes
    cache_ttl_off_hours: int = 86400    # 1 day

    # LLM
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    llm_provider: str = "gemini"        # "gemini" | "anthropic" | "none"

    # Screener
    max_screener_results: int = 50

    # NSE equity list
    nse_equity_csv_url: str = (
        "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
    )
    equity_refresh_days: int = 7

    # Frontend (optional static serving)
    serve_frontend: bool = False


# Singleton — imported by the rest of the app
settings = Settings()
