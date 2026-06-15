"""Гео-API: границы (GeoJSON), агрегаты, поиск (ТЗ §9).

Внутренний сервис. Фронт обращается через прокси-роуты web (там же — гейтинг
глубины по тарифу). Геометрия упрощается ST_SimplifyPreserveTopology по запросу.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/geo", tags=["geo"])


@router.get("/units")
def units(
    level: int = Query(1, ge=1, le=4),
    parent: int | None = Query(None),
    simplify: float = Query(0.0, ge=0.0, le=1.0),
) -> dict[str, Any]:
    """GeoJSON FeatureCollection территориальных единиц.

    parent задан → дети этого parent; иначе все единицы уровня level.
    """
    where = "parent_id = %(parent)s" if parent is not None else "level = %(level)s"
    params = {"parent": parent, "level": level, "tol": simplify}
    sql = f"""
        SELECT jsonb_build_object(
                 'type', 'FeatureCollection',
                 'features', COALESCE(jsonb_agg(feat), '[]'::jsonb)
               ) AS fc
        FROM (
          SELECT jsonb_build_object(
                   'type', 'Feature',
                   'id', id,
                   'geometry', ST_AsGeoJSON(
                       CASE WHEN %(tol)s > 0
                            THEN ST_SimplifyPreserveTopology(geom, %(tol)s)
                            ELSE geom END
                   )::jsonb,
                   'properties', jsonb_build_object(
                       'id', id, 'code', code_katottg, 'name', name,
                       'level', level, 'parentId', parent_id, 'population', population
                   )
                 ) AS feat
          FROM gis.admin_units
          WHERE {where}
          ORDER BY name
        ) t
    """
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
    return (row or {}).get("fc") or {"type": "FeatureCollection", "features": []}


@router.get("/metrics")
def metrics(
    period: str = Query(...),
    segment: str = Query("apartment"),
    operation: str = Query("sale"),
    metric: str = Query("avg_price_sqm"),
    level: int = Query(1, ge=1, le=4),
    parent: int | None = Query(None),
) -> dict[str, Any]:
    """Значения метрики по АТЕ для choropleth: {adminUnitId: value}."""
    where_unit = "u.parent_id = %(parent)s" if parent is not None else "u.level = %(level)s"
    sql = f"""
        SELECT m.admin_unit_id AS id, m.value, m.currency
          FROM gis.aggregated_metrics m
          JOIN gis.admin_units u ON u.id = m.admin_unit_id
         WHERE m.period = %(period)s AND m.segment = %(segment)s
           AND m.operation = %(operation)s AND m.metric_type = %(metric)s
           AND {where_unit}
    """
    params = {
        "period": period, "segment": segment, "operation": operation,
        "metric": metric, "level": level, "parent": parent,
    }
    values: dict[str, float] = {}
    currency = "UAH"
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        for r in cur.fetchall():
            values[str(r["id"])] = float(r["value"])
            currency = r["currency"]
    return {"period": period, "metric": metric, "currency": currency, "values": values}


@router.get("/search")
def search(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
) -> dict[str, Any]:
    """Поиск АТЕ по названию (для строки поиска на карте)."""
    sql = """
        SELECT id, name, level, parent_id AS "parentId",
               ST_XMin(geom) AS xmin, ST_YMin(geom) AS ymin,
               ST_XMax(geom) AS xmax, ST_YMax(geom) AS ymax
          FROM gis.admin_units
         WHERE name ILIKE %(q)s
         ORDER BY level, name
         LIMIT %(limit)s
    """
    items: list[dict[str, Any]] = []
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, {"q": f"%{q}%", "limit": limit})
        for r in cur.fetchall():
            items.append(
                {
                    "id": r["id"], "name": r["name"], "level": r["level"],
                    "parentId": r["parentId"],
                    "bbox": [
                        float(r["xmin"]), float(r["ymin"]),
                        float(r["xmax"]), float(r["ymax"]),
                    ],
                }
            )
    return {"items": items}


@router.get("/meta")
def meta() -> dict[str, Any]:
    """Доступные периоды/сегменты/операции/метрики для панели фильтров."""
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT DISTINCT period FROM gis.aggregated_metrics ORDER BY period")
        periods = [r["period"] for r in cur.fetchall()]
    return {
        "periods": periods,
        "segments": ["apartment", "house", "commercial", "land"],
        "operations": ["sale", "rent"],
        "metrics": ["avg_price_sqm", "median_price_sqm", "count"],
    }
