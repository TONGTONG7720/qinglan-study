#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="$repository_root/ops/production/production.env"
deployment_mode="build"
requested_tag=""
update_infrastructure="false"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file) environment_file="$2"; shift 2 ;;
    --image-tag) requested_tag="$2"; shift 2 ;;
    --pull) deployment_mode="pull"; shift ;;
    --reuse-images) deployment_mode="reuse"; shift ;;
    --update-infra) update_infrastructure="true"; shift ;;
    *) echo "unknown argument: $1" >&2; exit 64 ;;
  esac
done

if [ ! -f "$environment_file" ]; then
  echo "production environment file not found: $environment_file" >&2
  exit 66
fi
case "$environment_file" in
  /*) ;;
  *) environment_file="$(CDPATH= cd -- "$(dirname -- "$environment_file")" && pwd)/$(basename "$environment_file")" ;;
esac

if [ -n "$requested_tag" ]; then
  case "$requested_tag" in
    *[!A-Za-z0-9._-]*|'') echo "invalid image tag" >&2; exit 64 ;;
  esac
  export IMAGE_TAG="$requested_tag"
fi

"$script_directory/preflight.sh" "$environment_file" "$requested_tag"

set -a
. "$environment_file"
set +a
if [ -n "$requested_tag" ]; then
  export IMAGE_TAG="$requested_tag"
fi

if [ "$deployment_mode" = "reuse" ] && [ "${PRODUCTION_SMOKE_TEST:-false}" != "true" ]; then
  echo "--reuse-images is restricted to explicit production smoke tests" >&2
  exit 64
fi

compose() {
  docker compose --env-file "$environment_file" -f "$repository_root/compose.production.yaml" "$@"
}

if [ "${PRODUCTION_SMOKE_TEST:-false}" = "true" ]; then
  mkdir -p "$DEPLOY_STATE_DIR"
else
  install -d -m 700 "$DEPLOY_STATE_DIR"
fi
previous_tag=""
if [ -s "$DEPLOY_STATE_DIR/current-image-tag" ]; then
  previous_tag="$(cat "$DEPLOY_STATE_DIR/current-image-tag")"
fi

if [ "$deployment_mode" = "pull" ]; then
  if [ "$update_infrastructure" = "true" ]; then
    compose pull postgres backup
  fi
  compose --profile tools pull migrate api gateway
elif [ "$deployment_mode" = "build" ]; then
  if [ "$update_infrastructure" = "true" ]; then
    docker build --file "$repository_root/ops/postgres/Dockerfile" --target database \
      --tag "${POSTGRES_IMAGE_REPOSITORY:-qinglang-postgres}:${INFRA_IMAGE_TAG}" "$repository_root"
    docker build --file "$repository_root/ops/postgres/Dockerfile" --target backup \
      --tag "${BACKUP_IMAGE_REPOSITORY:-qinglang-backup}:${INFRA_IMAGE_TAG}" "$repository_root"
  fi
  docker build --file "$repository_root/apps/api/Dockerfile" --target migrate \
    --tag "${MIGRATE_IMAGE_REPOSITORY:-qinglang-migrate}:${IMAGE_TAG}" "$repository_root"
  docker build --file "$repository_root/apps/api/Dockerfile" --target api \
    --tag "${API_IMAGE_REPOSITORY:-qinglang-api}:${IMAGE_TAG}" "$repository_root"
  docker build --file "$repository_root/apps/web/Dockerfile" --target gateway \
    --tag "${GATEWAY_IMAGE_REPOSITORY:-qinglang-gateway}:${IMAGE_TAG}" "$repository_root"
fi

if ! docker image inspect \
    "${POSTGRES_IMAGE_REPOSITORY:-qinglang-postgres}:${INFRA_IMAGE_TAG}" \
    "${BACKUP_IMAGE_REPOSITORY:-qinglang-backup}:${INFRA_IMAGE_TAG}" >/dev/null 2>&1; then
  echo "infrastructure images are missing; rerun with --update-infra" >&2
  exit 66
fi

compose up -d postgres
compose --profile tools run --rm migrate
compose up -d api gateway backup monitor --remove-orphans

health_url="https://${SITE_ADDRESS}/v1/health/ready"
if [ "${PRODUCTION_SMOKE_TEST:-false}" = "true" ]; then
  health_url="https://${SITE_ADDRESS}:${PUBLIC_HTTPS_PORT}/v1/health/ready"
fi

attempt=1
while [ "$attempt" -le 30 ]; do
  curl_options="--fail --silent --show-error --max-time 10"
  if [ "${PRODUCTION_SMOKE_TEST:-false}" = "true" ]; then
    curl_options="$curl_options --insecure"
  fi
  if curl $curl_options "$health_url" >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    compose ps
    compose logs --tail 100 api gateway
    echo "deployment health verification failed" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ -n "$previous_tag" ] && [ "$previous_tag" != "$IMAGE_TAG" ]; then
  printf '%s' "$previous_tag" >"$DEPLOY_STATE_DIR/previous-image-tag"
fi
printf '%s' "$IMAGE_TAG" >"$DEPLOY_STATE_DIR/current-image-tag"
printf '%s\n' "Deployment succeeded for image tag $IMAGE_TAG."
printf '%s\n' "Database migrations are forward-only; application rollback does not reverse schema changes."
