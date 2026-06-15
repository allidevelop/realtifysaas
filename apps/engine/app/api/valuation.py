"""API оценки (ТЗ §10.2): express (быстрая) и detailed (для отчёта)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.valuation import (
    BatchRequest,
    BatchResult,
    BatchResultItem,
    DetailedResult,
    ExpressResult,
    ValuationRequest,
)
from app.valuation.comparative import value_property

router = APIRouter(prefix="/api/valuation", tags=["valuation"])


@router.post("/express", response_model=ExpressResult)
def express(req: ValuationRequest) -> ExpressResult:
    """Экспресс-оценка: {value, currency, confidence, comparablesCount}. ≤ 1–2 c."""
    d = value_property(req)
    return ExpressResult(
        value=d.value,
        currency=d.currency,
        confidence=d.confidence,
        comparablesCount=d.comparables_count,
    )


@router.post("/detailed", response_model=DetailedResult)
def detailed(req: ValuationRequest) -> DetailedResult:
    """Детальная оценка: результат + аналоги + корректировки (для отчёта)."""
    return value_property(req)


@router.post("/batch", response_model=BatchResult)
def batch(req: BatchRequest) -> BatchResult:
    """Портфельна (пакетная) оценка массива объектов одной выборкой (ТЗ §10.1)."""
    items: list[BatchResultItem] = []
    total = 0.0
    valued = 0
    for it in req.items[:500]:  # предохранитель на размер пакета
        d = value_property(
            ValuationRequest.model_validate(
                {
                    "adminUnitId": it.admin_unit_id,
                    "lat": it.lat,
                    "lon": it.lon,
                    "segment": it.segment,
                    "operation": it.operation,
                    "area": it.area,
                }
            )
        )
        if d.comparables_count > 0:
            total += d.value
            valued += 1
        items.append(
            BatchResultItem(
                label=it.label,
                value=d.value,
                pricePerSqm=d.price_per_sqm,
                confidence=d.confidence,
                comparablesCount=d.comparables_count,
                adminUnitName=d.admin_unit_name,
            )
        )
    return BatchResult(items=items, total=round(total, 0), count=len(items), valued=valued)
