#!/bin/sh
set -eu
umask 027

backup_dir="${BACKUP_DIR_CONTAINER:-/backups}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
interval_seconds="${BACKUP_INTERVAL_SECONDS:-86400}"
retry_seconds="${BACKUP_RETRY_SECONDS:-300}"
database_url_file="${BACKUP_DATABASE_URL_FILE:-}"

case "$retention_days" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2; exit 78 ;;
esac
case "$interval_seconds" in
  ''|*[!0-9]*) echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 78 ;;
esac
case "$retry_seconds" in
  ''|*[!0-9]*) echo "BACKUP_RETRY_SECONDS must be a positive integer" >&2; exit 78 ;;
esac
if [ "$retention_days" -lt 1 ] \
  || [ "$interval_seconds" -lt 300 ] \
  || [ "$retry_seconds" -lt 60 ] \
  || [ "$retry_seconds" -gt 3600 ]; then
  echo "backup retention or interval configuration is outside the safe range" >&2
  exit 78
fi
if [ ! -s "$database_url_file" ]; then
  echo "BACKUP_DATABASE_URL_FILE is unavailable" >&2
  exit 78
fi

database_url="$(cat "$database_url_file")"
mkdir -p "$backup_dir"

run_backup() (
  if ! flock -n 9; then
    printf '{"event":"database_backup_skipped_concurrent","timestamp":"%s"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
    return 75
  fi

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  temporary_path="${backup_dir}/.qinglang-${timestamp}.dump.tmp"
  final_path="${backup_dir}/qinglang-${timestamp}.dump"

  if ! pg_dump --dbname "$database_url" \
      --format=custom \
      --compress=9 \
      --no-owner \
      --no-acl \
      --file "$temporary_path"; then
    rm -f "$temporary_path"
    return 1
  fi
  if ! pg_restore --list "$temporary_path" >/dev/null; then
    rm -f "$temporary_path"
    return 1
  fi
  mv "$temporary_path" "$final_path"
  find "$backup_dir" -maxdepth 1 -type f -name 'qinglang-*.dump' \
    -mtime "+${retention_days}" -delete
  printf '{"event":"database_backup_succeeded","timestamp":"%s","file":"%s"}\n' \
    "$timestamp" "$(basename "$final_path")"
) 9>"$backup_dir/.qinglang-backup.lock"

if [ "${1:-}" = "once" ]; then
  run_backup
  exit 0
fi

trap 'exit 0' INT TERM
while true; do
  next_sleep_seconds="$interval_seconds"
  if run_backup; then
    :
  else
    backup_status="$?"
    if [ "$backup_status" -eq 75 ]; then
      next_sleep_seconds=60
    else
      printf '{"event":"database_backup_failed","timestamp":"%s"}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2
      next_sleep_seconds="$retry_seconds"
    fi
  fi
  sleep "$next_sleep_seconds" &
  wait $!
done
