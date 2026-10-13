"""Computational validation on a user's own dataset (optional, plugin-based).

How it avoids fooling itself:

* **Pre-registration.** `plan_run` saves the analysis (feature, groups, expected
  direction, alpha, seed) as a `planned` ValidationRun before any result exists.
  The executed result is version 2 of the same record, so the version history
  itself shows the endpoint was fixed first. Planned runs cannot hold numbers.
* **Held-out confirmation.** A seeded, group-stratified split: the discovery part
  must agree in direction; the held-out part gives the reported effect, interval
  and p-value.
* **Preflight refusals.** Missing or non-numeric feature, a feature that is really
  the group/batch/id column (leakage), too few samples per group, no variance,
  complete batch confounding, or a file changed since ingestion: the run is
  marked `failed` with the reason and carries no metrics.
* **Multiple testing.** Benjamini-Hochberg across the runs executed together.
* **Honest verdicts.** consistent / contradicted / inconclusive, computed from the
  numbers. A result is evidence from one dataset and never "validates" anything.

P-values come from a seeded permutation test and intervals from a seeded
bootstrap, so there is no distribution assumption and a rerun reproduces them.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Callable

from .datasets import DatasetError, load_table, numeric
from .models import (
    Dataset, Hypothesis, HypothesisStatus, Provenance, RunStatus, ValidationRun,
)
from .store import Store

CODE_VERSION = "validation-v1"
MIN_GROUP_N = 5
ALWAYS = "Evidence from this dataset only: a consistent result does not validate the hypothesis."


class PluginError(ValueError):
    """The analysis cannot run on this data; the message is recorded as the reason."""


# ── statistics (pure Python, seeded) ─────────────────────────────────────────

def mean(xs: list[float]) -> float:
    return sum(xs) / len(xs)


def variance(xs: list[float]) -> float:
    m = mean(xs)
    return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)


def hedges_g(a: list[float], b: list[float]) -> float:
    n1, n2 = len(a), len(b)
    pooled = math.sqrt(((n1 - 1) * variance(a) + (n2 - 1) * variance(b)) / (n1 + n2 - 2))
    if pooled == 0:
        raise PluginError("both groups have zero variance, so no effect size can be computed")
    return (mean(a) - mean(b)) / pooled * (1 - 3 / (4 * (n1 + n2) - 9))


def permutation_p(a: list[float], b: list[float], n_perm: int, rng: random.Random) -> float:
    """Two-sided permutation p-value for the difference in means (with the +1 correction)."""
    observed = abs(mean(a) - mean(b))
    pool, n1, hits = a + b, len(a), 0
    for _ in range(n_perm):
        rng.shuffle(pool)
        if abs(mean(pool[:n1]) - mean(pool[n1:])) >= observed - 1e-12:
            hits += 1
    return (hits + 1) / (n_perm + 1)


def bootstrap_ci_g(a: list[float], b: list[float], n_boot: int, rng: random.Random) -> tuple[float, float]:
    draws = []
    for _ in range(n_boot):
        ra, rb = [rng.choice(a) for _ in a], [rng.choice(b) for _ in b]
        try:
            draws.append(hedges_g(ra, rb))
        except PluginError:
            continue                                   # a resample with no variance carries no information
    if len(draws) < n_boot // 2:
        raise PluginError("too few usable bootstrap resamples to give an interval")
    draws.sort()
    return draws[int(0.025 * len(draws))], draws[min(int(0.975 * len(draws)), len(draws) - 1)]


def benjamini_hochberg(pvals: list[float]) -> list[float]:
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    adjusted, running = [0.0] * m, 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        running = min(running, pvals[i] * m / rank)
        adjusted[i] = running
    return adjusted


# ── plugins ──────────────────────────────────────────────────────────────────

@dataclass
class Outcome:
    metrics: dict[str, float]
    intervals: dict[str, tuple[float, float]]
    caveats: list[str]
    p_value: float
    discovery_ok: bool                 # discovery part agrees with the expected direction
    heldout_ok: bool                   # held-out part agrees with the expected direction


@dataclass
class Plugin:
    name: str
    version: str
    required: tuple[str, ...]
    analyse: Callable[[Dataset, list[str], list[dict[str, str]], dict], Outcome]


PLUGINS: dict[str, Plugin] = {}


def register(plugin: Plugin) -> None:
    PLUGINS[plugin.name] = plugin


def _two_group(ds: Dataset, columns: list[str], rows: list[dict[str, str]], p: dict) -> Outcome:
    feature, a_name, b_name = str(p["feature"]), str(p["group_a"]), str(p["group_b"])
    direction = str(p["expected_direction"])
    if direction not in ("a_greater", "b_greater"):
        raise PluginError("expected_direction must be 'a_greater' or 'b_greater'")
    if feature not in columns:
        raise PluginError(f"feature '{feature}' is not a column")
    if feature in (ds.sample_id_column, ds.group_column, ds.batch_column):
        raise PluginError(f"feature '{feature}' is the sample id, group or batch column: using it would leak the answer")
    for g in (a_name, b_name):
        if g not in ds.groups:
            raise PluginError(f"group '{g}' is not in the dataset (groups: {', '.join(ds.groups)})")

    values = numeric(rows, feature)                                    # raises DatasetError if not numeric
    kept = [(r, v) for r, v in zip(rows, values) if r[ds.group_column] in (a_name, b_name) and v is not None]
    dropped = sum(1 for r, v in zip(rows, values) if r[ds.group_column] in (a_name, b_name) and v is None)
    caveats = [f"{dropped} sample(s) with a missing '{feature}' value were left out."] if dropped else []

    if ds.batch_column:
        batches: dict[str, set[str]] = {}
        for r, _ in kept:
            batches.setdefault(r[ds.batch_column], set()).add(r[ds.group_column])
        if len(batches) > 1 and all(len(gs) == 1 for gs in batches.values()):
            raise PluginError("complete batch confounding: every batch holds one group only, so group and batch cannot be separated")
        single = sorted(b for b, gs in batches.items() if len(gs) == 1)
        if single:
            caveats.append(f"Partial batch confounding: batch(es) {', '.join(single[:5])} contain one group only.")

    rng = random.Random(int(p.get("seed", 7)))
    fraction = float(p.get("holdout_fraction", 0.5))
    discovery: dict[str, list[float]] = {a_name: [], b_name: []}
    held: dict[str, list[float]] = {a_name: [], b_name: []}
    for g in (a_name, b_name):
        members = sorted((r[ds.sample_id_column], v) for r, v in kept if r[ds.group_column] == g)
        rng.shuffle(members)
        cut = round(len(members) * (1 - fraction))
        discovery[g], held[g] = [v for _, v in members[:cut]], [v for _, v in members[cut:]]
        if len(discovery[g]) < MIN_GROUP_N or len(held[g]) < MIN_GROUP_N:
            raise PluginError(f"group '{g}' has {len(members)} usable sample(s); at least {2 * MIN_GROUP_N} are needed "
                              f"to keep {MIN_GROUP_N} in both the discovery and held-out parts")

    sign = 1 if direction == "a_greater" else -1
    d_diff = mean(discovery[a_name]) - mean(discovery[b_name])
    h_diff = mean(held[a_name]) - mean(held[b_name])
    g_val = hedges_g(held[a_name], held[b_name])
    ci = bootstrap_ci_g(held[a_name], held[b_name], int(p.get("n_boot", 2000)), rng)
    p_val = permutation_p(held[a_name], held[b_name], int(p.get("n_perm", 5000)), rng)
    metrics = {"n_a_heldout": float(len(held[a_name])), "n_b_heldout": float(len(held[b_name])),
               "mean_a_heldout": mean(held[a_name]), "mean_b_heldout": mean(held[b_name]),
               "difference_heldout": h_diff, "hedges_g_heldout": g_val, "p_permutation": p_val,
               "difference_discovery": d_diff}
    return Outcome(metrics, {"hedges_g_heldout": ci}, caveats, p_val, sign * d_diff > 0, sign * h_diff > 0)


register(Plugin("two_group_numeric", "1", ("feature", "group_a", "group_b", "expected_direction"), _two_group))


# ── plan, execute ────────────────────────────────────────────────────────────

def plan_run(store: Store, hyp: Hypothesis, ds: Dataset, method: str, parameters: dict) -> ValidationRun:
    """Pre-register an analysis. Saved as a planned run, before any result exists."""
    plugin = PLUGINS.get(method)
    if plugin is None:
        raise ValueError(f"unknown method '{method}' (available: {', '.join(sorted(PLUGINS))})")
    missing = [k for k in plugin.required if k not in parameters]
    if missing:
        raise ValueError(f"method '{method}' needs: {', '.join(missing)}")
    params = {"alpha": 0.05, "seed": 7, **parameters}
    run = ValidationRun(
        hypothesis_id=hyp.id, dataset_id=ds.id, method=method, code_version=f"{CODE_VERSION}/{plugin.name}-{plugin.version}",
        seed=int(params["seed"]), parameters=params, status=RunStatus.PLANNED,
        provenance=Provenance(source="validation_plan", detail=f"{method} on {ds.name}", tool_version=CODE_VERSION))
    store.save(run)
    return run


def _verdict(o: Outcome, p_adjusted: float, alpha: float) -> str:
    significant = p_adjusted < alpha
    if significant and o.heldout_ok and o.discovery_ok:
        return "consistent"
    if significant and not o.heldout_ok:
        return "contradicted"
    return "inconclusive"


def execute_runs(store: Store, run_ids: list[str]) -> list[ValidationRun]:
    """Run planned analyses together (one multiple-testing family) and save executed or failed versions."""
    results: dict[str, ValidationRun] = {}
    ok: dict[str, tuple[ValidationRun, Outcome]] = {}
    for rid in run_ids:
        run = store.get(rid)
        if not isinstance(run, ValidationRun):
            raise ValueError(f"{rid} is not a validation run")
        if run.status != RunStatus.PLANNED:
            results[rid] = run                                  # already executed or failed: never redo, never overwrite
            continue
        ds = store.get(run.dataset_id)
        try:
            columns, rows = load_table(ds)
            ok[rid] = (run, PLUGINS[run.method].analyse(ds, columns, rows, dict(run.parameters)))
        except (PluginError, DatasetError) as exc:
            results[rid] = _save(store, run.revise(status=RunStatus.FAILED, caveats=[f"Not run: {exc}"]))

    adjusted = benjamini_hochberg([o.p_value for _, o in ok.values()]) if ok else []
    for (rid, (run, o)), p_adj in zip(ok.items(), adjusted):
        alpha = float(run.parameters.get("alpha", 0.05))
        verdict = _verdict(o, p_adj, alpha)
        caveats = [*o.caveats, ALWAYS,
                   f"p-value from a seeded permutation test; Benjamini-Hochberg adjusted across {len(ok)} run(s) executed together."]
        results[rid] = _save(store, run.revise(
            status=RunStatus.EXECUTED, metrics=o.metrics | {"p_adjusted": p_adj, "alpha": alpha},
            confidence_intervals=o.intervals, caveats=caveats, verdict=verdict))
        _apply_to_hypothesis(store, run.hypothesis_id, verdict)
    return [results[r] for r in run_ids]


def _save(store: Store, run: ValidationRun) -> ValidationRun:
    store.save(run)
    return run


def _apply_to_hypothesis(store: Store, hypothesis_id: str, verdict: str) -> None:
    """Move a hypothesis's status only when the data justify it; never promote on an inconclusive result."""
    hyp = store.get(hypothesis_id)
    if not isinstance(hyp, Hypothesis):
        return
    if verdict == "consistent" and hyp.review_status in (HypothesisStatus.PROPOSED, HypothesisStatus.EVIDENCE_SUPPORTED):
        store.save(hyp.revise(review_status=HypothesisStatus.COMPUTATIONALLY_TESTED))
    elif verdict == "contradicted":
        store.save(hyp.revise(review_status=HypothesisStatus.CONTRADICTED))
