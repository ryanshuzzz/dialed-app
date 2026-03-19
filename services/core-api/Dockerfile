# Dialed Core API — port 8001
# Build context must be the repo root:
#   docker build -f services/core-api/Dockerfile .

ARG PYTHON_VERSION=3.12

# ── Builder ──────────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY shared/ /build/shared/
RUN pip install --no-cache-dir /build/shared/

COPY services/core-api/requirements.txt /build/requirements.txt
COPY services/core-api/requirements-test.txt /build/requirements-test.txt
RUN pip install --no-cache-dir -r /build/requirements-test.txt

COPY services/core-api/ /build/service/

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY --from=builder /build/service/ /app/

RUN useradd --create-home --shell /bin/bash dialed
USER dialed
WORKDIR /app

ENV PORT=8001
EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
