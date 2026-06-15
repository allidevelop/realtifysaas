#!/usr/bin/env sh
# Healthcheck всех сервисов (ТЗ §13). Exit != 0 если что-то лежит — для cron/мониторинга.
#   */5 * * * * /opt/realtify/infra/scripts/healthcheck.sh || curl -fsS "$ALERT_WEBHOOK" ...
set -u

fail=0
http() {
  if curl -fsS -m 5 "$1" >/dev/null 2>&1; then echo "OK   $2"; else echo "FAIL $2"; fail=1; fi
}

http "http://127.0.0.1:3000/" "web (:3000)"
http "http://127.0.0.1:8000/health" "engine (:8000)"

if redis-cli -u "${REDIS_URL:-redis://localhost:6379}" ping >/dev/null 2>&1; then
  echo "OK   redis"
else
  echo "FAIL redis"; fail=1
fi

if pg_isready >/dev/null 2>&1; then
  echo "OK   postgres"
else
  echo "FAIL postgres"; fail=1
fi

exit $fail
