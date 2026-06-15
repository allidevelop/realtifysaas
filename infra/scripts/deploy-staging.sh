#!/usr/bin/env bash
# Деплой STAGING/MVP одной командой (субдомен + SSL, mock-платежи).
# Запуск на сервере из корня репо:
#   cp .env.staging.example .env   # заполнить <...>
#   bash infra/scripts/deploy-staging.sh            # полный деплой
#   bash infra/scripts/deploy-staging.sh --pull     # + git pull перед сборкой
#   bash infra/scripts/deploy-staging.sh --skip-data # без переналива данных (быстрый redeploy)
#   bash infra/scripts/deploy-staging.sh --nginx    # ещё и отрендерить nginx-конфиг
#
# Идемпотентно. Данные: реальные границы (geoBoundaries) + демо-listings + Prozorro.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PULL=0; SKIP_DATA=0; SKIP_BUILD=0; DO_NGINX=0
for a in "$@"; do case "$a" in
  --pull) PULL=1 ;; --skip-data) SKIP_DATA=1 ;; --skip-build) SKIP_BUILD=1 ;; --nginx) DO_NGINX=1 ;;
  *) echo "неизвестный флаг: $a"; exit 2 ;;
esac; done

[ -f .env ] || { echo "Нет .env — скопируй .env.staging.example в .env и заполни"; exit 1; }
set -a; . ./.env; set +a
: "${STAGING_DOMAIN:?задай STAGING_DOMAIN в .env}"
: "${PAYLOAD_SECRET:?задай PAYLOAD_SECRET в .env}"
WEB_PORT="${WEB_PORT:-3100}"; ENGINE_PORT="${ENGINE_PORT:-8100}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Не найдено: $1 — установи (см. infra/README)"; exit 1; }; }
for c in docker pnpm uv pm2 node curl; do need "$c"; done

echo "==> [1/7] git $( [ $PULL = 1 ] && echo pull || echo skip )"
[ $PULL = 1 ] && git pull --ff-only

echo "==> [2/7] зависимости (pnpm + uv)"
pnpm install --no-frozen-lockfile
( cd apps/engine && uv sync )
mkdir -p apps/web/logs apps/engine/logs

echo "==> [3/7] контейнеры БД/Redis"
docker compose up -d
echo -n "   ждём Postgres"
for _ in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-geo}" >/dev/null 2>&1; then break; fi
  echo -n "."; sleep 1
done; echo " ok"
# Гарантируем схему gis (идемпотентно; на свежем томе создаётся, иначе — no-op).
docker compose exec -T postgres psql -U "${POSTGRES_USER:-geo}" -d "${POSTGRES_DB:-geo}" \
  < infra/sql/00-init.sql >/dev/null 2>&1 || true
docker compose exec -T postgres psql -U "${POSTGRES_USER:-geo}" -d "${POSTGRES_DB:-geo}" \
  < infra/sql/02-gis-admin.sql >/dev/null 2>&1 || true

# Схема Payload + сид ДО сборки: next build пререндерит страницы и читает таблицы
# Payload, поэтому они должны существовать. Push схемы — dev-операция (в production
# Payload его не делает), поэтому разово запускаем сид в NODE_ENV=development.
# Сид идемпотентен (повторно не дублирует). На реальном проде — миграции вместо push.
echo "==> [4/7] схема Payload + сид (контент, модули, пакеты, админ)"
NODE_ENV=development pnpm --filter web seed

if [ $SKIP_BUILD = 0 ]; then
  echo "==> [5/7] сборка web (прод)"
  pnpm --filter web build
else
  echo "==> [5/7] сборка web — пропущена"
fi

if [ $SKIP_DATA = 0 ]; then
  echo "==> [6/7] данные: реальные границы + демо-listings + Prozorro"
  pushd apps/engine >/dev/null
  uv run python -m etl.import_boundaries --source geoboundaries --demo-metrics
  uv run python -m etl.generate_listings           # демо-listings из агрегатов
  uv run python -m etl.pipeline --source prozorro  # реальные аукционы (без truncate) + recompute
  popd >/dev/null
else
  echo "==> [6/7] данные — пропущены"
fi

echo "==> [7/7] процессы pm2 (web:${WEB_PORT}, engine:${ENGINE_PORT})"
# Детерминированный рестарт: снять прежние и поднять заново (startOrReload капризен).
pm2 delete realtify-staging-web realtify-staging-engine realtify-staging-bot 2>/dev/null || true
pm2 start infra/pm2/ecosystem.staging.cjs --update-env
pm2 save
echo -n "   ждём web на :${WEB_PORT}"
for _ in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then break; fi
  echo -n "."; sleep 2
done; echo " ok"

if [ $DO_NGINX = 1 ]; then
  echo "==> nginx: рендер конфига субдомена"
  command -v envsubst >/dev/null || { echo "нет envsubst (apt install gettext-base)"; exit 1; }
  OUT="infra/nginx/realtify-staging.conf"
  STAGING_DOMAIN="$STAGING_DOMAIN" WEB_PORT="$WEB_PORT" \
    envsubst '${STAGING_DOMAIN} ${WEB_PORT}' < infra/nginx/realtify-staging.conf.template > "$OUT"
  echo "   готово: $OUT — установи с sudo:"
  echo "     sudo cp $OUT /etc/nginx/sites-available/realtify-staging"
  echo "     sudo ln -sf /etc/nginx/sites-available/realtify-staging /etc/nginx/sites-enabled/"
  echo "     sudo certbot --nginx -d ${STAGING_DOMAIN}"
  echo "     sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "Готово. Локально web слушает 127.0.0.1:${WEB_PORT}."
echo "Дальше (если ещё не сделано): DNS A-запись ${STAGING_DOMAIN} → IP сервера, затем --nginx + certbot."
echo "Логи: pm2 logs | pm2 status. Админка: https://${STAGING_DOMAIN}/admin"
