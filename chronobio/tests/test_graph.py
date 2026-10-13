import json

from world import PROV, make_world

from chronobio.graph import (
    build_graph, extract_edges, node_id, snapshot, suggest_inferred_edges, year_range,
)
from chronobio.llm import ScriptedLLM
from chronobio.models import (
    Direction, EvidenceClaim, GraphEdge, Locator, Publication, Relation,
)
from chronobio.store import Store


def keys(snap):
    return {(e.source, e.target) for e in snap.edges}


def ids(*names):
    return tuple(node_id(n) for n in names)


# ── time slicing (acceptance criterion C) ────────────────────────────────────

def test_cutoff_excludes_later_evidence_edges_and_nodes(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    snap = snapshot(w.nodes, w.edges, w.claims, w.pubs, 2016)
    assert keys(snap) == {ids("KRAS", "MAPK pathway")}
    assert {n.canonical_name for n in snap.nodes} == {"KRAS", "MAPK pathway"}      # later nodes absent
    assert all(w.pubs[w.claims[c].publication_id].year <= 2016 for c in snap.claim_ids)
    edge = snap.edges[0]
    assert len(edge.evidence) == 1 and edge.first_year == 2015                    # 2021 contradiction hidden


def test_cutoff_is_inclusive_and_grows_monotonically(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    sizes = [len(snapshot(w.nodes, w.edges, w.claims, w.pubs, y).claim_ids) for y in range(2010, 2024)]
    assert sizes == sorted(sizes)
    assert len(snapshot(w.nodes, w.edges, w.claims, w.pubs, 2018).claim_ids) == 2
    assert len(snapshot(w.nodes, w.edges, w.claims, w.pubs, 2014).claim_ids) == 0


def test_before_any_evidence_the_graph_is_empty(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    snap = snapshot(w.nodes, w.edges, w.claims, w.pubs, 2000)
    assert snap.edges == () and snap.nodes == ()


def test_undated_evidence_is_never_placed_on_the_timeline(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    snap = snapshot(w.nodes, w.edges, w.claims, w.pubs, None)
    assert snap.excluded_undated == 1
    undated_claim = next(c for c in w.claims.values() if "undated" in c.claim)
    assert undated_claim.id not in snap.claim_ids
    assert year_range(w.pubs) == (2012, 2021)


# ── contested / retracted flags ──────────────────────────────────────────────

def test_conflicting_evidence_marks_the_link_contested(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    by_pair = {(e.source, e.target): e for e in snapshot(w.nodes, w.edges, w.claims, w.pubs, 2021).edges}
    assert by_pair[ids("KRAS", "MAPK pathway")].contested is True       # activates (2015) vs inhibits (2021)
    assert by_pair[ids("MAPK pathway", "tumor growth")].contested is False
    # Before the conflicting paper existed it was not contested.
    early = snapshot(w.nodes, w.edges, w.claims, w.pubs, 2018)
    assert not any(e.contested for e in early.edges)


def test_edges_from_retracted_papers_are_flagged(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    by_pair = {(e.source, e.target): e for e in snapshot(w.nodes, w.edges, w.claims, w.pubs, 2021).edges}
    assert by_pair[ids("Drug X", "KRAS")].has_retracted_source is True
    assert by_pair[ids("MAPK pathway", "tumor growth")].has_retracted_source is False


# ── hypothesized links ───────────────────────────────────────────────────────

def test_inferred_edges_are_flagged_evidence_free_and_not_duplicates(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    inferred = suggest_inferred_edges(w.edges)
    pairs = {(e.source, e.target) for e in inferred}
    assert ids("KRAS", "tumor growth") in pairs                  # KRAS -> MAPK -> growth
    assert all(e.inferred and e.evidence_claim_ids == [] for e in inferred)
    direct = {(e.source, e.target) for e in w.edges}
    assert not (pairs & direct)


def test_inferred_edges_appear_only_when_both_ends_are_visible(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    edges = w.edges + suggest_inferred_edges(w.edges)
    assert not any(e.inferred for e in snapshot(w.nodes, edges, w.claims, w.pubs, 2016).edges)
    snap = snapshot(w.nodes, edges, w.claims, w.pubs, 2018)
    assert [e.key for e in snap.edges if e.inferred] == ["%s>%s" % ids("KRAS", "tumor growth")]
    assert not any(e.inferred for e in snapshot(w.nodes, edges, w.claims, w.pubs, 2018, include_inferred=False).edges)


# ── model triple extraction ──────────────────────────────────────────────────

def _claims():
    pub = Publication(title="t", year=2020, provenance=PROV)
    mk = lambda text: EvidenceClaim(publication_id=pub.id, claim=text, passage=text,
                                    locator=Locator.TEXT_ONLY, extraction_version="t", provenance=PROV)
    return pub, [mk("Sotorasib inhibits KRAS G12C signalling in lung cancer cells"),
                 mk("EGFR amplification is associated with poor survival")]


def run(items):
    pub, claims = _claims()
    return extract_edges(ScriptedLLM([json.dumps(items)]), claims, {pub.id: pub}), claims


def triple(i, s, rel, o, st="gene", ot="gene"):
    return {"claim": i, "subject": s, "subject_type": st, "relation": rel, "object": o, "object_type": ot}


def test_grounded_triples_become_dated_evidence_linked_edges():
    build, claims = run([triple(1, "Sotorasib", "inhibits", "KRAS G12C", "intervention")])
    e = build.edges[0]
    assert (e.relation, e.sign, e.inferred, e.evidence_claim_ids) == (Relation.INHIBITS, -1, False, [claims[0].id])
    assert e.publication_date.year == 2020
    assert {n.canonical_name for n in build.nodes} == {"Sotorasib", "KRAS G12C"}


def test_invented_entities_and_bad_output_are_rejected():
    build, _ = run([
        triple(1, "Sotorasib", "inhibits", "TP53"),            # TP53 not in the claim
        triple(1, "Sotorasib", "cures", "KRAS G12C"),          # not a valid relation
        triple(1, "KRAS", "associated", "kras"),               # same entity twice
        triple(9, "KRAS", "associated", "EGFR"),               # no such claim
    ])
    assert build.edges == []
    assert [r.reason for r in build.rejections] == [
        "entity_not_in_claim", "invalid_relation", "invalid_entities", "bad_claim_index"]
    pub, claims = _claims()
    bad = extract_edges(ScriptedLLM(["not json"]), claims, {pub.id: pub})
    assert bad.rejections[0].reason == "unparseable_model_output"


def test_same_entity_in_different_case_is_one_node():
    assert node_id("KRAS") == node_id("  kras ")
    build, _ = run([triple(1, "KRAS G12C", "associated", "lung cancer"),
                    triple(1, "kras g12c", "associated", "Sotorasib")])
    assert len([n for n in build.nodes if n.canonical_name.lower() == "kras g12c"]) == 1


# ── resumable build ──────────────────────────────────────────────────────────

def test_build_resumes_without_reprocessing_or_duplicating(tmp_path):
    store = Store(tmp_path / "s.sqlite3")
    pub, claims = _claims()
    for rec in (pub, *claims):
        store.save(rec)
    first = ScriptedLLM([json.dumps([triple(1, "Sotorasib", "inhibits", "KRAS G12C")])])
    build_graph(first, store, claims[:1], {pub.id: pub}, job_id="j")

    second = ScriptedLLM([json.dumps([triple(1, "EGFR", "associated", "survival", "gene", "measurement")])])
    build_graph(second, store, claims, {pub.id: pub}, job_id="j")      # claim 1 already done
    assert len(second.calls) == 1 and "Sotorasib" not in second.calls[0][1]
    assert len(store.list(GraphEdge)) == 2

    third = ScriptedLLM([])
    build_graph(third, store, claims, {pub.id: pub}, job_id="j")       # everything done
    assert third.calls == []
