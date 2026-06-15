"""Telegram-бот экспресс-оценки (ТЗ §10.4) — верх воронки.

FSM: сегмент → операция → площадь → район → экспресс-оценка + апселл в кабинет.
Геокодирование адреса (Nominatim) отложено (нет внешней сети в dev); пока район
выбирается по названию через гео-поиск engine. Отдельный процесс (long-polling).

Запуск: cd apps/engine && uv run python -m bot.main  (нужен TELEGRAM_BOT_TOKEN).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)

from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("bot")

SITE_URL = "http://localhost:3000"  # на проде — публичный URL кабинета


class Form(StatesGroup):
    segment = State()
    operation = State()
    area = State()
    location = State()


def _kb(rows: list[list[tuple[str, str]]]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text=t, callback_data=d) for t, d in row] for row in rows
        ]
    )


dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message, state: FSMContext) -> None:
    await state.clear()
    await state.set_state(Form.segment)
    await message.answer(
        "👋 Вітаю! Я порахую орієнтовну вартість нерухомості.\n\nОберіть сегмент:",
        reply_markup=_kb(
            [
                [("🏢 Квартира", "seg:apartment"), ("🏠 Будинок", "seg:house")],
                [("🏬 Комерція", "seg:commercial"), ("🌳 Земля", "seg:land")],
            ]
        ),
    )


@dp.callback_query(Form.segment, F.data.startswith("seg:"))
async def pick_segment(cb: CallbackQuery, state: FSMContext) -> None:
    assert cb.data is not None
    await state.update_data(segment=cb.data.split(":")[1])
    await state.set_state(Form.operation)
    if isinstance(cb.message, Message):
        await cb.message.answer(
            "Операція:",
            reply_markup=_kb([[("💰 Продаж", "op:sale"), ("🔑 Оренда", "op:rent")]]),
        )
    await cb.answer()


@dp.callback_query(Form.operation, F.data.startswith("op:"))
async def pick_operation(cb: CallbackQuery, state: FSMContext) -> None:
    assert cb.data is not None
    await state.update_data(operation=cb.data.split(":")[1])
    await state.set_state(Form.area)
    if isinstance(cb.message, Message):
        await cb.message.answer("Введіть площу, м² (наприклад, 65):")
    await cb.answer()


@dp.message(Form.area)
async def enter_area(message: Message, state: FSMContext) -> None:
    try:
        area = float((message.text or "").replace(",", "."))
        if area <= 0:
            raise ValueError
    except ValueError:
        await message.answer("Вкажіть число, наприклад 65.")
        return
    await state.update_data(area=area)
    await state.set_state(Form.location)
    await message.answer("Введіть назву району (наприклад, «Вінницька р-н 1»):")


@dp.message(Form.location)
async def enter_location(message: Message, state: FSMContext) -> None:
    query = (message.text or "").strip()
    data = await state.get_data()
    base = settings.engine_base_url

    async with httpx.AsyncClient(base_url=base, timeout=15) as client:
        search = await client.get("/api/geo/search", params={"q": query})
        items = search.json().get("items", []) if search.status_code == 200 else []
        raion = next((i for i in items if i.get("level") == 2), items[0] if items else None)
        if not raion:
            await message.answer("Не знайшов таку одиницю. Спробуйте іншу назву.")
            return

        payload: dict[str, Any] = {
            "adminUnitId": raion["id"],
            "segment": data["segment"],
            "operation": data["operation"],
            "area": data["area"],
        }
        resp = await client.post("/api/valuation/express", json=payload)
        if resp.status_code != 200:
            await message.answer("Помилка оцінки. Спробуйте пізніше.")
            return
        r = resp.json()

    await state.clear()
    if r.get("comparablesCount", 0) == 0:
        await message.answer("Недостатньо аналогів для оцінки. Спробуйте інший район/сегмент.")
        return

    value = f"{r['value']:,.0f}".replace(",", " ")
    conf = int(r["confidence"] * 100)
    await message.answer(
        f"📊 Орієнтовна вартість: <b>{value} грн</b>\n"
        f"Довіра: {conf}% · аналогів: {r['comparablesCount']}\n\n"
        f"🔓 Детальний звіт з аналогами та корективами — у кабінеті:\n{SITE_URL}/pricing",
        parse_mode="HTML",
    )


async def run() -> None:
    token = settings.telegram_bot_token
    if not token:
        logger.warning("TELEGRAM_BOT_TOKEN не задан — бот не запускается (заполните .env).")
        return
    bot = Bot(token=token)
    logger.info("Бот запущен (long-polling).")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(run())
