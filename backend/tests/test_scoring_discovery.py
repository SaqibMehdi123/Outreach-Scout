"""Module 5: fit scoring (pure) + discovery (fake LLM, dedupe, fallback)."""

from __future__ import annotations

import pytest

from app.agent.schemas import ResearchContact, ResearchInsight, ResearchResult, ResearchSignal
from app.config import settings
from app.schemas.icp import IcpCriteria
from app.services.discovery import discover_candidates
from app.services.llm import LLMResponse, ToolCall, Usage
from app.services.scoring import compute_fit_score

CRITERIA = IcpCriteria(
    industries=["B2B SaaS"], sizes=["m"], geos=["United States"],
    roles=["VP Sales"], signals=["funded", "hiring"],
)


def _strong() -> ResearchResult:
    return ResearchResult(
        name="Acme", domain="acme.com", industry="B2B SaaS", size="120",
        location="Austin, United States",
        insights=[ResearchInsight(text="Series B", source="TC"),
                  ResearchInsight(text="Hiring", source="GH"),
                  ResearchInsight(text="Launch", source="PH")],
        signals=[ResearchSignal(type="funded"), ResearchSignal(type="hiring")],
        contact=ResearchContact(name="Dana", title="VP Sales", email_verified=True),
    )


# ── scoring ──────────────────────────────────────────────────────────────────
def test_strong_lead_scores_high() -> None:
    assert compute_fit_score(_strong(), CRITERIA) >= 90


def test_weak_lead_scores_low() -> None:
    weak = ResearchResult(name="X", domain="x.com")
    assert compute_fit_score(weak, CRITERIA) < 30


def test_partial_signal_match_scales() -> None:
    r = _strong()
    r.signals = [ResearchSignal(type="funded")]  # 1 of 2 wanted
    full = compute_fit_score(_strong(), CRITERIA)
    half = compute_fit_score(r, CRITERIA)
    assert half < full


# ── discovery ──────────────────────────────────────────────────────────────────
class _FakeLLM:
    def __init__(self, candidates: list[dict]) -> None:
        self._candidates = candidates

    async def complete(self, **kwargs) -> LLMResponse:
        return LLMResponse(
            text="", stop_reason="tool_use", usage=Usage(5, 5, 0.0),
            tool_calls=[ToolCall("c1", "emit_candidates", {"candidates": self._candidates})],
        )


@pytest.mark.asyncio
async def test_discovery_dedupes_and_excludes(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_api_key", "test-key")
    llm = _FakeLLM([
        {"name": "Acme", "domain": "acme.com"},
        {"name": "Acme Dup", "domain": "acme.com"},   # dup domain
        {"name": "Known", "domain": "known.com"},      # already researched
        {"name": "Fresh", "domain": "fresh.com"},
    ])
    seeds = await discover_candidates(
        CRITERIA, 10, existing_domains=["known.com"], llm=llm
    )
    domains = [s["domain"] for s in seeds]
    assert domains == ["acme.com", "fresh.com"]


@pytest.mark.asyncio
async def test_discovery_fallback_without_key(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "llm_base_url", "https://api.groq.com/openai/v1")
    seeds = await discover_candidates(CRITERIA, 3)
    assert len(seeds) == 3
    assert all(s.get("placeholder") for s in seeds)
