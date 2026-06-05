"""Bounded ReAct research loop.

plan → call tool → observe → repeat, under three hard caps (max steps, token
budget, cost). Web content is sandboxed before the model sees it; the model can
only call allow-listed tools; the run ends with a forced ``emit_result`` so the
output is always structured. Every step is recorded to ``trace`` and the full
state is checkpointed each iteration so a crashed job can resume.
"""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from app.agent.prompts import SYSTEM, build_task_prompt
from app.agent.schemas import EMIT_RESULT_SCHEMA, ResearchResult
from app.agent.tools.registry import ToolRegistry
from app.config import settings
from app.observability.logging import get_logger
from app.schemas.icp import IcpCriteria
from app.services.llm import LLMClient, Tier, Usage

logger = get_logger(__name__)

# (progress 0..100, step, checkpoint) → persisted by the runner
StepSink = Callable[[int, int, dict], Awaitable[None]]


@dataclass
class AgentRun:
    status: str  # "done" | "failed"
    result: ResearchResult | None = None
    error: str | None = None
    trace: list[dict] = field(default_factory=list)
    usage: Usage = field(default_factory=Usage)
    checkpoint: dict = field(default_factory=dict)


class ResearchAgent:
    def __init__(
        self,
        llm: LLMClient,
        registry: ToolRegistry,
        *,
        max_steps: int | None = None,
        token_budget: int | None = None,
        max_cost: float | None = None,
    ) -> None:
        self.llm = llm
        self.registry = registry
        self.max_steps = max_steps or settings.agent_max_steps
        self.token_budget = token_budget or settings.agent_token_budget
        self.max_cost = max_cost or settings.agent_max_cost_usd
        # The model may research (allow-listed tools) or finish (emit_result) on
        # any turn. A guard prevents finishing before it has actually researched.
        self._tools = [*registry.schemas(), EMIT_RESULT_SCHEMA]

    async def run(
        self,
        *,
        seed: dict,
        criteria: IcpCriteria,
        value_prop: str | None = None,
        resume: dict | None = None,
        on_step: StepSink | None = None,
    ) -> AgentRun:
        if resume and resume.get("messages"):
            messages = resume["messages"]
            step = resume.get("step", 0)
            usage = Usage(**resume.get("usage", {}))
            trace = resume.get("trace", [])
        else:
            messages = [{"role": "user", "content": build_task_prompt(seed, criteria, value_prop)}]
            step, usage, trace = 0, Usage(), []
        nudged = False

        try:
            while not self._over_budget(step, usage):
                try:
                    resp = await self.llm.complete(
                        messages=messages, tier=Tier.PREMIUM, system=SYSTEM,
                        tools=self._tools, temperature=0.3, max_tokens=2048,
                    )
                except Exception as exc:  # noqa: BLE001
                    # A bad reasoning turn shouldn't waste the research already done —
                    # salvage by finalizing with what we have.
                    logger.warning("agent_step_error", step=step, error=str(exc))
                    if any(t["type"] == "tool" for t in trace):
                        break
                    raise
                usage = usage + resp.usage
                step += 1
                trace.append({"type": "llm", "step": step, "text": resp.text[:500],
                              "stop_reason": resp.stop_reason,
                              "tokens": resp.usage.total_tokens})

                fmt = getattr(self.llm, "message_format", "openai")
                messages.append(self._assistant_msg(resp, fmt))

                emit = next((tc for tc in resp.tool_calls if tc.name == "emit_result"), None)
                research_calls = [tc for tc in resp.tool_calls if tc.name != "emit_result"]

                # Execute any research tool calls and feed results back.
                if research_calls:
                    pairs = []
                    for tc in research_calls:
                        tr = await self.registry.invoke(tc.name, tc.arguments)
                        trace.append({"type": "tool", "step": step, "tool": tc.name,
                                      "args": tc.arguments, "ok": tr.ok,
                                      "source": tr.source, "untrusted": tr.untrusted,
                                      "error": tr.error})
                        pairs.append((tc, self._serialize_result(tr)))
                    messages.extend(self._tool_result_msgs(pairs, fmt))

                researched = any(t["type"] == "tool" for t in trace)

                if emit is not None:
                    # Don't let it finish before any research happened — nudge once.
                    if not researched and not nudged:
                        nudged = True
                        messages.extend(self._tool_result_msgs(
                            [(emit, "Use web_search/fetch_page to verify the company, "
                                    "its signals and the contact before emitting.")], fmt))
                        continue
                    await self._emit_progress(on_step, 100, step, messages, usage, trace)
                    return self._finish(emit.arguments, seed, trace, usage, messages, step)

                if not resp.tool_calls:
                    # text only → nudge to research once, else finalize
                    if not researched and not nudged:
                        nudged = True
                        messages.append({"role": "user", "content":
                            "Before finishing, use web_search and fetch_page to verify "
                            "the company, its signals and the right contact."})
                        continue
                    break

                await self._emit_progress(
                    on_step, self._progress(step), step, messages, usage, trace
                )

            return await self._finalize(seed, messages, trace, usage, step, on_step)
        except Exception as exc:  # noqa: BLE001 — isolate failure to this lead
            logger.exception("agent_run_failed", seed=seed)
            return AgentRun(status="failed", error=str(exc), trace=trace, usage=usage,
                            checkpoint=self._checkpoint(messages, step, usage, trace))

    # ── budget / progress ──────────────────────────────────────────────────────
    def _over_budget(self, step: int, usage: Usage) -> bool:
        return (
            step >= self.max_steps
            or usage.total_tokens >= self.token_budget
            or usage.cost_usd >= self.max_cost
        )

    def _progress(self, step: int) -> int:
        return min(90, int(step / max(1, self.max_steps) * 90))

    async def _emit_progress(self, on_step, progress, step, messages, usage, trace) -> None:
        if on_step is not None:
            await on_step(progress, step, self._checkpoint(messages, step, usage, trace))

    # ── finalize via forced emit_result ──────────────────────────────────────────
    async def _finalize(self, seed, messages, trace, usage, step, on_step) -> AgentRun:
        messages.append({"role": "user",
                         "content": "Summarise your findings now by calling emit_result."})
        resp = await self.llm.complete(
            messages=messages, tier=Tier.CHEAP, system=SYSTEM,
            tools=[EMIT_RESULT_SCHEMA], force_tool="emit_result",
            temperature=0.2, max_tokens=2048,
        )
        usage = usage + resp.usage
        step += 1
        trace.append({"type": "finalize", "step": step, "tokens": resp.usage.total_tokens})
        emit = next((tc for tc in resp.tool_calls if tc.name == "emit_result"), None)
        if emit is None:
            return AgentRun(status="failed", error="model did not emit a result",
                            trace=trace, usage=usage,
                            checkpoint=self._checkpoint(messages, step, usage, trace))
        await self._emit_progress(on_step, 100, step, messages, usage, trace)
        return self._finish(emit.arguments, seed, trace, usage, messages, step)

    def _finish(self, args, seed, trace, usage, messages, step) -> AgentRun:
        try:
            payload = dict(args)
            payload.setdefault("name", seed.get("hint") or seed.get("name") or "Unknown")
            payload.setdefault("domain", seed.get("domain") or "")
            result = ResearchResult.model_validate(payload)
            self._sanitize(result)
        except Exception as exc:  # noqa: BLE001
            return AgentRun(status="failed", error=f"invalid result: {exc}",
                            trace=trace, usage=usage,
                            checkpoint=self._checkpoint(messages, step, usage, trace))
        return AgentRun(status="done", result=result, trace=trace, usage=usage,
                        checkpoint=self._checkpoint(messages, step, usage, trace))

    @staticmethod
    def _sanitize(result: ResearchResult) -> None:
        """Drop hallucinated values that echo the sandbox markers or placeholders."""
        def bad(v: str | None) -> bool:
            return bool(v) and ("UNTRUSTED" in v or v.strip() in {"—", "N/A", "unknown"})

        c = result.contact
        if bad(c.name):
            c.name = None
        if bad(c.title):
            c.title = None
        result.insights = [i for i in result.insights if i.text and not bad(i.text)]

    # ── message construction (provider-aware) ─────────────────────────────────────
    @staticmethod
    def _serialize_result(tr) -> str:
        if tr.ok:
            return json.dumps(tr.data, default=str)[:12_000]
        return f"ERROR: {tr.error}"

    @staticmethod
    def _assistant_msg(resp, fmt: str) -> dict[str, Any]:
        if fmt == "anthropic":
            content: list[dict] = []
            if resp.text:
                content.append({"type": "text", "text": resp.text})
            for tc in resp.tool_calls:
                content.append(
                    {"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.arguments}
                )
            if not content:
                content.append({"type": "text", "text": "(no content)"})
            return {"role": "assistant", "content": content}
        # openai
        msg: dict[str, Any] = {"role": "assistant", "content": resp.text or None}
        if resp.tool_calls:
            msg["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.name, "arguments": json.dumps(tc.arguments)}}
                for tc in resp.tool_calls
            ]
        return msg

    @staticmethod
    def _tool_result_msgs(pairs: list[tuple], fmt: str) -> list[dict[str, Any]]:
        if fmt == "anthropic":
            blocks = [{"type": "tool_result", "tool_use_id": tc.id, "content": body}
                      for tc, body in pairs]
            return [{"role": "user", "content": blocks}]
        # openai: one tool message per call
        return [{"role": "tool", "tool_call_id": tc.id, "content": body}
                for tc, body in pairs]

    @staticmethod
    def _checkpoint(messages, step, usage, trace) -> dict:
        return {"messages": messages, "step": step,
                "usage": {"input_tokens": usage.input_tokens,
                          "output_tokens": usage.output_tokens,
                          "cost_usd": usage.cost_usd},
                "trace": trace}
