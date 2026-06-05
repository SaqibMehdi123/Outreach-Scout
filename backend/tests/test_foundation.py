"""Smoke tests for the Module 0 foundation."""

from __future__ import annotations

from app.config import settings
from app.db import models
from app.services.llm import Tier, Usage, _cost


def test_settings_load() -> None:
    assert settings.llm_model_cheap
    assert settings.agent_max_steps > 0
    assert settings.agent_token_budget > 0


def test_models_registered() -> None:
    tables = set(models.Base.metadata.tables)
    expected = {
        "orgs",
        "users",
        "icp_profiles",
        "campaigns",
        "jobs",
        "companies",
        "contacts",
        "drafts",
        "agent_traces",
    }
    assert expected.issubset(tables)


def test_usage_add_and_cost() -> None:
    a = Usage(input_tokens=100, output_tokens=50, cost_usd=0.1)
    b = Usage(input_tokens=10, output_tokens=5, cost_usd=0.01)
    total = a + b
    assert total.total_tokens == 165
    assert round(total.cost_usd, 3) == 0.11


def test_cost_uses_pricing_table() -> None:
    cost = _cost("claude-haiku-4-5-20251001", 1_000_000, 1_000_000)
    assert cost == 6.0  # 1.0 in + 5.0 out per MTok


def test_tier_enum() -> None:
    assert Tier.CHEAP.value == "cheap"
    assert Tier.PREMIUM.value == "premium"
