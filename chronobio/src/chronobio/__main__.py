"""Command line: `python -m chronobio doctor | report | viewer`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

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


def report(args: argparse.Namespace) -> int:
    from .report import build_report
    from .store import Store
    s = load_settings()
    res = build_report(Store(s.db_path), s, args.out, title=args.title, pdf=not args.no_pdf)
    for name in ("html", "docx", "json", "pdf"):
        path = getattr(res, name)
        print(f"{name:5} {path}" if path else f"{name:5} not produced")
    for note in res.notes:
        print(f"note: not produced: {note}")
    return 0


def viewer(args: argparse.Namespace) -> int:
    from .store import Store
    from .viewer import build_viewer
    s = load_settings()
    print(build_viewer(Store(s.db_path), s, args.out, title=args.title).html_path)
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="chronobio")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor", help="show settings and check the local model")
    for name, helptext in (("report", "write the HTML, Word, PDF and JSON report"), ("viewer", "write the interactive viewer")):
        p = sub.add_parser(name, help=helptext)
        p.add_argument("--out", type=Path, default=None, help="output directory (default: data/report or data/figures)")
        p.add_argument("--title", default="ChronoBio research report" if name == "report" else "ChronoBio evidence graph")
        if name == "report":
            p.add_argument("--no-pdf", action="store_true", help="skip the PDF")
    args = parser.parse_args(argv[1:])
    return {"doctor": lambda: doctor(), "report": lambda: report(args), "viewer": lambda: viewer(args)}[args.command]()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
