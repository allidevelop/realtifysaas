"""Поиск объявлений (АРМ Аналітика, ТЗ §8.1). Демо-данные (этап 3 — реальные)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/listings", tags=["listings"])


@router.get("/search")
def search(
    admin_unit_id: int | None = Query(None, alias="adminUnitId"),
    segment: str | None = Query(None),
    operation: str | None = Query(None),
    area_min: float | None = Query(None, alias="areaMin"),
    area_max: float | None = Query(None, alias="areaMax"),
    price_min: float | None = Query(None, alias="priceMin"),
    price_max: float | None = Query(None, alias="priceMax"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> dict[str, Any]:
    """Список объявлений по фильтрам + общее число (для пагинации/экспорта)."""
    conds = ["TRUE"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if admin_unit_id is not None:
        # АТЕ любого уровня: прямой район ИЛИ дети области.
        conds.append(
            "(l.admin_unit_id = %(unit)s OR u.parent_id = %(unit)s)"
        )
        params["unit"] = admin_unit_id
    if segment:
        conds.append("l.segment = %(seg)s")
        params["seg"] = segment
    if operation:
        conds.append("l.operation = %(op)s")
        params["op"] = operation
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

    items: list[dict[str, Any]] = []
    total = 0
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT l.id, l.segment, l.operation, l.area, l.price, l.currency,
                   to_char(l.published_at, 'YYYY-MM-DD') AS published, u.name AS unit
              FROM gis.listings l
              JOIN gis.admin_units u ON u.id = l.admin_unit_id
             WHERE {where}
             ORDER BY l.published_at DESC, l.id
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
                    "pricePerSqm": round(float(r["price"]) / float(r["area"]))
                    if r["price"] and r["area"] else None,
                }
            )
        cur.execute(
            f"""
            SELECT count(*) AS n
              FROM gis.listings l JOIN gis.admin_units u ON u.id = l.admin_unit_id
             WHERE {where}
            """,
            params,
        )
        row = cur.fetchone()
        total = int(row["n"]) if row else 0

    return {"items": items, "total": total}
