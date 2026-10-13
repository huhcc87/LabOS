"""Validation tests use SYNTHETIC data with a known, built-in effect. Nothing here is biology."""

import csv
import random
from pathlib import Path

import pytest
from swarm_world import PROV

from chronobio.config import Settings
from chronobio.datasets import DatasetError, ingest_csv, load_table
from chronobio.models import (
    AccessStatus, Hypothesis, HypothesisStatus, RunStatus, ValidationRun,
)
from chronobio.store import Store
from chronobio.validation import (
    benjamini_hochberg, bootstrap_ci_g, execute_runs, hedges_g, permutation_p, plan_run,
)

DICT = {"sample": "sample id", "group": "treatment group", "batch": "processing batch",
        "expr": "expression of the marker", "other": "a second marker"}
COMMON = dict(name="synthetic", data_dictionary=DICT, sample_id_column="sample", group_column="group", batch_column="batch")


def write_csv(path: Path, *, n=20, effect=2.0, seed=1, other_effect=0.0, batch="mixed") -> Path:
    rng = random.Random(seed)
    rows = []
    for g, shift in (("treated", effect), ("control", 0.0)):
        for i in range(n):
            b = ("b1" if i % 2 else "b2") if batch == "mixed" else ("b1" if g == "treated" else "b2")
            rows.append({"sample": f"{g[0].upper()}{i}", "group": g, "batch": b,
                         "expr": round(10 + shift + rng.gauss(0, 1), 3),
                         "other": round(5 + (other_effect if g == "treated" else 0) + rng.gauss(0, 1), 3)})
    with path.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    return path


@pytest.fixture
def store(tmp_path):
    return Store(Settings(data_dir=tmp_path / "d").db_path)


def hyp(store):
    h = Hypothesis(statement="Treatment raises marker expression", predictions=["expression is higher in treated"],
                   falsifiers=["expression is not higher"], provenance=PROV)
    store.save(h)
    return h


PARAMS = dict(feature="expr", group_a="treated", group_b="control", expected_direction="a_greater", n_perm=2000, n_boot=500)


def run_one(store, tmp_path, csv_path, **overrides):
    ds = ingest_csv(store, csv_path, **COMMON)
    h = hyp(store)
    plan = plan_run(store, h, ds, "two_group_numeric", PARAMS | overrides)
    return h, ds, plan, execute_runs(store, [plan.id])[0]


# ── statistics ───────────────────────────────────────────────────────────────

def test_statistics_match_known_values_and_are_reproducible():
    a, b = [12.0, 13.0, 14.0, 15.0, 16.0], [10.0, 11.0, 12.0, 13.0, 14.0]
    assert hedges_g(a, b) == pytest.approx(1.2649 * (1 - 3 / 31), abs=1e-3)           # d = 2/sqrt(2.5), small-sample correction
    assert benjamini_hochberg([0.01, 0.04, 0.03, 0.005]) == pytest.approx([0.02, 0.04, 0.04, 0.02])
    assert permutation_p(a, b, 3000, random.Random(5)) == permutation_p(a, b, 3000, random.Random(5))
    lo, hi = bootstrap_ci_g(a, b, 800, random.Random(5))
    assert lo < hedges_g(a, b) < hi
    flat = [1.0] * 10
    assert permutation_p(flat, flat, 200, random.Random(1)) == 1.0                    # no difference -> p = 1


# ── ingestion ────────────────────────────────────────────────────────────────

def test_ingest_records_provenance_flags_and_leaves_the_file_alone(store, tmp_path):
    path = write_csv(tmp_path / "d.csv")
    before = path.read_bytes()
    ds = ingest_csv(store, path, **COMMON, units={"expr": "AU"}, access=AccessStatus.PATIENT_LEVEL)
    assert ds.sample_count == 40 and ds.groups == ["control", "treated"] and len(ds.sha256) == 64
    assert any("other: numeric but no unit declared" in f for f in ds.quality_flags)
    assert any("never be sent to a cloud model" in f for f in ds.quality_flags)
    assert path.read_bytes() == before and store.get(ds.id) == ds


@pytest.mark.parametrize("breakage,message", [
    ({"data_dictionary": {k: v for k, v in DICT.items() if k != "other"}}, "missing a description for: other"),
    ({"sample_id_column": "nope"}, "sample id column 'nope'"),
])
def test_ingest_refuses_incomplete_or_unusable_tables(store, tmp_path, breakage, message):
    with pytest.raises(DatasetError, match=message):
        ingest_csv(store, write_csv(tmp_path / "d.csv"), **(COMMON | breakage))


def test_ingest_refuses_duplicate_and_missing_sample_ids(store, tmp_path):
    p = tmp_path / "dup.csv"
    p.write_text("sample,group,batch,expr,other\nS1,a,b1,1,1\nS1,b,b1,2,2\n")
    with pytest.raises(DatasetError, match="repeated: S1"):
        ingest_csv(store, p, **COMMON)
    p.write_text("sample,group,batch,expr,other\n,a,b1,1,1\nS2,b,b1,2,2\n")
    with pytest.raises(DatasetError, match="needs an id"):
        ingest_csv(store, p, **COMMON)


def test_ingest_flags_missingness_and_batch_confounding(store, tmp_path):
    ds = ingest_csv(store, write_csv(tmp_path / "d.csv", batch="confounded"), **COMMON)
    assert any("batch confounding" in f for f in ds.quality_flags)
    p = tmp_path / "miss.csv"
    p.write_text("sample,group,batch,expr,other\n" + "".join(f"S{i},{'a' if i % 2 else 'b'},b1,,{i}\n" for i in range(10)))
    assert any("expr: 100% of values are missing" in f for f in ingest_csv(store, p, **COMMON).quality_flags)


def test_a_file_changed_after_ingestion_is_refused(store, tmp_path):
    path = write_csv(tmp_path / "d.csv")
    ds = ingest_csv(store, path, **COMMON)
    path.write_text(path.read_text() + "X1,treated,b1,99,1\n")
    with pytest.raises(DatasetError, match="changed after it was ingested"):
        load_table(ds)


# ── pre-registration and execution ───────────────────────────────────────────

def test_plan_is_saved_first_and_the_result_is_version_two_of_the_same_record(store, tmp_path):
    h, ds, plan, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv"))
    assert (plan.status, plan.metrics, plan.verdict, plan.version) == (RunStatus.PLANNED, {}, "", 1)
    assert (run.id, run.version, run.status) == (plan.id, 2, RunStatus.EXECUTED)
    first, second = store.history(plan.id)
    assert first.created_at <= second.created_at and first.parameters == second.parameters       # endpoint fixed before results
    assert run.seed == 7 and run.code_version.startswith("validation-v1/two_group_numeric")


def test_a_real_effect_is_found_with_interval_and_adjusted_p_and_updates_the_hypothesis(store, tmp_path):
    h, _, _, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv", effect=2.0))
    m = run.metrics
    assert run.verdict == "consistent" and m["hedges_g_heldout"] > 1.0 and m["p_adjusted"] < 0.05
    lo, hi = run.confidence_intervals["hedges_g_heldout"]
    assert lo < m["hedges_g_heldout"] < hi and m["n_a_heldout"] == m["n_b_heldout"] == 10
    assert any("does not validate" in c for c in run.caveats)
    assert store.get(h.id).review_status == HypothesisStatus.COMPUTATIONALLY_TESTED


def test_no_effect_is_inconclusive_and_never_promotes_the_hypothesis(store, tmp_path):
    h, _, _, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv", effect=0.0, seed=3))
    assert run.verdict == "inconclusive" and store.get(h.id).review_status == HypothesisStatus.PROPOSED


def test_an_opposite_effect_is_reported_as_contradicting_the_prediction(store, tmp_path):
    h, _, _, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv", effect=2.0), expected_direction="b_greater")
    assert run.verdict == "contradicted" and store.get(h.id).review_status == HypothesisStatus.CONTRADICTED


def test_results_are_reproducible_from_the_seed(store, tmp_path, ):
    path = write_csv(tmp_path / "d.csv")
    a = run_one(store, tmp_path, path)[3]
    b = run_one(Store(Settings(data_dir=tmp_path / "d2").db_path), tmp_path, path)[3]
    assert a.metrics == b.metrics and a.confidence_intervals == b.confidence_intervals


def test_multiple_endpoints_are_corrected_together(store, tmp_path):
    ds = ingest_csv(store, write_csv(tmp_path / "d.csv", other_effect=0.3), **COMMON)
    h = hyp(store)
    plans = [plan_run(store, h, ds, "two_group_numeric", PARAMS | {"feature": f}) for f in ("expr", "other")]
    runs = execute_runs(store, [p.id for p in plans])
    assert all(r.metrics["p_adjusted"] >= r.metrics["p_permutation"] for r in runs)
    assert max(r.metrics["p_adjusted"] for r in runs) >= max(r.metrics["p_permutation"] for r in runs)
    assert any("across 2 run(s)" in c for c in runs[0].caveats)


def test_executing_twice_never_redoes_or_overwrites(store, tmp_path):
    _, _, plan, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv"))
    again = execute_runs(store, [plan.id])[0]
    assert again.version == 2 and again.metrics == run.metrics and [r.version for r in store.history(plan.id)] == [1, 2]


# ── refusals: the run is marked failed, with the reason and no numbers ───────

@pytest.mark.parametrize("override,csv_kw,reason", [
    ({"feature": "group"}, {}, "would leak the answer"),
    ({"feature": "sample"}, {}, "would leak the answer"),
    ({"feature": "batch"}, {}, "would leak the answer"),
    ({"group_a": "nonexistent"}, {}, "is not in the dataset"),
    ({"feature": "nope"}, {}, "is not a column"),
    ({}, {"n": 8}, "at least 10 are needed"),
    ({}, {"batch": "confounded"}, "complete batch confounding"),
    ({"expected_direction": "up"}, {}, "must be 'a_greater' or 'b_greater'"),
])
def test_unsafe_analyses_are_refused_with_the_reason_and_no_metrics(store, tmp_path, override, csv_kw, reason):
    _, _, _, run = run_one(store, tmp_path, write_csv(tmp_path / "d.csv", **csv_kw), **override)
    assert run.status == RunStatus.FAILED and run.metrics == {} and run.confidence_intervals == {} and run.verdict == ""
    assert reason in run.caveats[0]


def test_non_numeric_feature_and_zero_variance_fail_cleanly(store, tmp_path):
    p = tmp_path / "text.csv"
    p.write_text("sample,group,batch,expr,other\n" + "".join(
        f"{g}{i},{g},b{i % 2},{'high' if g == 'treated' else 'low'},{i}\n" for g in ("treated", "control") for i in range(12)))
    _, _, _, run = run_one(store, tmp_path, p)
    assert run.status == RunStatus.FAILED and "not numeric" in run.caveats[0]
    flat = tmp_path / "flat.csv"
    flat.write_text("sample,group,batch,expr,other\n" + "".join(
        f"{g}{i},{g},b{i % 2},5,{i}\n" for g in ("treated", "control") for i in range(12)))
    _, _, _, run2 = run_one(Store(Settings(data_dir=tmp_path / "d3").db_path), tmp_path, flat)
    assert run2.status == RunStatus.FAILED and "zero variance" in run2.caveats[0]


def test_file_changed_after_ingestion_fails_the_run_instead_of_analysing_it(store, tmp_path):
    path = write_csv(tmp_path / "d.csv")
    ds = ingest_csv(store, path, **COMMON)
    plan = plan_run(store, hyp(store), ds, "two_group_numeric", PARAMS)
    path.write_text(path.read_text() + "X1,treated,b1,99,1\n")
    run = execute_runs(store, [plan.id])[0]
    assert run.status == RunStatus.FAILED and "changed after it was ingested" in run.caveats[0] and run.metrics == {}


def test_partial_batch_confounding_and_missing_values_are_caveats_not_failures(store, tmp_path):
    path = tmp_path / "d.csv"
    write_csv(path)
    rows = path.read_text().splitlines()
    rows[1] = rows[1].replace(rows[1].split(",")[3], "")                      # one missing expr value
    rows = [r.replace(",b2,", ",b3,") if r.startswith("T") and i < 6 else r for i, r in enumerate(rows)]
    path.write_text("\n".join(rows) + "\n")
    _, _, _, run = run_one(store, tmp_path, path)
    assert run.status == RunStatus.EXECUTED
    assert any("left out" in c for c in run.caveats) and any("Partial batch confounding" in c for c in run.caveats)


def test_plan_run_rejects_unknown_methods_and_missing_parameters(store, tmp_path):
    ds = ingest_csv(store, write_csv(tmp_path / "d.csv"), **COMMON)
    h = hyp(store)
    with pytest.raises(ValueError, match="unknown method"):
        plan_run(store, h, ds, "magic", {})
    with pytest.raises(ValueError, match="needs: group_a"):
        plan_run(store, h, ds, "two_group_numeric", {"feature": "expr", "group_b": "x", "expected_direction": "a_greater"})


def test_a_planned_run_can_never_carry_numbers_or_a_verdict():
    with pytest.raises(ValueError):
        ValidationRun(hypothesis_id="h", dataset_id="d", method="m", code_version="v", metrics={"p": 0.01}, provenance=PROV)
    with pytest.raises(ValueError):
        ValidationRun(hypothesis_id="h", dataset_id="d", method="m", code_version="v", verdict="consistent", provenance=PROV)


def test_a_single_group_table_is_refused(store, tmp_path):
    p = tmp_path / "one.csv"
    p.write_text("sample,group,batch,expr,other\n" + "".join(f"S{i},only,b1,{i},{i}\n" for i in range(10)))
    with pytest.raises(DatasetError, match="at least two groups"):
        ingest_csv(store, p, **COMMON)


def test_command_line_ingests_validates_and_designs(store, tmp_path, monkeypatch, capsys):
    import json
    from chronobio.__main__ import main
    from chronobio.experiment import design_experiment  # noqa: F401
    monkeypatch.setenv("CHRONOBIO_DATA_DIR", str(tmp_path / "d"))
    h = hyp(store)
    path = write_csv(tmp_path / "d.csv")
    (tmp_path / "dict.json").write_text(json.dumps(DICT))
    assert main(["c", "dataset-add", str(path), "--name", "syn", "--dictionary", str(tmp_path / "dict.json"),
                 "--id-col", "sample", "--group-col", "group", "--batch-col", "batch"]) == 0
    ds_id = capsys.readouterr().out.split()[1].rstrip(":")
    assert main(["c", "validate", h.id, ds_id, "--feature", "expr", "--group-a", "treated", "--group-b", "control",
                 "--direction", "a_greater"]) == 0
    out = capsys.readouterr().out
    assert "pre-registered" in out and "executed: consistent" in out and "Hedges g" in out
    assert main(["c", "design", h.id, "--effect-size", "0.8"]) == 0
    assert "About 25 independent samples" in capsys.readouterr().out
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps({"sample": "id"}))
    assert main(["c", "dataset-add", str(path), "--name", "x", "--dictionary", str(bad), "--id-col", "sample", "--group-col", "group"]) == 1
    assert "refused: data dictionary is missing" in capsys.readouterr().err
