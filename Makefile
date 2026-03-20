dev:
	docker compose up

dev-build:
	docker compose up --build

migrate:
	./infra/scripts/migrate-all.sh

test-core:
	docker compose exec core-api pytest

test-telemetry:
	docker compose exec telemetry-ingestion pytest

test-ai:
	docker compose exec ai pytest

test-all:
	docker compose exec core-api pytest && \
	docker compose exec telemetry-ingestion pytest && \
	docker compose exec ai pytest

# Windows (GNU Make sets OS=Windows_NT): use PowerShell. Unix/macOS: bash script.
ifeq ($(OS),Windows_NT)
generate-types:
	powershell -NoProfile -ExecutionPolicy Bypass -File infra/scripts/generate-types.ps1
else
generate-types:
	./infra/scripts/generate-types.sh
endif

# Use this if `make generate-types` still invokes bash (e.g. non-GNU make on Windows).
generate-types-win:
	powershell -NoProfile -ExecutionPolicy Bypass -File infra/scripts/generate-types.ps1

seed:
	python infra/scripts/seed.py

clean:
	docker compose down -v
