"""Provider-agnostic LLM wrapper.

Two tiers per the cost-control NFR (CHEAP for routine extraction, PREMIUM for the
final draft) and two backends:

  * ``OpenAICompatClient`` — any OpenAI-compatible endpoint: Groq (default, free),
    Google Gemini, OpenRouter, Ollama (local). Selected with LLM_PROVIDER=openai.
  * ``AnthropicClient``    — Claude. Selected with LLM_PROVIDER=anthropic.

Both return a normalized ``LLMResponse`` (text + tool calls + token usage) and
expose ``message_format`` so the agent loop can build provider-correct
conversation turns. Pricing is approximate $/MTok; free providers resolve to 0.
"""

from __future__ import annotations

import enum
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.config import settings


class Tier(enum.StrEnum):
    CHEAP = "cheap"
    PREMIUM = "premium"


# Approximate USD per 1M tokens (input, output). Unknown/free models → 0.
_PRICING: dict[str, tuple[float, float]] = {
    "claude-haiku-4-5-20251001": (1.0, 5.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-opus-4-8": (15.0, 75.0),
}


@dataclass(slots=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens

    def __add__(self, other: Usage) -> Usage:
        return Usage(
            self.input_tokens + other.input_tokens,
            self.output_tokens + other.output_tokens,
            self.cost_usd + other.cost_usd,
        )


@dataclass(slots=True)
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(slots=True)
class LLMResponse:
    text: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    stop_reason: str | None = None
    usage: Usage = field(default_factory=Usage)


def _cost(model: str, input_tokens: int, output_tokens: int) -> float:
    in_price, out_price = _PRICING.get(model, (0.0, 0.0))
    return (input_tokens * in_price + output_tokens * out_price) / 1_000_000


class LLMClient(ABC):
    """Provider interface. ``message_format`` is 'openai' or 'anthropic'."""

    message_format: str = "openai"

    @abstractmethod
    def model_for(self, tier: Tier) -> str: ...

    @abstractmethod
    async def complete(
        self,
        *,
        messages: list[dict[str, Any]],
        tier: Tier = Tier.CHEAP,
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        force_tool: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.4,
    ) -> LLMResponse: ...


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI-compatible (Groq / Gemini / OpenRouter / Ollama)
# ─────────────────────────────────────────────────────────────────────────────
class OpenAICompatClient(LLMClient):
    message_format = "openai"

    def __init__(self) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key or "not-needed",
        )

    def model_for(self, tier: Tier) -> str:
        return settings.llm_model_premium if tier is Tier.PREMIUM else settings.llm_model_cheap

    @staticmethod
    def _to_openai_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [
            {"type": "function", "function": {
                "name": t["name"], "description": t.get("description", ""),
                "parameters": t["input_schema"]}}
            for t in tools
        ]

    async def complete(self, *, messages, tier=Tier.CHEAP, system=None, tools=None,
                       force_tool=None, max_tokens=2048, temperature=0.4) -> LLMResponse:
        model = self.model_for(tier)
        msgs = ([{"role": "system", "content": system}] if system else []) + messages
        kwargs: dict[str, Any] = {
            "model": model, "messages": msgs,
            "max_tokens": max_tokens, "temperature": temperature,
        }
        if tools:
            kwargs["tools"] = self._to_openai_tools(tools)
            kwargs["tool_choice"] = (
                {"type": "function", "function": {"name": force_tool}}
                if force_tool else "auto"
            )

        resp = await self._client.chat.completions.create(**kwargs)
        choice = resp.choices[0]
        msg = choice.message

        tool_calls: list[ToolCall] = []
        for tc in (msg.tool_calls or []):
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            tool_calls.append(ToolCall(id=tc.id, name=tc.function.name, arguments=args))

        u = resp.usage
        usage = Usage(
            input_tokens=getattr(u, "prompt_tokens", 0) or 0,
            output_tokens=getattr(u, "completion_tokens", 0) or 0,
            cost_usd=_cost(model, getattr(u, "prompt_tokens", 0) or 0,
                           getattr(u, "completion_tokens", 0) or 0),
        )
        return LLMResponse(text=msg.content or "", tool_calls=tool_calls,
                           stop_reason=choice.finish_reason, usage=usage)


# ─────────────────────────────────────────────────────────────────────────────
# Anthropic (Claude) — optional
# ─────────────────────────────────────────────────────────────────────────────
class AnthropicClient(LLMClient):
    message_format = "anthropic"

    def __init__(self) -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    def model_for(self, tier: Tier) -> str:
        return settings.llm_model_premium if tier is Tier.PREMIUM else settings.llm_model_cheap

    async def complete(self, *, messages, tier=Tier.CHEAP, system=None, tools=None,
                       force_tool=None, max_tokens=2048, temperature=0.4) -> LLMResponse:
        model = self.model_for(tier)
        kwargs: dict[str, Any] = {
            "model": model, "max_tokens": max_tokens,
            "temperature": temperature, "messages": messages,
        }
        if system is not None:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        if force_tool:
            kwargs["tool_choice"] = {"type": "tool", "name": force_tool}

        resp = await self._client.messages.create(**kwargs)
        text_parts, tool_calls = [], []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_calls.append(
                    ToolCall(id=block.id, name=block.name, arguments=dict(block.input))
                )

        usage = Usage(
            input_tokens=resp.usage.input_tokens, output_tokens=resp.usage.output_tokens,
            cost_usd=_cost(model, resp.usage.input_tokens, resp.usage.output_tokens),
        )
        return LLMResponse(text="".join(text_parts), tool_calls=tool_calls,
                           stop_reason=resp.stop_reason, usage=usage)


_default_client: LLMClient | None = None


def get_llm() -> LLMClient:
    global _default_client
    if _default_client is None:
        if settings.llm_provider == "anthropic":
            _default_client = AnthropicClient()
        else:
            _default_client = OpenAICompatClient()
    return _default_client
