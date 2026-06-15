"""Импорт границ АТЕ и пересчёт агрегатов (ТЗ §9, §10.3).

Источники:
  --source synthetic  (по умолчанию) — структурно корректные ДЕМО-полигоны по
      bbox Украины с КАТОТТГ-подобными кодами. Для локальной разработки геопортала,
      пока нет реального потока данных (этап 3).
  --source geoboundaries — РЕАЛЬНЫЕ границы Украины ADM1+ADM2, скачиваются одной
      командой из geoBoundaries (ODbL, www.openstreetmap.org/copyright). Нужна сеть.
  --source geojson --adm1 FILE [--adm2 FILE] — РЕАЛЬНЫЕ границы из локального GeoJSON
      (предпочтительно КАТОТТГ-датасет с украинскими названиями + кодами).

Для реальных границ агрегаты НЕ фабрикуются — их даёт ETL (`etl.pipeline` →
`aggregate.recompute`). Демо-агрегаты для предпросмотра карты — флаг `--demo-metrics`.

Запуск:  cd apps/engine && uv run python -m etl.import_boundaries
         uv run python -m etl.import_boundaries --source geoboundaries
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import httpx
import psycopg
from psycopg.rows import DictRow, dict_row

from app.db import get_conn

GEOBOUNDARIES_API = "https://www.geoboundaries.org/api/current/gbOpen/UKR"

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


# Ключи свойств в разных датасетах границ (КАТОТТГ-датасеты — украинские названия
# первыми; geoBoundaries — shapeName/shapeID). Предпочитаем украинское название.
_NAME_KEYS = (
    "name_uk", "name:uk", "NAME_UK", "ukr_name", "ADM2_UA", "ADM1_UA", "shapeName", "name", "NAME",
)
_CODE_KEYS = ("katotth", "katottg", "cod_3", "COD", "code", "shapeISO", "shapeID")
_POP_KEYS = ("population", "pop", "POP")


def _parse_props(props: dict[str, Any]) -> tuple[str | None, str, int | None]:
    """Свойства фичи → (код КАТОТТГ/ISO, название, население) с фолбэком по ключам."""
    name = next((str(props[k]) for k in _NAME_KEYS if props.get(k)), "—")
    code = next((str(props[k]) for k in _CODE_KEYS if props.get(k)), None)
    pop_raw = next((props[k] for k in _POP_KEYS if props.get(k) is not None), None)
    try:
        population = int(float(pop_raw)) if pop_raw is not None else None
    except (TypeError, ValueError):
        population = None
    return code, name, population


def insert_features(
    conn: psycopg.Connection[DictRow], features: list[dict[str, Any]], level: int
) -> int:
    """Вставка фич GeoJSON в admin_units (truncate в main гарантирует чистый старт)."""
    count = 0
    with conn.cursor() as cur:
        for f in features:
            geometry = f.get("geometry")
            if not geometry or "Polygon" not in str(geometry.get("type")):
                continue  # только полигоны (LineString-артефакты osmtogeojson пропускаем)
            code, name, population = _parse_props(f.get("properties", {}) or {})
            # ON CONFLICT — устойчивость к дублям КАТОТТГ (артефакты конвертации границ).
            cur.execute(
                """
                INSERT INTO gis.admin_units (code_katottg, level, name, population, geom)
                VALUES (%s, %s, %s, %s, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)))
                ON CONFLICT (code_katottg) WHERE code_katottg IS NOT NULL DO NOTHING
                """,
                (code, level, name, population, json.dumps(geometry)),
            )
            count += cur.rowcount
    return count


def insert_geojson(conn: psycopg.Connection[DictRow], path: Path, level: int) -> int:
    data = json.loads(path.read_text(encoding="utf-8"))
    return insert_features(conn, data.get("features", []), level)


def fetch_geoboundaries(adm: str) -> list[dict[str, Any]]:
    """Скачать GeoJSON-границы Украины из geoBoundaries (ODbL). adm: 'ADM1'|'ADM2'."""
    meta = httpx.get(f"{GEOBOUNDARIES_API}/{adm}/", timeout=60.0)
    meta.raise_for_status()
    gj_url = meta.json()["gjDownloadURL"]
    gj = httpx.get(gj_url, timeout=180.0, follow_redirects=True)
    gj.raise_for_status()
    feats = gj.json().get("features", [])
    return list(feats)


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
    ap.add_argument(
        "--source", choices=["synthetic", "geoboundaries", "geojson"], default="synthetic"
    )
    ap.add_argument("--adm1", type=Path)
    ap.add_argument("--adm2", type=Path)
    ap.add_argument("--months", type=int, default=6)
    ap.add_argument("--end", default="2026-06", help="последний период YYYY-MM")
    ap.add_argument(
        "--demo-metrics",
        action="store_true",
        help="сфабриковать ДЕМО-агрегаты для real-границ (иначе агрегаты даёт ETL)",
    )
    args = ap.parse_args()

    ey, em = (int(x) for x in args.end.split("-"))
    periods = _periods(ey, em, args.months)

    with get_conn() as conn:
        _truncate(conn)
        if args.source == "synthetic":
            n = insert_synthetic(conn)
            make_metrics = True
        elif args.source == "geoboundaries":
            n = insert_features(conn, fetch_geoboundaries("ADM1"), level=1)
            n += insert_features(conn, fetch_geoboundaries("ADM2"), level=2)
            link_parents_spatial(conn)
            make_metrics = args.demo_metrics
        else:  # geojson
            if not args.adm1:
                raise SystemExit("--adm1 обязателен для --source geojson")
            n = insert_geojson(conn, args.adm1, level=1)
            if args.adm2:
                n += insert_geojson(conn, args.adm2, level=2)
            link_parents_spatial(conn)
            make_metrics = args.demo_metrics
        m = generate_metrics(conn, periods) if make_metrics else 0
        conn.commit()
    tail = f"aggregated_metrics: {m}" if make_metrics else "aggregated_metrics: из ETL (recompute)"
    print(f"admin_units: {n}; {tail}; periods: {periods[0]}..{periods[-1]}")


if __name__ == "__main__":
    main()
