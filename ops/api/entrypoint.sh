#!/bin/sh
set -eu

load_required_secret() {
  variable_name="$1"
  secret_path="$2"

  if [ -z "$secret_path" ] || [ ! -f "$secret_path" ]; then
    echo "required secret file for ${variable_name} is unavailable" >&2
    exit 78
  fi

  secret_value="$(cat "$secret_path")"
  if [ -z "$secret_value" ]; then
    echo "required secret ${variable_name} is empty" >&2
    exit 78
  fi
  export "${variable_name}=${secret_value}"
}

load_optional_secret() {
  variable_name="$1"
  secret_path="$2"

  if [ -n "$secret_path" ] && [ -s "$secret_path" ]; then
    secret_value="$(cat "$secret_path")"
    export "${variable_name}=${secret_value}"
  fi
}

load_required_secret DATABASE_URL "${DATABASE_URL_FILE:-}"
load_required_secret REAUTH_PROOF_SECRET "${REAUTH_PROOF_SECRET_FILE:-}"
load_required_secret INVITATION_TOKEN_SECRET "${INVITATION_TOKEN_SECRET_FILE:-}"
load_optional_secret MODEL_API_KEY "${MODEL_API_KEY_FILE:-}"
load_optional_secret ALERT_WEBHOOK_URL "${ALERT_WEBHOOK_URL_FILE:-}"

exec "$@"
