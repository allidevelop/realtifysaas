"""API оценки (ТЗ §10.2): express (быстрая) и detailed (для отчёта)."""

from __future__ import annotations

from fastapi import APIRouter

from app.schemas.valuation import DetailedResult, ExpressResult, ValuationRequest
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
