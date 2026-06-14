"""Pydantic-схемы — дублируют контракты из packages/shared-types (ТЗ §12)."""

from __future__ import annotations

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Зеркало TS-типа HealthResponse из @realtify/shared-types."""

    status: str = "ok"
    service: str
    version: str
