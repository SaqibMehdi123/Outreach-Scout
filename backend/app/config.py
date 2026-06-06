"""Application settings, loaded from environment / .env.

A single ``settings`` instance is imported across the app. Secrets are read from
the environment so they can be vaulted in production and never committed.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Core ─────────────────────────────────────────────────────────────────
    environment: str = "development"
    secret_key: str = "change-me"
    log_level: str = "INFO"
    # Comma-separated allowed browser origins for CORS. In prod set this to the
    # deployed frontend URL, e.g. CORS_ORIGINS=https://your-app.vercel.app
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # ── Infra ────────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://outreach:outreach@localhost:5432/outreach_scout"
    redis_url: str = "redis://localhost:6379/0"

    # ── LLM ──────────────────────────────────────────────────────────────────
    # Provider: "openai" (OpenAI-compatible: Groq/Gemini/OpenRouter/Ollama) or "anthropic".
    llm_provider: str = "openai"
    # OpenAI-compatible endpoint. Default = Groq (free).
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""  # Groq / OpenRouter / Gemini key (Ollama: any value)
    llm_model_cheap: str = "llama-3.1-8b-instant"
    llm_model_premium: str = "openai/gpt-oss-120b"
    # Used only when llm_provider == "anthropic".
    anthropic_api_key: str = ""

    # ── Observability ─────────────────────────────────────────────────────────
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"

    # ── Agent budget caps (per lead) ──────────────────────────────────────────
    agent_max_steps: int = 12
    agent_token_budget: int = 120_000
    agent_max_cost_usd: float = 0.50

    # ── External data tool APIs ────────────────────────────────────────────────
    tavily_api_key: str = ""
    crunchbase_api_key: str = ""
    apollo_api_key: str = ""
    hunter_api_key: str = ""
    builtwith_api_key: str = ""

    # ── CRM ──────────────────────────────────────────────────────────────────
    hubspot_access_token: str = ""

    # ── Tool layer behaviour ────────────────────────────────────────────────────
    tool_default_timeout_seconds: float = 20.0
    tool_max_retries: int = 3
    tool_cache_ttl_seconds: int = 86_400

    # ── Worker / backpressure ────────────────────────────────────────────────────
    worker_max_jobs: int = 5

    # ── Auth ─────────────────────────────────────────────────────────────────
    access_token_expire_minutes: int = 60 * 24 * 7
    jwt_algorithm: str = "HS256"
    # Google OAuth — the Web client ID (audience) used to verify ID tokens.
    google_client_id: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def langfuse_enabled(self) -> bool:
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    @property
    def llm_configured(self) -> bool:
        """Whether an LLM backend is usable (a key, or a local Ollama endpoint)."""
        if self.llm_provider == "anthropic":
            return bool(self.anthropic_api_key)
        local = "localhost" in self.llm_base_url or "127.0.0.1" in self.llm_base_url
        return bool(self.llm_api_key) or local


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
