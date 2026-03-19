"""Seed the database with sample development data."""

import asyncio
import os

# Placeholder — will be implemented when services have models and DB connections.
# Expected usage: python infra/scripts/seed.py


async def seed() -> None:
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:devpassword@localhost/dialed",
    )
    print(f"Seeding database at {database_url}")
    print("TODO: implement seed data once models are in place")


if __name__ == "__main__":
    asyncio.run(seed())
