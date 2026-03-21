#!/bin/bash
set -e
docker compose exec core-api alembic upgrade head
docker compose exec telemetry-ingestion alembic upgrade head
docker compose exec ai alembic upgrade head
