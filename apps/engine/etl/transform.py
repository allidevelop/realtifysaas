"""Очистка/нормализация объявлений (ТЗ §3 «Качество данных», §10.3).

Дедуп (source+external_id), нормализация валюты в UAH, отсев без площади/цены/
координат. Грубые выбросы по цене/м² отсекаются на шаге агрегации (IQR).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import replace

from .sources.base import RawListing

# Демо-курсы к UAH. На проде — курс НБУ на дату объявления.
DEFAULT_RATES = {"UAH": 1.0, "USD": 41.0, "EUR": 44.0}


def normalize(
    listings: Iterable[RawListing], rates: dict[str, float] | None = None
) -> list[RawListing]:
    rates = rates or DEFAULT_RATES
    seen: set[tuple[str, str]] = set()
    out: list[RawListing] = []
    for item in listings:
        if not item.area or item.area <= 0:
            continue
        if not item.price or item.price <= 0:
            continue
        if item.lat is None or item.lon is None:
            continue
        key = (item.source, item.external_id)
        if key in seen:
            continue
        seen.add(key)
        rate = rates.get(item.currency.upper(), 1.0)
        out.append(replace(item, price=round(item.price * rate, 2), currency="UAH"))
    return out
