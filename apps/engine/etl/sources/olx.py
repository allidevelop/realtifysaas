"""Источник OLX Partner API (ТЗ §3, Уровень 1).

OAuth2 (client_credentials) → Bearer + `Version: 2.0`; GET /adverts (offset/limit/
category_ids). Маппинг advert→RawListing. Точные id категорий и код атрибута
площади УТОЧНИТЬ по реальному ответу OLX (заданы дефолты/ENV).

Док: https://developer.olx.ua/api/doc  Base: https://www.olx.ua/api/partner
"""

from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Any

import httpx

from .base import RawListing


def _env(name: str, default: str) -> str:
    return os.getenv(name, default)


OLX_API_BASE = _env("OLX_API_BASE", "https://www.olx.ua/api/partner")
OLX_TOKEN_URL = _env("OLX_TOKEN_URL", "https://www.olx.ua/api/open/oauth/token")
OLX_AREA_ATTR = _env("OLX_AREA_ATTR", "total_area")  # код атрибута «площа»

# Категория OLX → (сегмент, операция). Дефолт совпадает с sample-фикстурой;
# на проде задать реальные id через ENV OLX_CATEGORY_MAP (JSON {"id":["seg","op"]}).
DEFAULT_CATEGORY_MAP: dict[int, tuple[str, str]] = {
    1: ("apartment", "sale"),
    2: ("apartment", "rent"),
    3: ("house", "sale"),
    4: ("commercial", "sale"),
    5: ("land", "sale"),
}


def category_map() -> dict[int, tuple[str, str]]:
    raw = os.getenv("OLX_CATEGORY_MAP")
    if not raw:
        return DEFAULT_CATEGORY_MAP
    parsed = json.loads(raw)
    return {int(k): (v[0], v[1]) for k, v in parsed.items()}


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", ".").replace(" ", ""))
    except ValueError:
        return None


def map_advert(
    advert: dict[str, Any],
    cmap: dict[int, tuple[str, str]] | None = None,
    source: str = "olx",
) -> RawListing | None:
    """OLX advert → нормализованное объявление (None — если не недвижимость/без данных)."""
    cmap = cmap or category_map()
    cat = advert.get("category_id")
    seg_op = cmap.get(int(cat)) if cat is not None else None
    if not seg_op:
        return None
    segment, operation = seg_op

    area: float | None = None
    for attr in advert.get("attributes", []):
        if attr.get("code") == OLX_AREA_ATTR:
            area = _to_float(attr.get("value") or attr.get("values"))
            break

    price = advert.get("price") or {}
    loc = advert.get("location") or {}
    created = str(advert.get("created_at") or advert.get("activated_at") or "")[:10]

    return RawListing(
        external_id=str(advert.get("id")),
        segment=segment,
        operation=operation,
        area=area,
        price=_to_float(price.get("value")),
        currency=str(price.get("currency") or "UAH").upper(),
        lat=_to_float(loc.get("latitude")),
        lon=_to_float(loc.get("longitude")),
        published_at=created,
        source=source,
        url=advert.get("url"),
    )


def _get_token() -> str:
    cid = os.getenv("OLX_CLIENT_ID", "")
    secret = os.getenv("OLX_CLIENT_SECRET", "")
    if not cid or not secret:
        raise RuntimeError("OLX_CLIENT_ID/OLX_CLIENT_SECRET не заданы в .env")
    resp = httpx.post(
        OLX_TOKEN_URL,
        data={
            "grant_type": "client_credentials",
            "client_id": cid,
            "client_secret": secret,
            "scope": "read",
        },
        timeout=30,
    )
    resp.raise_for_status()
    token = resp.json().get("access_token")
    if not token:
        raise RuntimeError("OLX не вернул access_token")
    return str(token)


class OlxSource:
    name = "olx"

    def __init__(self, category_ids: list[int] | None = None, limit: int = 50, max_pages: int = 40):
        self.category_ids = category_ids or list(category_map().keys())
        self.limit = limit
        self.max_pages = max_pages

    def fetch(self) -> Iterator[RawListing]:
        token = _get_token()
        cmap = category_map()
        with httpx.Client(
            base_url=OLX_API_BASE,
            headers={"Authorization": f"Bearer {token}", "Version": "2.0"},
            timeout=30,
        ) as client:
            offset = 0
            for _ in range(self.max_pages):
                resp = client.get(
                    "/adverts",
                    params={
                        "offset": offset,
                        "limit": self.limit,
                        "category_ids": ",".join(map(str, self.category_ids)),
                    },
                )
                if resp.status_code != 200:
                    break
                data = resp.json().get("data", [])
                if not data:
                    break
                for advert in data:
                    rl = map_advert(advert, cmap)
                    if rl:
                        yield rl
                offset += self.limit
