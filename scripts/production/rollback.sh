#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="${1:-$repository_root/ops/production/production.env}"

set -a
. "$environment_file"
set +a

if [ ! -s "$DEPLOY_STATE_DIR/previous-image-tag" ]; then
  echo "no previous image tag is recorded" >&2
  exit 66
fi

current_tag="$(cat "$DEPLOY_STATE_DIR/current-image-tag")"
rollback_tag="$(cat "$DEPLOY_STATE_DIR/previous-image-tag")"
case "$rollback_tag" in
  *[!A-Za-z0-9._-]*|'') echo "recorded rollback tag is invalid" >&2; exit 78 ;;
esac
export IMAGE_TAG="$rollback_tag"

compose() {
  docker compose --env-file "$environment_file" -f "$repository_root/compose.production.yaml" "$@"
}

if ! docker image inspect \
    "${API_IMAGE_REPOSITORY:-qinglang-api}:${rollback_tag}" \
    "${GATEWAY_IMAGE_REPOSITORY:-qinglang-gateway}:${rollback_tag}" >/dev/null 2>&1; then
  compose pull api gateway
fi

compose up -d --no-build --no-deps api gateway monitor

health_url="https://${SITE_ADDRESS}/v1/health/ready"
curl_options="--fail --silent --show-error --max-time 10"
if [ "${PRODUCTION_SMOKE_TEST:-false}" = "true" ]; then
  health_url="https://${SITE_ADDRESS}:${PUBLIC_HTTPS_PORT}/v1/health/ready"
  curl_options="$curl_options --insecure"
fi

attempt=1
while [ "$attempt" -le 20 ]; do
  if curl $curl_options "$health_url" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 20 ]; then
    echo "rollback containers did not become healthy" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

printf '%s' "$rollback_tag" >"$DEPLOY_STATE_DIR/current-image-tag"
printf '%s' "$current_tag" >"$DEPLOY_STATE_DIR/previous-image-tag"
printf '%s\n' "Application images rolled back to $rollback_tag."
printf '%s\n' "Database schema was not reversed; verify migration backward compatibility."
