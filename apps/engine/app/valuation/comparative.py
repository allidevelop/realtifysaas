"""Сравнительная оценка по аналогам (ТЗ §10.1).

Подбор аналогов (PostGIS ST_Within/ST_DWithin, близость площади) → веса по
схожести → средневзвешенная цена за м² → корректировки (торг, этаж) → стоимость.
Метрика доверия (confidence) — по числу аналогов и разбросу цен. Прозрачно:
возвращаем аналоги и их веса (для отчёта банкам, ТЗ §10.1).
"""

from __future__ import annotations

import statistics
from typing import Any

from psycopg.rows import dict_row

from app.db import get_conn
from app.schemas.valuation import (
    Adjustment,
    Comparable,
    DetailedResult,
    ValuationRequest,
)

RADIUS_M = 40_000
LIMIT = 30
AREA_LOW, AREA_HIGH = 0.65, 1.35


def _resolve_unit(conn: Any, req: ValuationRequest) -> tuple[int | None, str | None]:
    with conn.cursor(row_factory=dict_row) as cur:
        if req.lon is not None and req.lat is not None:
            cur.execute(
                """
                SELECT id, name FROM gis.admin_units
                 WHERE level = 2
                   AND ST_Contains(geom, ST_SetSRID(ST_Point(%(lon)s, %(lat)s), 4326))
                 LIMIT 1
                """,
                {"lon": req.lon, "lat": req.lat},
            )
            r = cur.fetchone()
            if r:
                return r["id"], r["name"]
        if req.admin_unit_id is not None:
            cur.execute(
                "SELECT id, name FROM gis.admin_units WHERE id = %s", (req.admin_unit_id,)
            )
            r = cur.fetchone()
            if r:
                return r["id"], r["name"]
    return None, None


def _find_comparables(conn: Any, unit_id: int, req: ValuationRequest) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT l.id, l.area, l.price,
                   ST_Distance(l.geom::geography, ST_Centroid(t.geom)::geography) AS dist_m,
                   to_char(l.published_at, 'YYYY-MM') AS period
              FROM gis.listings l,
                   (SELECT geom FROM gis.admin_units WHERE id = %(unit)s) t
             WHERE l.segment = %(seg)s AND l.operation = %(op)s
               AND l.area BETWEEN %(area)s * %(lo)s AND %(area)s * %(hi)s
               AND (
                     ST_Within(l.geom, t.geom)
                     OR ST_DWithin(l.geom::geography, ST_Centroid(t.geom)::geography, %(radius)s)
                   )
             ORDER BY abs(l.area - %(area)s), dist_m
             LIMIT %(limit)s
            """,
            {
                "unit": unit_id, "seg": req.segment, "op": req.operation,
                "area": req.area, "lo": AREA_LOW, "hi": AREA_HIGH,
                "radius": RADIUS_M, "limit": LIMIT,
            },
        )
        return list(cur.fetchall())


def _confidence(n: int, ppsqm: list[float]) -> float:
    if n == 0:
        return 0.0
    count_factor = min(1.0, n / 15.0)
    spread_factor = 1.0
    if n >= 2:
        mean = statistics.fmean(ppsqm)
        cv = statistics.pstdev(ppsqm) / mean if mean else 1.0
        spread_factor = max(0.0, 1.0 - min(1.0, cv * 2))
    conf = 0.4 + 0.4 * count_factor + 0.2 * spread_factor
    return round(min(0.95, max(0.2, conf)), 2)


def value_property(req: ValuationRequest) -> DetailedResult:
    with get_conn() as conn:
        unit_id, unit_name = _resolve_unit(conn, req)
        if unit_id is None:
            return DetailedResult(
                value=0.0, confidence=0.0, comparablesCount=0, pricePerSqm=0.0,
                adminUnitName=None,
                methodology="Не визначено територіальну одиницю для оцінки.",
            )
        raw = _find_comparables(conn, unit_id, req)

    comps: list[Comparable] = []
    ppsqm_list: list[float] = []
    weights: list[float] = []
    for r in raw:
        area = float(r["area"])
        price = float(r["price"])
        ppsqm = price / area if area else 0.0
        area_diff = abs(area - req.area) / req.area
        dist_ratio = float(r["dist_m"]) / RADIUS_M
        weight = 1.0 / (1.0 + area_diff + dist_ratio)
        ppsqm_list.append(ppsqm)
        weights.append(weight)
        comps.append(
            Comparable(
                id=r["id"], area=round(area, 1), price=round(price, 0),
                pricePerSqm=round(ppsqm, 0), distanceM=round(float(r["dist_m"]), 0),
                publishedAt=r["period"], weight=round(weight, 3),
            )
        )

    n = len(comps)
    if n == 0:
        return DetailedResult(
            value=0.0, confidence=0.0, comparablesCount=0, pricePerSqm=0.0,
            adminUnitName=unit_name,
            methodology="Недостатньо аналогів для оцінки в обраному сегменті/локації.",
        )

    wsum = sum(weights)
    wavg_ppsqm = sum(w * p for w, p in zip(weights, ppsqm_list, strict=True)) / wsum

    # Корректировки (демо): коэффициент торга + этажность.
    adjustments: list[Adjustment] = [
        Adjustment(factor="bargain", description="Коефіцієнт торгу", coefficient=0.95),
    ]
    if req.floor is not None and req.total_floors:
        if req.floor == 1 or req.floor == req.total_floors:
            adjustments.append(
                Adjustment(factor="floor", description="Перший/останній поверх", coefficient=0.97)
            )

    coef = 1.0
    for a in adjustments:
        coef *= a.coefficient
    adjusted_ppsqm = wavg_ppsqm * coef
    value = adjusted_ppsqm * req.area

    return DetailedResult(
        value=round(value, 0),
        currency="UAH",
        confidence=_confidence(n, ppsqm_list),
        comparablesCount=n,
        pricePerSqm=round(adjusted_ppsqm, 0),
        adminUnitName=unit_name,
        period=req.period,
        comparables=sorted(comps, key=lambda c: c.weight, reverse=True)[:10],
        adjustments=adjustments,
        methodology=(
            "Порівняльний підхід: підбір аналогів за сегментом, операцією, близькістю "
            "площі та локації (PostGIS); середньозважена ціна за м² за схожістю; "
            "корективи на торг та поверховість. Відповідає принципам Національних "
            "стандартів оцінки (демо-дані)."
        ),
    )
