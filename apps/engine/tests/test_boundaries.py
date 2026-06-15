"""Тесты парсинга свойств GeoJSON-границ → admin_units (ТЗ §9)."""

from __future__ import annotations

from etl.import_boundaries import _parse_props


def test_parse_geoboundaries_props() -> None:
    # geoBoundaries: shapeName + shapeID, без украинского названия/населения.
    code, name, pop = _parse_props(
        {"shapeName": "Kyivska", "shapeID": "UKR-ADM1-X", "shapeISO": "UA-32"}
    )
    assert name == "Kyivska"
    assert code == "UA-32"  # shapeISO приоритетнее shapeID
    assert pop is None


def test_parse_katottg_props_prefers_ukrainian() -> None:
    # КАТОТТГ-датасет: украинское название + код КАТОТТГ + население.
    code, name, pop = _parse_props(
        {
            "name_uk": "Київська область",
            "katotth": "UA80000000000000000",
            "population": "2981000",
            "shapeName": "Kyiv",
        }
    )
    assert name == "Київська область"  # name_uk важнее shapeName
    assert code == "UA80000000000000000"
    assert pop == 2_981_000


def test_parse_props_fallback_and_bad_population() -> None:
    code, name, pop = _parse_props({"NAME": "Район X", "pop": "n/a"})
    assert name == "Район X"
    assert code is None
    assert pop is None  # некорректное население → None, без падения


def test_parse_props_empty() -> None:
    code, name, pop = _parse_props({})
    assert (code, name, pop) == (None, "—", None)
