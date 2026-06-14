"""Точка входа FastAPI (ТЗ §10).

Этап 0: только каркас и healthcheck. Роутеры valuation/geo/reports/public_api
подключаются на этапах 2–5.
"""

from __future__ import annotations

from fastapi import FastAPI

from app import __version__
from app.api.reports import router as reports_router
from app.schemas import HealthResponse

app = FastAPI(
    title="Realtify Engine",
    version=__version__,
    description="Движок оценки, гео-API, публичный API, ETL, Telegram-бот.",
)

# Биллинг-документы (счёт/акт PDF) — этап 5 (ТЗ §11).
app.include_router(reports_router)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    """Healthcheck для локальной разработки и прод-мониторинга (ТЗ §13)."""
    return HealthResponse(status="ok", service="engine", version=__version__)
