"""Пересчёт gis.aggregated_metrics из gis.listings (ТЗ §9, §10.3).

Каноничный источник агрегатов для карты/дашбордов/оценки. Воспроизводимо:
очистка выбросов по IQR на цену/м², средняя и медианная цена/м², количество —
в разрезе АТЕ × период × сегмент × операция. Каждое объявление учитывается и в
своём районе (level 2), и в области (level 1, roll-up по parent).

Запуск:  cd apps/engine && uv run python -m etl.aggregate
"""

from __future__ import annotations

from app.db import get_conn

RECOMPUTE_SQL = """
WITH exploded AS (
    -- объявление → его район (level 2)
    SELECT l.admin_unit_id AS unit_id,
           to_char(l.published_at, 'YYYY-MM') AS period,
           l.segment, l.operation,
           l.price / NULLIF(l.area, 0) AS ppsqm
      FROM gis.listings l
     WHERE l.area > 0 AND l.price > 0 AND l.admin_unit_id IS NOT NULL
           AND l.published_at IS NOT NULL
    UNION ALL
    -- объявление → его область (level 1, roll-up через parent)
    SELECT u.parent_id AS unit_id,
           to_char(l.published_at, 'YYYY-MM') AS period,
           l.segment, l.operation,
           l.price / NULLIF(l.area, 0) AS ppsqm
      FROM gis.listings l
      JOIN gis.admin_units u ON u.id = l.admin_unit_id
     WHERE u.parent_id IS NOT NULL AND l.area > 0 AND l.price > 0
           AND l.published_at IS NOT NULL
),
bounds AS (
    SELECT unit_id, period, segment, operation,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY ppsqm) AS q1,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY ppsqm) AS q3
      FROM exploded
     GROUP BY unit_id, period, segment, operation
),
filtered AS (
    SELECT e.unit_id, e.period, e.segment, e.operation, e.ppsqm
      FROM exploded e
      JOIN bounds b USING (unit_id, period, segment, operation)
     WHERE e.ppsqm BETWEEN b.q1 - 1.5 * (b.q3 - b.q1)
                       AND b.q3 + 1.5 * (b.q3 - b.q1)
),
agg AS (
    SELECT unit_id, period, segment, operation,
           avg(ppsqm) AS avg_ppsqm,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY ppsqm) AS median_ppsqm,
           count(*) AS cnt
      FROM filtered
     GROUP BY unit_id, period, segment, operation
)
INSERT INTO gis.aggregated_metrics
    (admin_unit_id, period, segment, operation, metric_type, value, currency)
SELECT unit_id, period, segment, operation,
       'avg_price_sqm', round(avg_ppsqm::numeric, 2), 'UAH'
  FROM agg
UNION ALL
SELECT unit_id, period, segment, operation,
       'median_price_sqm', round(median_ppsqm::numeric, 2), 'UAH'
  FROM agg
UNION ALL
SELECT unit_id, period, segment, operation, 'count', cnt, 'UAH'
  FROM agg
-- Доп. рыночные метрики для «Інтерактивного звіту». Истинные значения требуют данных
-- об аренде/сделках/днях-на-рынке (нет в demo) → синтетика, детерминированная от
-- АТЕ/месяца/сегмента. Считаются здесь, чтобы переживать TRUNCATE+recompute.
UNION ALL
SELECT unit_id, period, segment, operation, 'cap_rate',
       round((7.0 + (CASE WHEN segment = 'commercial' THEN 2.0 ELSE 0 END)
              + mod(unit_id + right(period, 2)::int, 5) * 0.4)::numeric, 2), '%'
  FROM agg
UNION ALL
SELECT unit_id, period, segment, operation, 'bargain_index',
       round((4.0 + mod(unit_id * 3 + right(period, 2)::int, 6) * 0.7)::numeric, 2), '%'
  FROM agg
UNION ALL
SELECT unit_id, period, segment, operation, 'exposure_days',
       (45 + mod(unit_id + right(period, 2)::int * 2, 9) * 9)::numeric, 'day'
  FROM agg
UNION ALL
SELECT unit_id, period, segment, operation, 'occupancy_pct',
       (72 + mod(unit_id + right(period, 2)::int, 8) * 3)::numeric, '%'
  FROM agg WHERE segment = 'commercial'
"""


def recompute() -> int:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE gis.aggregated_metrics RESTART IDENTITY")
            cur.execute(RECOMPUTE_SQL)
            cur.execute("SELECT count(*) AS n FROM gis.aggregated_metrics")
            row = cur.fetchone()
        conn.commit()
    return int(row["n"]) if row else 0


def main() -> None:
    n = recompute()
    print(f"aggregated_metrics: {n}")


if __name__ == "__main__":
    main()
