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

generate-types:
	./infra/scripts/generate-types.sh

seed:
	python infra/scripts/seed.py

clean:
	docker compose down -v
