"""Sample-источник: фикстура OLX-формата для локального e2e без сети/ключей.

Прогоняет те же adverts через реальный map_advert (тестирует и маппинг OLX).
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

from .base import RawListing
from .olx import map_advert

_FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "olx_sample.json"


class SampleSource:
    name = "sample"

    def fetch(self) -> Iterator[RawListing]:
        data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
        for advert in data.get("data", []):
            rl = map_advert(advert, source="sample")
            if rl:
                yield rl
