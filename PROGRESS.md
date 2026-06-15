# PROGRESS.md

Статус разработки по этапам (см. §16 ТЗ v2). Обновлять после каждого осмысленного шага.

**Последнее обновление:** 2026-06-15
**Текущий фокус:** Этап 5 (биллинг) ✅ и Этап 2 (геопортал) ✅ готовы. Далее — Этап 3 (реальные данные/ETL: заменить синтетику границ/агрегатов реальным потоком) и Этап 4 (оценка/бот).
**Режим:** локальная разработка; коммерческий продукт (монетизация в scope); прод — этап 7

> Параллельно с кодом идут две некодовые дорожки (блокирующие запуск). Их статус — внизу.

---

## Этап 0 — Инфраструктура и каркас 🟢 готово
- [x] Бутстрап: `CLAUDE.md`, `PROGRESS.md`, `DECISIONS.md`, `docker-compose.yml`, `.env.example`, `infra/sql/00-init.sql`
- [x] `docker compose up -d` → `postgis_version()` = 3.4, схема `gis` есть (PostGIS установлен в `gis`, см. DECISIONS)
- [x] Монорепо: `pnpm-workspace.yaml`, корневой `package.json`, `.gitignore`, `.npmrc`
- [x] Скаффолд `apps/web`: Next.js 15.4.11 + Payload 3.85.1 (Postgres-адаптер); `/` `200`, `/admin` `200`, `/api/users/me` `200`; таблицы Payload созданы в `public`
- [x] Скаффолд `apps/engine`: FastAPI + uv; `GET /health` → `200` (uvicorn) + pytest
- [x] `packages/shared-types`: заготовка (контракты valuation/geo/health)
- [x] Линт/типчек проходят: `pnpm -r lint`/`typecheck` зелёные; engine `ruff`/`mypy`/`pytest` зелёные
- [ ] Первый commit — выполняется
**DoD:** ✅ БД с PostGIS поднимается; пустые web/engine стартуют; линт/типчек проходят.

> Примечание (см. DECISIONS): хост-порт Postgres — **5433** (конфликт с локальной службой postgresql-x64-17); PostGIS — в схеме `gis`; корневой `.env` грузится в web через `next.config.mjs`.

## Этап 0.5 — Стратегия данных и дифференциация ⚪ ожидает (НЕКОДОВЫЙ, важнейший)
Выбрать угол позиционирования и легитимный источник данных; запустить накопление своего ряда; начать юр-дорожку.
**DoD:** в `DECISIONS.md` зафиксированы ниша, источник(и) данных и их условия; накопление идёт.

## Этап 1 — Контентный сайт + CMS 🟢 готово
- [x] Коллекции: Pages (блоки + drafts + section), News (drafts), Tools, TeamMembers, Partners, ServicePlans, Media, Users (роли admin/editor/customer/api)
- [x] Global SiteSettings (навигация header/footer, контакты)
- [x] Блоки (§8.3): Hero, Stats, FeatureGrid, ToolsShowcase, Pricing, RichText, Team, Partners, CTA + рендер-компоненты и диспетчер
- [x] Маршруты: `/`, `/[slug]` (about/contacts), `/tools` + `/tools/[slug]`, `/news` + `/news/[slug]`, `/pricing`, `/legal/[slug]`
- [x] Tailwind v4 + typography; Header/Footer; адаптив
- [x] Локализация Payload uk/en (контент); плагин SEO (meta)
- [x] SEO: generateMetadata (canonical/OG/Twitter), sitemap.ts, robots.ts, JSON-LD (Article, Product/Offer)
- [x] Seed: admin, 4 тарифа, 5 инструментов, 2 новости, команда/партнёры, страницы (home/about/contacts/legal) — `GET /seed?secret=…`
- [x] Линт/типчек/сборка зелёные; `next build` — 22 страницы, SSG для контент-маршрутов
**DoD:** ✅ контент редактируется в /admin и рендерится с SEO-HTML; `/pricing` отдаёт тарифы из CMS.

> Дефолтный admin (seed): `admin@realtify.local` / `admin12345` (сменить на проде). i18n UI (next-intl) и изображения team/partners — отдельный проход.

## Этап 2 — Геопортал 🟢 готово (на ДЕМО-границах; реальные — этап 3)
- [x] Схема `gis`: admin_units/listings/aggregated_metrics (GiST, уник-ключи) — `infra/sql/02-gis-admin.sql`
- [x] Импорт АТЕ: `apps/engine/etl/import_boundaries.py` — синтетика (135 АТЕ, 6 периодов) + **swappable** реальный GeoJSON (`--source geojson`)
- [x] Гео-API engine: `/api/geo/{units,metrics,search,meta}` (GeoJSON + ST_SimplifyPreserveTopology, psycopg)
- [x] Карта в кабинете `/account/geoportal`: react-leaflet 5 через `next/dynamic(ssr:false)`, choropleth, легенда, hover, фильтры (период/показник/сегмент/операция), drill-down область→район, поиск
- [x] Прокси-роуты `/account/geoportal/data/*` с **freemium**: бесплатно — последний период без районов; полный — при любом платном пакете
**DoD:** ✅ карта раскрашивается по показателю/периоду; фильтры/drill-down работают; freemium применяется. e2e (curl): admin(full) видит все периоды+drill; free → 403 на старый период/drill.

> Данные — синтетические демо (нет внешней сети в dev, см. DECISIONS). Реальные границы/метрики — этап 3 (swap одной командой).

## Этап 3 — Данные/ETL ⚪ ожидает
Интеграция выбранного источника; импорт громад/микрорайонов; пайплайн listings→aggregated_metrics; геокодинг; накопление.
**DoD:** карта на реальных данных за несколько периодов; пересчёт воспроизводим.

## Этап 4 — Оценка + бот ⚪ ожидает
FastAPI движок (express/detailed), калькуляторы в кабинете, экспорт Word/PDF; aiogram-бот с апселлом.
**DoD:** express-оценка с числом аналогов; экспорт в Word/PDF; бот доводит от адреса до цифры.

## Этап 5 — Биллинг и монетизация 🟢 готово (re-приоритизирован раньше 2–4)
Модель «пакеты квот по модулям» (как у конкурента), а не единые тарифы — см. DECISIONS.
- [x] Коллекции: Modules, ServicePlans→каталог пакетов, Entitlements (=Subscriptions), Orders (legalEntity/items/PDF), Organizations, PaymentEvents
- [x] Движок: entitlements/quota (Redis Lua атомарное списание + write-through БД, идемпотентность runId), fulfillment (бандлы), resolveModuleAccess
- [x] Платежи: провайдер-агностик (Monobank-адаптер ECDSA X-Sign + мок HMAC), вебхуки `/webhooks/{provider}` (подпись + идемпотентность PaymentEvents.eventId)
- [x] Кабинет `/account/*`: login/register/logout, dashboard-хаб, 6 gated-модулей (run→consume / paywall→buy), settings, billing (доступы/история/покупка/B2B), mock-pay
- [x] middleware (presence-гейт) + requireUser (авторитет в server-components)
- [x] Безнал B2B: счёт/акт PDF (engine fpdf2) + защищённая выдача `/account/orders/[id]/{invoice,act}`
- [x] /pricing и PricingBlock сгруппированы по модулям; shared-types/billing.ts (§12)
- [x] e2e: register→buy→mock-pay→вебхук→entitlement→run(−1)→exhausted→paywall; бандл; B2B paid→доступ+акт; дубль вебхука no-op; плохая подпись 400
**DoD:** ✅ оплата открывает доступ; исчерпание квоты закрывает; банк платит по счёту (рахунок→акт).

> Отложено в этой фазе (модель данных оставляет место): публичный API + ApiKeys, рекуррент по токену (chargeByToken-заглушка), реальная логика модулей (этапы 2–4). PDF — fpdf2-стаб (прод: docx+LibreOffice).

## Этап 6 — Интерактивные отчёты и корпоративные функции ⚪ ожидает
Дашборды (Recharts); генератор PDF-отчётов; корпоративные аккаунты с местами (seats).
**DoD:** отчёты выгружаются; корп-доступ с seats работает.

## Этап 7 — Вывод в прод ⚪ ожидает
VPS, Nginx, SSL, PM2, pm2-logrotate, бэкапы, мониторинг, перф карты, мобильный QA, боевые платёжные ключи.
**DoD:** стабильный прод; бэкапы и мониторинг работают; платежи в боевом режиме.

---

## Некодовые дорожки (блокирующие запуск)
- **Данные (ТЗ §3):** ⚪ не начато — выбрать легитимный источник, запустить накопление ряда.
- **Юр./биллинг (ТЗ §4):** ⚪ не начато — ФОП/ТОВ, договор с эквайером, оферта, политика приватности.
- **Дифференциация (ТЗ §1):** ⚪ не начато — зафиксировать угол позиционирования.

### Журнал заметок
- 2026-06-14: ТЗ переведено в коммерческую версию (v2); контекст-файлы синхронизированы; разработка локально.
- 2026-06-14: Этап 0 завершён. Монорепо (pnpm+uv), docker (postgis 16-3.4 + redis 7), web (Next 15.4.11 + Payload 3.85.1) и engine (FastAPI) стартуют, линт/типчек/тесты зелёные. Решения сессии — в DECISIONS (порт 5433, PostGIS в схеме gis, Next 15 vs 16, загрузка .env, хойст eslint).
- 2026-06-15: Этап 1 завершён. Контентный сайт на Payload: 8 коллекций + global, 9 блоков, публичные маршруты, Tailwind v4, локализация uk/en, SEO (sitemap/robots/JSON-LD), seed демо-контента. `next build` зелёный (22 страницы). Решения — в DECISIONS (Tailwind v4, локализация, plugin-seo, Pages.section, seed через /seed из-за бага tsx+Node26).
- 2026-06-15: Этап 5 завершён (re-приоритизирован). Денежная машина «пакеты квот по модулям» + кабинет /account/* + платежи (Monobank-адаптер + мок) + квоты (Redis Lua) + B2B счёт/акт PDF (engine). Полный e2e (buy→pay→run→exhaust, бандл, безнал) пройден. Решения — в DECISIONS (per-module packs, Monobank, webhook path, Redis 6380/Memurai, фулфилмент-транзакция, presence-middleware, PDF-стаб). Дефолтный admin: admin@realtify.local / admin12345.
- 2026-06-15: Этап 2 завершён (на демо-границах). Схема gis + ETL-импорт (синтетика + swappable GeoJSON) + гео-API engine + карта react-leaflet в кабинете (choropleth/фильтры/drill-down) + freemium-гейтинг. e2e пройден. Реальные данные — этап 3 (нет внешней сети в dev).
