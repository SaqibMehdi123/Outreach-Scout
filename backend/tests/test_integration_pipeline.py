"""End-to-end pipeline test against real Postgres + Redis.

Skipped automatically if infra is unreachable. Run with `docker compose up -d db
redis` and `python -m scripts.init_db` first.
"""

from __future__ import annotations

import socket
import uuid
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


def _reachable(url: str, default_port: int) -> bool:
    try:
        parts = urlsplit(url)
        host = parts.hostname or "localhost"
        with socket.create_connection((host, parts.port or default_port), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not (_reachable(settings.database_url, 5432) and _reachable(settings.redis_url, 6379)),
    reason="Postgres/Redis not reachable",
)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def _auth(client: AsyncClient) -> dict[str, str]:
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post(
        "/auth/signup",
        json={"name": "Test User", "email": email, "password": "secret123",
              "company": "Acme GTM", "value_prop": "We do research."},
    )
    assert resp.status_code == 201, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def test_full_launch_pipeline(client: AsyncClient) -> None:
    headers = await _auth(client)

    # me reflects the org bootstrapped at signup
    me = (await client.get("/auth/me", headers=headers)).json()
    assert me["org"]["name"] == "Acme GTM"
    assert me["org"]["value_prop"] == "We do research."

    # create an ICP
    icp = await client.post(
        "/icp",
        headers=headers,
        json={"name": "B2B SaaS VPs",
              "criteria": {"industries": ["B2B SaaS"], "roles": ["VP Sales"],
                           "signals": ["funded", "hiring"]},
              "value_prop": "We do research."},
    )
    assert icp.status_code == 201, icp.text
    icp_id = icp.json()["id"]

    # launch a campaign → enqueues one job per candidate
    camp = await client.post(
        "/campaigns",
        headers=headers,
        json={"name": "Q3 push", "target_count": 5, "icp_profile_id": icp_id},
    )
    assert camp.status_code == 201, camp.text
    camp_id = camp.json()["id"]
    assert camp.json()["status"] == "running"

    # detail shows 5 queued jobs
    detail = (await client.get(f"/campaigns/{camp_id}", headers=headers)).json()
    assert detail["stats"]["queued"] == 5
    assert detail["stats"]["done"] == 0


async def test_tenant_isolation(client: AsyncClient) -> None:
    h1 = await _auth(client)
    h2 = await _auth(client)
    icp = (await client.post("/icp", headers=h1, json={"name": "Mine", "criteria": {}})).json()
    # tenant 2 cannot see tenant 1's ICP
    resp = await client.get(f"/icp/{icp['id']}", headers=h2)
    assert resp.status_code == 404
