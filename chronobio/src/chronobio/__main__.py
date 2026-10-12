"""`python -m chronobio doctor` — show settings and check the local model."""

from __future__ import annotations

import sys

from .config import load_settings
from .llm import OllamaLLM


def doctor() -> int:
    s = load_settings()
    print(f"enabled={s.enabled} dry_run={s.dry_run} allow_cloud_llm={s.allow_cloud_llm} "
          f"allow_network={s.allow_network_literature}")
    print(f"data_dir={s.data_dir}")
    print(f"model={s.model} at {s.ollama_url}")
    try:
        models = OllamaLLM(s).available_models()
    except Exception as exc:  # report, don't crash: doctor is diagnostic
        print(f"ollama: unreachable ({exc.__class__.__name__}: {exc})")
        return 1
    status = "installed" if s.model in models else "NOT installed"
    print(f"ollama: reachable, {len(models)} model(s); {s.model} {status}")
    return 0 if s.model in models else 1


def main(argv: list[str]) -> int:
    if argv[1:] == ["doctor"]:
        return doctor()
    print("usage: python -m chronobio doctor", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
