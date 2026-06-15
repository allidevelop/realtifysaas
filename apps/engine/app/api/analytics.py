"""Аналитические ряды для интерактивного отчёта (ТЗ §8.1, дашборды)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/series")
def series(
    admin_unit_id: int = Query(..., alias="adminUnitId"),
    operation: str = Query("sale"),
    metric: str = Query("avg_price_sqm"),
) -> dict[str, Any]:
    """Временной ряд по периодам (по сегментам) + разрез по сегментам за последний период."""
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        # Ряд по периодам, по каждому сегменту.
        cur.execute(
            """
            SELECT period, segment, value
              FROM gis.aggregated_metrics
             WHERE admin_unit_id = %(unit)s AND operation = %(op)s AND metric_type = %(metric)s
             ORDER BY period
            """,
            {"unit": admin_unit_id, "op": operation, "metric": metric},
        )
        rows = cur.fetchall()

    periods = sorted({r["period"] for r in rows})
    segments = sorted({r["segment"] for r in rows})
    by_period: dict[str, dict[str, Any]] = {p: {"period": p} for p in periods}
    for r in rows:
        by_period[r["period"]][r["segment"]] = round(float(r["value"]))

    latest = periods[-1] if periods else None
    by_segment = [
        {"segment": r["segment"], "value": round(float(r["value"]))}
        for r in rows
        if r["period"] == latest
    ]

    return {
        "periods": periods,
        "segments": segments,
        "trend": [by_period[p] for p in periods],
        "latest": latest,
        "bySegment": by_segment,
    }
