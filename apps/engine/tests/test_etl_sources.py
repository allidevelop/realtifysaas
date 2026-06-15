"""Тесты мапперов источников Prozorro.Sale и DOM.RIA → RawListing (ТЗ §3).

Фикстуры — сокращённые реальные ответы API (без сети/ключей/БД).
"""

from __future__ import annotations

from etl.sources.domria import map_info
from etl.sources.prozorro import map_auction
from etl.transform import normalize

# --- Prozorro.Sale -----------------------------------------------------------

PROZORRO_LEASE = {
    "_id": "6564a1636665096a8b43c637",
    "auctionId": "LLE001-UA-20231127-57961",
    "auctionUrl": "https://auction.prozorro.sale/LLE001-UA-20231127-57961",
    "sellingMethod": "legitimatePropertyLease-english",
    "datePublished": "2023-11-27T14:02:11.503000Z",
    "dateModified": "2024-01-01T06:15:49.086000Z",
    "value": {"amount": 904.24, "currency": "UAH"},
    "items": [
        {
            "id": "item1",
            "itemType": "realEstate",
            "classification": {"scheme": "CAV", "id": "04000000-8"},
            "quantity": 27.37,
            "unit": {"code": "MTK"},
            "location": {"latitude": "49.8367386", "longitude": "35.61501099999999"},
            "reProps": {"totalObjectArea": 27.37, "usableArea": 21.0},
        }
    ],
    "awards": [{"status": "active", "value": {"amount": 6000.0, "currency": "UAH"}}],
    "contracts": [{"value": {"amount": 6000.0}}],
}

PROZORRO_LAND_SALE = {
    "auctionId": "LSE001-UA-1",
    "auctionUrl": "https://auction.prozorro.sale/LSE001-UA-1",
    "sellingMethod": "landSell-english",
    "datePublished": "2024-02-01T10:00:00.000000Z",
    "value": {"amount": 100000.0, "currency": "UAH"},
    "items": [
        {
            "id": "land1",
            "classification": {"scheme": "CAV", "id": "06121000-6"},
            "quantity": 0.5,
            "unit": {"code": "HAR"},
            "location": {"latitude": "50.0", "longitude": "30.0"},
        }
    ],
}


def test_prozorro_lease_real_estate() -> None:
    rls = map_auction(PROZORRO_LEASE)
    assert len(rls) == 1
    rl = rls[0]
    assert rl.operation == "rent"
    assert rl.segment == "commercial"
    assert rl.area == 27.37
    assert rl.price == 6000.0  # реализованная (award) важнее стартовой 904.24
    assert rl.currency == "UAH"
    assert rl.lat == 49.8367386
    assert rl.published_at == "2023-11-27"
    assert rl.external_id == "LLE001-UA-20231127-57961:item1"
    assert rl.source == "prozorro"


def test_prozorro_land_sale_hectares_to_sqm() -> None:
    rls = map_auction(PROZORRO_LAND_SALE)
    assert len(rls) == 1
    rl = rls[0]
    assert rl.operation == "sale"
    assert rl.segment == "land"
    assert rl.area == 5000.0  # 0.5 га → 5000 м²
    assert rl.price == 100000.0


def test_prozorro_skips_non_real_estate() -> None:
    auction = {
        "auctionId": "X-1",
        "sellingMethod": "basicSell-english",
        "value": {"amount": 1.0, "currency": "UAH"},
        "items": [{"id": "v", "classification": {"scheme": "CAV", "id": "99000000-0"}}],
    }
    assert map_auction(auction) == []


# --- DOM.RIA -----------------------------------------------------------------

DOMRIA_INFO = {
    "realty_id": 13825265,
    "price": 60000,
    "currency_type": "$",
    "total_square_meters": 93,
    "latitude": "50.39161687881484",
    "longitude": "30.480281005166944",
    "publishing_date": "2017-10-02 14:51:07",
    "is_commercial": 0,
    "beautiful_url": "realty-prodaja-kvartira-kiev-13825265.html",
    "characteristics_values": {"242": 239},
}


def test_domria_info_apartment_sale() -> None:
    rl = map_info(DOMRIA_INFO, "apartment", "sale")
    assert rl is not None
    assert rl.external_id == "13825265"
    assert rl.segment == "apartment"
    assert rl.operation == "sale"
    assert rl.area == 93.0
    assert rl.price == 60000.0
    assert rl.currency == "USD"
    assert rl.lat == 50.39161687881484
    assert rl.published_at == "2017-10-02"
    assert rl.url == "https://dom.ria.com/realty-prodaja-kvartira-kiev-13825265.html"


def test_domria_currency_fallback_to_characteristics() -> None:
    info = {**DOMRIA_INFO, "currency_type": "", "characteristics_values": {"242": 240}}
    rl = map_info(info, "apartment", "sale")
    assert rl is not None
    assert rl.currency == "UAH"


def test_domria_commercial_flag_overrides_segment() -> None:
    info = {**DOMRIA_INFO, "is_commercial": 1}
    rl = map_info(info, "apartment", "sale")
    assert rl is not None
    assert rl.segment == "commercial"


def test_mapped_listings_pass_normalize_with_currency_conversion() -> None:
    # USD 60000 → UAH по демо-курсу 41 = 2_460_000; запись проходит фильтры normalize.
    rl = map_info(DOMRIA_INFO, "apartment", "sale")
    assert rl is not None
    out = normalize([rl])
    assert len(out) == 1
    assert out[0].currency == "UAH"
    assert out[0].price == 2_460_000.0
