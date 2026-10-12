"""Feature flags and resource limits.

Everything is OFF by default. Settings come from CHRONOBIO_* environment
variables so nothing in LabOS has to change to configure the extension.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return default if raw is None else int(raw)


@dataclass(frozen=True)
class Settings:
    enabled: bool = False                 # master switch; nothing runs when False
    dry_run: bool = True                  # plan only: no model calls, no network
    allow_cloud_llm: bool = False         # only literature text, never patient data
    allow_network_literature: bool = False
    data_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parents[2] / "data")
    ollama_url: str = "http://127.0.0.1:11434"
    model: str = "llama3.1:latest"
    # 16 GB Apple Silicon budget: one model, one agent at a time, bounded context.
    max_context_chars: int = 12_000
    max_batch_papers: int = 5
    max_agent_iterations: int = 3
    request_timeout_s: int = 180

    @property
    def db_path(self) -> Path:
        return self.data_dir / "chronobio.sqlite3"

    def validate(self) -> None:
        host = urlparse(self.ollama_url).hostname or ""
        if host not in LOCAL_HOSTS and not self.allow_cloud_llm:
            raise ValueError(
                f"LLM endpoint {self.ollama_url} is not local; set CHRONOBIO_ALLOW_CLOUD_LLM=1 to allow it"
            )
        if self.max_context_chars <= 0 or self.max_batch_papers <= 0 or self.max_agent_iterations <= 0:
            raise ValueError("resource limits must be positive")


def load_settings() -> Settings:
    defaults = Settings()
    settings = Settings(
        enabled=_flag("CHRONOBIO_ENABLED", defaults.enabled),
        dry_run=_flag("CHRONOBIO_DRY_RUN", defaults.dry_run),
        allow_cloud_llm=_flag("CHRONOBIO_ALLOW_CLOUD_LLM", defaults.allow_cloud_llm),
        allow_network_literature=_flag("CHRONOBIO_ALLOW_NETWORK", defaults.allow_network_literature),
        data_dir=Path(os.environ.get("CHRONOBIO_DATA_DIR", defaults.data_dir)),
        ollama_url=os.environ.get("CHRONOBIO_OLLAMA_URL", defaults.ollama_url),
        model=os.environ.get("CHRONOBIO_MODEL", defaults.model),
        max_context_chars=_int("CHRONOBIO_MAX_CONTEXT_CHARS", defaults.max_context_chars),
        max_batch_papers=_int("CHRONOBIO_MAX_BATCH_PAPERS", defaults.max_batch_papers),
        max_agent_iterations=_int("CHRONOBIO_MAX_AGENT_ITERATIONS", defaults.max_agent_iterations),
        request_timeout_s=_int("CHRONOBIO_TIMEOUT_S", defaults.request_timeout_s),
    )
    settings.validate()
    return settings
