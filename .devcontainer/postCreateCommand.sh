#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

corepack enable
corepack prepare pnpm@9.15.4 --activate

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
else
  echo ".env already exists; leaving it unchanged."
fi

corepack pnpm install

docker version
docker compose version

echo "Revealth Codespaces post-create setup complete."
echo "Next: docker compose up -d && corepack pnpm db:generate && corepack pnpm db:deploy && corepack pnpm db:seed"
