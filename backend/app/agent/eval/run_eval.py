"""Golden-ICP eval harness.

Runs the research agent against a fixed set of known companies and scores
research relevance: did it complete, produce enough sourced insights, classify
the industry correctly, and identify a contact?  Reports per-case + aggregate
metrics and a mean cost/lead (cost-control signal).

Run:  python -m app.agent.eval.run_eval
Requires ANTHROPIC_API_KEY and the tool provider keys to be configured.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from app.agent.loop import ResearchAgent
from app.agent.schemas import ResearchResult
from app.agent.tools.registry import ToolRegistry
from app.config import settings
from app.schemas.icp import IcpCriteria
from app.services.llm import get_llm

DATASET = Path(__file__).with_name("golden_icp.json")


def _score(result: ResearchResult, expect: dict[str, Any]) -> dict[str, Any]:
    industry_ok = True
    pat = expect.get("industry_contains")
    if pat:
        industry_ok = bool(re.search(pat, (result.industry or ""), re.I))
    insights_ok = len(result.insights) >= expect.get("min_insights", 1)
    sourced = sum(1 for i in result.insights if i.source or i.url)
    contact_ok = (not expect.get("contact_required")) or bool(result.contact.name)
    passed = industry_ok and insights_ok and contact_ok
    return {
        "passed": passed, "industry_ok": industry_ok, "insights": len(result.insights),
        "sourced_insights": sourced, "contact_ok": contact_ok,
    }


async def run() -> dict[str, Any]:
    if not settings.anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY required to run the eval")

    data = json.loads(DATASET.read_text())
    criteria = IcpCriteria.model_validate(data["criteria"])
    agent = ResearchAgent(get_llm(), ToolRegistry())

    rows, costs = [], []
    for case in data["cases"]:
        run_res = await agent.run(
            seed=case["seed"], criteria=criteria,
            value_prop="We build the research + personalization layer for SDRs.",
        )
        costs.append(run_res.usage.cost_usd)
        if run_res.status != "done" or run_res.result is None:
            rows.append({"seed": case["seed"]["name"], "passed": False,
                         "error": run_res.error, "cost": run_res.usage.cost_usd})
            continue
        sc = _score(run_res.result, case["expect"])
        sc.update(seed=case["seed"]["name"], cost=round(run_res.usage.cost_usd, 4))
        rows.append(sc)

    passed = sum(1 for r in rows if r.get("passed"))
    report = {
        "total": len(rows), "passed": passed,
        "pass_rate": round(passed / len(rows), 2) if rows else 0,
        "mean_cost_usd": round(sum(costs) / len(costs), 4) if costs else 0,
        "cases": rows,
    }
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    asyncio.run(run())
