#!/usr/bin/env bash
set -euo pipefail

compose=(
  docker compose
  --env-file /srv/cardyx/secrets/cardyx-api.env
  -f /srv/cardyx/app/backend/docker-compose.production.yml
  -f /srv/cardyx/app/backend/docker-compose.oura.production.yml
  -f /srv/cardyx/compose/cardyx-api-pool-state-pause.yml
)

config_hash() {
  "${compose[@]}" run --rm --no-deps --entrypoint sha256sum oura-config /run/oura/daemon.toml 2>/dev/null \
    | awk '{print $1}' || true
}

before=$(config_hash)
"${compose[@]}" run --rm --no-deps oura-config
after=$(config_hash)

if [[ -z "$after" ]]; then
  echo "Oura filter config was not generated." >&2
  exit 1
fi

if [[ "$before" != "$after" ]]; then
  "${compose[@]}" up -d --no-deps --no-build --force-recreate oura
  echo "Oura restarted with the current validated pool addresses."
else
  echo "Oura pool-address filter is unchanged."
fi