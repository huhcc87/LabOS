"""Model access behind one small interface.

Agents depend on the `LLM` protocol, never on a provider, so tests run with a
scripted fake and production runs on local Ollama. Dry-run and the enabled
flag are enforced here so no agent can bypass them.
"""

from __future__ import annotations

from typing import Protocol

import httpx

from .config import Settings


class LLMDisabled(RuntimeError):
    """Raised when a model call is attempted while disabled or in dry-run."""


class LLM(Protocol):
    name: str

    def generate(self, system: str, prompt: str) -> str: ...


class OllamaLLM:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        settings.validate()
        self._settings = settings
        self._client = client or httpx.Client(timeout=settings.request_timeout_s)
        self.name = f"ollama:{settings.model}"

    def generate(self, system: str, prompt: str) -> str:
        s = self._settings
        if not s.enabled:
            raise LLMDisabled("ChronoBio is disabled (CHRONOBIO_ENABLED=0)")
        if s.dry_run:
            raise LLMDisabled("dry-run mode: model calls are skipped")
        # Bounded context: never send more than the configured budget.
        prompt = prompt[: s.max_context_chars]
        resp = self._client.post(
            f"{s.ollama_url}/api/generate",
            json={"model": s.model, "system": system, "prompt": prompt, "stream": False,
                  "options": {"temperature": 0.2}},
        )
        resp.raise_for_status()
        return resp.json()["response"]

    def available_models(self) -> list[str]:
        resp = self._client.get(f"{self._settings.ollama_url}/api/tags")
        resp.raise_for_status()
        return [m["name"] for m in resp.json().get("models", [])]


class ScriptedLLM:
    """Deterministic fake for tests: returns queued replies and records prompts."""

    name = "scripted"

    def __init__(self, replies: list[str]):
        self._replies = list(replies)
        self.calls: list[tuple[str, str]] = []

    def generate(self, system: str, prompt: str) -> str:
        self.calls.append((system, prompt))
        if not self._replies:
            raise AssertionError("ScriptedLLM ran out of replies")
        return self._replies.pop(0)
