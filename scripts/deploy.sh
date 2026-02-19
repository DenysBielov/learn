#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Pulling latest code..."
git pull

echo "==> Pulling latest image and starting containers..."
docker compose pull
docker compose up -d

echo "==> Done! App should be available at http://localhost:3000"
echo "==> Watchtower will auto-update on future pushes to main."
