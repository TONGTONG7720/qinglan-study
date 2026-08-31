#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="${1:-$repository_root/ops/production/production.env}"
requested_backup="${2:-}"
docker_environment_file="$environment_file"
docker_compose_file="$repository_root/compose.production.yaml"

set -a
. "$environment_file"
set +a

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    docker_environment_file="$(cygpath -w "$(realpath "$environment_file")")"
    docker_compose_file="$(cygpath -w "$repository_root/compose.production.yaml")"
    export MSYS_NO_PATHCONV=1
    ;;
esac

container_backup_path=""
if [ -n "$requested_backup" ]; then
  case "$requested_backup" in
    qinglang-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.dump)
      container_backup_path="/backups/$requested_backup"
      ;;
    *) echo "backup argument must be a qinglang dump basename" >&2; exit 64 ;;
  esac
fi

if [ -n "$container_backup_path" ]; then
  docker compose \
    --env-file "$docker_environment_file" \
    -f "$docker_compose_file" \
    --profile tools \
    run --rm restore-tool "$container_backup_path"
else
  docker compose \
    --env-file "$docker_environment_file" \
    -f "$docker_compose_file" \
    --profile tools \
    run --rm restore-tool
fi
