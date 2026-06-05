"""End-to-end runner test against real Postgres + Redis with a scripted LLM.

Exercises the full persistence path the agent produces — company, contact,
pending draft, agent_trace, fit score, campaign completion — without needing any
API keys (the LLM and draft generator are faked).
"""

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
from app.db.models import AgentTrace, Campaign, CampaignStatus, Company, Contact, Draft, Job
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
    """Emits a complete result on the first call — no tools, no network."""

    def __init__(self) -> None:
        self.n = 0

    async def complete(self, **kwargs) -> LLMResponse:
        self.n += 1
        args = {
            "name": f"Company {self.n}",
            "domain": f"co{self.n}.com",
            "industry": "B2B SaaS",
            "size": "120",
            "location": "Austin, United States",
            "insights": [{"text": "Raised a $24M Series B", "source": "TechCrunch"}],
            "signals": [{"type": "funded"}],
            "contact": {"name": "Dana Whitford", "title": "VP Sales", "email_verified": True},
        }
        return LLMResponse(text="", stop_reason="tool_use", usage=Usage(20, 20, 0.002),
                           tool_calls=[ToolCall("e1", "emit_result", args)])


async def _fake_draft(result, value_prop, **kwargs):
    msg = (f"Hi Dana — congrats on the raise at {result.name}. We build the "
           "research layer so your SDRs start in conversations. Worth 15 minutes?")
    return msg, Usage(40, 60, 0.01)


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def test_runner_persists_full_lead(client: AsyncClient, monkeypatch) -> None:
    # One shared instance so each job emits a distinct domain (no false dedupe).
    fake = FakeAgentLLM()
    monkeypatch.setattr("app.agent.runner.get_llm", lambda: fake)
    monkeypatch.setattr("app.agent.runner.generate_draft", _fake_draft)

    # signup → ICP → launch (placeholder discovery, no anthropic key needed)
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    tok = (await client.post("/auth/signup", json={
        "name": "T", "email": email, "password": "secret123", "company": "Acme"})).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    icp = (await client.post("/icp", headers=h, json={
        "name": "ICP", "criteria": {"industries": ["B2B SaaS"], "roles": ["VP Sales"],
                                     "signals": ["funded"]}})).json()
    camp = (await client.post("/campaigns", headers=h, json={
        "target_count": 3, "icp_profile_id": icp["id"]})).json()
    camp_id = uuid.UUID(camp["id"])

    # fetch the 3 queued job ids
    async with SessionLocal() as s:
        job_ids = list(await s.scalars(select(Job.id).where(Job.campaign_id == camp_id)))
    assert len(job_ids) == 3

    # run each job through the real runner
    for jid in job_ids:
        out = await run_research_job(str(jid))
        assert out["status"] == "done", out

    # verify persisted artefacts
    async with SessionLocal() as s:
        companies = list(await s.scalars(select(Company).where(Company.campaign_id == camp_id)))
        assert len(companies) == 3
        assert all(c.fit_score and c.fit_score > 0 for c in companies)
        assert all(c.insights["facts"] for c in companies)

        contacts = list(await s.scalars(
            select(Contact).where(Contact.company_id.in_([c.id for c in companies]))))
        assert len(contacts) == 3

        drafts = list(await s.scalars(
            select(Draft).where(Draft.contact_id.in_([ct.id for ct in contacts]))))
        assert len(drafts) == 3
        assert all(d.status.value == "pending" for d in drafts)
        assert all("Dana" in d.message for d in drafts)

        traces = list(await s.scalars(select(AgentTrace).where(AgentTrace.job_id.in_(job_ids))))
        assert len(traces) == 3
        assert all(t.tokens > 0 for t in traces)

        campaign = await s.get(Campaign, camp_id)
        assert campaign.status == CampaignStatus.done
