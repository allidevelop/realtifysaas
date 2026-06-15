#!/usr/bin/env sh
# Восстановление БД из дампа backup-db.sh.  ВНИМАНИЕ: --clean удаляет существующие объекты.
# Использование:  PGDATABASE=geo PGPASSWORD=... ./restore-db.sh <файл.dump>
set -eu

FILE="${1:?usage: restore-db.sh <dump-file>}"
: "${PGDATABASE:=geo}"

pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE" "$FILE"
echo "restore ok: $FILE → $PGDATABASE"
