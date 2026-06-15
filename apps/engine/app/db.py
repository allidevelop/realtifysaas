"""Подключение к PostgreSQL/PostGIS (ТЗ §9). Используется гео-API и ETL."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import DictRow, dict_row

from app.config import settings


def dsn() -> str:
    # libpq принимает и postgres://, и postgresql://.
    return settings.database_url


@contextmanager
def get_conn() -> Iterator[psycopg.Connection[DictRow]]:
    """Короткоживущее соединение. search_path = public, gis (из ALTER DATABASE)."""
    with psycopg.connect(dsn(), row_factory=dict_row) as conn:
        yield conn
