"""Acceptance suite: one test per criterion A-J from the ChronoBio specification.

Fixtures are generated PDFs and synthetic data; models and literature APIs are scripted or mocked.
A pass here means the criterion holds on those fixtures, not on the real literature.
"""

import json
import re
import xml.etree.ElementTree as ET

import pytest
from conftest import _draw
from swarm_world import A, B, Paper, build
from test_report import accepted, unaccepted
from test_swarm import critic, judge, literature, proposal, three_animal_corpus
from test_validation import COMMON, PARAMS, write_csv

from chronobio.benchmark import citation_fidelity, run_benchmark
from chronobio.claims import extract_claims
from chronobio.config import Settings
from chronobio.datasets import ingest_csv
from chronobio.export import build_records
from chronobio.figures import graph_svg, legend_height
from chronobio.graph import load_graph, snapshot
from chronobio.ingest import ingest_pdf
from chronobio.layout import layout
from chronobio.llm import ScriptedLLM
from chronobio.models import Direction, Locator, RunStatus, Relation, Verdict
from chronobio.pdf_ingest import locate
from chronobio.store import Store
from chronobio.swarm import load_result, run_swarm
from chronobio.validation import execute_runs, plan_run
from chronobio.models import Publication

N_PAPERS = 20


def twenty_papers(tmp_path):
    """20 generated PDFs, each with a unique finding sentence on page 1 and a different year."""
    settings = Settings(data_dir=tmp_path / "data", max_context_chars=20_000)
    store = Store(settings.db_path)
    papers = []
    for i in range(N_PAPERS):
        sentence = f"Compound C{i} reduced marker M{i} by {20 + i} percent in the treated group"
        pdf = _draw(tmp_path / f"paper{i}.pdf", [[f"Study {i} of compound C{i}", sentence, "Methods were standard."], ["Limitations apply."]])
        pub, doc, _ = ingest_pdf(store, settings, pdf, title=f"Study {i}", year=2000 + i, doi=f"10.7/{i}")
        papers.append((pub, doc, sentence))
    return settings, store, papers


# A ── legacy application unchanged ───────────────────────────────────────────

def test_A_legacy_application_is_unchanged():
    import subprocess
    from pathlib import Path
    from chronobio.__main__ import legacy_changes
    repo = Path(__file__).resolve().parents[2]
    base = next((b for b in ("origin/main", "main") if subprocess.run(["git", "rev-parse", "--verify", "-q", b], cwd=repo,
                                                                         capture_output=True).returncode == 0), None)
    if base is None:
        pytest.skip("no git base branch available")
    assert legacy_changes(repo, base) == []            # existing frontend tests: `python -m chronobio regression`


# B ── 20 fixture papers, exact highlighted passages ──────────────────────────

def test_B_twenty_papers_give_exact_highlighted_passages_and_every_citation_checks_out(tmp_path):
    settings, store, papers = twenty_papers(tmp_path)
    fabricated = 0
    for pub, doc, sentence in papers:
        reply = json.dumps([
            {"claim": f"A finding about {pub.title}", "passage": sentence, "direction": "supports", "design": "in_vitro"},
            {"claim": "An invented finding", "passage": f"{pub.title} proved a cure in every patient", "direction": "supports"}])
        res = extract_claims(ScriptedLLM([reply]), pub, settings, doc=doc)
        fabricated += sum(r.reason == "passage_not_verbatim" for r in res.rejections)
        (claim,) = res.claims
        store.save(claim)
        page = doc.pages[claim.page - 1]
        assert claim.locator == Locator.PDF_EXACT and claim.page == 1 and claim.passage == sentence
        assert page.text[claim.char_start:claim.char_end] == sentence                          # exact text at the stated offsets
        x0, top, x1, bottom = claim.highlight_boxes[0]
        assert 0 <= x0 < x1 <= page.width and 0 <= top < bottom <= page.height                  # a real region on the page
    assert fabricated == N_PAPERS                                                               # every invented quote was refused
    fidelity = {m.name: m for m in citation_fidelity(store, settings)}
    assert fidelity["claim_quote_fidelity"].value == 1.0 and fidelity["references_with_identifier"].value == 1.0


# C ── time slider excludes post-cutoff publications and claims ──────────────

def test_C_the_time_slider_never_shows_evidence_from_after_the_cutoff(tmp_path):
    settings, store, papers = twenty_papers(tmp_path)
    from chronobio.models import EvidenceClaim, GraphEdge, GraphNode, NodeType, Provenance
    from chronobio.graph import edge_id, node_id
    prov = Provenance(source="test")
    for pub, _, sentence in papers:
        c = EvidenceClaim(publication_id=pub.id, claim=sentence, passage=sentence, locator=Locator.TEXT_ONLY, extraction_version="t", provenance=prov)
        store.save(c)
        i = int(pub.title.split()[-1])
        for name in (f"C{i}", f"M{i}"):
            if store.get(node_id(name)) is None:
                store.save(GraphNode(id=node_id(name), type=NodeType.GENE, canonical_name=name, provenance=prov))
        store.save(GraphEdge(id=edge_id(c.id, node_id(f"C{i}"), node_id(f"M{i}"), Relation.INHIBITS), source=node_id(f"C{i}"),
                             target=node_id(f"M{i}"), relation=Relation.INHIBITS, evidence_claim_ids=[c.id], provenance=prov))
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes, edges = load_graph(store)
    counts = []
    for cutoff in range(1999, 2021):
        snap = snapshot(nodes, edges, claims, pubs, cutoff)
        assert all(pubs[claims[c].publication_id].year <= cutoff for c in snap.claim_ids)
        counts.append(len(snap.claim_ids))
    assert counts == sorted(counts) and counts[0] == 0 and counts[-1] == N_PAPERS


# D ── every hypothesis lists evidence for and against, predictions, uncertainty

def test_D_every_hypothesis_carries_its_evidence_falsifiers_and_uncertainty(tmp_path):
    corpus, result = accepted(tmp_path)
    for rec in build_records(corpus.store, result):
        assert rec["supporting_evidence"] and "opposing_evidence" in rec           # opposing may be empty, but is always reported
        assert rec["predictions"] and rec["falsifiers"] and rec["uncertainty"] and rec["critic"]


# E ── critic rejects weak hypotheses and catches contradictory fixtures ─────

def test_E_the_critic_rejects_weak_and_contradicted_hypotheses(tmp_path):
    papers = [Paper(year=2015), Paper(year=2016, relation=Relation.INHIBITS), Paper(year=2017, relation=Relation.INHIBITS),
              Paper(year=2018, relation=Relation.INHIBITS)]
    corpus = build(tmp_path, papers)
    result = run_swarm(ScriptedLLM([proposal(corpus.claim_ids[:1]), critic("accept")]), corpus.store, corpus.settings, literature([]), max_gaps=1)
    verdicts = {r.verdict for r in result.reviews}
    assert verdicts == {Verdict.REJECT} and result.hypotheses[0].review_status.value == "contradicted"
    weak_corpus, weak = unaccepted(tmp_path / "weak")
    assert all(r.verdict == Verdict.REVISE for r in weak.reviews) and weak.cards == []        # never accepted, however many rounds


# F ── novelty results keep reproducible queries and dates ───────────────────

def test_F_novelty_searches_are_recorded_with_query_and_date(tmp_path):
    corpus, result = accepted(tmp_path)
    (rec,) = build_records(corpus.store, result)
    searches = rec["novelty"]["searches"]
    assert [s["query"] for s in searches] == [f'"{A}" AND "{B}"', f'"{A}"', f'"{B}"']
    assert all(re.match(r"\d{4}-\d{2}-\d{2}T", s["run_at"]) and s["hits"] >= 0 for s in searches)
    assert "Absence of search hits is not evidence of novelty." in rec["novelty"]["limitations"]


# G ── validation separates executed from proposed and never invents metrics ─

def test_G_validation_never_shows_numbers_for_planned_or_refused_analyses(tmp_path):
    corpus, result = accepted(tmp_path)
    hyp = result.hypotheses[0]
    ds = ingest_csv(corpus.store, write_csv(tmp_path / "s.csv"), **COMMON)
    planned = plan_run(corpus.store, hyp, ds, "two_group_numeric", PARAMS)
    assert planned.status == RunStatus.PLANNED and planned.metrics == {} and planned.verdict == ""
    refused = execute_runs(corpus.store, [plan_run(corpus.store, hyp, ds, "two_group_numeric", PARAMS | {"feature": "group"}).id])[0]
    assert refused.status == RunStatus.FAILED and refused.metrics == {} and refused.verdict == ""
    done = execute_runs(corpus.store, [planned.id])[0]
    assert done.status == RunStatus.EXECUTED and done.metrics and done.verdict
    (rec,) = build_records(corpus.store, load_result(corpus.store))
    assert sorted(v["status"] for v in rec["validation"]) == ["executed", "failed"]            # the plan became the executed version


# H ── graphics: legend, source mapping, SVG export, hypotheses visibly distinct

def test_H_every_graphic_has_a_legend_a_claim_mapping_and_visibly_distinct_hypotheses(tmp_path, monkeypatch):
    from chronobio import report as report_module
    monkeypatch.setattr(report_module, "find_chrome", lambda: None)
    corpus, _ = accepted(tmp_path)
    res = report_module.build_report(corpus.store, corpus.settings, tmp_path / "r")
    for fig in res.figures:
        root = ET.fromstring(fig.svg)
        assert root.find("{http://www.w3.org/2000/svg}title") is not None and fig.caption and fig.legend
        assert (tmp_path / "r" / "figures" / f"{fig.key}.svg").exists()                      # editable SVG export
    sources = json.loads((tmp_path / "r" / "figures" / "figure_sources.json").read_text())
    assert all(sources[f.key] == f.claim_ids for f in res.figures)
    assert "hypothesis — NOT established" in next(f for f in res.figures if f.key == "evidence-graph").svg


def test_H_a_hypothesized_link_is_drawn_dashed_and_labelled_unlike_reported_ones(tmp_path):
    from chronobio.graph import suggest_inferred_edges
    corpus = build(tmp_path, [Paper(src=A, dst=B), Paper(src=B, dst="tumor growth")])           # A->B->growth, A->growth never reported
    nodes_list, edges = load_graph(corpus.store)
    snap = snapshot(nodes_list, edges + suggest_inferred_edges(edges), corpus.claims, corpus.pubs, None)
    placed = layout([n.id for n in snap.nodes], [(e.source, e.target) for e in snap.edges])
    root = ET.fromstring(graph_svg(snap, placed.pos, {n.id: n for n in nodes_list}, title="t", height=placed.height + legend_height(960)))
    groups = [g for g in root.iter("{http://www.w3.org/2000/svg}g") if g.get("data-edge")]
    inferred = [g for g in groups if "inferred" in g.get("class").split()]
    reported = [g for g in groups if "inferred" not in g.get("class").split()]
    assert len(inferred) == 1 and len(reported) == 2
    assert inferred[0].find("{http://www.w3.org/2000/svg}path").get("stroke-dasharray") == "7 5" and inferred[0].get("data-claims") == ""
    assert all(g.find("{http://www.w3.org/2000/svg}path").get("stroke-dasharray") is None and g.get("data-claims") for g in reported)


# I ── report content ─────────────────────────────────────────────────────────

def test_I_the_report_has_aims_controls_outcomes_data_requirements_and_citations(tmp_path, monkeypatch):
    from chronobio import report as report_module
    from chronobio.experiment import design_experiment
    monkeypatch.setattr(report_module, "find_chrome", lambda: None)
    corpus, result = accepted(tmp_path)
    corpus.store.save(design_experiment(result.hypotheses[0], corpus.claims, corpus.pubs, assumed_effect_size=0.8))
    html = report_module.build_report(corpus.store, corpus.settings, tmp_path / "r").html.read_text()
    for needle in ("Aims", "Controls", "Endpoints and expected outcomes", "Alternative outcomes", "Sample size and replication",
                   "Go / no-go criteria", "Ethics, cost and feasibility flags", "6. Validation and experiment design",
                   "8. References", "Limitations", "Supporting evidence", "doi:10.1/0"):
        assert needle in html, needle


# J ── resources stay within limits; failed jobs resume without harming data ─

def test_J_runs_stay_within_limits_and_resume_after_a_crash(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    out = run_benchmark(corpus.store, corpus.settings, None, tmp_path / "b")
    assert out["limit_problems"] == [] and out["peak_memory_mb"] < corpus.settings.max_memory_mb

    class Crash(RuntimeError):
        pass

    class Dying(ScriptedLLM):
        def generate(self, system, prompt, **kw):
            if len(self.calls) >= 2:
                raise Crash("model died")
            return super().generate(system, prompt, **kw)

    before = {p.id: p for p in corpus.store.list(Publication)}
    with pytest.raises(Crash):
        run_swarm(Dying([proposal(corpus.claim_ids), critic("revise"), proposal(corpus.claim_ids)]), corpus.store, corpus.settings,
                  literature([]), max_gaps=1)
    assert {p.id: p for p in corpus.store.list(Publication)} == before                      # earlier data untouched by the crash
    resumed = run_swarm(ScriptedLLM([proposal(corpus.claim_ids), critic("accept"), judge("no", "")] * 2), corpus.store, corpus.settings,
                        literature([]), max_gaps=1)
    assert resumed.hypotheses and corpus.store.resume("swarm")[1]["done"]
