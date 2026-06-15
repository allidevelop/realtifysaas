#!/usr/bin/env sh
# Бэкап БД Realtify (ТЗ §13/§14 — данные listings/aggregated_metrics = главный актив).
# Дампит ОБЕ схемы (public Payload + gis PostGIS). Подключение — через libpq-переменные
# (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE). Запуск по cron (напр., ежедневно):
#   0 3 * * *  PGPASSWORD=... PGDATABASE=geo /opt/realtify/infra/scripts/backup-db.sh
set -eu

: "${PGDATABASE:=geo}"
: "${BACKUP_DIR:=/var/backups/realtify}"
: "${RETENTION_DAYS:=14}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/realtify-${PGDATABASE}-${TS}.dump"

# custom-формат (-Fc) уже сжат; --no-owner — переносимость между окружениями.
pg_dump --format=custom --no-owner --file="$FILE" "$PGDATABASE"

# Ротация: удалить дампы старше RETENTION_DAYS.
find "$BACKUP_DIR" -name "realtify-*.dump" -mtime +"$RETENTION_DAYS" -delete

echo "backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
