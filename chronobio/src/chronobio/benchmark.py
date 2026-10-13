"""Benchmarks (spec M15). Every number comes from stored data or a measured run.

What this can and cannot show:

* Citation fidelity, testability and evidence completeness are checked by code
  against the sources, so they are exact.
* The baseline comparison is STRUCTURAL: it asks whether each system's output carries
  verifiable quotes, falsifiers, opposing evidence and stated uncertainty. It says
  nothing about whether a hypothesis is scientifically right.
* Scientific quality needs expert judgement. This module only prepares a blinded rating
  sheet and scores ratings once someone has filled them in; it never invents ratings.
* Historical (cutoff) evaluation audits for leakage and measures follow-up in later
  literature. A language model may still have seen the later papers in pretraining, so
  a historical result is weaker evidence than a prospective one.
"""

from __future__ import annotations

import csv
import json
import random
import resource
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .agents import MEASURABLE
from .config import Settings
from .graph import load_graph, snapshot
from .ingest import load_document
from .llm import LLM, UNTRUSTED_DATA_NOTICE
from .models import EvidenceClaim, Hypothesis, NoveltyStatus, Publication
from .pdf_ingest import find_ignoring_case
from .store import Store

CONTAMINATION_CAVEAT = ("The language model may have seen the later papers during pretraining, so a historical "
                        "(cutoff) evaluation cannot rule out contamination and is weaker evidence than a prospective test.")
NOT_ASSESSED = None


@dataclass
class Metric:
    name: str
    value: float | None                 # None = not assessed
    detail: str = ""
    failures: list[str] = field(default_factory=list)


# ── measured resources and cost proxy ────────────────────────────────────────

class CountingLLM:
    """Wraps a model and counts calls, characters and seconds (the cost of a local model is time, not money)."""

    def __init__(self, inner: LLM):
        self.inner, self.name = inner, getattr(inner, "name", "model")
        self.calls = self.chars_in = self.chars_out = 0
        self.seconds = 0.0

    def generate(self, system: str, prompt: str, *, json_format: bool = False) -> str:
        t = time.time()
        reply = self.inner.generate(system, prompt, json_format=json_format)
        self.seconds += time.time() - t
        self.calls += 1
        self.chars_in += len(system) + len(prompt)
        self.chars_out += len(reply)
        return reply


def peak_memory_mb() -> float:
    rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return rss / (1024 * 1024) if sys.platform == "darwin" else rss / 1024         # macOS: bytes, Linux: KB


def within_limits(settings: Settings, seconds: float, memory_mb: float) -> list[str]:
    problems = []
    if seconds > settings.max_runtime_s:
        problems.append(f"runtime {seconds:.0f}s exceeds the limit of {settings.max_runtime_s}s")
    if memory_mb > settings.max_memory_mb:
        problems.append(f"peak memory {memory_mb:.0f} MB exceeds the limit of {settings.max_memory_mb} MB")
    return problems


# ── citation fidelity ────────────────────────────────────────────────────────

def citation_fidelity(store: Store, settings: Settings) -> list[Metric]:
    """Re-check every stored claim and every hypothesis citation against the original source text."""
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    bad: list[str] = []
    for c in claims.values():
        pub = pubs.get(c.publication_id)
        doc = load_document(settings, c.publication_id) if c.locator.value == "pdf_exact" else None
        if doc is not None:
            page = next((p for p in doc.pages if p.number == c.page), None)
            ok = page is not None and c.char_start is not None and (
                page.text[c.char_start:c.char_end].casefold() == c.passage.casefold())
        else:
            ok = pub is not None and find_ignoring_case(pub.abstract, c.passage) is not None
        if not ok:
            bad.append(c.id)
    hyps = store.list(Hypothesis)
    cited = [(h.id, cid) for h in hyps for cid in h.supporting_claim_ids + h.contradicting_claim_ids]
    dangling = [f"{h}:{c}" for h, c in cited if c not in claims]
    with_id = sum(1 for p in pubs.values() if p.doi or p.pmid)
    return [
        Metric("claim_quote_fidelity", (1 - len(bad) / len(claims)) if claims else NOT_ASSESSED,
               f"{len(claims) - len(bad)} of {len(claims)} stored quotes re-verified against their source", bad),
        Metric("hypothesis_citation_resolution", (1 - len(dangling) / len(cited)) if cited else NOT_ASSESSED,
               f"{len(cited) - len(dangling)} of {len(cited)} cited claim ids exist", dangling),
        Metric("references_with_identifier", (with_id / len(pubs)) if pubs else NOT_ASSESSED,
               f"{with_id} of {len(pubs)} publications have a DOI or PMID"),
    ]


# ── hypothesis rubric (structural) ───────────────────────────────────────────

def _distinct_falsifier(predictions: list[str], falsifiers: list[str]) -> bool:
    return bool(falsifiers) and not ({f.casefold() for f in falsifiers} & {p.casefold() for p in predictions})


def rubric_extension(records: list[dict]) -> dict[str, float | None]:
    n = len(records)
    if not n:
        return {k: NOT_ASSESSED for k in ("verifiable_quote_rate", "falsifier_rate", "measurable_prediction_rate",
                                           "opposing_evidence_checked_rate", "uncertainty_stated_rate")}
    return {
        "verifiable_quote_rate": sum(bool(r["supporting_ids"]) for r in records) / n,
        "falsifier_rate": sum(_distinct_falsifier(r["predictions"], r["falsifiers"]) for r in records) / n,
        "measurable_prediction_rate": sum(any(MEASURABLE.search(p) for p in r["predictions"]) for r in records) / n,
        "opposing_evidence_checked_rate": sum(r["critic"] is not None for r in records) / n,   # checked, even if none was found
        "uncertainty_stated_rate": sum(bool(r["uncertainty"]) for r in records) / n,
    }


BASELINE_SYSTEM = UNTRUSTED_DATA_NOTICE + (
    "You are a research assistant. From the literature below propose up to {n} novel scientific hypotheses. Reply with ONLY a "
    "JSON array of objects: {{\"hypothesis\": str, \"rationale\": str, \"supporting_evidence\": str}}.")


def baseline_hypotheses(llm: LLM, corpus: list[str], n: int = 4) -> list[dict]:
    """The pre-ChronoBio style: one prompt over the literature, free-text output, no verification."""
    raw = llm.generate(BASELINE_SYSTEM.format(n=n), "\n\n".join(corpus)[:12000])
    start, end = raw.find("["), raw.rfind("]")
    try:
        items = json.loads(raw[start:end + 1]) if start != -1 and end > start else []
    except json.JSONDecodeError:
        items = []
    return [i for i in items if isinstance(i, dict) and i.get("hypothesis")][:n]


def _has_verbatim_span(text: str, corpus: list[str], words: int = 8) -> bool:
    tokens = text.split()
    return any(find_ignoring_case(src, " ".join(tokens[i:i + words])) for src in corpus for i in range(0, max(len(tokens) - words + 1, 0)))


def rubric_baseline(items: list[dict], corpus: list[str]) -> dict[str, float | None]:
    n = len(items)
    if not n:
        return {k: NOT_ASSESSED for k in ("verifiable_quote_rate", "falsifier_rate", "measurable_prediction_rate",
                                           "opposing_evidence_checked_rate", "uncertainty_stated_rate")}
    return {
        "verifiable_quote_rate": sum(_has_verbatim_span(str(i.get("supporting_evidence", "")), corpus) for i in items) / n,
        "falsifier_rate": 0.0,                      # the baseline format has no falsifier field
        "measurable_prediction_rate": 0.0,          # nor predictions
        "opposing_evidence_checked_rate": 0.0,      # nor a check for conflicting evidence
        "uncertainty_stated_rate": 0.0,             # nor stated uncertainty
    }


# ── blinded expert rating ────────────────────────────────────────────────────

CRITERIA = ("plausibility", "testability", "novelty", "evidence_support")


def expert_sheet(records: list[dict], baseline: list[dict], out_dir: Path, *, seed: int = 11) -> tuple[Path, Path]:
    """Write a shuffled rating sheet with no system labels, and a separate key. Ratings are left blank."""
    rows = [("chronobio", r["statement"], r["mechanism"]) for r in records] + \
           [("baseline", b["hypothesis"], str(b.get("rationale", ""))) for b in baseline]
    random.Random(seed).shuffle(rows)
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet, key = out_dir / "expert_rating_sheet.csv", out_dir / "expert_rating_key.json"
    with sheet.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["item", "statement", "rationale", *CRITERIA])
        for i, (_, statement, rationale) in enumerate(rows, start=1):
            w.writerow([f"H{i:03d}", statement, rationale, *[""] * len(CRITERIA)])
    key.write_text(json.dumps({f"H{i:03d}": system for i, (system, _, _) in enumerate(rows, start=1)}, indent=2))
    return sheet, key


def score_ratings(sheet: Path, key: Path) -> dict:
    """Mean rating per system and criterion. Blank cells are not rated, never filled in."""
    system_of = json.loads(key.read_text())
    sums: dict[str, dict[str, list[float]]] = {}
    with sheet.open(newline="") as fh:
        for row in csv.DictReader(fh):
            for c in CRITERIA:
                cell = (row.get(c) or "").strip()
                if cell:
                    sums.setdefault(system_of[row["item"]], {}).setdefault(c, []).append(float(cell))
    if not sums:
        return {"status": "not rated", "detail": "the rating sheet has no ratings yet"}
    return {"status": "rated", "means": {s: {c: sum(v) / len(v) for c, v in cs.items()} for s, cs in sums.items()},
            "counts": {s: {c: len(v) for c, v in cs.items()} for s, cs in sums.items()}}


# ── historical (cutoff) evaluation ───────────────────────────────────────────

def historical_audit(store: Store, cutoff: int) -> dict:
    """Leakage audit plus follow-up in later literature, for gaps defined using only evidence up to `cutoff`."""
    from .gaps import find_gaps
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes_list, edges = load_graph(store)
    nodes = {n.id: n for n in nodes_list}
    snap = snapshot(nodes_list, edges, claims, pubs, cutoff, include_inferred=False)
    year = lambda cid: getattr(pubs.get(claims[cid].publication_id), "year", None)
    leaks = [cid for cid in snap.claim_ids if (year(cid) or 0) > cutoff]
    gaps = find_gaps(snap, claims, nodes)

    def later_papers(pair: tuple[str, str]) -> int:
        full = snapshot(nodes_list, edges, claims, pubs, None, include_inferred=False)
        e = next((x for x in full.edges if (x.source, x.target) == pair), None)
        return len({claims[c].publication_id for c, _ in e.evidence if (year(c) or 0) > cutoff}) if e else 0

    pair_gaps = [g for g in gaps if len(g.node_ids) == 2]
    followed = [g for g in pair_gaps if later_papers((g.node_ids[0], g.node_ids[1])) > 0]
    base = [e for e in snap.edges if not e.inferred]
    base_followed = [e for e in base if later_papers((e.source, e.target)) > 0]
    return {
        "cutoff": cutoff, "claims_visible": len(snap.claim_ids), "leaks": leaks, "gaps": len(pair_gaps),
        "gaps_with_later_evidence": len(followed), "all_links": len(base), "links_with_later_evidence": len(base_followed),
        "gap_followup_rate": len(followed) / len(pair_gaps) if pair_gaps else NOT_ASSESSED,
        "baseline_followup_rate": len(base_followed) / len(base) if base else NOT_ASSESSED,
        "caveat": CONTAMINATION_CAVEAT,
    }


# ── novelty precision against a gold standard ────────────────────────────────

def novelty_precision(assessed: dict[str, NoveltyStatus], gold: dict[str, NoveltyStatus]) -> dict:
    """Precision/recall of the 'known' call (the claim that prior work exists). Needs expert gold labels."""
    shared = [h for h in assessed if h in gold]
    if not shared:
        return {"status": "not assessed", "detail": "no gold-standard labels were provided"}
    tp = sum(assessed[h] == gold[h] == NoveltyStatus.KNOWN for h in shared)
    called = sum(assessed[h] == NoveltyStatus.KNOWN for h in shared)
    actual = sum(gold[h] == NoveltyStatus.KNOWN for h in shared)
    return {"status": "measured", "n": len(shared), "precision_known": tp / called if called else NOT_ASSESSED,
            "recall_known": tp / actual if actual else NOT_ASSESSED,
            "confusion": dict(Counter((gold[h].value, assessed[h].value) for h in shared))}


# ── runner ───────────────────────────────────────────────────────────────────

def run_benchmark(
    store: Store, settings: Settings, llm: LLM | None, out_dir: Path, *, cutoff: int | None = None, baseline_n: int = 4,
) -> dict:
    """Benchmark the stored extension output; optionally run the single-prompt baseline on the same corpus."""
    from .export import build_records
    from .swarm import load_result
    records = build_records(store, load_result(store))
    pubs = list(store.list(Publication))
    out: dict = {"fidelity": [m.__dict__ for m in citation_fidelity(store, settings)],
                 "extension": rubric_extension(records), "hypotheses": len(records)}
    items: list[dict] = []
    if llm is not None:
        corpus = [p.abstract for p in pubs if p.abstract]
        counter = CountingLLM(llm)
        items = baseline_hypotheses(counter, corpus, baseline_n)
        out["baseline"] = rubric_baseline(items, corpus) | {"hypotheses": len(items)}
        out["baseline_cost"] = {"model_calls": counter.calls, "seconds": round(counter.seconds, 1),
                                "characters_in": counter.chars_in, "characters_out": counter.chars_out}
    out["historical"] = historical_audit(store, cutoff) if cutoff else None
    sheet, key = expert_sheet(records, items, out_dir)
    out["expert_rating"] = {"sheet": str(sheet), "key": str(key), **score_ratings(sheet, key)}
    out["peak_memory_mb"] = round(peak_memory_mb(), 1)
    out["limit_problems"] = within_limits(settings, 0.0, peak_memory_mb())
    out["comparison_note"] = ("Structural comparison only: it shows which outputs carry verifiable quotes, falsifiers, "
                              "opposing-evidence checks and stated uncertainty, not which hypotheses are scientifically better.")
    (out_dir / "benchmark.json").write_text(json.dumps(out, indent=2, default=str))
    (out_dir / "benchmark.md").write_text(_markdown(out))
    return out


def _pct(x: float | None) -> str:
    return "not assessed" if x is None else f"{x:.0%}"


def _markdown(o: dict) -> str:
    lines = ["# ChronoBio benchmark", "", o["comparison_note"], "", "## Citation fidelity (exact, re-checked against sources)"]
    lines += [f"- {m['name']}: {_pct(m['value'])} — {m['detail']}" for m in o["fidelity"]]
    lines += ["", f"## Hypothesis structure ({o['hypotheses']} extension hypotheses)",
              "| property | ChronoBio | single-prompt baseline |", "|---|---|---|"]
    for k, v in o["extension"].items():
        b = o["baseline"][k] if "baseline" in o else None
        lines.append(f"| {k.replace('_', ' ')} | {_pct(v)} | {_pct(b) if 'baseline' in o else 'not run'} |")
    if "baseline_cost" in o:
        c = o["baseline_cost"]
        lines += ["", f"Baseline cost: {c['model_calls']} model call(s), {c['seconds']} s, {c['characters_in']} characters sent."]
    if o["historical"]:
        h = o["historical"]
        lines += ["", f"## Historical evaluation (cutoff {h['cutoff']})",
                  f"- leaks of post-cutoff evidence into the snapshot: {len(h['leaks'])}",
                  f"- gaps defined at the cutoff: {h['gaps']}; with later evidence: {h['gaps_with_later_evidence']} ({_pct(h['gap_followup_rate'])})",
                  f"- all links at the cutoff: {h['all_links']}; with later evidence: {h['links_with_later_evidence']} ({_pct(h['baseline_followup_rate'])})",
                  f"- caveat: {h['caveat']}"]
    lines += ["", f"## Expert rating: {o['expert_rating']['status']}", f"- blinded sheet: {o['expert_rating']['sheet']}",
              f"## Resources", f"- peak memory so far: {o['peak_memory_mb']} MB", ""]
    return "\n".join(lines)
