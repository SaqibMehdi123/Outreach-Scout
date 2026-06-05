"""Unit tests for the OpenAI-compatible LLM client (Groq/Gemini/OpenRouter/Ollama).

Validates request translation (neutral tools → OpenAI function tools, force_tool →
tool_choice) and response parsing, with a mocked OpenAI client (no key/network).
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.services.llm import LLMResponse, OpenAICompatClient, Tier


class _FakeCompletions:
    def __init__(self) -> None:
        self.last_kwargs = None

    async def create(self, **kwargs):
        self.last_kwargs = kwargs
        fn = SimpleNamespace(name="emit_result", arguments=json.dumps({"name": "Acme"}))
        tc = SimpleNamespace(id="call_1", function=fn)
        message = SimpleNamespace(content="thinking...", tool_calls=[tc])
        choice = SimpleNamespace(message=message, finish_reason="tool_calls")
        usage = SimpleNamespace(prompt_tokens=11, completion_tokens=7)
        return SimpleNamespace(choices=[choice], usage=usage)


def _client() -> tuple[OpenAICompatClient, _FakeCompletions]:
    c = OpenAICompatClient()
    fake = _FakeCompletions()
    c._client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return c, fake


@pytest.mark.asyncio
async def test_translates_tools_and_force_tool() -> None:
    client, fake = _client()
    tools = [{"name": "emit_result", "description": "emit",
              "input_schema": {"type": "object", "properties": {}}}]
    resp = await client.complete(
        messages=[{"role": "user", "content": "hi"}],
        tier=Tier.CHEAP, system="be terse", tools=tools, force_tool="emit_result",
    )
    kw = fake.last_kwargs
    # system prepended as a system message
    assert kw["messages"][0] == {"role": "system", "content": "be terse"}
    # neutral tool → openai function tool
    assert kw["tools"][0]["type"] == "function"
    assert kw["tools"][0]["function"]["name"] == "emit_result"
    # forced tool choice
    assert kw["tool_choice"] == {"type": "function", "function": {"name": "emit_result"}}
    # response parsed
    assert isinstance(resp, LLMResponse)
    assert resp.text == "thinking..."
    assert resp.tool_calls[0].name == "emit_result"
    assert resp.tool_calls[0].arguments == {"name": "Acme"}
    assert resp.usage.input_tokens == 11 and resp.usage.output_tokens == 7


@pytest.mark.asyncio
async def test_auto_tool_choice_without_force() -> None:
    client, fake = _client()
    await client.complete(
        messages=[{"role": "user", "content": "hi"}],
        tools=[{"name": "x", "description": "", "input_schema": {"type": "object"}}],
    )
    assert fake.last_kwargs["tool_choice"] == "auto"


def test_message_format_is_openai() -> None:
    client, _ = _client()
    assert client.message_format == "openai"
