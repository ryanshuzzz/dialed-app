"""
Async Redis task queue helpers for the Dialed platform.

Redis is used solely as a task queue with two queues:

- ``dialed:ingestion`` — CSV, OCR, and voice ingestion jobs
- ``dialed:ai`` — AI suggestion generation jobs

Both queues use Redis Lists (``LPUSH`` to enqueue, ``BRPOP`` to dequeue).
Payloads are JSON-serialised dicts matching the schemas in
``contracts/json-schema/task-payloads.schema.json``.

Usage — producer (in a router)::

    from dialed_shared.redis_tasks import push_job

    await push_job(
        redis_url="redis://redis:6379",
        queue_name="dialed:ingestion",
        payload={"job_id": "...", "session_id": "...", ...},
    )

Usage — consumer (in a worker process)::

    from dialed_shared.redis_tasks import consume_jobs

    async def handle_job(payload: dict) -> None:
        # process the job ...
        pass

    await consume_jobs(
        redis_url="redis://redis:6379",
        queue_name="dialed:ingestion",
        handler=handle_job,
    )
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable, Coroutine

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


async def push_job(
    redis_url: str,
    queue_name: str,
    payload: dict[str, Any],
) -> None:
    """Push a job payload onto a Redis List queue.

    Serialises ``payload`` as JSON and ``LPUSH``es it to the named queue.
    The corresponding ``consume_jobs`` worker will ``BRPOP`` from the
    right end, giving FIFO ordering.

    Args:
        redis_url: Redis connection URL (e.g. ``redis://redis:6379``).
        queue_name: Queue name (e.g. ``dialed:ingestion``).
        payload: Job data dict — must be JSON-serialisable.
    """
    client = aioredis.from_url(redis_url, decode_responses=True)
    try:
        serialised = json.dumps(payload)
        await client.lpush(queue_name, serialised)
        logger.info("Pushed job to %s: job_id=%s", queue_name, payload.get("job_id"))
    finally:
        await client.aclose()


async def consume_jobs(
    redis_url: str,
    queue_name: str,
    handler: Callable[[dict[str, Any]], Coroutine[Any, Any, None]],
    timeout: int = 0,
) -> None:
    """Consume jobs from a Redis List queue in an infinite loop.

    Blocks on ``BRPOP`` waiting for jobs, deserialises the JSON payload,
    and calls ``handler(payload)``. If the handler raises an exception
    the error is logged but the loop continues — the job's database
    record should be marked as failed by the handler itself.

    This function runs forever and should be launched as the main
    entry point of a worker process.

    Args:
        redis_url: Redis connection URL.
        queue_name: Queue name to consume from.
        handler: Async callable that processes a single job payload dict.
        timeout: ``BRPOP`` timeout in seconds. ``0`` means block
            indefinitely (the default and recommended setting).
    """
    client = aioredis.from_url(redis_url, decode_responses=True)
    logger.info("Worker listening on queue: %s", queue_name)

    try:
        while True:
            result = await client.brpop(queue_name, timeout=timeout)
            if result is None:
                continue

            _queue_name, raw_payload = result
            try:
                payload = json.loads(raw_payload)
            except json.JSONDecodeError:
                logger.error("Invalid JSON on queue %s: %s", queue_name, raw_payload)
                continue

            job_id = payload.get("job_id", "unknown")
            logger.info("Processing job %s from %s", job_id, queue_name)

            try:
                await handler(payload)
                logger.info("Job %s completed successfully", job_id)
            except Exception:
                logger.exception("Job %s failed with unhandled exception", job_id)
    finally:
        await client.aclose()
