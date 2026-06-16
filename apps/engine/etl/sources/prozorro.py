"""Источник Prozorro.Продажі (Prozorro.Sale) — открытые аукционы недвижимости (ТЗ §3, Уровень 1).

Публичный OCDS-API без ключа. Лента `byDateModified` отдаёт ПОЛНЫЕ объекты аукционов;
пагинация — курсор по `dateModified` (последний элемент + 1мс). Фильтр недвижимости —
на клиенте по `items[].classification` (CAV: 04*=нерухомість, 06*=земля) и `itemType`.

ВАЖНО (см. DECISIONS): это аукционы гос/коммунального/арестованного/банкротного имущества,
преимущественно АРЕНДА и продажа арестованного — это «якорные» цены реальных сделок и
гео-датасет коммерции/земли, а НЕ репрезентативный поток жилых объявлений. Цена аренды —
периодическая (за месяц). Приоритет цены: реализованная (award/contract) → стартовая value.

Док: https://procedure.prozorro.sale/api
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from .base import RawListing

PROZORRO_API_BASE = os.getenv("PROZORRO_API_BASE", "https://procedure.prozorro.sale/api")

# sellingMethod-префиксы аренды/лизинга → operation=rent (остальное — sale).
_RENT_PREFIXES = ("legitimatepropertylease", "regulationspropertylease", "landrental")


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None


def _operation(selling_method: str) -> str:
    sm = (selling_method or "").lower()
    if sm.startswith(_RENT_PREFIXES) or "lease" in sm or "rental" in sm:
        return "rent"
    return "sale"


def _segment_and_area(item: dict[str, Any]) -> tuple[str | None, float | None]:
    """Сегмент (commercial/land/None) и площадь в м² из item классификации/reProps."""
    cls = item.get("classification") or {}
    cav = str(cls.get("id") or "")
    reprops = item.get("reProps") or {}
    unit = (item.get("unit") or {}).get("code")
    qty = _to_float(item.get("quantity"))

    area = _to_float(reprops.get("totalObjectArea")) or _to_float(reprops.get("usableArea"))
    if area is None:
        if unit == "MTK":  # квадратный метр
            area = qty
        elif unit == "HAR" and qty is not None:  # гектар → м²
            area = qty * 10_000.0

    if cav.startswith("06"):
        return "land", area
    if cav.startswith("04") or item.get("itemType") == "realEstate":
        # Держ/комун нерухомість — по умолчанию commercial (жильё среди них редкость).
        return "commercial", area
    return None, area


def _final_price(auction: dict[str, Any]) -> tuple[float | None, str]:
    """Реализованная цена (award→contract) приоритетнее стартовой value."""
    for aw in auction.get("awards") or []:
        if aw.get("status") == "active":
            v = aw.get("value") or {}
            p = _to_float(v.get("amount"))
            if p:
                return p, str(v.get("currency") or "UAH")
    for contract in auction.get("contracts") or []:
        v = contract.get("value") or {}
        p = _to_float(v.get("amount"))
        if p:
            return p, str(v.get("currency") or "UAH")
    v = auction.get("value") or {}
    return _to_float(v.get("amount")), str(v.get("currency") or "UAH")


def map_auction(auction: dict[str, Any], source: str = "prozorro") -> list[RawListing]:
    """Аукцион Prozorro.Sale → список нормализованных объявлений (по объектам недвижимости)."""
    operation = _operation(str(auction.get("sellingMethod") or ""))
    price, currency = _final_price(auction)
    published = str(auction.get("datePublished") or auction.get("dateModified") or "")[:10]
    base_id = str(auction.get("auctionId") or auction.get("_id") or "")
    url = auction.get("auctionUrl")

    out: list[RawListing] = []
    for item in auction.get("items") or []:
        segment, area = _segment_and_area(item)
        if segment is None:
            continue
        loc = item.get("location") or {}
        item_id = item.get("id")
        ext = f"{base_id}:{item_id}" if item_id else base_id
        out.append(
            RawListing(
                external_id=ext,
                segment=segment,
                operation=operation,
                area=area,
                price=price,
                currency=currency.upper(),
                lat=_to_float(loc.get("latitude")),
                lon=_to_float(loc.get("longitude")),
                published_at=published,
                source=source,
                url=url,
            )
        )
    return out


def _default_since() -> str:
    return (datetime.now(UTC) - timedelta(days=30)).strftime("%Y-%m-%d")


def _bump(iso: str) -> str:
    """Курсор пагинации: дата последнего элемента + 1мс (ISO с 'Z')."""
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except ValueError:
        return iso
    return (dt + timedelta(milliseconds=1)).strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"


class ProzorroSaleSource:
    name = "prozorro"

    def __init__(
        self, since: str | None = None, limit: int | None = None, max_pages: int | None = None
    ):
        self.since = since or os.getenv("PROZORRO_SINCE") or _default_since()
        # Бесплатный источник (без ключа), но env-контроль объёма прогона удобен для cron.
        self.limit = limit if limit is not None else int(os.getenv("PROZORRO_LIMIT", "100"))
        self.max_pages = (
            max_pages if max_pages is not None else int(os.getenv("PROZORRO_MAX_PAGES", "50"))
        )

    def fetch(self) -> Iterator[RawListing]:
        cursor = self.since
        with httpx.Client(
            base_url=PROZORRO_API_BASE,
            headers={"accept": "application/json"},
            timeout=60,
        ) as client:
            for _ in range(self.max_pages):
                resp = client.get(f"/search/byDateModified/{cursor}", params={"limit": self.limit})
                if resp.status_code != 200:
                    break
                batch = resp.json()
                if not isinstance(batch, list) or not batch:
                    break
                for auction in batch:
                    yield from map_auction(auction)
                last = batch[-1].get("dateModified")
                if not last:
                    break
                nxt = _bump(str(last))
                if nxt == cursor:  # защита от зацикливания
                    break
                cursor = nxt
