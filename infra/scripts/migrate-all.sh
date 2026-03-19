#!/usr/bin/env bash
# Run Alembic migrations for all services sequentially.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

SERVICES=("core-api" "telemetry-ingestion" "ai")

for svc in "${SERVICES[@]}"; do
  svc_dir="$REPO_ROOT/services/$svc"
  if [ -d "$svc_dir/alembic" ]; then
    echo "==> Running migrations for $svc"
    (cd "$svc_dir" && alembic upgrade head)
  else
    echo "==> Skipping $svc (no alembic/ directory)"
  fi
done

echo "==> All migrations complete"
