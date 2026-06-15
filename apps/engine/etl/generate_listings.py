"""Генерация синтетических объявлений (gis.listings) для движка оценки (ТЗ §10.1).

Точки разбрасываются внутри полигонов районов (ST_GeneratePoints), цена выводится
из агрегатов avg_price_sqm. Это демо-аналоги — на этапе 3 заменяются реальным
потоком объявлений из легитимного источника.

Запуск:  cd apps/engine && uv run python -m etl.generate_listings
"""

from __future__ import annotations

from app.db import get_conn

# На каждую строку агрегата (район × период × сегмент × операция) — K объявлений.
PER_METRIC = 3

# CTE `gen` считает площадь random() в SELECT-листе → значение ПО СТРОКЕ
# (volatile per output row). Внешний INSERT использует её для площади и цены.
INSERT_SQL = f"""
WITH gen AS (
    SELECT
        m.segment, m.operation, m.value, m.currency, m.period,
        u.id AS uid, u.geom,
        round((
            CASE m.segment
                WHEN 'land' THEN 200 + random() * 1800
                WHEN 'commercial' THEN 50 + random() * 350
                WHEN 'house' THEN 60 + random() * 190
                ELSE 30 + random() * 120
            END)::numeric, 1) AS area_val
    FROM gis.aggregated_metrics m
    JOIN gis.admin_units u ON u.id = m.admin_unit_id
    CROSS JOIN generate_series(1, {PER_METRIC}) AS gs(n)
    WHERE m.metric_type = 'avg_price_sqm' AND u.level = 2
)
INSERT INTO gis.listings
    (segment, operation, area, price, currency, published_at, source, geom, admin_unit_id)
SELECT
    segment, operation, area_val,
    round((value * area_val * (0.85 + random() * 0.30))::numeric, 0),
    currency,
    to_date(period || '-15', 'YYYY-MM-DD'),
    'synthetic',
    (ST_Dump(ST_GeneratePoints(geom, 1))).geom,
    uid
FROM gen
"""


def main() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE gis.listings RESTART IDENTITY")
            cur.execute(INSERT_SQL)
            cur.execute("SELECT count(*) AS n FROM gis.listings")
            row = cur.fetchone()
        conn.commit()
    print(f"listings: {row['n'] if row else 0}")


if __name__ == "__main__":
    main()
