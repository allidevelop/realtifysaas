"""Тест генерации PDF счёта/акта (ТЗ §11)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_REQ = {
    "orderNumber": "RT-20260615-0001",
    "date": "15.06.2026",
    "seller": {"name": "ФОП Тест", "edrpou": "1234567890", "iban": "UA00...", "bankName": "Mono"},
    "buyer": {"name": "ТОВ Банк", "edrpou": "0987654321", "ipn": "111", "address": "Київ"},
    "items": [{"title": "Експрес оцінка — 20", "qty": 1, "priceMinor": 200000}],
    "totalMinor": 200000,
    "currency": "UAH",
}


def test_invoice_pdf() -> None:
    resp = client.post("/api/reports/invoice", json=_REQ)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"


def test_act_pdf() -> None:
    resp = client.post("/api/reports/act", json={**_REQ, "paidDate": "16.06.2026"})
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"
