"""Research-loop tests with a scripted fake LLM (no network, no keys)."""

from __future__ import annotations

import pytest

from app.agent.loop import ResearchAgent
from app.agent.tools.base import ToolResult
from app.schemas.icp import IcpCriteria
from app.services.llm import LLMResponse, ToolCall, Usage


class FakeLLM:
    def __init__(self, scripted: list[LLMResponse]) -> None:
        self._queue = list(scripted)
        self.calls = 0

    async def complete(self, **kwargs) -> LLMResponse:
        self.calls += 1
        return self._queue.pop(0)


class FakeRegistry:
    def __init__(self) -> None:
        self.invoked: list[str] = []

    def schemas(self) -> list[dict]:
        return []

    async def invoke(self, name: str, args: dict) -> ToolResult:
        self.invoked.append(name)
        return ToolResult(ok=True, data={"echo": args}, source="fake", untrusted=True)


def _emit(args: dict) -> LLMResponse:
    return LLMResponse(text="", tool_calls=[ToolCall("e1", "emit_result", args)],
                       stop_reason="tool_use", usage=Usage(10, 10, 0.001))


def _tool(name: str, args: dict) -> LLMResponse:
    return LLMResponse(text="working", tool_calls=[ToolCall("t1", name, args)],
                       stop_reason="tool_use", usage=Usage(10, 10, 0.001))


def _text(t: str = "done researching") -> LLMResponse:
    return LLMResponse(text=t, tool_calls=[], stop_reason="end_turn", usage=Usage(8, 8, 0.001))


CRITERIA = IcpCriteria(industries=["B2B SaaS"], roles=["VP Sales"], signals=["funded"])
SEED = {"name": "Acme", "domain": "acme.com"}

RESULT_ARGS = {
    "name": "Acme", "domain": "acme.com",
    "insights": [{"text": "Raised a Series B", "source": "TechCrunch"}],
    "contact": {"name": "Dana Whitford", "title": "VP Sales"},
}


@pytest.mark.asyncio
async def test_research_then_emit_completes() -> None:
    # research (tool) → emit in-loop captures the result directly (no finalize call)
    llm = FakeLLM([_tool("web_search", {"query": "acme funding"}), _emit(RESULT_ARGS)])
    reg = FakeRegistry()
    run = await ResearchAgent(llm, reg, max_steps=10).run(seed=SEED, criteria=CRITERIA)

    assert run.status == "done"
    assert run.result.name == "Acme"
    assert run.result.contact.title == "VP Sales"
    assert reg.invoked == ["web_search"]  # emit_result is not sent to the registry
    types = [t["type"] for t in run.trace]
    assert types == ["llm", "tool", "llm"]
    assert run.checkpoint["messages"]  # state captured for resume


@pytest.mark.asyncio
async def test_finalize_path_when_model_stops_with_text() -> None:
    # research (tool) → stop (text) → forced finalize emits the result
    llm = FakeLLM([_tool("web_search", {"query": "q"}), _text(), _emit(RESULT_ARGS)])
    run = await ResearchAgent(llm, FakeRegistry(), max_steps=10).run(seed=SEED, criteria=CRITERIA)
    assert run.status == "done"
    assert any(t["type"] == "finalize" for t in run.trace)


@pytest.mark.asyncio
async def test_early_emit_is_nudged_then_completes() -> None:
    # emit on turn 1 (no research yet) → nudged → researches → emits
    llm = FakeLLM([_emit(RESULT_ARGS), _tool("web_search", {"query": "q"}), _emit(RESULT_ARGS)])
    reg = FakeRegistry()
    run = await ResearchAgent(llm, reg, max_steps=10).run(seed=SEED, criteria=CRITERIA)
    assert run.status == "done"
    assert reg.invoked == ["web_search"]  # it did research before finishing


@pytest.mark.asyncio
async def test_step_cap_forces_finalize() -> None:
    # max_steps=1: after one tool step the loop exits and finalize forces emit.
    llm = FakeLLM([_tool("fetch_page", {"url": "https://acme.com"}), _emit(RESULT_ARGS)])
    reg = FakeRegistry()
    run = await ResearchAgent(llm, reg, max_steps=1).run(seed=SEED, criteria=CRITERIA)

    assert run.status == "done"
    assert run.result.domain == "acme.com"
    assert any(t["type"] == "finalize" for t in run.trace)


@pytest.mark.asyncio
async def test_nudged_to_research_before_finishing() -> None:
    # model tries to finish with no research → nudged once → then finalize
    llm = FakeLLM([_text("here's the answer"), _text("ok done"), _emit(RESULT_ARGS)])
    reg = FakeRegistry()
    run = await ResearchAgent(llm, reg, max_steps=5).run(seed=SEED, criteria=CRITERIA)
    assert run.status == "done"
    # two reasoning turns happened before finalize (the nudge added one)
    assert sum(1 for t in run.trace if t["type"] == "llm") == 2


@pytest.mark.asyncio
async def test_missing_fields_fall_back_to_seed() -> None:
    llm = FakeLLM([_tool("web_search", {"query": "x"}), _text(), _emit({"insights": []})])
    run = await ResearchAgent(llm, FakeRegistry(), max_steps=5).run(seed=SEED, criteria=CRITERIA)
    assert run.status == "done"
    assert run.result.name == "Acme"
    assert run.result.domain == "acme.com"


@pytest.mark.asyncio
async def test_sanitizes_hallucinated_contact() -> None:
    bad = {"name": "Acme", "domain": "acme.com",
           "contact": {"name": "UNTRUSTED_WEB_CONTENT", "title": "—"},
           "insights": [{"text": "UNTRUSTED_WEB_CONTENT from x"},
                        {"text": "Real fact", "source": "TC"}]}
    llm = FakeLLM([_tool("web_search", {"query": "x"}), _text(), _emit(bad)])
    run = await ResearchAgent(llm, FakeRegistry(), max_steps=5).run(seed=SEED, criteria=CRITERIA)
    assert run.result.contact.name is None
    assert run.result.contact.title is None
    assert [i.text for i in run.result.insights] == ["Real fact"]
