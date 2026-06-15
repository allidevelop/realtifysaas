# CLAUDE.md

Операционная инструкция для агента. **Источник истины по требованиям** — `TZ-geoanalytics-uvecon-v2-commercial.md` (читать перед каждой сессией вместе с `PROGRESS.md`).

## Что это за проект
**Коммерческий** геоаналитический продукт по рынку недвижимости (конкурент gisuvecon.com). Монетизация — подписки на инструменты + продажа аналитики + публичный API. Это собственный продукт владельца (не заказ клиента), но полноценный бизнес.

> **Режим разработки сейчас: ЛОКАЛЬНО.** Прод (Nginx/PM2/SSL/бэкапы/мониторинг) — этап 7 roadmap, реальная цель, не «навсегда отложено». Биллинг, публичный API и сбор данных — В SCOPE (соответствующие этапы), просто не в самом начале. Платёжные боевые ключи — только на проде.

## Архитектура
Монорепо из двух приложений + одна БД с двумя схемами:
- `apps/web` — Next.js 15 (App Router) + Payload CMS 3. Сайт, кабинет, магазин, админка контента и биллинга.
- `apps/engine` — Python (FastAPI + ETL + aiogram-бот + публичный API). Движок оценки, гео-API, бот.
- PostgreSQL: схема `public` (Payload) + схема `gis` (PostGIS). Redis — кэш агрегатов/квот.
- `packages/shared-types` — общие TS-типы (контракты API), дублируются Pydantic-схемами в engine.

## Локальный запуск
```bash
cp .env.example .env
docker compose up -d                              # Postgres+PostGIS, Redis
pnpm --filter web dev                             # http://localhost:3000, /admin
pnpm --filter web payload migrate                 # миграции Payload
cd apps/engine && uv run uvicorn app.main:app --reload   # http://localhost:8000
```

## Команды
- Линт/типы (web): `pnpm lint`, `pnpm typecheck`
- Линт/типы (engine): `uv run ruff check`, `uv run mypy`; тесты: `uv run pytest`
- БД: `docker compose up -d` / `down` (данные в volume `pgdata`); сброс начисто: `docker compose down -v`
- Payload codegen (web): `pnpm --filter web generate:types` и `generate:importmap` — после изменения коллекций/полей.
- Seed демо-контента: `GET /seed?secret=$PAYLOAD_SECRET` на dev-сервере (`pnpm --filter web seed` падает на Node 26 — баг tsx, см. DECISIONS).
- Порты на хосте: Postgres-контейнер — **5433** (5432 занят локальной службой); Redis-контейнер — **6380** (6379 занят Memurai). `DATABASE_URL=...localhost:5433/geo`, `REDIS_URL=redis://localhost:6380`.

## Биллинг и кабинет (этапы 5–6)
- Модель — **пакеты квот по модулям** (Modules/ServicePlans-пакеты/Entitlements/Orders/Organizations/PaymentEvents). Деньги — копейки (`priceMinor`/`totalMinor`).
- Движок: `apps/web/src/lib/billing/*` (entitlements/quota/fulfillment/providers/checkout/renewals/documents). Гейтинг: `middleware.ts` (presence) + `requireUser` в страницах.
- Платежи: `PAYMENTS_PROVIDER=mock|monobank`. Локальный e2e — мок-провайдер + `/account/mock-pay`. Вебхуки: `/webhooks/{provider}` (подпись + идемпотентность). Боевые ключи Monobank — только на проде.
- **Seats (корп-доступ):** entitlement может принадлежать организации (`Entitlement.organization`); член видит её через `User.organization`. Резолв доступа org-aware (`getUserEntitlements`/`resolveModuleAccess`: `or: [{user},{organization}]`). Управление — `/account/organization`; корп-покупка — чекбокс «для організації» (→ `order.organization`).
- **Авто-рекуррент period + dunning:** `lib/billing/renewals.processRenewals` через cron-роут `GET|POST /cron/renewals?secret=$CRON_SECRET` (∥ PAYLOAD_SECRET). Продление по `chargeByToken` (mock детерминированный: токен с `fail`→отказ); отказ → `past_due`+`pastDueUntil` (грейс в гейтинге), грейс истёк → `expired`. Тоггл авто-продления — в `/account/billing`.
- Безнал PDF: engine `POST /api/reports/{invoice,act}` (fpdf2-стаб; прод — docx+LibreOffice); выдача через `/account/orders/[id]/{invoice,act}`.
- Engine для PDF: `cd apps/engine && uv run uvicorn app.main:app --reload` (нужен для безнала).

## Геопортал (этап 2)
- Схема: `psql ... -f infra/sql/02-gis-admin.sql` (на первом старте тома — авто).
- Импорт границ: `cd apps/engine && uv run python -m etl.import_boundaries` (синтетика-демо). Реальные данные: `... --source geojson --adm1 adm1.geojson --adm2 adm2.geojson` (geoBoundaries/COD-AB, CC BY 4.0). **Реальные границы/метрики — этап 3** (в dev нет внешней сети).
- Гео-API (engine): `/api/geo/{units,metrics,search,meta}`. Карта: `/account/geoportal` (react-leaflet, `ssr:false`); прокси с freemium — `/account/geoportal/data/*`.

## Оценка и бот (этап 4)
- Демо-объявления: `cd apps/engine && uv run python -m etl.generate_listings` (нужны после import_boundaries). Реальные — этап 3.
- Движок оценки (engine): `/api/valuation/{express,detailed}`, отчёт PDF `/api/reports/valuation-doc`. Модули кабинета: `/account/{express-valuation,appraiser-calculator,report-generator}`.
- Telegram-бот (отдельный процесс): `cd apps/engine && uv run python -m bot.main` (нужен `TELEGRAM_BOT_TOKEN`; без него — graceful-выход).
- Server actions нельзя драйвить из curl (Flight+Origin) — интерактивные формы проверять в браузере.

## Данные / ETL (этап 3)
- Конвейер: `cd apps/engine && uv run python -m etl.pipeline --source sample` (локально) | `--source olx` (реальный, нужны `OLX_CLIENT_ID/SECRET` + сеть) | `--truncate` (очистка listings).
- Шаги: `etl/sources/{olx,sample}` → `etl/transform` (дедуп/валюты) → `etl/load` (upsert, ST_Contains) → `etl/aggregate` (пересчёт агрегатов из listings, IQR/median/roll-up).
- Триггер: `POST /api/etl/run?source=sample&secret=$ETL_TRIGGER_SECRET`.
- Реальный OLX: заполнить `OLX_*` в .env, уточнить `OLX_CATEGORY_MAP` (id категорий) и `OLX_AREA_ATTR`.

## Конвенции
- TypeScript strict; Python типизирован (mypy). Без `any` и бездумных `# type: ignore`.
- Коммиты — Conventional Commits: `feat|fix|chore|docs|refactor(scope): …`, атомарные.
- Контракт API не меняется без синхронного обновления `packages/shared-types` + Pydantic + записи в `DECISIONS.md`.
- Секреты только из `.env`; `.env` — в `.gitignore`. **Платёжные вебхуки — всегда проверка подписи + идемпотентность.**
- Карта Leaflet — ТОЛЬКО через `next/dynamic(..., { ssr: false })`.
- Геоданные — только легитимные источники (CC BY 4.0 / COD-AB / ODbL / официальные API). **Массовый скрейпинг чужих сайтов — НЕ дефолт, это юр-решение (ТЗ §3).**
- Версии библиотек фиксируй в `DECISIONS.md` при установке.

## Порядок работы
1. Этапы из §16 ТЗ — строго последовательно; у каждого есть Definition of Done.
2. Не пиши код вне текущего этапа.
3. После шага: линт/типчек/тесты пакета → обнови `PROGRESS.md` → commit.
4. Конфликт ТЗ с реальностью — останови пункт, запиши в `DECISIONS.md`, предложи варианты.

## Дорожки вне кода (блокирующие запуск — статус в PROGRESS.md)
- **Данные (ТЗ §3):** выбран легитимный источник объявлений; запущено накопление собственного временного ряда.
- **Юр./биллинг (ТЗ §4):** субъект хозяйствования (ФОП/ТОВ), договор с эквайером, публичная оферта, политика приватности.
- **Дифференциация (ТЗ §1):** зафиксирован угол позиционирования (ниша/регион/API-first/UX).

## Файлы контекста
- `TZ-geoanalytics-uvecon-v2-commercial.md` — полное ТЗ (требования, бизнес-модель, схемы, API, roadmap).
- `PROGRESS.md` — статус по этапам.
- `DECISIONS.md` — журнал технических решений.
