"""Google sign-in: token verification mocked, find-or-create + JWT (live DB)."""

from __future__ import annotations

import socket
import uuid
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.core.security import decode_access_token
from app.main import app
from app.services import auth as auth_svc


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


@pytest.fixture
def fake_google(monkeypatch):
    email = f"g-{uuid.uuid4().hex[:8]}@gmail.com"
    monkeypatch.setattr(settings, "google_client_id", "test-client-id")

    async def _fake_verify(token: str) -> dict:
        return {"email": email, "email_verified": True, "name": "Greer Google", "sub": "123"}

    monkeypatch.setattr(auth_svc, "_verify_google_token", _fake_verify)
    return email


async def test_google_signup_then_login(client: AsyncClient, fake_google) -> None:
    # first call → new user/org
    r1 = await client.post("/auth/google", json={"id_token": "x", "company": "Greer Co"})
    assert r1.status_code == 200
    body = r1.json()
    assert body["is_new"] is True
    payload = decode_access_token(body["access_token"])
    assert payload is not None and "org" in payload

    me = (await client.get("/auth/me",
          headers={"Authorization": f"Bearer {body['access_token']}"})).json()
    assert me["user"]["email"] == fake_google
    assert me["org"]["name"] == "Greer Co"

    # second call with same Google identity → existing user, not new
    r2 = await client.post("/auth/google", json={"id_token": "x"})
    assert r2.json()["is_new"] is False


async def test_google_requires_config(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "google_client_id", "")
    r = await client.post("/auth/google", json={"id_token": "x"})
    assert r.status_code == 401
