"""Схемы оценки (ТЗ §10.1, §10.2, §12). Зеркало packages/shared-types/valuation.ts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ValuationRequest(BaseModel):
    admin_unit_id: int | None = Field(None, alias="adminUnitId")
    lon: float | None = None
    lat: float | None = None
    segment: str = "apartment"
    operation: str = "sale"
    area: float = Field(..., gt=0)
    period: str | None = None
    floor: int | None = None
    total_floors: int | None = Field(None, alias="totalFloors")

    model_config = {"populate_by_name": True}


class Comparable(BaseModel):
    id: int
    area: float
    price: float
    price_per_sqm: float = Field(alias="pricePerSqm")
    distance_m: float = Field(alias="distanceM")
    published_at: str | None = Field(None, alias="publishedAt")
    weight: float

    model_config = {"populate_by_name": True}


class Adjustment(BaseModel):
    factor: str
    description: str
    coefficient: float


class ExpressResult(BaseModel):
    value: float
    currency: str = "UAH"
    confidence: float
    comparables_count: int = Field(alias="comparablesCount")

    model_config = {"populate_by_name": True}


class DetailedResult(ExpressResult):
    price_per_sqm: float = Field(alias="pricePerSqm")
    admin_unit_name: str | None = Field(None, alias="adminUnitName")
    period: str | None = None
    comparables: list[Comparable] = []
    adjustments: list[Adjustment] = []
    methodology: str = ""


# Портфельна оцінка — пакетная оценка массива объектов (ТЗ §10.1; аналог референса).
class BatchItem(BaseModel):
    label: str = ""
    admin_unit_id: int | None = Field(None, alias="adminUnitId")
    lat: float | None = None
    lon: float | None = None
    segment: str = "apartment"
    operation: str = "sale"
    area: float = Field(..., gt=0)

    model_config = {"populate_by_name": True}


class BatchRequest(BaseModel):
    items: list[BatchItem]


class BatchResultItem(BaseModel):
    label: str = ""
    value: float
    price_per_sqm: float = Field(alias="pricePerSqm")
    confidence: float
    comparables_count: int = Field(alias="comparablesCount")
    admin_unit_name: str | None = Field(None, alias="adminUnitName")

    model_config = {"populate_by_name": True}


class BatchResult(BaseModel):
    items: list[BatchResultItem]
    total: float
    count: int
    valued: int
