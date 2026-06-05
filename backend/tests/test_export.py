"""Module 8: CRM connectors (unit) + export/sync approval gate (live DB)."""

from __future__ import annotations

import socket
import uuid
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.agent.runner import run_research_job
from app.config import settings
from app.db.models import Job
from app.db.session import SessionLocal
from app.main import app
from app.services.crm.base import LeadRecord
from app.services.crm.hubspot import HubSpotConnector
from app.services.crm.log import LogConnector
from app.services.llm import LLMResponse, ToolCall, Usage


def _rec(name: str, email: str) -> LeadRecord:
    return LeadRecord(company=name, domain=f"{name.lower()}.com", industry="SaaS",
                      location="NY", fit_score=80, contact_name="Dana Lee",
                      contact_title="VP Sales", contact_email=email,
                      message="Hi Dana, congrats on the raise.", signals=["funded"])


# ── connectors (unit) ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_log_connector_counts() -> None:
    res = await LogConnector().sync([_rec("Acme", "a@acme.com"), _rec("Beta", "b@beta.com")])
    assert res.provider == "log" and res.synced == 2 and res.failed == 0


@pytest.mark.asyncio
async def test_hubspot_isolates_failures() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "contacts" in request.url.path and b"bad@" in request.content:
            return httpx.Response(400, json={"message": "invalid"})
        return httpx.Response(201, json={"id": "1"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler),
                               base_url="https://api.hubapi.com")
    res = await HubSpotConnector(client=client).sync(
        [_rec("Good", "ok@x.com"), _rec("Bad", "bad@y.com")])
    assert res.synced == 1 and res.failed == 1 and res.errors


# ── export/sync gate (live DB) ───────────────────────────────────────────────
def _reachable(url: str, default_port: int) -> bool:
    try:
        parts = urlsplit(url)
        host = parts.hostname or "localhost"
        with socket.create_connection((host, parts.port or default_port), timeout=1):
            return True
    except OSError:
        return False


db_required = pytest.mark.skipif(
    not (_reachable(settings.database_url, 5432) and _reachable(settings.redis_url, 6379)),
    reason="Postgres/Redis not reachable",
)


class FakeAgentLLM:
    def __init__(self) -> None:
        self.n = 0

    async def complete(self, **kwargs) -> LLMResponse:
        self.n += 1
        args = {"name": f"Co {self.n}", "domain": f"co{self.n}.com", "industry": "SaaS",
                "insights": [{"text": "Series B", "source": "TC"}],
                "signals": [{"type": "funded"}],
                "contact": {"name": "Dana Lee", "title": "VP Sales"}}
        return LLMResponse(text="", stop_reason="tool_use", usage=Usage(10, 10, 0.001),
                           tool_calls=[ToolCall("e", "emit_result", args)])


async def _fake_draft(result, value_prop, **kwargs):
    return f"Hi Dana — congrats on the raise at {result.name}.", Usage(5, 5, 0.0)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _setup(client: AsyncClient, monkeypatch) -> tuple[dict, str, list[str]]:
    fake = FakeAgentLLM()  # shared so each job emits a distinct domain (no false dedupe)
    monkeypatch.setattr("app.agent.runner.get_llm", lambda: fake)
    monkeypatch.setattr("app.agent.runner.generate_draft", _fake_draft)
    email = f"u-{uuid.uuid4().hex[:8]}@e.com"
    tok = (await client.post("/auth/signup", json={"name": "T", "email": email,
            "password": "secret123", "company": "Acme"})).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    icp = (await client.post("/icp", headers=h, json={"name": "I", "criteria": {}})).json()
    camp = (await client.post("/campaigns", headers=h, json={
        "target_count": 2, "icp_profile_id": icp["id"]})).json()
    async with SessionLocal() as s:
        cid = uuid.UUID(camp["id"])
        job_ids = list(await s.scalars(select(Job.id).where(Job.campaign_id == cid)))
    for jid in job_ids:
        await run_research_job(str(jid))
    items = (await client.get(f"/companies?campaign={camp['id']}", headers=h)).json()["items"]
    draft_ids = [it["draft"]["id"] for it in items]
    return h, camp["id"], draft_ids


@db_required
async def test_export_requires_approval(client: AsyncClient, monkeypatch) -> None:
    h, camp_id, draft_ids = await _setup(client, monkeypatch)
    # nothing approved yet → export rejected (the gate)
    assert (await client.post(f"/campaigns/{camp_id}/export", headers=h)).status_code == 400

    for did in draft_ids:
        await client.post(f"/drafts/{did}/approve", headers=h)
    resp = await client.post(f"/campaigns/{camp_id}/export", headers=h)
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    body = resp.text.splitlines()
    assert body[0].startswith("Company,Domain")
    assert len(body) == 3  # header + 2 leads

    # exported drafts are no longer "approved" → second export is a no-op (gated)
    assert (await client.post(f"/campaigns/{camp_id}/export", headers=h)).status_code == 400


@db_required
async def test_sync_marks_exported(client: AsyncClient, monkeypatch) -> None:
    h, camp_id, draft_ids = await _setup(client, monkeypatch)
    for did in draft_ids:
        await client.post(f"/drafts/{did}/approve", headers=h)
    res = (await client.post(f"/campaigns/{camp_id}/sync", headers=h)).json()
    assert res["provider"] == "log" and res["synced"] == 2 and res["failed"] == 0
    # after sync they're exported, so export now finds nothing approved
    assert (await client.post(f"/campaigns/{camp_id}/export", headers=h)).status_code == 400
