#!/bin/sh
set -eu

backup_path="${1:-}"
admin_password_file="${POSTGRES_ADMIN_PASSWORD_FILE:-}"

if [ -z "$backup_path" ]; then
  backup_path="$(find /backups -maxdepth 1 -type f -name 'qinglang-*.dump' \
    -printf '%T@ %p\n' | sort -nr | sed -n '1s/^[^ ]* //p')"
fi
if [ -z "$backup_path" ] || [ ! -f "$backup_path" ]; then
  echo "no backup file is available inside /backups" >&2
  exit 64
fi
case "$backup_path" in
  /backups/qinglang-*.dump) ;;
  *) echo "backup path must match /backups/qinglang-*.dump" >&2; exit 64 ;;
esac
if [ ! -s "$admin_password_file" ]; then
  echo "POSTGRES_ADMIN_PASSWORD_FILE is unavailable" >&2
  exit 78
fi

export PGPASSWORD="$(cat "$admin_password_file")"
database_host="${POSTGRES_HOST:-postgres}"
database_port="${POSTGRES_PORT:-5432}"
admin_user="${POSTGRES_ADMIN_USER:-qinglang_admin}"
temporary_database="qinglang_restore_verify_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
  dropdb --if-exists --force \
    --host "$database_host" \
    --port "$database_port" \
    --username "$admin_user" \
    "$temporary_database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

createdb \
  --host "$database_host" \
  --port "$database_port" \
  --username "$admin_user" \
  "$temporary_database"

pg_restore \
  --host "$database_host" \
  --port "$database_port" \
  --username "$admin_user" \
  --dbname "$temporary_database" \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "$backup_path"

verification="$(psql \
  --host "$database_host" \
  --port "$database_port" \
  --username "$admin_user" \
  --dbname "$temporary_database" \
  --tuples-only \
  --no-align \
  --command "SELECT json_build_object('migrations', (SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), 'tables', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'), 'vector', (SELECT extversion FROM pg_extension WHERE extname = 'vector'));"
)"

printf '{"event":"database_restore_verified","backup":"%s","checks":%s}\n' \
  "$(basename "$backup_path")" "$verification"
