"""Генерация PDF рахунку-фактури и акта (ТЗ §11, безнал B2B).

Этап 5 (стаб): fpdf2 без LibreOffice — достаточно для локальной разработки.
TODO (прод): шаблон python-docx → headless LibreOffice → PDF, фирменный бланк.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Response
from fpdf import FPDF
from fpdf.enums import XPos, YPos

from app.schemas.billing import ActDocRequest, InvoiceDocRequest
from app.schemas.valuation import ValuationRequest
from app.valuation.comparative import value_property

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Кандидаты Unicode-шрифтов (кириллица): Windows (dev) и Linux (prod).
_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _money(minor: int) -> str:
    return f"{minor / 100:,.2f}".replace(",", " ")


class _Doc:
    def __init__(self) -> None:
        self.pdf = FPDF()
        self.pdf.add_page()
        self.font = "helvetica"
        for path in _FONT_CANDIDATES:
            if os.path.exists(path):
                self.pdf.add_font("uni", "", path)
                self.font = "uni"
                break

    def _enc(self, s: str) -> str:
        if self.font == "uni":
            return s
        return s.encode("latin-1", "replace").decode("latin-1")

    def line(self, s: str, size: int = 11) -> None:
        self.pdf.set_font(self.font, "", size)
        self.pdf.set_x(self.pdf.l_margin)
        self.pdf.multi_cell(
            self.pdf.epw, 7, self._enc(s), new_x=XPos.LMARGIN, new_y=YPos.NEXT
        )

    def gap(self, h: int = 3) -> None:
        self.pdf.ln(h)

    def output(self) -> bytes:
        return bytes(self.pdf.output())


def _render(req: InvoiceDocRequest, *, title: str, is_act: bool, paid_date: str = "") -> bytes:
    d = _Doc()
    d.line(f"{title} № {req.order_number} від {req.date}", size=15)
    d.gap()

    d.line(
        "Продавець: "
        f"{req.seller.name}, ЄДРПОУ {req.seller.edrpou or '—'}, ІПН {req.seller.ipn or '—'}"
    )
    if req.seller.iban:
        d.line(f"IBAN: {req.seller.iban} {req.seller.bank_name}")
    d.gap()
    d.line(
        "Покупець: "
        f"{req.buyer.name}, ЄДРПОУ {req.buyer.edrpou or '—'}, ІПН {req.buyer.ipn or '—'}"
    )
    if req.buyer.address:
        d.line(f"Адреса: {req.buyer.address}")
    d.gap()

    d.line("Найменування / Кіл-ть / Ціна / Сума", size=11)
    for i, it in enumerate(req.items, start=1):
        line_sum = it.price_minor * it.qty
        d.line(
            f"{i}. {it.title} — {it.qty} × {_money(it.price_minor)} = "
            f"{_money(line_sum)} {req.currency}"
        )
    d.gap()
    d.line(f"Разом до сплати: {_money(req.total_minor)} {req.currency}", size=13)
    d.gap()

    if is_act:
        d.line("Послуги надано в повному обсязі. Сторони претензій не мають.")
        if paid_date:
            d.line(f"Сплачено: {paid_date}")
    else:
        d.line("Спосіб оплати: безготівковий переказ на рахунок продавця.")
        d.line("Призначення платежу: оплата за доступ до сервісів за рахунком.")

    return d.output()


@router.post("/invoice")
def make_invoice(req: InvoiceDocRequest) -> Response:
    pdf = _render(req, title="РАХУНОК-ФАКТУРА", is_act=False)
    return Response(content=pdf, media_type="application/pdf")


@router.post("/act")
def make_act(req: ActDocRequest) -> Response:
    pdf = _render(req, title="АКТ наданих послуг", is_act=True, paid_date=req.paid_date)
    return Response(content=pdf, media_type="application/pdf")


@router.post("/valuation-doc")
def valuation_doc(req: ValuationRequest) -> Response:
    """Отчёт оценки (PDF) по детальной оценке (ТЗ §10.2)."""
    d = value_property(req)
    doc = _Doc()
    doc.line("ЗВІТ З ОЦІНКИ (експрес)", size=15)
    doc.gap()
    doc.line(f"Об'єкт: {req.segment}, операція: {req.operation}, площа: {req.area} м²")
    if d.admin_unit_name:
        doc.line(f"Локація: {d.admin_unit_name}")
    doc.gap()
    if d.comparables_count == 0:
        doc.line("Недостатньо аналогів для оцінки.")
        return Response(content=doc.output(), media_type="application/pdf")

    doc.line(f"Орієнтовна вартість: {d.value:,.0f} {d.currency}".replace(",", " "), size=13)
    doc.line(f"Ціна за м²: {d.price_per_sqm:,.0f} {d.currency}".replace(",", " "))
    doc.line(f"Довіра: {int(d.confidence * 100)}% · аналогів: {d.comparables_count}")
    doc.gap()

    if d.adjustments:
        doc.line("Корективи:")
        for a in d.adjustments:
            doc.line(f"  • {a.description}: ×{a.coefficient}")
        doc.gap()

    doc.line("Аналоги (топ за схожістю):")
    for c in d.comparables[:8]:
        doc.line(
            f"  • {c.area:.0f} м² — {c.price:,.0f} {d.currency} "
            f"({c.price_per_sqm:,.0f}/м², вага {c.weight})".replace(",", " ")
        )
    doc.gap()
    doc.line(d.methodology)
    return Response(content=doc.output(), media_type="application/pdf")
