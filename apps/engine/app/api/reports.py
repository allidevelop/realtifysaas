"""Генерация PDF рахунку-фактури и акта (ТЗ §11, безнал B2B).

Этап 5 (стаб): fpdf2 без LibreOffice — достаточно для локальной разработки.
TODO (прод): шаблон python-docx → headless LibreOffice → PDF, фирменный бланк.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Response
from fpdf import FPDF
from fpdf.enums import XPos, YPos
from psycopg.rows import dict_row
from pydantic import BaseModel

from app.db import get_conn
from app.schemas.billing import ActDocRequest, InvoiceDocRequest
from app.schemas.valuation import ValuationRequest
from app.valuation.comparative import value_property

router = APIRouter(prefix="/api/reports", tags=["reports"])

# Демо-курс UAH→USD для отчёта (на проде — курс НБУ на дату; см. transform.DEFAULT_RATES).
REPORT_USD_RATE = float(os.getenv("REPORT_USD_RATE", "41"))
BRAND = (16, 122, 101)  # фирменный зелёный
HEAD_FILL = (224, 242, 238)
MONTHS_UA = [
    "", "січень", "лютий", "березень", "квітень", "травень", "червень",
    "липень", "серпень", "вересень", "жовтень", "листопад", "грудень",
]
SEG_LABEL = {
    "apartment": "Вторинний ринок квартир",
    "house": "Домоволодіння",
    "commercial": "Офісна / комерційна нерухомість",
    "land": "Земельні ділянки",
}
OP_LABEL = {"sale": "продаж", "rent": "оренда"}

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

    def new_page(self) -> None:
        self.pdf.add_page()

    def cover(self, region: str, period_label: str, segment: str, operation: str) -> None:
        pdf = self.pdf
        pdf.set_fill_color(*BRAND)
        pdf.rect(0, 60, 210, 46, style="F")
        pdf.set_text_color(255, 255, 255)
        pdf.set_font(self.font, "", 26)
        pdf.set_xy(0, 70)
        pdf.cell(210, 14, self._enc("НЕРУХОМІСТЬ УКРАЇНИ"), align="C")
        pdf.set_font(self.font, "", 16)
        pdf.set_xy(0, 89)
        pdf.cell(210, 10, self._enc(region), align="C")
        pdf.set_text_color(40, 40, 40)
        pdf.set_font(self.font, "", 14)
        pdf.set_xy(0, 122)
        pdf.cell(210, 8, self._enc(period_label), align="C")
        pdf.set_font(self.font, "", 12)
        pdf.set_xy(0, 135)
        pdf.cell(210, 7, self._enc(f"{segment} · {operation}"), align="C")
        pdf.set_xy(0, 145)
        sub = "Аналітичні дослідження тенденцій зміни цінових показників"
        pdf.cell(210, 7, self._enc(sub), align="C")
        pdf.set_text_color(0, 0, 0)

    def band(self, text: str, size: int = 13) -> None:
        pdf = self.pdf
        pdf.set_fill_color(*BRAND)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font(self.font, "", size)
        pdf.set_x(pdf.l_margin)
        pdf.cell(pdf.epw, 9, self._enc(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)

    def table(
        self, headers: list[str], rows: list[list[str]], widths: list[float] | None = None
    ) -> None:
        pdf = self.pdf
        n = len(headers)
        widths = widths or [pdf.epw / n] * n
        pdf.set_font(self.font, "", 9)
        pdf.set_fill_color(*HEAD_FILL)
        pdf.set_x(pdf.l_margin)
        for h, w in zip(headers, widths, strict=False):
            pdf.cell(w, 7, self._enc(str(h)), border=1, fill=True, align="C")
        pdf.ln()
        for row in rows:
            pdf.set_x(pdf.l_margin)
            for v, w in zip(row, widths, strict=False):
                pdf.cell(w, 6, self._enc(str(v)), border=1, align="C")
            pdf.ln()

    def bars(self, labels: list[str], values: list[float]) -> None:
        pdf = self.pdf
        vals = [float(v) for v in values]
        if not vals:
            return
        x0, y0 = pdf.l_margin, pdf.get_y() + 2
        w, h = pdf.epw, 40.0
        vmax = max(vals) or 1.0
        gap = 3.0
        bw = (w - gap * (len(vals) + 1)) / len(vals)
        base = y0 + h
        pdf.set_draw_color(210, 210, 210)
        pdf.line(x0, base, x0 + w, base)
        pdf.set_fill_color(*BRAND)
        pdf.set_font(self.font, "", 7)
        for i, (lab, val) in enumerate(zip(labels, vals, strict=False)):
            bh = (val / vmax) * (h - 7)
            bx = x0 + gap + i * (bw + gap)
            by = base - bh
            pdf.rect(bx, by, bw, bh, style="F")
            pdf.set_xy(bx - 2, by - 4.5)
            pdf.cell(bw + 4, 4, self._enc(f"{val:,.0f}".replace(",", " ")), align="C")
            pdf.set_xy(bx - 3, base + 1)
            pdf.cell(bw + 6, 4, self._enc(str(lab)[:10]), align="C")
        pdf.set_y(base + 7)

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


class StatReportRequest(BaseModel):
    adminUnitId: int
    segment: str = "apartment"
    operation: str = "sale"


def _to_quarters(series: list[tuple[str, float]]) -> list[tuple[str, float]]:
    acc: dict[str, list[float]] = {}
    for p, v in series:
        y, m = p.split("-")
        key = f"{y} Q{(int(m) - 1) // 3 + 1}"
        acc.setdefault(key, []).append(v)
    return [(k, sum(vs) / len(vs)) for k, vs in sorted(acc.items())]


def _uah(v: float) -> str:
    return f"{v:,.0f}".replace(",", " ")


@router.post("/stat-report")
def stat_report(req: StatReportRequest) -> Response:
    """Статистичний звіт середніх цін по АТЕ/періодах (аналог «Генератор звітів»)."""
    seg = SEG_LABEL.get(req.segment, req.segment)
    op = OP_LABEL.get(req.operation, req.operation)
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT a.id, a.name, a.level, p.name AS parent "
            "FROM gis.admin_units a LEFT JOIN gis.admin_units p ON p.id = a.parent_id "
            "WHERE a.id = %s",
            (req.adminUnitId,),
        )
        unit = cur.fetchone()
        if not unit:
            d0 = _Doc()
            d0.line("Територіальну одиницю не знайдено.")
            return Response(content=d0.output(), media_type="application/pdf")
        cur.execute(
            "SELECT period, value FROM gis.aggregated_metrics "
            "WHERE admin_unit_id = %s AND segment = %s AND operation = %s "
            "AND metric_type = 'avg_price_sqm' ORDER BY period",
            (req.adminUnitId, req.segment, req.operation),
        )
        series = [(r["period"], float(r["value"])) for r in cur.fetchall()]
        cur.execute(
            """
            SELECT a.name AS name,
                   (SELECT value FROM gis.aggregated_metrics m WHERE m.admin_unit_id = a.id
                      AND m.segment = %(seg)s AND m.operation = %(op)s
                      AND m.metric_type = 'avg_price_sqm' ORDER BY period DESC LIMIT 1) AS latest
              FROM gis.admin_units a WHERE a.parent_id = %(uid)s ORDER BY a.name
            """,
            {"seg": req.segment, "op": req.operation, "uid": req.adminUnitId},
        )
        children = [r for r in cur.fetchall() if r["latest"] is not None]

    region = f"{unit['name']} ({unit['parent']})" if unit["parent"] else unit["name"]
    last_p = series[-1][0] if series else "—"
    first_p = series[0][0] if series else "—"
    period_label = (
        f"{MONTHS_UA[int(last_p.split('-')[1])]} {last_p.split('-')[0]}" if series else "—"
    )

    d = _Doc()
    d.cover(region, period_label, seg, op)

    d.new_page()
    d.band(f"{region} · {seg} · {op}")
    d.line(
        "Аналітичний звіт сформовано з агрегованих даних геоінформаційної системи про середню "
        "вартість нерухомості у розрізі територіального поділу, сегмента ринку та типу операції. "
        "Показники наведені у гривні (грн) та доларах США (USD) за кв.м."
    )
    d.gap()

    if not series:
        d.line("Недостатньо даних для обраної території/сегмента.")
        return Response(content=d.output(), media_type="application/pdf")

    months = [MONTHS_UA[int(p.split("-")[1])] for p, _ in series]
    d.band("Динаміка середньої вартості кв.м (помісячно)")
    d.line("Грн / кв.м:", size=10)
    d.bars(months, [v for _, v in series])
    d.line("USD / кв.м:", size=10)
    d.bars(months, [v / REPORT_USD_RATE for _, v in series])

    quarters = _to_quarters(series)
    if len(quarters) >= 2:
        d.new_page()
        d.band("Динаміка середньої вартості кв.м (поквартально)")
        d.line("Грн / кв.м:", size=10)
        d.bars([k for k, _ in quarters], [v for _, v in quarters])
        d.line("USD / кв.м:", size=10)
        d.bars([k for k, _ in quarters], [v / REPORT_USD_RATE for _, v in quarters])

    cur_uah, first_uah = series[-1][1], series[0][1]
    delta = (cur_uah / first_uah - 1) * 100 if first_uah else 0.0
    dlt = f"{delta:+.1f}%"
    first_usd, cur_usd = first_uah / REPORT_USD_RATE, cur_uah / REPORT_USD_RATE
    d.gap()
    d.band(f"Зміна показників: {first_p} → {last_p}")
    d.table(
        ["Показник", first_p, last_p, "Зміна"],
        [
            ["Грн / кв.м", _uah(first_uah), _uah(cur_uah), dlt],
            ["USD / кв.м", _uah(first_usd), _uah(cur_usd), dlt],
        ],
    )

    if children:
        d.new_page()
        d.band("Середня вартість кв.м у розрізі підпорядкованих одиниць")
        rows = [
            [c["name"], _uah(float(c["latest"])), _uah(float(c["latest"]) / REPORT_USD_RATE)]
            for c in children
        ]
        d.table(
            ["Одиниця", "Грн / кв.м", "USD / кв.м"],
            rows,
            widths=[d.pdf.epw * 0.5, d.pdf.epw * 0.25, d.pdf.epw * 0.25],
        )

    d.gap()
    d.line("Джерело: агреговані дані ГІС (демонстраційні). Курс USD — демо-константа.", size=8)
    return Response(content=d.output(), media_type="application/pdf")
