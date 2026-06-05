"""Structured output the research agent must produce per lead."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ResearchInsight(BaseModel):
    text: str = Field(description="A specific, sourced fact about the company")
    source: str | None = Field(default=None, description="Source name, e.g. TechCrunch")
    url: str | None = Field(default=None, description="Source URL")


class ResearchSignal(BaseModel):
    type: str = Field(description="funded | hiring | launch | exec | tech")
    detail: str | None = None


class ResearchContact(BaseModel):
    name: str | None = None
    title: str | None = None
    profile_url: str | None = None
    email: str | None = None
    email_verified: bool = False


class ResearchResult(BaseModel):
    """The agent's structured deliverable for one lead."""

    name: str
    domain: str
    industry: str | None = None
    size: str | None = None
    location: str | None = None
    insights: list[ResearchInsight] = Field(default_factory=list)
    signals: list[ResearchSignal] = Field(default_factory=list)
    contact: ResearchContact = Field(default_factory=ResearchContact)
    # Filled by later modules:
    fit_score: float | None = None   # Module 5
    draft: str | None = None         # Module 6


# Flat JSON schema for the forced ``emit_result`` tool (Anthropic tool_choice).
EMIT_RESULT_SCHEMA: dict = {
    "name": "emit_result",
    "description": "Emit the final structured research result for this company.",
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "domain": {"type": "string"},
            "industry": {"type": "string"},
            "size": {"type": "string"},
            "location": {"type": "string"},
            "insights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "source": {"type": "string"},
                        "url": {"type": "string"},
                    },
                    "required": ["text"],
                },
            },
            "signals": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": {"type": "string"},
                        "detail": {"type": "string"},
                    },
                    "required": ["type"],
                },
            },
            "contact": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "title": {"type": "string"},
                    "profile_url": {"type": "string"},
                    "email": {"type": "string"},
                    "email_verified": {"type": "boolean"},
                },
            },
        },
        "required": ["name", "domain"],
    },
}
