"""Discovery placeholder-seed tests (no LLM configured → deterministic fallback)."""

from __future__ import annotations

import pytest

from app.config import settings
from app.schemas.icp import IcpCriteria
from app.services.discovery import discover_candidates


@pytest.fixture(autouse=True)
def _no_llm(monkeypatch):
    # Force the keyless fallback path regardless of the local .env.
    monkeypatch.setattr(settings, "llm_provider", "openai")
    monkeypatch.setattr(settings, "llm_api_key", "")
    monkeypatch.setattr(settings, "llm_base_url", "https://api.groq.com/openai/v1")


@pytest.mark.asyncio
async def test_placeholder_seeds_carry_criteria() -> None:
    criteria = IcpCriteria(industries=["Fintech"], roles=["CRO"], signals=["funded"])
    seeds = await discover_candidates(criteria, 7)
    assert len(seeds) == 7
    assert all(s["industry"] == "Fintech" for s in seeds)
    assert all(s["target_role"] == "CRO" for s in seeds)
    assert all(s["signals"] == ["funded"] for s in seeds)


@pytest.mark.asyncio
async def test_placeholder_defaults_when_empty_criteria() -> None:
    seeds = await discover_candidates(IcpCriteria(), 3)
    assert len(seeds) == 3
    assert seeds[0]["industry"] == "B2B SaaS"
    assert seeds[0]["target_role"] == "VP Sales"
