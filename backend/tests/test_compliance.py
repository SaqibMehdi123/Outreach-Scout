"""Module 9: compliance — domain normalise (unit) + suppression/settings API (live DB)."""

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
from app.services.compliance import _normalise


# ── unit ─────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("raw,expected", [
    ("https://www.Foo.com/path", "foo.com"),
    ("HTTP://Bar.io", "bar.io"),
    ("  competitor.com  ", "competitor.com"),
    ("www.baz.co", "baz.co"),
])
def test_normalise_domain(raw, expected) -> None:
    assert _normalise(raw) == expected


# ── api (live DB) ────────────────────────────────────────────────────────────
def _reachable(url: str, port: int) -> bool:
    try:
        p = urlsplit(url)
        with socket.create_connection((p.hostname or "localhost", p.port or port), timeout=1):
            return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not (_reachable(settings.database_url, 5432) and _reachable(settings.redis_url, 6379)),
    reason="Postgres/Redis not reachable",
)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _auth(client: AsyncClient) -> dict[str, str]:
    email = f"u-{uuid.uuid4().hex[:8]}@e.com"
    tok = (await client.post("/auth/signup", json={
        "name": "T", "email": email, "password": "secret123"})).json()
    return {"Authorization": f"Bearer {tok['access_token']}"}


async def test_compliance_defaults_and_update(client: AsyncClient) -> None:
    h = await _auth(client)
    comp = (await client.get("/settings/compliance", headers=h)).json()
    assert comp["settings"]["retention_days"] == 90
    assert comp["settings"]["gdpr_checks"] is True
    assert comp["suppressions"] == []

    updated = await client.put("/settings/compliance", headers=h, json={
        "retention_days": 30, "gdpr_checks": False, "canspam_footer": True})
    assert updated.json()["retention_days"] == 30
    again = (await client.get("/settings/compliance", headers=h)).json()
    assert again["settings"]["retention_days"] == 30
    assert again["settings"]["gdpr_checks"] is False


async def test_suppression_crud_and_normalise(client: AsyncClient) -> None:
    h = await _auth(client)
    created = await client.post("/settings/suppression", headers=h,
                                json={"domain": "https://www.Competitor.com", "reason": "rival"})
    assert created.status_code == 201
    assert created.json()["domain"] == "competitor.com"  # normalised
    sid = created.json()["id"]

    comp = (await client.get("/settings/compliance", headers=h)).json()
    assert [s["domain"] for s in comp["suppressions"]] == ["competitor.com"]

    assert (await client.delete(f"/settings/suppression/{sid}", headers=h)).status_code == 204
    comp2 = (await client.get("/settings/compliance", headers=h)).json()
    assert comp2["suppressions"] == []


async def test_suppression_tenant_scoped(client: AsyncClient) -> None:
    h1, h2 = await _auth(client), await _auth(client)
    s = (await client.post("/settings/suppression", headers=h1,
                           json={"domain": "secret.com"})).json()
    # tenant 2 cannot delete tenant 1's entry
    assert (await client.delete(f"/settings/suppression/{s['id']}", headers=h2)).status_code == 404
