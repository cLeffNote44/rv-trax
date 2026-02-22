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
  # Patch DATABASE_URL for local dev
  sed -i 's|postgresql://rvtrax:rvtrax_dev@localhost:5432/rvtrax|postgresql://rvtrax:rvtrax_dev@localhost:5432/rvtrax|' "$ROOT_DIR/.env"
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
