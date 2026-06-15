"""Загрузка объявлений в gis.listings (ТЗ §10.3).

Upsert по (source, external_id) — для накопления собственного ряда без дублей.
Привязка к АТЕ — пространственно (ST_Contains по точке lon/lat).
"""

from __future__ import annotations

from collections.abc import Iterable

from psycopg.rows import dict_row

from app.db import get_conn

from .sources.base import RawListing

UPSERT = """
INSERT INTO gis.listings
    (external_id, segment, operation, area, price, currency, published_at,
     source, url, geom, admin_unit_id)
VALUES (
    %(ext)s, %(seg)s, %(op)s, %(area)s, %(price)s, %(cur)s, %(pub)s,
    %(src)s, %(url)s,
    ST_SetSRID(ST_Point(%(lon)s, %(lat)s), 4326),
    (SELECT id FROM gis.admin_units
       WHERE level = 2
         AND ST_Contains(geom, ST_SetSRID(ST_Point(%(lon)s, %(lat)s), 4326))
       LIMIT 1)
)
ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL
DO UPDATE SET
    price = EXCLUDED.price, area = EXCLUDED.area, segment = EXCLUDED.segment,
    operation = EXCLUDED.operation, published_at = EXCLUDED.published_at,
    geom = EXCLUDED.geom, admin_unit_id = EXCLUDED.admin_unit_id, url = EXCLUDED.url
"""


def load_listings(listings: Iterable[RawListing]) -> tuple[int, int]:
    """Upsert объявлений. Возвращает (загружено, привязано к АТЕ всего по источнику)."""
    items = list(listings)
    if not items:
        return 0, 0
    rows = [
        {
            "ext": it.external_id, "seg": it.segment, "op": it.operation,
            "area": it.area, "price": it.price, "cur": it.currency,
            "pub": it.published_at or None, "src": it.source, "url": it.url,
            "lat": it.lat, "lon": it.lon,
        }
        for it in items
    ]
    src = rows[0]["src"]
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.executemany(UPSERT, rows)
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "SELECT count(*) AS n FROM gis.listings "
                "WHERE source = %s AND admin_unit_id IS NOT NULL",
                (src,),
            )
            row = cur.fetchone()
        conn.commit()
    mapped = int(row["n"]) if row else 0
    return len(rows), mapped
