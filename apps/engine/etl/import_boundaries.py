"""Импорт границ АТЕ и пересчёт агрегатов (ТЗ §9, §10.3).

Источники:
  --source synthetic  (по умолчанию) — структурно корректные ДЕМО-полигоны по
      bbox Украины с КАТОТТГ-подобными кодами. Для локальной разработки геопортала,
      пока нет реального потока данных (этап 3).
  --source geojson --adm1 FILE [--adm2 FILE] — РЕАЛЬНЫЕ границы из GeoJSON
      (geoBoundaries/COD-AB/ukrainian_geodata, CC BY 4.0 / ODbL). Подставляется
      одной командой, когда файл доступен.

Запуск:  cd apps/engine && uv run python -m etl.import_boundaries
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import psycopg
from psycopg.rows import DictRow, dict_row

from app.db import get_conn

# bbox материковой Украины (для синтетики).
LON0, LON1 = 22.0, 40.2
LAT0, LAT1 = 44.2, 52.4
COLS, ROWS = 6, 5

OBLAST_NAMES = [
    "Вінницька", "Волинська", "Дніпропетровська", "Донецька", "Житомирська",
    "Закарпатська", "Запорізька", "Івано-Франківська", "Київська", "Кіровоградська",
    "Луганська", "Львівська", "Миколаївська", "Одеська", "Полтавська",
    "Рівненська", "Сумська", "Тернопільська", "Харківська", "Херсонська",
    "Хмельницька", "Черкаська", "Чернівецька", "Чернігівська", "м. Київ",
    "АР Крим", "Севастополь",
]

SEGMENTS = ["apartment", "house", "commercial", "land"]
OPERATIONS = ["sale", "rent"]
METRICS = ["avg_price_sqm", "median_price_sqm", "count"]


def _rect_wkt(x0: float, y0: float, x1: float, y1: float) -> str:
    pad = 0.03
    x0, y0, x1, y1 = x0 + pad, y0 + pad, x1 - pad, y1 - pad
    return (
        f"POLYGON(({x0} {y0}, {x1} {y0}, {x1} {y1}, {x0} {y1}, {x0} {y0}))"
    )


def _periods(end_year: int, end_month: int, months: int) -> list[str]:
    out: list[str] = []
    y, m = end_year, end_month
    for _ in range(months):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(out))


def _truncate(conn: psycopg.Connection[DictRow]) -> None:
    with conn.cursor() as cur:
        cur.execute("TRUNCATE gis.admin_units RESTART IDENTITY CASCADE")


def insert_synthetic(conn: psycopg.Connection[DictRow]) -> int:
    cell_w = (LON1 - LON0) / COLS
    cell_h = (LAT1 - LAT0) / ROWS
    count = 0
    with conn.cursor(row_factory=dict_row) as cur:
        for i, name in enumerate(OBLAST_NAMES):
            col, row = i % COLS, i // COLS
            x0, y0 = LON0 + col * cell_w, LAT0 + row * cell_h
            wkt = _rect_wkt(x0, y0, x0 + cell_w, y0 + cell_h)
            cur.execute(
                """
                INSERT INTO gis.admin_units (code_katottg, level, name, population, geom)
                VALUES (%s, 1, %s, %s, ST_Multi(ST_GeomFromText(%s, 4326)))
                RETURNING id
                """,
                (f"UA{i + 1:02d}00000000", name, 300000 + (i * 37 % 50) * 20000, wkt),
            )
            row_ = cur.fetchone()
            assert row_ is not None
            oblast_id = row_["id"]
            count += 1
            # 2x2 раёна внутри области
            for r in range(4):
                rc, rr = r % 2, r // 2
                rx0 = x0 + rc * cell_w / 2
                ry0 = y0 + rr * cell_h / 2
                rwkt = _rect_wkt(rx0, ry0, rx0 + cell_w / 2, ry0 + cell_h / 2)
                cur.execute(
                    """
                    INSERT INTO gis.admin_units
                        (code_katottg, level, name, parent_id, population, geom)
                    VALUES (%s, 2, %s, %s, %s, ST_Multi(ST_GeomFromText(%s, 4326)))
                    """,
                    (
                        f"UA{i + 1:02d}{r + 1:02d}000000",
                        f"{name} р-н {r + 1}",
                        oblast_id,
                        60000 + (r * 7 % 9) * 8000,
                        rwkt,
                    ),
                )
                count += 1
    return count


def insert_geojson(conn: psycopg.Connection[DictRow], path: Path, level: int) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    feats = data.get("features", [])
    count = 0
    with conn.cursor() as cur:
        for f in feats:
            props = f.get("properties", {})
            name = props.get("shapeName") or props.get("name") or props.get("NAME") or "—"
            code = props.get("shapeID") or props.get("katottg") or props.get("COD")
            geom = json.dumps(f.get("geometry"))
            cur.execute(
                """
                INSERT INTO gis.admin_units (code_katottg, level, name, geom)
                VALUES (%s, %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                """,
                (str(code) if code else None, level, name, geom),
            )
            count += 1
    return count


def link_parents_spatial(conn: psycopg.Connection[DictRow]) -> None:
    """Для реальных данных: parent_id района = область, содержащая его центроид."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE gis.admin_units a2
               SET parent_id = a1.id
              FROM gis.admin_units a1
             WHERE a2.level = 2 AND a1.level = 1
               AND ST_Contains(a1.geom, ST_PointOnSurface(a2.geom))
            """
        )


def generate_metrics(conn: psycopg.Connection[DictRow], periods: list[str]) -> int:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT id, level,
                   ST_X(ST_Centroid(geom)) AS lon,
                   ST_Y(ST_Centroid(geom)) AS lat
              FROM gis.admin_units
            """
        )
        units = cur.fetchall()

    rows: list[tuple[int, str, str, str, str, float, str]] = []
    seg_mult = {"apartment": 1.0, "house": 0.8, "commercial": 1.3, "land": 0.18}
    for u in units:
        uid, lon, lat = u["id"], float(u["lon"]), float(u["lat"])
        # Базовая цена кв.м (UAH): запад/Киев дороже + широтный градиент.
        base = 22000 + (lon - LON0) / (LON1 - LON0) * 6000 + (lat - LAT0) / (LAT1 - LAT0) * 9000
        for pi, period in enumerate(periods):
            trend = 1.0 + pi * 0.012  # лёгкий рост во времени
            for seg in SEGMENTS:
                for op in OPERATIONS:
                    noise = 1.0 + ((uid * 7 + pi * 13 + hash(seg) % 7) % 11 - 5) / 50.0
                    avg = base * seg_mult[seg] * trend * noise
                    if op == "rent":
                        avg = avg / 160.0  # месячная ставка аренды кв.м
                    median = avg * 0.95
                    cnt = float(8 + (uid * 3 + pi) % 40)
                    rows.append((uid, period, seg, op, "avg_price_sqm", round(avg, 2), "UAH"))
                    rows.append((uid, period, seg, op, "median_price_sqm", round(median, 2), "UAH"))
                    rows.append((uid, period, seg, op, "count", cnt, "UAH"))

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO gis.aggregated_metrics
                (admin_unit_id, period, segment, operation, metric_type, value, currency)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            rows,
        )
    return len(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description="Импорт границ АТЕ + агрегаты")
    ap.add_argument("--source", choices=["synthetic", "geojson"], default="synthetic")
    ap.add_argument("--adm1", type=Path)
    ap.add_argument("--adm2", type=Path)
    ap.add_argument("--months", type=int, default=6)
    ap.add_argument("--end", default="2026-06", help="последний период YYYY-MM")
    args = ap.parse_args()

    ey, em = (int(x) for x in args.end.split("-"))
    periods = _periods(ey, em, args.months)

    with get_conn() as conn:
        _truncate(conn)
        if args.source == "synthetic":
            n = insert_synthetic(conn)
        else:
            if not args.adm1:
                raise SystemExit("--adm1 обязателен для --source geojson")
            n = insert_geojson(conn, args.adm1, level=1)
            if args.adm2:
                n += insert_geojson(conn, args.adm2, level=2)
            link_parents_spatial(conn)
        m = generate_metrics(conn, periods)
        conn.commit()
    print(f"admin_units: {n}; aggregated_metrics: {m}; periods: {periods[0]}..{periods[-1]}")


if __name__ == "__main__":
    main()
