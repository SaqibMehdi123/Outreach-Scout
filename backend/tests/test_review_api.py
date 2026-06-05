"""Module 7 backend: companies read API + draft review gate (live DB)."""

from __future__ import annotations

import socket
import uuid
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.agent.runner import run_research_job
from app.config import settings
from app.db.models import Job
from app.db.session import SessionLocal
from app.main import app
from app.services.llm import LLMResponse, ToolCall, Usage


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


class FakeAgentLLM:
    def __init__(self) -> None:
        self.n = 0

    async def complete(self, **kwargs) -> LLMResponse:
        self.n += 1
        args = {
            "name": f"Company {self.n}", "domain": f"co{self.n}.com",
            "industry": "B2B SaaS", "size": "120", "location": "Austin, United States",
            "insights": [{"text": "Series B", "source": "TechCrunch", "url": "https://x"}],
            "signals": [{"type": "funded"}],
            "contact": {"name": "Dana Whitford", "title": "VP Sales", "email_verified": True},
        }
        return LLMResponse(text="", stop_reason="tool_use", usage=Usage(20, 20, 0.002),
                           tool_calls=[ToolCall("e1", "emit_result", args)])


async def _fake_draft(result, value_prop, **kwargs):
    msg = f"Hi Dana — congrats on the raise at {result.name}. Worth 15 minutes?"
    return msg, Usage(10, 10, 0.001)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def _setup_campaign(client: AsyncClient, monkeypatch) -> tuple[dict, str]:
    fake = FakeAgentLLM()
    monkeypatch.setattr("app.agent.runner.get_llm", lambda: fake)
    monkeypatch.setattr("app.agent.runner.generate_draft", _fake_draft)

    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    tok = (await client.post("/auth/signup", json={
        "name": "T", "email": email, "password": "secret123", "company": "Acme"})).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    icp = (await client.post("/icp", headers=h, json={
        "name": "ICP", "criteria": {"industries": ["B2B SaaS"], "roles": ["VP Sales"],
                                     "signals": ["funded"]}})).json()
    camp = (await client.post("/campaigns", headers=h, json={
        "target_count": 2, "icp_profile_id": icp["id"]})).json()

    async with SessionLocal() as s:
        cid = uuid.UUID(camp["id"])
        job_ids = list(await s.scalars(select(Job.id).where(Job.campaign_id == cid)))
    for jid in job_ids:
        await run_research_job(str(jid))
    return h, camp["id"]


async def test_companies_list_and_detail(client: AsyncClient, monkeypatch) -> None:
    h, camp_id = await _setup_campaign(client, monkeypatch)

    page = (await client.get(f"/companies?campaign={camp_id}", headers=h)).json()
    assert page["total"] == 2
    assert len(page["items"]) == 2
    lead = page["items"][0]
    assert lead["fit_score"] > 0
    assert lead["contact"]["name"] == "Dana Whitford"
    assert lead["draft"]["status"] == "pending"

    detail = (await client.get(f"/companies/{lead['id']}", headers=h)).json()
    assert detail["trace"]["tokens"] > 0
    assert detail["insights"]["facts"]


async def test_draft_review_gate(client: AsyncClient, monkeypatch) -> None:
    h, camp_id = await _setup_campaign(client, monkeypatch)
    lead = (await client.get(f"/companies?campaign={camp_id}", headers=h)).json()["items"][0]
    draft_id = lead["draft"]["id"]

    approved = await client.post(f"/drafts/{draft_id}/approve", headers=h)
    assert approved.json()["status"] == "approved"
    edited = await client.patch(
        f"/drafts/{draft_id}", headers=h, json={"message": "Edited opener here."})
    assert edited.json()["message"] == "Edited opener here."
    discarded = await client.post(f"/drafts/{draft_id}/discard", headers=h)
    assert discarded.json()["status"] == "discarded"


async def test_stream_requires_valid_token(client: AsyncClient, monkeypatch) -> None:
    h, camp_id = await _setup_campaign(client, monkeypatch)
    # bad token rejected
    bad = await client.get(f"/campaigns/{camp_id}/stream?token=nope")
    assert bad.status_code == 401


async def test_tenant_cannot_read_others_company(client: AsyncClient, monkeypatch) -> None:
    h, camp_id = await _setup_campaign(client, monkeypatch)
    lead = (await client.get(f"/companies?campaign={camp_id}", headers=h)).json()["items"][0]
    # second tenant
    other = (await client.post("/auth/signup", json={
        "name": "O", "email": f"o-{uuid.uuid4().hex[:8]}@e.com", "password": "secret123"})).json()
    oh = {"Authorization": f"Bearer {other['access_token']}"}
    assert (await client.get(f"/companies/{lead['id']}", headers=oh)).status_code == 404
