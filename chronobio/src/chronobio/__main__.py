"""Command line: `python -m chronobio doctor | report | viewer | dataset-add | validate | design`."""

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


def dataset_add(args: argparse.Namespace) -> int:
    import json
    from .datasets import DatasetError, ingest_csv
    from .models import AccessStatus
    from .store import Store
    s = load_settings()
    try:
        ds = ingest_csv(
            Store(s.db_path), args.file, name=args.name, data_dictionary=json.loads(args.dictionary.read_text()),
            sample_id_column=args.id_col, group_column=args.group_col, batch_column=args.batch_col,
            units=json.loads(args.units.read_text()) if args.units else None, access=AccessStatus(args.access))
    except DatasetError as exc:
        print(f"refused: {exc}", file=sys.stderr)
        return 1
    print(f"dataset {ds.id}: {ds.sample_count} samples, groups {', '.join(ds.groups)}")
    for flag in ds.quality_flags:
        print(f"  flag: {flag}")
    return 0


def validate(args: argparse.Namespace) -> int:
    from .models import Hypothesis
    from .store import Store
    from .validation import execute_runs, plan_run
    s = load_settings()
    store = Store(s.db_path)
    hyp, ds = store.get(args.hypothesis), store.get(args.dataset)
    if hyp is None or ds is None:
        print("unknown hypothesis or dataset id", file=sys.stderr)
        return 1
    params = {"feature": args.feature, "group_a": args.group_a, "group_b": args.group_b,
              "expected_direction": args.direction, "alpha": args.alpha, "seed": args.seed}
    run = plan_run(store, hyp, ds, "two_group_numeric", params)
    print(f"pre-registered {run.id} at {run.created_at:%Y-%m-%d %H:%M:%S}")
    done = execute_runs(store, [run.id])[0]
    print(f"{done.status.value}: {done.verdict or done.caveats[0]}")
    if done.metrics:
        lo, hi = done.confidence_intervals["hedges_g_heldout"]
        print(f"  held-out Hedges g {done.metrics['hedges_g_heldout']:.2f} ({lo:.2f} to {hi:.2f}), adjusted p {done.metrics['p_adjusted']:.4f}")
    return 0


def design(args: argparse.Namespace) -> int:
    from .models import EvidenceClaim, Publication, ValidationRun
    from .store import Store
    from .experiment import design_experiment
    s = load_settings()
    store = Store(s.db_path)
    hyp = store.get(args.hypothesis)
    if hyp is None:
        print("unknown hypothesis id", file=sys.stderr)
        return 1
    plan = design_experiment(
        hyp, {c.id: c for c in store.list(EvidenceClaim)}, {p.id: p for p in store.list(Publication)},
        [r for r in store.list(ValidationRun) if r.hypothesis_id == hyp.id], assumed_effect_size=args.effect_size)
    store.save(plan)
    print(f"experiment plan {plan.id}: {len(plan.aims)} aim(s). {plan.power_plan}")
    return 0


def benchmark(args: argparse.Namespace) -> int:
    from .benchmark import run_benchmark
    from .store import Store
    s = load_settings()
    llm = None if args.no_baseline else OllamaLLM(s)
    out = run_benchmark(Store(s.db_path), s, llm, args.out or s.data_dir / "benchmark", cutoff=args.cutoff)
    print((args.out or s.data_dir / "benchmark") / "benchmark.md")
    return 1 if out["limit_problems"] else 0


def audit_cmd(args: argparse.Namespace) -> int:
    from .security import audit
    a = audit(Path(__file__).resolve().parents[2])
    print(f"{len(a['licenses'])} dependencies; blocking licenses: {[f.name for f in a['blocking']] or 'none'}; "
          f"review: {[(f.name, f.license) for f in a['review']] or 'none'}")
    print(f"secret-like strings found: {len(a['secrets'])}; data directory git-ignored: {a['data_dir_ignored']}")
    for f in a["secrets"]:
        print(f"  {f.path}:{f.line} {f.kind}")
    return 1 if a["blocking"] or a["secrets"] or not a["data_dir_ignored"] else 0


def regression(args: argparse.Namespace) -> int:
    """ChronoBio tests, the LabOS frontend tests, and a check that LabOS itself is unchanged."""
    import subprocess
    root = Path(__file__).resolve().parents[2]
    repo = root.parent
    steps: list[tuple[str, list[str], Path]] = [("chronobio tests", [sys.executable, "-m", "pytest", "-q"], root)]
    if (repo / "frontend" / "package.json").exists() and not args.skip_frontend:
        steps.append(("frontend tests", ["npx", "vitest", "run"], repo / "frontend"))
    failed = 0
    for name, cmd, cwd in steps:
        code = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=900).returncode
        print(f"{'PASS' if code == 0 else 'FAIL'}  {name}")
        failed += code != 0
    changed = legacy_changes(repo, args.base)
    print(f"{'PASS' if not changed else 'FAIL'}  LabOS unchanged outside chronobio/ vs {args.base}" +
          (f": {len(changed)} file(s), e.g. {changed[0]}" if changed else ""))
    return 1 if failed or changed else 0


def legacy_changes(repo: Path, base: str) -> list[str]:
    """Files changed outside chronobio/ and graphify-out/ since the merge-base with `base`."""
    import subprocess
    try:
        merge_base = subprocess.run(["git", "merge-base", base, "HEAD"], cwd=repo, capture_output=True, text=True, check=True).stdout.strip()
        names = subprocess.run(["git", "diff", "--name-only", merge_base, "--", "."], cwd=repo, capture_output=True, text=True, check=True).stdout.split()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ["(could not compare with git)"]
    return [n for n in names if not n.startswith(("chronobio/", "graphify-out/"))]


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="chronobio")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("doctor", help="show settings and check the local model")
    d = sub.add_parser("dataset-add", help="register a CSV dataset (needs a data dictionary)")
    d.add_argument("file", type=Path)
    d.add_argument("--name", required=True)
    d.add_argument("--dictionary", type=Path, required=True, help="JSON file: column -> description")
    d.add_argument("--units", type=Path, help="JSON file: column -> unit")
    d.add_argument("--id-col", required=True)
    d.add_argument("--group-col", required=True)
    d.add_argument("--batch-col")
    d.add_argument("--access", default="private", choices=["open", "controlled", "private", "patient_level"])
    v = sub.add_parser("validate", help="pre-register and run a two-group comparison on a dataset")
    v.add_argument("hypothesis")
    v.add_argument("dataset")
    v.add_argument("--feature", required=True)
    v.add_argument("--group-a", required=True)
    v.add_argument("--group-b", required=True)
    v.add_argument("--direction", required=True, choices=["a_greater", "b_greater"])
    v.add_argument("--alpha", type=float, default=0.05)
    v.add_argument("--seed", type=int, default=7)
    b = sub.add_parser("benchmark", help="benchmark stored output (and a single-prompt baseline) and write a blinded rating sheet")
    b.add_argument("--out", type=Path, default=None)
    b.add_argument("--cutoff", type=int, default=None, help="also run the historical (cutoff) audit at this year")
    b.add_argument("--no-baseline", action="store_true", help="skip the baseline model call")
    sub.add_parser("audit", help="license scan, secret scan and safe-default checks")
    r = sub.add_parser("regression", help="run all tests and check LabOS itself is unchanged")
    r.add_argument("--base", default="origin/main")
    r.add_argument("--skip-frontend", action="store_true")
    e = sub.add_parser("design", help="draft an experiment plan for a hypothesis")
    e.add_argument("hypothesis")
    e.add_argument("--effect-size", type=float, default=None, help="assumed effect size (Hedges g), labelled an assumption")
    for name, helptext in (("report", "write the HTML, Word, PDF and JSON report"), ("viewer", "write the interactive viewer")):
        p = sub.add_parser(name, help=helptext)
        p.add_argument("--out", type=Path, default=None, help="output directory (default: data/report or data/figures)")
        p.add_argument("--title", default="ChronoBio research report" if name == "report" else "ChronoBio evidence graph")
        if name == "report":
            p.add_argument("--no-pdf", action="store_true", help="skip the PDF")
    args = parser.parse_args(argv[1:])
    return {"doctor": lambda: doctor(), "report": lambda: report(args), "viewer": lambda: viewer(args),
            "dataset-add": lambda: dataset_add(args), "validate": lambda: validate(args), "design": lambda: design(args),
            "benchmark": lambda: benchmark(args), "audit": lambda: audit_cmd(args), "regression": lambda: regression(args)}[args.command]()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
