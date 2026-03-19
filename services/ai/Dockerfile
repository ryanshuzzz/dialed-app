# Dialed AI Service — port 8003
# Build context must be the repo root:
#   docker build -f services/ai/Dockerfile .

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

COPY services/ai/requirements.txt /build/requirements.txt
COPY services/ai/requirements-test.txt /build/requirements-test.txt
RUN pip install --no-cache-dir -r /build/requirements-test.txt

COPY services/ai/ /build/service/

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

ENV PORT=8003
EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
