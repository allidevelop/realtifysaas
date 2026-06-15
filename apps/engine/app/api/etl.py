"""Защищённый ручной триггер ETL (ТЗ §10.3). На проде — ещё и cron/планировщик."""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from etl.pipeline import run

router = APIRouter(prefix="/api/etl", tags=["etl"])


@router.post("/run")
def run_etl(
    source: str = Query("sample"),
    truncate: bool = Query(False),
    secret: str = Query(...),
) -> dict[str, Any]:
    """Запуск пайплайна extract→transform→load→aggregate. Гард по ETL_TRIGGER_SECRET."""
    expected = os.getenv("ETL_TRIGGER_SECRET", "")
    if not expected or secret != expected:
        raise HTTPException(status_code=401, detail="unauthorized")
    if source not in ("olx", "sample"):
        raise HTTPException(status_code=400, detail="bad source")
    return run(source, truncate)
