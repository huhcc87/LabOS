import csv
import json

import pytest
from swarm_world import PROV
from world import make_world
from test_report import accepted

from chronobio import benchmark
from chronobio.benchmark import (
    CONTAMINATION_CAVEAT, CountingLLM, baseline_hypotheses, citation_fidelity, expert_sheet, historical_audit,
    novelty_precision, peak_memory_mb, rubric_baseline, rubric_extension, run_benchmark, score_ratings, within_limits,
)
from chronobio.config import Settings
from chronobio.export import build_records
from chronobio.llm import ScriptedLLM
from chronobio.models import (
    Direction, EvidenceClaim, Hypothesis, Locator, NoveltyStatus, Provenance, Publication,
)
from chronobio.store import Store
from chronobio.swarm import load_result

SENTENCE = "Drug X reduced tumour size in mice after four weeks of treatment"


def small_store(tmp_path, passages):
    settings = Settings(data_dir=tmp_path / "d")
    store = Store(settings.db_path)
    pub = Publication(title="P", abstract=f"Background. {SENTENCE}. Conclusion.", year=2020, doi="10.1/p", provenance=PROV)
    store.save(pub)
    claims = []
    for text in passages:
        c = EvidenceClaim(publication_id=pub.id, claim=text, passage=text, locator=Locator.TEXT_ONLY, extraction_version="t", provenance=PROV)
        store.save(c)
        claims.append(c)
    return store, settings, pub, claims


# ── citation fidelity ────────────────────────────────────────────────────────

def test_fidelity_detects_a_tampered_quote_and_a_dangling_citation(tmp_path):
    store, settings, pub, claims = small_store(tmp_path, [SENTENCE, "Drug X reduced tumour size", "Drug X cured everyone"])
    store.save(Hypothesis(statement="s", predictions=["p"], falsifiers=["f"],
                          supporting_claim_ids=[claims[0].id, "clm_missing"], provenance=PROV))
    by_name = {m.name: m for m in citation_fidelity(store, settings)}
    quote = by_name["claim_quote_fidelity"]
    assert quote.value == pytest.approx(2 / 3) and quote.failures == [claims[2].id]
    assert by_name["hypothesis_citation_resolution"].value == 0.5 and by_name["hypothesis_citation_resolution"].failures
    assert by_name["references_with_identifier"].value == 1.0


def test_fidelity_checks_pdf_offsets_against_the_stored_page_text(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    pdf_claim = next(c for c in w.claims.values() if c.locator == Locator.PDF_EXACT)
    assert pdf_claim.id not in citation_fidelity(w.store, w.settings)[0].failures
    w.store.save(pdf_claim.revise(char_start=pdf_claim.char_start + 5, char_end=pdf_claim.char_end + 5))      # offsets now wrong
    assert pdf_claim.id in citation_fidelity(w.store, w.settings)[0].failures


def test_fidelity_is_not_assessed_with_nothing_to_check(tmp_path):
    metrics = citation_fidelity(Store(Settings(data_dir=tmp_path / "e").db_path), Settings(data_dir=tmp_path / "e"))
    assert [m.value for m in metrics] == [None, None, None]


# ── structural rubric and baseline ───────────────────────────────────────────

def test_extension_rubric_counts_real_properties(tmp_path):
    corpus, result = accepted(tmp_path)
    rub = rubric_extension(build_records(corpus.store, result))
    assert rub == {"verifiable_quote_rate": 1.0, "falsifier_rate": 1.0, "measurable_prediction_rate": 1.0,
                   "opposing_evidence_checked_rate": 1.0, "uncertainty_stated_rate": 1.0}
    assert set(rubric_extension([]).values()) == {None}


def test_baseline_is_scored_on_verifiable_quotes_and_lacks_the_other_structure():
    corpus = [f"Background. {SENTENCE}. Conclusion."]
    quoted = {"hypothesis": "h1", "supporting_evidence": f"The paper states: {SENTENCE}"}
    paraphrased = {"hypothesis": "h2", "supporting_evidence": "Studies show that the drug shrinks tumours in rodents."}
    rub = rubric_baseline([quoted, paraphrased], corpus)
    assert rub["verifiable_quote_rate"] == 0.5 and rub["falsifier_rate"] == 0.0 and rub["uncertainty_stated_rate"] == 0.0


def test_baseline_parser_survives_garbage_and_caps_the_count():
    items = [{"hypothesis": f"h{i}", "rationale": "r", "supporting_evidence": "e"} for i in range(6)]
    assert len(baseline_hypotheses(ScriptedLLM([json.dumps(items)]), ["x"], n=4)) == 4
    assert baseline_hypotheses(ScriptedLLM(["Sure, here you go!"]), ["x"]) == []
    assert baseline_hypotheses(ScriptedLLM(['[{"rationale": "no hypothesis"}]']), ["x"]) == []


# ── blinded expert rating ────────────────────────────────────────────────────

def test_the_rating_sheet_hides_which_system_wrote_what_and_is_reproducible(tmp_path):
    records = [{"statement": f"ext {i}", "mechanism": "m"} for i in range(3)]
    base = [{"hypothesis": f"base {i}", "rationale": "r"} for i in range(3)]
    sheet, key = expert_sheet(records, base, tmp_path / "a", seed=5)
    text = sheet.read_text()
    assert "chronobio" not in text.lower() and "baseline" not in text.lower()
    assert sorted(json.loads(key.read_text()).values()) == ["baseline"] * 3 + ["chronobio"] * 3
    sheet2, _ = expert_sheet(records, base, tmp_path / "b", seed=5)
    assert sheet2.read_text() == text


def test_ratings_are_never_invented_and_means_are_split_by_system(tmp_path):
    records, base = [{"statement": "ext", "mechanism": ""}], [{"hypothesis": "base", "rationale": ""}]
    sheet, key = expert_sheet(records, base, tmp_path)
    assert score_ratings(sheet, key)["status"] == "not rated"
    system_of = json.loads(key.read_text())
    rows = list(csv.DictReader(sheet.open()))
    for row in rows:
        row["plausibility"] = "5" if system_of[row["item"]] == "chronobio" else "2"
    with sheet.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    scored = score_ratings(sheet, key)
    assert scored["means"]["chronobio"]["plausibility"] == 5 and scored["means"]["baseline"]["plausibility"] == 2
    assert "testability" not in scored["means"]["chronobio"]                      # unrated criteria stay absent


# ── historical audit ─────────────────────────────────────────────────────────

def test_historical_audit_reports_followup_against_the_base_rate(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    audit = historical_audit(w.store, 2016)
    assert audit["leaks"] == [] and audit["claims_visible"] == 1 and audit["caveat"] == CONTAMINATION_CAVEAT
    assert audit["gaps"] == 1 and audit["gaps_with_later_evidence"] == 1 and audit["gap_followup_rate"] == 1.0   # 2021 paper hit the same link
    assert audit["all_links"] == 1 and audit["baseline_followup_rate"] == 1.0
    assert historical_audit(w.store, 2000)["gap_followup_rate"] is None


def test_the_leak_check_catches_post_cutoff_evidence(tmp_path, paper_pdf, monkeypatch):
    w = make_world(tmp_path, paper_pdf)
    real = benchmark.snapshot
    later = next(c.id for c in w.claims.values() if w.pubs[c.publication_id].year == 2021)

    def leaky(*args, **kwargs):
        snap = real(*args, **kwargs)
        return type(snap)(snap.cutoff, snap.nodes, snap.edges, snap.claim_ids | {later}, snap.excluded_undated)

    monkeypatch.setattr(benchmark, "snapshot", leaky)
    assert historical_audit(w.store, 2016)["leaks"] == [later]


# ── novelty precision, resources, cost ───────────────────────────────────────

def test_novelty_precision_needs_gold_labels():
    K, P, U = NoveltyStatus.KNOWN, NoveltyStatus.PARTIALLY_TESTED, NoveltyStatus.UNKNOWN
    assert novelty_precision({"a": K}, {})["status"] == "not assessed"
    res = novelty_precision({"a": K, "b": K, "c": P, "d": U}, {"a": K, "b": P, "c": K, "d": U})
    assert res["n"] == 4 and res["precision_known"] == 0.5 and res["recall_known"] == 0.5
    assert res["confusion"][("known", "known")] == 1 and res["confusion"][("partially_tested", "known")] == 1 and sum(res["confusion"].values()) == 4


def test_resource_limits_and_cost_counting():
    s = Settings(max_runtime_s=10, max_memory_mb=100)
    assert within_limits(s, 5, 50) == []
    assert len(within_limits(s, 11, 101)) == 2 and "runtime" in within_limits(s, 11, 50)[0]
    inner = ScriptedLLM(["abc", "de"])
    counted = CountingLLM(inner)
    counted.generate("sys", "prompt"), counted.generate("s", "p")
    assert (counted.calls, counted.chars_in, counted.chars_out) == (2, len("sysprompt") + 2, 5) and counted.seconds >= 0
    assert peak_memory_mb() > 10


def test_full_benchmark_writes_json_markdown_and_a_blank_rating_sheet(tmp_path, monkeypatch):
    corpus, _ = accepted(tmp_path)
    reply = json.dumps([{"hypothesis": "Drug X shrinks tumours", "rationale": "r", "supporting_evidence": "KRAS drives MAPK pathway activity"}])
    out = run_benchmark(corpus.store, corpus.settings, ScriptedLLM([reply]), tmp_path / "bench", cutoff=2018)
    assert out["extension"]["falsifier_rate"] == 1.0 and out["baseline"]["falsifier_rate"] == 0.0
    assert out["baseline_cost"]["model_calls"] == 1 and out["historical"]["cutoff"] == 2018 and out["limit_problems"] == []
    assert out["expert_rating"]["status"] == "not rated" and "Structural comparison only" in out["comparison_note"]
    md = (tmp_path / "bench" / "benchmark.md").read_text()
    for needle in ("Citation fidelity", "single-prompt baseline", "Historical evaluation (cutoff 2018)", "pretraining", "not rated"):
        assert needle in md or needle.replace("pretraining", "contamination") in md
    assert json.loads((tmp_path / "bench" / "benchmark.json").read_text())["hypotheses"] == 1
    skipped = run_benchmark(corpus.store, corpus.settings, None, tmp_path / "b2")
    assert "baseline" not in skipped and "not run" in (tmp_path / "b2" / "benchmark.md").read_text()
