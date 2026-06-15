"""Конфигурация engine из переменных окружения (ТЗ §17)."""

from __future__ import annotations

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Кладём .env в os.environ — для os.getenv в ETL/OLX (pydantic-settings этого не делает).
load_dotenv("../../.env")
load_dotenv(".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgres://geo:geo_local_pass@localhost:5432/geo"
    pg_gis_schema: str = "gis"
    redis_url: str = "redis://localhost:6379"
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    engine_base_url: str = "http://localhost:8000"
    telegram_bot_token: str = ""


settings = Settings()
