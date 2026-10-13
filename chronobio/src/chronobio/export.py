"""Readable (Markdown) and machine-readable (JSON) export of swarm results.

Everything shown is stored data: nothing is generated here. Hypotheses the
critic rejected are kept in the output with their reasons, so a reader can see
what was ruled out and why.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from .models import Dataset, EvidenceClaim, ExperimentPlan, Publication, SearchLog, ValidationRun
from .store import Store
from .swarm import SwarmResult


def _cite(pub: Publication | None) -> str:
    if pub is None:
        return "unknown source"
    ids = " ".join(x for x in (f"doi:{pub.doi}" if pub.doi else "", f"PMID {pub.pmid}" if pub.pmid else "") if x)
    return f"{pub.title} ({pub.year or 'n.d.'}){' — ' + ids if ids else ''}"


def build_records(store: Store, result: SwarmResult) -> list[dict]:
    """One plain dict per hypothesis (ranked first), with evidence, critic, novelty and ranking attached."""
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    logs = {g.id: g for g in store.list(SearchLog)}
    gaps = {g.id: g for g in result.gaps}
    latest_review = {}
    for r in result.reviews:
        if r.hypothesis_id not in latest_review or r.hypothesis_version >= latest_review[r.hypothesis_id].hypothesis_version:
            latest_review[r.hypothesis_id] = r
    card_by_id = {c.hypothesis_id: c for c in result.cards}
    ordered = [h for c in result.cards for h in result.hypotheses if h.id == c.hypothesis_id]
    ordered += [h for h in result.hypotheses if h.id not in card_by_id]

    def claim_view(cid: str) -> dict:
        c = claims.get(cid)
        return {"id": cid, "claim": c.claim, "quote": c.passage, "source": _cite(pubs.get(c.publication_id))} if c else {"id": cid}

    runs_by_hyp: dict[str, list[ValidationRun]] = {}
    for run in store.list(ValidationRun):
        runs_by_hyp.setdefault(run.hypothesis_id, []).append(run)
    datasets = {d.id: d for d in store.list(Dataset)}
    plans = {p.hypothesis_id: p for p in store.list(ExperimentPlan)}

    def run_view(run: ValidationRun) -> dict:
        first = store.history(run.id)[0]
        return {"id": run.id, "method": run.method, "status": run.status.value, "verdict": run.verdict,
                "dataset": datasets[run.dataset_id].name if run.dataset_id in datasets else run.dataset_id,
                "parameters": run.parameters, "metrics": run.metrics,
                "intervals": {k: list(v) for k, v in run.confidence_intervals.items()}, "caveats": run.caveats,
                "planned_at": first.created_at.isoformat(), "recorded_at": run.created_at.isoformat(),
                "code_version": run.code_version, "seed": run.seed}

    def plan_view(plan: ExperimentPlan | None) -> dict | None:
        return None if plan is None else {
            "aims": plan.aims, "controls": plan.controls, "endpoints": plan.endpoints, "replication": plan.replication,
            "power_plan": plan.power_plan, "models_and_assays": plan.models_and_assays, "expected_outcomes": plan.expected_outcomes,
            "alternative_outcomes": plan.alternative_outcomes, "go_no_go": plan.go_no_go, "assumptions": plan.assumptions,
            "flags": plan.flags}

    records = []
    for h in ordered:
        rev, nov, rank = latest_review.get(h.id), result.novelty.get(h.id), result.profiles.get(h.id)
        records.append({
            "id": h.id, "version": h.version, "statement": h.statement, "mechanism": h.mechanism,
            "predictions": h.predictions, "falsifiers": h.falsifiers, "alternative_mechanisms": h.alternative_mechanisms,
            "status": h.review_status.value, "novelty_status": h.novelty_status.value,
            "gap": {"id": h.gap_id, "kind": gaps[h.gap_id].kind.value, "description": gaps[h.gap_id].description,
                    "node_ids": gaps[h.gap_id].node_ids} if h.gap_id in gaps else None,
            "supporting_ids": h.supporting_claim_ids, "opposing_ids": h.contradicting_claim_ids,
            "verdict_history": [r.verdict.value for r in sorted(
                (r for r in result.reviews if r.hypothesis_id == h.id), key=lambda r: r.hypothesis_version)],
            "supporting_evidence": [claim_view(c) for c in h.supporting_claim_ids],
            "opposing_evidence": [claim_view(c) for c in h.contradicting_claim_ids],
            "uncertainty": h.uncertainty,
            "critic": {"verdict": rev.verdict.value, "rule_findings": rev.rule_findings, "notes": rev.critic_notes,
                       "missing_controls": rev.missing_controls, "confounders": rev.confounders} if rev else None,
            "novelty": {"status": nov.status.value, "prior_work_quotes": nov.verified_quotes, "prior_titles": nov.prior_titles,
                        "searches": [{"query": logs[i].query, "run_at": logs[i].run_at.isoformat(), "hits": logs[i].result_count,
                                      "examined": logs[i].returned_count} for i in nov.search_log_ids if i in logs],
                        "limitations": nov.limitations} if nov else None,
            "ranking": {k: asdict(v) for k, v in asdict_dims(rank).items()} if rank else None,
            "validation": [run_view(r) for r in runs_by_hyp.get(h.id, [])],
            "experiment_plan": plan_view(plans.get(h.id)),
            "computational_validation": ("EXECUTED" if any(r.status.value == "executed" for r in runs_by_hyp.get(h.id, []))
                                         else "NOT PERFORMED"),
        })
    return records


def export_swarm(store: Store, result: SwarmResult, out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    records = build_records(store, result)
    json_path = out_dir / "hypotheses.json"
    json_path.write_text(json.dumps({"hypotheses": records}, indent=2, ensure_ascii=False))
    md_path = out_dir / "hypotheses.md"
    md_path.write_text(_markdown(records))
    return json_path, md_path


def asdict_dims(rank) -> dict:
    return {name: getattr(rank, name) for name in ("evidence_strength", "falsifiability", "originality", "feasibility", "impact")}


def _markdown(records: list[dict]) -> str:
    out = ["# ChronoBio hypotheses", "",
           "Generated from the stored evidence graph. Nothing here has been validated computationally or experimentally.", ""]
    for i, r in enumerate(records, start=1):
        verdict = r["critic"]["verdict"] if r["critic"] else "not reviewed"
        out += [f"## {i}. {r['statement']}", "", f"**Status:** {r['status']} · **Critic:** {verdict} · "
                f"**Novelty:** {r['novelty_status']} · **Validation:** {r['computational_validation']}", ""]
        if r["gap"]:
            out += [f"**Gap ({r['gap']['kind']}):** {r['gap']['description']}", ""]
        if r["mechanism"]:
            out += [f"**Proposed mechanism:** {r['mechanism']}", ""]
        out += ["**Predictions**"] + [f"- {p}" for p in r["predictions"]] + ["", "**Would be falsified by**"] + [f"- {f}" for f in r["falsifiers"]] + [""]
        if r["alternative_mechanisms"]:
            out += ["**Alternative explanations**"] + [f"- {a}" for a in r["alternative_mechanisms"]] + [""]
        out += ["**Supporting evidence**"] + [f"- “{e.get('quote', '')}” — {e.get('source', '')}" for e in r["supporting_evidence"]] + [""]
        out += ["**Opposing evidence**"] + ([f"- “{e.get('quote', '')}” — {e.get('source', '')}" for e in r["opposing_evidence"]]
                                           or ["- none found in this corpus"]) + [""]
        out += ["**Uncertainty**"] + [f"- {u}" for u in r["uncertainty"]] + [""]
        if r["critic"]:
            out += ["**Critic findings**"] + [f"- {x}" for x in r["critic"]["rule_findings"] + r["critic"]["notes"]] + [""]
        if r["novelty"]:
            n = r["novelty"]
            out += [f"**Prior-work search ({n['status']})**"] + [f"- query `{s['query']}` on {s['run_at'][:10]}: {s['hits']} hits, {s['examined']} examined" for s in n["searches"]]
            out += [f"- prior work: {q}" for q in n["prior_work_quotes"]] + [f"- limitation: {x}" for x in n["limitations"]] + [""]
        for v in r["validation"]:
            out += [f"**Validation run: {v['method']} on {v['dataset']} ({v['status']}" + (f", {v['verdict']}" if v["verdict"] else "") + ")**",
                    f"- pre-registered {v['planned_at'][:19]}, recorded {v['recorded_at'][:19]}; seed {v['seed']}; settings {v['parameters']}"]
            if v["metrics"]:
                ci = v["intervals"].get("hedges_g_heldout")
                out += [f"- held-out effect size (Hedges g) {v['metrics']['hedges_g_heldout']:.2f}"
                        + (f", 95% interval {ci[0]:.2f} to {ci[1]:.2f}" if ci else "")
                        + f"; adjusted p {v['metrics']['p_adjusted']:.4f}; n {v['metrics']['n_a_heldout']:.0f} vs {v['metrics']['n_b_heldout']:.0f}"]
            out += [f"- caveat: {c}" for c in v["caveats"]] + [""]
        if r["experiment_plan"]:
            e = r["experiment_plan"]
            out += ["**Experiment plan (draft for expert review)**"] + [f"- {a}" for a in e["aims"]] + [f"- Power: {e['power_plan']}"]
            out += [f"- Assumption: {x}" for x in e["assumptions"]] + [f"- Flag: {x}" for x in e["flags"]] + [""]
        if r["ranking"]:
            out += ["**Ranking (reported separately, no combined score)**"] + [
                f"- {k}: {v['level']}" + (f" ({'; '.join(v['reasons'])})" if v["reasons"] else "") for k, v in r["ranking"].items()] + [""]
    return "\n".join(out) + "\n"
