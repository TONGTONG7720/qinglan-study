#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="${1:-$repository_root/ops/production/production.env}"

if [ ! -f "$environment_file" ]; then
  echo "production environment file not found: $environment_file" >&2
  exit 66
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required" >&2
  exit 69
fi
if [ "$(id -u)" -ne 0 ]; then
  echo "bootstrap-secrets.sh must run as root" >&2
  exit 77
fi

set -a
. "$environment_file"
set +a
umask 077

if ! id "$DEPLOY_OWNER_USER" >/dev/null 2>&1; then
  echo "DEPLOY_OWNER_USER must already exist" >&2
  exit 78
fi
if ! getent group "$DEPLOY_OWNER_GROUP" >/dev/null 2>&1; then
  echo "DEPLOY_OWNER_GROUP must already exist" >&2
  exit 78
fi

required_paths="
POSTGRES_ADMIN_PASSWORD_FILE
POSTGRES_MIGRATOR_PASSWORD_FILE
POSTGRES_APP_PASSWORD_FILE
POSTGRES_BACKUP_PASSWORD_FILE
DATABASE_URL_FILE
MIGRATION_DATABASE_URL_FILE
BACKUP_DATABASE_URL_FILE
REAUTH_PROOF_SECRET_FILE
INVITATION_TOKEN_SECRET_FILE
MODEL_API_KEY_FILE
ALERT_WEBHOOK_URL_FILE
"

for variable_name in $required_paths; do
  eval "secret_path=\${$variable_name:-}"
  case "$secret_path" in
    /*) ;;
    *) echo "$variable_name must be an absolute path" >&2; exit 78 ;;
  esac
  install -d -o "$DEPLOY_OWNER_USER" -g "$DEPLOY_OWNER_GROUP" -m 700 \
    "$(dirname "$secret_path")"
done

write_secret_once() {
  destination="$1"
  value="$2"
  if [ -e "$destination" ]; then
    return
  fi
  printf '%s' "$value" >"$destination"
  chmod 600 "$destination"
}

admin_password="$(openssl rand -hex 32)"
migrator_password="$(openssl rand -hex 32)"
app_password="$(openssl rand -hex 32)"
backup_password="$(openssl rand -hex 32)"

write_secret_once "$POSTGRES_ADMIN_PASSWORD_FILE" "$admin_password"
write_secret_once "$POSTGRES_MIGRATOR_PASSWORD_FILE" "$migrator_password"
write_secret_once "$POSTGRES_APP_PASSWORD_FILE" "$app_password"
write_secret_once "$POSTGRES_BACKUP_PASSWORD_FILE" "$backup_password"

admin_password="$(cat "$POSTGRES_ADMIN_PASSWORD_FILE")"
migrator_password="$(cat "$POSTGRES_MIGRATOR_PASSWORD_FILE")"
app_password="$(cat "$POSTGRES_APP_PASSWORD_FILE")"
backup_password="$(cat "$POSTGRES_BACKUP_PASSWORD_FILE")"

write_secret_once "$DATABASE_URL_FILE" \
  "postgresql://${POSTGRES_APP_USER}:${app_password}@postgres:5432/${POSTGRES_DB}?schema=public"
write_secret_once "$MIGRATION_DATABASE_URL_FILE" \
  "postgresql://${POSTGRES_MIGRATOR_USER}:${migrator_password}@postgres:5432/${POSTGRES_DB}?schema=public"
write_secret_once "$BACKUP_DATABASE_URL_FILE" \
  "postgresql://${POSTGRES_BACKUP_USER}:${backup_password}@postgres:5432/${POSTGRES_DB}"
write_secret_once "$REAUTH_PROOF_SECRET_FILE" "$(openssl rand -hex 48)"
write_secret_once "$INVITATION_TOKEN_SECRET_FILE" "$(openssl rand -hex 48)"
write_secret_once "$MODEL_API_KEY_FILE" ""
write_secret_once "$ALERT_WEBHOOK_URL_FILE" ""

install -d -m 2750 "$BACKUP_DIR"
install -d -o "$DEPLOY_OWNER_USER" -g "$DEPLOY_OWNER_GROUP" -m 700 "$DEPLOY_STATE_DIR"
chown 999:"$BACKUP_SHARED_GID" "$BACKUP_DIR"
chmod 2750 "$BACKUP_DIR"

for variable_name in $required_paths; do
  eval "secret_path=\${$variable_name}"
  chown "$DEPLOY_OWNER_USER":"$DEPLOY_OWNER_GROUP" "$secret_path"
  chmod 600 "$secret_path"
done

printf '%s\n' "Production secrets were initialized without printing their values."
printf '%s\n' "Configure MODEL_API_KEY_FILE only when MODEL_PROVIDER=openai-compatible."
printf '%s\n' "Configure ALERT_WEBHOOK_URL_FILE with an HTTPS webhook to enable remote alerts."
