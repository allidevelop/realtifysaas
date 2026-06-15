"""Нормализованное объявление и протокол источника (ТЗ §3, §10.3)."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass
class RawListing:
    external_id: str
    segment: str  # apartment/house/commercial/land
    operation: str  # sale/rent
    area: float | None
    price: float | None
    currency: str
    lat: float | None
    lon: float | None
    published_at: str  # YYYY-MM-DD
    source: str
    url: str | None = None


class Source(Protocol):
    name: str

    def fetch(self) -> Iterator[RawListing]: ...
