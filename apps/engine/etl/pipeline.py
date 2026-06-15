"""Оркестратор ETL (ТЗ §10.3): extract → transform → load → recompute aggregates.

  uv run python -m etl.pipeline --source sample      # локальный e2e (фикстура)
  uv run python -m etl.pipeline --source olx         # реальный OLX (нужны ключи + сеть)
  uv run python -m etl.pipeline --source olx --truncate   # с очисткой listings

Накопление собственного ряда (ТЗ §3): запускать по расписанию (cron на проде).
"""

from __future__ import annotations

import argparse

from app.db import get_conn

from .aggregate import recompute
from .load import load_listings
from .sources.base import Source
from .sources.domria import DomRiaSource
from .sources.olx import OlxSource
from .sources.prozorro import ProzorroSaleSource
from .sources.sample import SampleSource
from .transform import normalize

SOURCES = ("olx", "sample", "prozorro", "domria")


def _make_source(name: str) -> Source:
    if name == "olx":
        return OlxSource()
    if name == "prozorro":
        return ProzorroSaleSource()
    if name == "domria":
        return DomRiaSource()
    return SampleSource()


def _truncate_listings() -> None:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("TRUNCATE gis.listings RESTART IDENTITY")
        conn.commit()


def run(source_name: str, truncate: bool = False) -> dict[str, int]:
    if truncate:
        _truncate_listings()
    source = _make_source(source_name)
    raw = list(source.fetch())
    clean = normalize(raw)
    loaded, mapped = load_listings(clean)
    metrics = recompute()
    return {
        "fetched": len(raw),
        "cleaned": len(clean),
        "loaded": loaded,
        "mapped": mapped,
        "metrics": metrics,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="ETL объявлений → агрегаты")
    ap.add_argument("--source", choices=list(SOURCES), default="sample")
    ap.add_argument("--truncate", action="store_true", help="очистить listings перед загрузкой")
    args = ap.parse_args()
    r = run(args.source, args.truncate)
    print(
        f"source={args.source} fetched={r['fetched']} cleaned={r['cleaned']} "
        f"loaded={r['loaded']} mapped={r['mapped']} metrics={r['metrics']}"
    )


if __name__ == "__main__":
    main()
