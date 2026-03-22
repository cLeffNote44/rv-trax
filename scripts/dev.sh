#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Starting infrastructure (PostgreSQL, Redis, Mosquitto)..."
docker compose -f "$ROOT_DIR/infrastructure/docker/docker-compose.yml" up -d postgres redis mosquitto

echo "==> Waiting for PostgreSQL to be ready..."
until docker exec rvtrax-postgres pg_isready -U rvtrax -q 2>/dev/null; do
  sleep 1
done
echo "    PostgreSQL is ready."

echo "==> Waiting for Redis to be ready..."
until docker exec rvtrax-redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "    Redis is ready."

# Copy .env if not exists
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "==> Creating .env from .env.example..."
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  # Generate a random JWT_SECRET if it's still the placeholder
  if grep -q 'change-this-to-a-random-64-char-string' "$ROOT_DIR/.env"; then
    JWT=$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)
    sed -i "s|change-this-to-a-random-64-char-string|${JWT}|" "$ROOT_DIR/.env"
    echo "    Generated random JWT_SECRET"
  fi
fi

# Source .env
set -a
source "$ROOT_DIR/.env"
set +a

echo "==> Running database migrations..."
cd "$ROOT_DIR"
pnpm --filter @rv-trax/db db:migrate

echo "==> Building packages..."
pnpm --filter @rv-trax/shared build
pnpm --filter @rv-trax/db build

echo ""
echo "==> Infrastructure ready! Start the API with:"
echo "    pnpm --filter @rv-trax/api dev"
echo ""
echo "    Or start everything:"
echo "    pnpm dev"
