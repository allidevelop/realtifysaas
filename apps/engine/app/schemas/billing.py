"""Pydantic-схемы биллинг-документов (ТЗ §11, §12).

Зеркалят TS-контракты из packages/shared-types/src/billing.ts. Изменение
контракта — синхронно в обоих местах + запись в DECISIONS.md.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class DocParty(BaseModel):
    """Сторона документа (продавец/покупатель)."""

    name: str
    edrpou: str = ""
    ipn: str = ""
    address: str = ""
    iban: str = ""
    bank_name: str = Field("", alias="bankName")
    vat: str = ""

    model_config = {"populate_by_name": True}


class DocItem(BaseModel):
    title: str
    qty: int = 1
    price_minor: int = Field(alias="priceMinor")

    model_config = {"populate_by_name": True}


class InvoiceDocRequest(BaseModel):
    """Запрос на рахунок-фактуру (безнал, B2B)."""

    order_number: str = Field(alias="orderNumber")
    date: str
    seller: DocParty
    buyer: DocParty
    items: list[DocItem]
    total_minor: int = Field(alias="totalMinor")
    currency: str = "UAH"

    model_config = {"populate_by_name": True}


class ActDocRequest(InvoiceDocRequest):
    """Запрос на акт виконаних робіт (после оплаты)."""

    paid_date: str = Field("", alias="paidDate")

    model_config = {"populate_by_name": True}
