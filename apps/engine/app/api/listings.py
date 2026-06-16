"""Поиск объявлений (АРМ Аналітика, ТЗ §8.1).

Источники: реальные (DOM.RIA — `source='domria'`, с бэклинком на dom.ria.com по ToS) и
демо. Фильтр `source` + сортировка по колонкам + сводные средние/медиана по выборке.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/listings", tags=["listings"])

# Белый список сортировок (защита от инъекции — ключ от клиента, SQL — наш).
_SORTS = {
    "published_desc": "l.published_at DESC NULLS LAST, l.id",
    "published_asc": "l.published_at ASC NULLS LAST, l.id",
    "price_desc": "l.price DESC NULLS LAST, l.id",
    "price_asc": "l.price ASC NULLS LAST, l.id",
    "area_desc": "l.area DESC NULLS LAST, l.id",
    "area_asc": "l.area ASC NULLS LAST, l.id",
    "ppsqm_desc": "(l.price / NULLIF(l.area, 0)) DESC NULLS LAST, l.id",
    "ppsqm_asc": "(l.price / NULLIF(l.area, 0)) ASC NULLS LAST, l.id",
}


@router.get("/search")
def search(
    admin_unit_id: int | None = Query(None, alias="adminUnitId"),
    segment: str | None = Query(None),
    operation: str | None = Query(None),
    source: str | None = Query(None),
    area_min: float | None = Query(None, alias="areaMin"),
    area_max: float | None = Query(None, alias="areaMax"),
    price_min: float | None = Query(None, alias="priceMin"),
    price_max: float | None = Query(None, alias="priceMax"),
    sort: str = Query("published_desc"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Список объявлений по фильтрам + total + сводные (avg/median цены и цены/м²)."""
    conds = ["TRUE"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if admin_unit_id is not None:
        # АТЕ любого уровня: прямой район ИЛИ дети области.
        conds.append("(l.admin_unit_id = %(unit)s OR u.parent_id = %(unit)s)")
        params["unit"] = admin_unit_id
    if segment:
        conds.append("l.segment = %(seg)s")
        params["seg"] = segment
    if operation:
        conds.append("l.operation = %(op)s")
        params["op"] = operation
    if source:
        conds.append("l.source = %(src)s")
        params["src"] = source
    if area_min is not None:
        conds.append("l.area >= %(amin)s")
        params["amin"] = area_min
    if area_max is not None:
        conds.append("l.area <= %(amax)s")
        params["amax"] = area_max
    if price_min is not None:
        conds.append("l.price >= %(pmin)s")
        params["pmin"] = price_min
    if price_max is not None:
        conds.append("l.price <= %(pmax)s")
        params["pmax"] = price_max
    where = " AND ".join(conds)
    order = _SORTS.get(sort, _SORTS["published_desc"])

    items: list[dict[str, Any]] = []
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT l.id, l.segment, l.operation, l.area, l.price, l.currency,
                   to_char(l.published_at, 'YYYY-MM-DD') AS published,
                   u.name AS unit, l.source, l.url
              FROM gis.listings l
              JOIN gis.admin_units u ON u.id = l.admin_unit_id
             WHERE {where}
             ORDER BY {order}
             LIMIT %(limit)s OFFSET %(offset)s
            """,
            params,
        )
        for r in cur.fetchall():
            items.append(
                {
                    "id": r["id"], "segment": r["segment"], "operation": r["operation"],
                    "area": float(r["area"]) if r["area"] is not None else None,
                    "price": float(r["price"]) if r["price"] is not None else None,
                    "currency": r["currency"], "published": r["published"], "unit": r["unit"],
                    "source": r["source"], "url": r["url"],
                    "pricePerSqm": round(float(r["price"]) / float(r["area"]))
                    if r["price"] and r["area"] else None,
                }
            )
        cur.execute(
            f"""
            SELECT count(*) AS n,
                   avg(l.price)::float AS avg_price,
                   percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price)::float AS median_price,
                   avg(l.price / NULLIF(l.area, 0))::float AS avg_ppsqm,
                   percentile_cont(0.5) WITHIN GROUP (
                       ORDER BY l.price / NULLIF(l.area, 0)
                   )::float AS median_ppsqm
              FROM gis.listings l JOIN gis.admin_units u ON u.id = l.admin_unit_id
             WHERE {where}
            """,
            params,
        )
        s = cur.fetchone() or {}

    def _r(v: Any) -> float | None:
        return round(float(v)) if v is not None else None

    return {
        "items": items,
        "total": int(s.get("n") or 0),
        "stats": {
            "count": int(s.get("n") or 0),
            "avgPrice": _r(s.get("avg_price")),
            "medianPrice": _r(s.get("median_price")),
            "avgPpsqm": _r(s.get("avg_ppsqm")),
            "medianPpsqm": _r(s.get("median_ppsqm")),
        },
    }
