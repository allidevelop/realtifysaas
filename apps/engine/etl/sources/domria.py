"""Источник DOM.RIA / DIM.RIA (developers.ria.com) — основной поток объявлений (ТЗ §3, Уровень 1).

Публичный REST/JSON API по `api_key` (query-параметр). Поиск `/dom/search` отдаёт массив
realty_id + count; детали — `/dom/info/{id}`. Поиск ведём по группам (сегмент/операция →
category/realty_type/operation_type).

Лимиты freemium: 1000 запросов/мес и 30/час (HTTP 429 при превышении) — коннектор
консервативен (малые max_pages/max_items, стоп при 429). ToS: при показе данных обязателен
ВИДИМЫЙ ИНДЕКСИРУЕМЫЙ бэклинк на dom.ria.com (фронт; см. DECISIONS). Точные коды
комерції/землі/оренди уточнять через `/dom/options` — заданы документированные дефолты + ENV.

Док: https://developers.ria.com/dom_ria/
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Any

import httpx

from .base import RawListing

DOMRIA_API_BASE = os.getenv("DOMRIA_API_BASE", "https://developers.ria.com")

# Группы поиска: (segment, operation, category, realty_type, operation_type).
# operation_type: 1=продаж (подтверждено доками), 3=оренда (по конвенции сайта — уточнить
# через /dom/options). Документированы apartment(cat1/type2) и house(cat4/type7).
SearchGroup = tuple[str, str, int, int, int]
DEFAULT_SEARCH_GROUPS: list[SearchGroup] = [
    ("apartment", "sale", 1, 2, 1),
    ("apartment", "rent", 1, 2, 3),
    ("house", "sale", 4, 7, 1),
]

# Символ валюты → код; запасной путь — characteristics_values["242"] (239/240/241).
_CURRENCY_SYMBOL = {"$": "USD", "грн": "UAH", "₴": "UAH", "€": "EUR"}
_CURRENCY_CODE = {239: "USD", 240: "UAH", 241: "EUR"}


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None


def search_groups() -> list[SearchGroup]:
    raw = os.getenv("DOMRIA_SEARCH_GROUPS")
    if not raw:
        return DEFAULT_SEARCH_GROUPS
    parsed = json.loads(raw)
    return [(g[0], g[1], int(g[2]), int(g[3]), int(g[4])) for g in parsed]


def _currency(info: dict[str, Any]) -> str:
    sym = str(info.get("currency_type") or "").strip()
    if sym in _CURRENCY_SYMBOL:
        return _CURRENCY_SYMBOL[sym]
    cv = (info.get("characteristics_values") or {}).get("242")
    try:
        return _CURRENCY_CODE.get(int(cv), "UAH") if cv is not None else "UAH"
    except (TypeError, ValueError):
        return "UAH"


def map_info(
    info: dict[str, Any], segment: str, operation: str, source: str = "domria"
) -> RawListing | None:
    """DOM.RIA info-объект → нормализованное объявление (segment/operation — из группы поиска)."""
    rid = info.get("realty_id")
    if rid is None:
        return None
    # is_commercial уточняет сегмент (офис/коммерция в жилом поиске не ожидается, но на всякий).
    seg = "commercial" if info.get("is_commercial") in (1, "1", True) else segment
    bu = info.get("beautiful_url")
    published = str(info.get("publishing_date") or info.get("created_at") or "")[:10]
    raw_price = info.get("price") if info.get("price") is not None else info.get("price_total")
    return RawListing(
        external_id=str(rid),
        segment=seg,
        operation=operation,
        area=_to_float(info.get("total_square_meters")),
        price=_to_float(raw_price),
        currency=_currency(info),
        lat=_to_float(info.get("latitude")),
        lon=_to_float(info.get("longitude")),
        published_at=published,
        source=source,
        url=f"https://dom.ria.com/{bu}" if bu else None,
    )


class DomRiaSource:
    name = "domria"

    def __init__(
        self,
        groups: list[SearchGroup] | None = None,
        max_pages: int = 1,
        max_items: int = 25,
    ):
        self.api_key = os.getenv("DOMRIA_API_KEY", "")
        self.groups = groups or search_groups()
        self.max_pages = max_pages
        # Жёсткий предел info-запросов за прогон — держим под лимитом 30/час.
        self.max_items = max_items
        self.state_id = os.getenv("DOMRIA_STATE_ID")

    def fetch(self) -> Iterator[RawListing]:
        if not self.api_key:
            raise RuntimeError("DOMRIA_API_KEY не задан в .env (получить на developers.ria.com)")
        fetched = 0
        with httpx.Client(
            base_url=DOMRIA_API_BASE,
            headers={"accept": "application/json"},
            timeout=30,
        ) as client:
            for segment, operation, category, realty_type, operation_type in self.groups:
                for page in range(self.max_pages):
                    if fetched >= self.max_items:
                        return
                    params: dict[str, Any] = {
                        "api_key": self.api_key,
                        "category": category,
                        "realty_type": realty_type,
                        "operation_type": operation_type,
                        "page": page,
                    }
                    if self.state_id:
                        params["state_id"] = self.state_id
                    resp = client.get("/dom/search", params=params)
                    if resp.status_code == 429:  # лимит исчерпан — корректный стоп
                        return
                    if resp.status_code != 200:
                        break
                    ids = resp.json().get("items", [])
                    if not ids:
                        break
                    for rid in ids:
                        if fetched >= self.max_items:
                            return
                        info_resp = client.get(f"/dom/info/{rid}", params={"api_key": self.api_key})
                        fetched += 1
                        if info_resp.status_code == 429:
                            return
                        if info_resp.status_code != 200:
                            continue
                        rl = map_info(info_resp.json(), segment, operation)
                        if rl:
                            yield rl
