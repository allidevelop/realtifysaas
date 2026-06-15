# Деплой в прод (Этап 7, ТЗ §14)

> Цель: стабильный прод; бэкапы и мониторинг работают; платежи в боевом режиме.
> Ниже — конфиги и шаги. Боевые ключи (Monobank/OLX/Telegram) — только в prod-`.env`,
> не в репозитории.

## 0. Быстрый старт: Staging / MVP на субдомене (mock-платежи)

> Для тестирования всего продукта в браузере на публичном субдомене. Платежи — **mock**
> (без реальных денег). Отличия от боевого прода — в разделах ниже (Monobank, миграции, бэкапы).

**Пререквизиты на сервере (Ubuntu):** docker + compose, Node 20+ и `pnpm`, `uv`, `pm2`,
`nginx`, `certbot`, `gettext-base` (даёт `envsubst`).

```bash
# 1) DNS: A-запись  app.realtifysaas.wisecat.site → <IP сервера>
# 2) код + конфиг
git clone <repo> /opt/realtify && cd /opt/realtify
cp .env.staging.example .env
#    заполнить <...>: секреты — `openssl rand -hex 32` (PAYLOAD_SECRET) / `-hex 16` (прочие),
#    СИЛЬНЫЙ SEED_ADMIN_PASSWORD (сайт публичный!), STAGING_DOMAIN, пароль БД.
# 3) деплой одной командой (docker → данные → сборка → pm2 → seed)
bash infra/scripts/deploy-staging.sh --pull
# 4) nginx + SSL
bash infra/scripts/deploy-staging.sh --nginx     # отрендерит конфиг и напечатает sudo-команды
#    выполнить напечатанные:  cp → ln → certbot --nginx -d app.realtifysaas.wisecat.site → reload
```
Открыть `https://app.realtifysaas.wisecat.site` (сайт) и `/admin` (вход — `SEED_ADMIN_*`).

- **Данные:** реальные границы Украины (geoBoundaries) + демо-listings + реальные аукционы Prozorro.
- **Быстрый redeploy** (после `git pull`, без переналива данных): `bash infra/scripts/deploy-staging.sh --pull --skip-data`.
- **Порты:** web `:3100`, engine `:8100` (внутренний). Меняются в `.env` (`WEB_PORT`/`ENGINE_PORT`).
- **Безопасность стейджа:** mock-платежи; сильные `PAYLOAD_SECRET`/`SEED_ADMIN_PASSWORD`;
  `noindex` включён; опц. ограничить `/admin` по IP (закомментированный блок в
  `infra/nginx/realtify-staging.conf.template`). DOM.RIA-ключ — когда придёт апрув (в `.env`).
- **Схема БД:** на стейдже создаётся через `PAYLOAD_DB_PUSH=true` (push при старте). На
  настоящем проде — миграции (`payload migrate`), флаг не ставить.

---

## 1. Сервер (Ubuntu VPS)
```bash
sudo apt update && sudo apt install -y nginx postgresql-16 postgresql-16-postgis-3 redis-server git curl
# Node 20+ (nvm/nodesource), pnpm:  npm i -g pnpm
# uv:  curl -LsSf https://astral.sh/uv/install.sh | sh
# pm2: npm i -g pm2
```
Альтернатива БД/Redis — `docker compose up -d` (как локально), но на проде обычно нативные.

## 2. БД и схемы
```sql
CREATE DATABASE geo;
\c geo
-- из infra/sql/: 00-init.sql (postgis в схему gis), 02-gis-admin.sql (таблицы gis)
```
Применить SQL: `psql -d geo -f infra/sql/00-init.sql -f infra/sql/02-gis-admin.sql`.
Миграции Payload (схема public): `pnpm --filter web payload migrate` (или dev-push на стейдже).

## 3. Код и сборка
```bash
git clone <repo> /opt/realtify && cd /opt/realtify
cp .env.example .env   # затем заполнить боевыми значениями (см. .env.prod.example)
pnpm install
pnpm --filter web build
cd apps/engine && uv sync && cd ../..
mkdir -p apps/web/logs apps/engine/logs
```
Данные: импорт границ + (этап 3) объявлений:
```bash
cd apps/engine
uv run python -m etl.import_boundaries --source geojson --adm1 adm1.geojson --adm2 adm2.geojson
uv run python -m etl.pipeline --source olx        # реальный OLX (ключи в .env)
```

## 4. Процессы (PM2)
```bash
pm2 start infra/pm2/ecosystem.config.cjs
pm2 save && pm2 startup            # автозапуск
pm2 install pm2-logrotate          # ротация логов (сразу!)
# Обновление без даунтайма web:  pnpm --filter web build && pm2 reload realtify-web
```

## 5. Nginx + SSL
```bash
sudo cp infra/nginx/realtify.conf /etc/nginx/sites-available/realtify
sudo ln -s /etc/nginx/sites-available/realtify /etc/nginx/sites-enabled/
# заменить realtify.example.com на домен; затем:
sudo certbot --nginx -d realtify.example.com -d www.realtify.example.com
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Платежи (Monobank)
- В `.env`: `PAYMENTS_PROVIDER=monobank`, `MONOBANK_TOKEN=<боевой>`,
  `WEBHOOK_BASE_URL=https://realtify.example.com`.
- В кабинете мерчанта Monobank указать webHookUrl `https://realtify.example.com/webhooks/monobank`.
- Проверить подпись X-Sign на боевом pubkey (GET /api/merchant/pubkey).

## 7. Бэкапы и мониторинг (обязательно — данные = актив, ТЗ §13)
```cron
0 3 * * *   PGDATABASE=geo PGPASSWORD=*** /opt/realtify/infra/scripts/backup-db.sh
*/5 * * * * /opt/realtify/infra/scripts/healthcheck.sh || echo "realtify down" | mail -s alert you@host
```
Бэкапы хранят и `gis.listings`/`gis.aggregated_metrics` — потеря ряда отбрасывает на месяцы.
Восстановление: `infra/scripts/restore-db.sh <file.dump>`.

## Архитектура прокси
Всё публичное → web (Next.js+Payload :3000): сайт, `/admin`, `/account`, `/api` (Payload),
`/webhooks/*`. engine (FastAPI :8000) — внутренний (web вызывает server-side). Публичный
API (`/api/public/*` → engine) включается отдельной локацией Nginx при необходимости.
