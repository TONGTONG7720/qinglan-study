#!/bin/sh
set -eu

script_directory="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
repository_root="$(CDPATH= cd -- "$script_directory/../.." && pwd)"
environment_file="${1:-$repository_root/ops/production/production.env}"

docker compose \
  --env-file "$environment_file" \
  -f "$repository_root/compose.production.yaml" \
  run --rm backup once
