"""Dev-only DB bootstrap: enable pgvector + create all tables from models.

For local development you can run this instead of migrations:
    python -m scripts.init_db

In CI/production use Alembic instead:
    alembic upgrade head            # enables pgvector (0001)
    alembic revision --autogenerate -m "schema"   # then generate tables
    alembic upgrade head
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from app.db import models  # noqa: F401  (register models)
from app.db.base import Base
from app.db.session import engine


async def main() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("DB initialised: pgvector enabled, tables created.")


if __name__ == "__main__":
    asyncio.run(main())
