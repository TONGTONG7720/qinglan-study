#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="${1:-$repository_root/ops/production/production.env}"
image_tag_override="${2:-}"

if [ ! -f "$environment_file" ]; then
  echo "production environment file not found: $environment_file" >&2
  exit 66
fi
case "$environment_file" in
  /*) ;;
  *) environment_file="$(CDPATH= cd -- "$(dirname -- "$environment_file")" && pwd)/$(basename "$environment_file")" ;;
esac

set -a
. "$environment_file"
set +a
if [ -n "$image_tag_override" ]; then
  IMAGE_TAG="$image_tag_override"
  export IMAGE_TAG
fi

require_value() {
  variable_name="$1"
  eval "value=\${$variable_name:-}"
  if [ -z "$value" ]; then
    echo "$variable_name is required" >&2
    exit 78
  fi
}

for variable_name in \
  IMAGE_TAG INFRA_IMAGE_TAG DEPLOY_OWNER_USER DEPLOY_OWNER_GROUP SITE_ADDRESS ACME_EMAIL \
  ALLOWED_ORIGINS SESSION_COOKIE_NAME REQUEST_BODY_LIMIT_BYTES CSRF_PROTECTION_ENABLED \
  VITE_ENABLE_DEMO_COURSE_CATALOG VITE_QA_DEMO_BUILD VITE_RELEASE_SCOPE \
  MODEL_PROVIDER OBJECT_STORAGE_PROVIDER OBJECT_SCAN_PROVIDER EMAIL_PROVIDER \
  EXPECTED_MIGRATION_NAME \
  POSTGRES_DB BACKUP_SHARED_GID \
  POSTGRES_ADMIN_USER POSTGRES_MIGRATOR_USER POSTGRES_APP_USER POSTGRES_BACKUP_USER \
  BACKUP_DIR DEPLOY_STATE_DIR POSTGRES_ADMIN_PASSWORD_FILE POSTGRES_MIGRATOR_PASSWORD_FILE \
  POSTGRES_APP_PASSWORD_FILE POSTGRES_BACKUP_PASSWORD_FILE DATABASE_URL_FILE \
  MIGRATION_DATABASE_URL_FILE BACKUP_DATABASE_URL_FILE REAUTH_PROOF_SECRET_FILE \
  INVITATION_TOKEN_SECRET_FILE MODEL_API_KEY_FILE OBJECT_STORAGE_SECRET_ACCESS_KEY_FILE \
  ALERT_WEBHOOK_URL_FILE
do
  require_value "$variable_name"
done

for variable_name in IMAGE_TAG INFRA_IMAGE_TAG; do
  eval "tag_value=\${$variable_name}"
  case "$tag_value" in
    replace-*|*[!A-Za-z0-9._-]*|'') echo "$variable_name is not a deployable immutable tag" >&2; exit 78 ;;
  esac
done
if [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
  for variable_name in IMAGE_TAG INFRA_IMAGE_TAG; do
    eval "tag_value=\${$variable_name}"
    if ! printf '%s' "$tag_value" | grep -Eq '^[0-9a-f]{40}$'; then
      echo "$variable_name must be an immutable 40-character commit SHA" >&2
      exit 78
    fi
  done
fi

if ! printf '%s' "$BACKUP_SHARED_GID" | grep -Eq '^[0-9]{3,5}$' \
  || [ "$BACKUP_SHARED_GID" -lt 100 ] \
  || [ "$BACKUP_SHARED_GID" -gt 60000 ]; then
  echo "BACKUP_SHARED_GID must be an unprivileged numeric group ID" >&2
  exit 78
fi

for variable_name in POSTGRES_DB POSTGRES_ADMIN_USER POSTGRES_MIGRATOR_USER POSTGRES_APP_USER POSTGRES_BACKUP_USER; do
  eval "database_identifier=\${$variable_name}"
  if ! printf '%s' "$database_identifier" | grep -Eq '^[a-z][a-z0-9_]{2,30}$'; then
    echo "$variable_name must be a lowercase PostgreSQL identifier" >&2
    exit 78
  fi
done

for variable_name in DEPLOY_OWNER_USER DEPLOY_OWNER_GROUP; do
  eval "owner_identifier=\${$variable_name}"
  if ! printf '%s' "$owner_identifier" | grep -Eq '^[A-Za-z_][A-Za-z0-9_-]{1,31}$'; then
    echo "$variable_name is invalid" >&2
    exit 78
  fi
done

case "$SESSION_COOKIE_NAME" in
  __Host-*) ;;
  *) echo "SESSION_COOKIE_NAME must use the __Host- prefix" >&2; exit 78 ;;
esac

if [ "$REQUEST_BODY_LIMIT_BYTES" != "256000" ]; then
  echo "REQUEST_BODY_LIMIT_BYTES must match the reviewed 256 KB API and gateway limit" >&2
  exit 78
fi
if [ "$CSRF_PROTECTION_ENABLED" != "true" ]; then
  echo "CSRF_PROTECTION_ENABLED must be true in production" >&2
  exit 78
fi
if [ "$VITE_ENABLE_DEMO_COURSE_CATALOG" != "false" ] \
  || [ "$VITE_QA_DEMO_BUILD" != "false" ]; then
  echo "production deployment must disable every Web demo and QA build flag" >&2
  exit 78
fi
if [ "$VITE_RELEASE_SCOPE" != "READ_ONLY_BETA" ]; then
  echo "production deployment must use VITE_RELEASE_SCOPE=READ_ONLY_BETA until full vertical services are verified" >&2
  exit 78
fi
case "$OBJECT_STORAGE_PROVIDER" in
  disabled)
    if [ "$OBJECT_SCAN_PROVIDER" != "disabled" ]; then
      echo "OBJECT_SCAN_PROVIDER must be disabled when object storage is disabled" >&2
      exit 78
    fi
    ;;
  s3)
    require_value CLAMAV_IMAGE
    for variable_name in \
      OBJECT_STORAGE_ENDPOINT OBJECT_STORAGE_REGION OBJECT_STORAGE_BUCKET \
      OBJECT_STORAGE_ACCESS_KEY_ID OBJECT_STORAGE_FORCE_PATH_STYLE \
      OBJECT_STORAGE_UPLOAD_TTL_SECONDS OBJECT_STORAGE_READ_TTL_SECONDS \
      OBJECT_STORAGE_RETENTION_DAYS OBJECT_STORAGE_SSE \
      CLAMAV_HOST CLAMAV_PORT CLAMAV_TIMEOUT_MS
    do
      require_value "$variable_name"
    done
    case "$OBJECT_STORAGE_ENDPOINT" in
      https://*) ;;
      *) echo "OBJECT_STORAGE_ENDPOINT must use HTTPS" >&2; exit 78 ;;
    esac
    if [ "$OBJECT_STORAGE_SSE" != "AES256" ]; then
      echo "OBJECT_STORAGE_SSE must be AES256" >&2
      exit 78
    fi
    if [ "$OBJECT_SCAN_PROVIDER" != "clamav" ]; then
      echo "S3 object storage requires OBJECT_SCAN_PROVIDER=clamav" >&2
      exit 78
    fi
    if [ "$CLAMAV_HOST" != "malware-scanner" ] || [ "$CLAMAV_PORT" != "3310" ]; then
      echo "ClamAV must use the private malware-scanner service on port 3310" >&2
      exit 78
    fi
    case ",${COMPOSE_PROFILES:-}," in
      *,ocr,*) ;;
      *) echo "COMPOSE_PROFILES must include ocr when object storage is enabled" >&2; exit 78 ;;
    esac
    if ! printf '%s' "$CLAMAV_IMAGE" | grep -Eq '^clamav/clamav:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$'; then
      echo "CLAMAV_IMAGE must use an immutable sha256 digest" >&2
      exit 78
    fi
    ;;
  *) echo "OBJECT_STORAGE_PROVIDER must be disabled or s3" >&2; exit 78 ;;
esac
if [ "$EMAIL_PROVIDER" != "disabled" ]; then
  echo "EMAIL_PROVIDER must remain disabled until a production adapter is implemented" >&2
  exit 78
fi

latest_migration_name="$(
  for migration_path in "$repository_root"/apps/api/prisma/migrations/*; do
    if [ -d "$migration_path" ]; then
      basename "$migration_path"
    fi
  done | sort | tail -n 1
)"
if [ -z "$latest_migration_name" ] || [ "$EXPECTED_MIGRATION_NAME" != "$latest_migration_name" ]; then
  echo "EXPECTED_MIGRATION_NAME must match the latest committed Prisma migration" >&2
  exit 78
fi

if [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
  if [ "$(id -un)" != "$DEPLOY_OWNER_USER" ]; then
    echo "production deployment must run as DEPLOY_OWNER_USER" >&2
    exit 77
  fi
  case "$SITE_ADDRESS" in
    *.*) ;;
    *) echo "SITE_ADDRESS must be a public DNS name" >&2; exit 78 ;;
  esac
  case "$SITE_ADDRESS" in
    http://*|https://*|*/*|*:*|localhost|127.0.0.1)
      echo "SITE_ADDRESS must be a bare public hostname" >&2
      exit 78
      ;;
  esac
  if [ "$ALLOWED_ORIGINS" != "https://$SITE_ADDRESS" ]; then
    echo "ALLOWED_ORIGINS must exactly match https://SITE_ADDRESS" >&2
    exit 78
  fi
  if [ "${PUBLIC_BIND_IP:-0.0.0.0}" != "0.0.0.0" ] \
    || [ "${PUBLIC_HTTP_PORT:-80}" != "80" ] \
    || [ "${PUBLIC_HTTPS_PORT:-443}" != "443" ]; then
    echo "production must expose Caddy on public ports 80 and 443" >&2
    exit 78
  fi
fi

case "$ACME_EMAIL" in
  *@*.*) ;;
  *) echo "ACME_EMAIL must be a valid operations email" >&2; exit 78 ;;
esac

if [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_MIGRATOR_USER" ] \
  || [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_APP_USER" ] \
  || [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_BACKUP_USER" ] \
  || [ "$POSTGRES_MIGRATOR_USER" = "$POSTGRES_APP_USER" ] \
  || [ "$POSTGRES_MIGRATOR_USER" = "$POSTGRES_BACKUP_USER" ] \
  || [ "$POSTGRES_APP_USER" = "$POSTGRES_BACKUP_USER" ]; then
  echo "PostgreSQL administrator, migrator, application, and backup roles must be distinct" >&2
  exit 78
fi

if [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
  case "$BACKUP_DIR" in
    /|/root|/home|/var|/var/lib) echo "BACKUP_DIR is too broad" >&2; exit 78 ;;
    /*) ;;
    *) echo "BACKUP_DIR must be an absolute path" >&2; exit 78 ;;
  esac
  case "$DEPLOY_STATE_DIR" in
    /|/root|/home|/var|/var/lib) echo "DEPLOY_STATE_DIR is too broad" >&2; exit 78 ;;
    /*) ;;
    *) echo "DEPLOY_STATE_DIR must be an absolute path" >&2; exit 78 ;;
  esac
  if [ ! -d "$BACKUP_DIR" ]; then
    echo "BACKUP_DIR must be created by bootstrap-secrets.sh before deployment" >&2
    exit 78
  fi
  if [ "$(stat -c %g "$BACKUP_DIR")" != "$BACKUP_SHARED_GID" ] \
    || [ "$(stat -c %a "$BACKUP_DIR")" != "2750" ]; then
    echo "BACKUP_DIR must use the configured shared group and mode 2750" >&2
    exit 78
  fi
fi

for variable_name in \
  POSTGRES_ADMIN_PASSWORD_FILE POSTGRES_MIGRATOR_PASSWORD_FILE POSTGRES_APP_PASSWORD_FILE \
  POSTGRES_BACKUP_PASSWORD_FILE DATABASE_URL_FILE MIGRATION_DATABASE_URL_FILE \
  BACKUP_DATABASE_URL_FILE REAUTH_PROOF_SECRET_FILE INVITATION_TOKEN_SECRET_FILE
do
  eval "secret_path=\${$variable_name}"
  if [ ! -s "$secret_path" ]; then
    echo "$variable_name is missing or empty" >&2
    exit 78
  fi
  if [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
    case "$secret_path" in
      /*) ;;
      *) echo "$variable_name must be an absolute path" >&2; exit 78 ;;
    esac
    if [ "$(stat -c %a "$secret_path")" != "600" ]; then
      echo "$variable_name must have mode 600" >&2
      exit 78
    fi
  fi
done

for variable_name in MODEL_API_KEY_FILE OBJECT_STORAGE_SECRET_ACCESS_KEY_FILE ALERT_WEBHOOK_URL_FILE; do
  eval "secret_path=\${$variable_name}"
  if [ ! -f "$secret_path" ]; then
    echo "$variable_name is missing" >&2
    exit 78
  fi
  if [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
    case "$secret_path" in
      /*) ;;
      *) echo "$variable_name must be an absolute path" >&2; exit 78 ;;
    esac
    if [ "$(stat -c %a "$secret_path")" != "600" ]; then
      echo "$variable_name must have mode 600" >&2
      exit 78
    fi
  fi
done

if [ "$OBJECT_STORAGE_PROVIDER" = "s3" ]; then
  if [ ! -s "$OBJECT_STORAGE_SECRET_ACCESS_KEY_FILE" ] \
    || [ "$(wc -c <"$OBJECT_STORAGE_SECRET_ACCESS_KEY_FILE")" -lt 20 ]; then
    echo "OBJECT_STORAGE_SECRET_ACCESS_KEY_FILE must contain the least-privilege bucket secret" >&2
    exit 78
  fi
fi

for secret_path in \
  "$POSTGRES_ADMIN_PASSWORD_FILE" "$POSTGRES_MIGRATOR_PASSWORD_FILE" \
  "$POSTGRES_APP_PASSWORD_FILE" "$POSTGRES_BACKUP_PASSWORD_FILE" \
  "$REAUTH_PROOF_SECRET_FILE" "$INVITATION_TOKEN_SECRET_FILE"
do
  if [ "$(wc -c <"$secret_path")" -lt 32 ]; then
    echo "a required production secret is shorter than 32 characters" >&2
    exit 78
  fi
done

if ! grep -Fq "postgresql://${POSTGRES_APP_USER}:" "$DATABASE_URL_FILE"; then
  echo "DATABASE_URL_FILE must use the least-privilege application role" >&2
  exit 78
fi
if ! grep -Fq "postgresql://${POSTGRES_MIGRATOR_USER}:" "$MIGRATION_DATABASE_URL_FILE"; then
  echo "MIGRATION_DATABASE_URL_FILE must use the migrator role" >&2
  exit 78
fi
if ! grep -Fq "postgresql://${POSTGRES_BACKUP_USER}:" "$BACKUP_DATABASE_URL_FILE"; then
  echo "BACKUP_DATABASE_URL_FILE must use the backup role" >&2
  exit 78
fi

case "$MODEL_PROVIDER" in
  disabled) ;;
  openai-compatible)
    case "${MODEL_BASE_URL:-}" in
      https://*) ;;
      *) echo "MODEL_BASE_URL must use HTTPS" >&2; exit 78 ;;
    esac
    if [ ! -s "$MODEL_API_KEY_FILE" ] || [ "$(wc -c <"$MODEL_API_KEY_FILE")" -lt 20 ]; then
      echo "MODEL_API_KEY_FILE must contain a real provider key" >&2
      exit 78
    fi
    require_value MODEL_NAME
    ;;
  *) echo "MODEL_PROVIDER must be disabled or openai-compatible" >&2; exit 78 ;;
esac

alert_webhook_url="$(cat "$ALERT_WEBHOOK_URL_FILE")"
if [ -n "$alert_webhook_url" ]; then
  case "$alert_webhook_url" in
    https://*) ;;
    *) echo "ALERT_WEBHOOK_URL_FILE must contain an HTTPS URL" >&2; exit 78 ;;
  esac
else
  if [ "${PRODUCTION_SMOKE_TEST:-false}" = "true" ]; then
    echo "warning: remote alert webhook is not configured; monitor will log locally only" >&2
  else
    echo "ALERT_WEBHOOK_URL_FILE is required for production alert delivery" >&2
    exit 78
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 69
fi
docker compose version >/dev/null

cd "$repository_root"
docker compose --env-file "$environment_file" -f compose.production.yaml config --quiet
printf '%s\n' "Production preflight passed without exposing secret values."
