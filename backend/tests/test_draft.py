"""Module 6: draft generation (fake premium LLM) + validation."""

from __future__ import annotations

import pytest

from app.agent.schemas import ResearchContact, ResearchInsight, ResearchResult
from app.services.draft import _validate, generate_draft
from app.services.llm import LLMResponse, ToolCall, Usage

RESULT = ResearchResult(
    name="Northwind", domain="northwind.io", industry="Data Observability",
    insights=[ResearchInsight(text="Raised a $24M Series B", source="TechCrunch")],
    contact=ResearchContact(name="Dana Whitford", title="VP Sales"),
)


class _FakeLLM:
    def __init__(self, message: str | None) -> None:
        self._message = message

    async def complete(self, **kwargs) -> LLMResponse:
        calls = [] if self._message is None else [
            ToolCall("d1", "emit_draft", {"message": self._message})
        ]
        return LLMResponse(text="", tool_calls=calls, stop_reason="tool_use",
                           usage=Usage(50, 80, 0.01))


def test_validate_rejects_placeholder() -> None:
    with pytest.raises(ValueError):
        _validate("Hi [Company], we help [X].")


def test_validate_rejects_too_short() -> None:
    with pytest.raises(ValueError):
        _validate("Hi.")


@pytest.mark.asyncio
async def test_generate_draft_ok() -> None:
    msg = ("Hi Dana — congrats on the $24M Series B. As you ramp the new SDR hires, "
           "the gap is giving them researched accounts on day one; we build that layer. "
           "Worth 15 minutes next week?")
    out, usage = await generate_draft(RESULT, "We build the research layer", llm=_FakeLLM(msg))
    assert out.startswith("Hi Dana")
    assert usage.total_tokens == 130


@pytest.mark.asyncio
async def test_generate_draft_invalid_returns_none() -> None:
    out, _ = await generate_draft(RESULT, "vp", llm=_FakeLLM("Hi [Name]"))
    assert out is None


@pytest.mark.asyncio
async def test_generate_draft_no_tool_call_returns_none() -> None:
    out, _ = await generate_draft(RESULT, "vp", llm=_FakeLLM(None))
    assert out is None
