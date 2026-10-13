import pytest
from swarm_world import PROV, A, B, Paper, build

from chronobio.agents import NO_MECHANISM, build_pool, rule_findings, ungrounded_terms
from chronobio.entities import build_aliases, canonical_key, is_generic
from chronobio.gaps import find_gaps
from chronobio.graph import edge_id, load_graph, node_id, snapshot
from chronobio.models import (
    EvidenceClaim, GapKind, GraphEdge, GraphNode, Hypothesis, Locator, NodeType, Publication, Relation, StudyDesign, Verdict,
)
from chronobio.store import Store
from chronobio.config import Settings

SAME = [("p38MAPK", "p38MAPK signaling"), ("KRAS G12C", "KRAS(G12C)"), ("K-ras G12C", "kras g12c"),
        ("MAPK pathway", "MAPK"), ("EGFR signalling pathway", "EGFR")]
DIFFERENT = [("MEK inhibitor", "MEK"), ("KRAS G12C", "KRAS G12D"), ("KRAS", "KRAS mutation"), ("p38MAPK", "p38 inhibitor")]


@pytest.mark.parametrize("a,b", SAME)
def test_names_that_differ_only_in_punctuation_case_or_function_words_merge(a, b):
    assert canonical_key(a) == canonical_key(b)


@pytest.mark.parametrize("a,b", DIFFERENT)
def test_names_that_change_the_entity_never_merge(a, b):
    assert canonical_key(a) != canonical_key(b)


def test_generic_terms_are_recognised_and_specific_ones_are_not():
    assert all(is_generic(t) for t in ("inhibition", "Cancer", "patients", "combination therapy", "Treatment outcomes"))
    assert not any(is_generic(t) for t in ("KRAS G12C", "tumor growth", "sotorasib", "MAPK pathway"))


def store_with_aliases(tmp_path):
    store = Store(Settings(data_dir=tmp_path / "d").db_path)
    names = ["p38MAPK", "p38MAPK signaling", "tumorigenesis", "cancer"]
    nodes = {n: GraphNode(id=node_id(n), type=NodeType.GENE, canonical_name=n, provenance=PROV) for n in names}
    for n in nodes.values():
        store.save(n)
    pubs = {}
    for i, (src, dst) in enumerate([("p38MAPK", "tumorigenesis"), ("p38MAPK signaling", "tumorigenesis"), ("p38MAPK", "p38MAPK signaling"),
                                    ("tumorigenesis", "cancer")]):
        pub = Publication(title=f"P{i}", year=2020 + i, doi=f"10.1/{i}", provenance=PROV)
        claim = EvidenceClaim(publication_id=pub.id, claim=f"{src} drives {dst}", passage=f"{src} drives {dst}", locator=Locator.TEXT_ONLY,
                              design=StudyDesign.ANIMAL, extraction_version="t", provenance=PROV)
        pubs[pub.id] = pub
        for rec in (pub, claim, GraphEdge(id=edge_id(claim.id, node_id(src), node_id(dst), Relation.ACTIVATES), source=node_id(src), target=node_id(dst),
                                          relation=Relation.ACTIVATES, evidence_claim_ids=[claim.id], provenance=PROV)):
            store.save(rec)
    return store, nodes, pubs


def test_loading_the_graph_merges_aliases_remaps_edges_and_drops_self_links(tmp_path):
    store, nodes, _ = store_with_aliases(tmp_path)
    merged_nodes, edges = load_graph(store)
    names = {n.canonical_name for n in merged_nodes}
    assert names == {"p38MAPK", "tumorigenesis", "cancer"}                       # "p38MAPK signaling" merged into "p38MAPK"
    assert build_aliases(list(nodes.values())) == {node_id("p38MAPK signaling"): node_id("p38MAPK")}
    assert len(edges) == 3                                                       # the p38MAPK -> p38MAPK signaling edge became a self-link and is gone
    pairs = [(e.source, e.target) for e in edges]
    assert pairs.count((node_id("p38MAPK"), node_id("tumorigenesis"))) == 2     # two papers now support ONE link


def test_a_link_reported_under_two_names_is_no_longer_called_unreplicated(tmp_path):
    store, _, pubs = store_with_aliases(tmp_path)
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes_list, edges = load_graph(store)
    snap = snapshot(nodes_list, edges, claims, pubs, None)
    link = next(e for e in snap.edges if (e.source, e.target) == (node_id("p38MAPK"), node_id("tumorigenesis")))
    assert len({claims[c].publication_id for c, _ in link.evidence}) == 2
    gaps = find_gaps(snap, claims, {n.id: n for n in nodes_list})
    assert not any(g.kind == GapKind.UNREPLICATED and g.node_ids == [node_id("p38MAPK"), node_id("tumorigenesis")] for g in gaps)


def test_links_through_generic_terms_produce_no_gaps(tmp_path):
    store, _, pubs = store_with_aliases(tmp_path)
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes_list, edges = load_graph(store)
    gaps = find_gaps(snapshot(nodes_list, edges, claims, pubs, None), claims, {n.id: n for n in nodes_list})
    assert all(node_id("cancer") not in g.node_ids for g in gaps)               # tumorigenesis -> cancer is generic


# ── grounded mechanisms ──────────────────────────────────────────────────────

EVIDENCE = ["KRAS activates MAPK pathway in study 0 KRAS activates MAPK pathway in study 0"]


def test_a_mechanism_built_from_the_evidence_is_grounded_and_an_invented_one_is_not():
    assert ungrounded_terms("KRAS activates MAPK pathway", EVIDENCE) == []
    invented = ungrounded_terms("KRAS recruits RAF kinase which phosphorylates MEK1 and ERK2", EVIDENCE)
    assert {"recruits", "phosphorylates", "kinase"} <= set(invented)
    assert ungrounded_terms("mechanism not stated in the evidence", EVIDENCE) == [] == ungrounded_terms("", EVIDENCE)
    assert ungrounded_terms(f"{NO_MECHANISM}; possibly via RAF", EVIDENCE) == []               # an explicit admission is never penalised


def test_the_critic_sends_back_a_hypothesis_with_an_invented_mechanism_and_names_the_terms(tmp_path):
    corpus = build(tmp_path, [Paper(), Paper(), Paper()])
    hyp = Hypothesis(statement=f"{A} drives {B} activity in organoids", mechanism="KRAS recruits RAF kinase which phosphorylates MEK1",
                     predictions=["activity falls by 50%"], falsifiers=["no change"], supporting_claim_ids=corpus.claim_ids,
                     alternative_mechanisms=["other"], provenance=PROV)
    findings = rule_findings(hyp, corpus.claims, corpus.pubs)
    invented = [t for v, t in findings if "never mentions" in t]
    assert invented and "phosphorylates" in invented[0] and any(v == Verdict.REVISE for v, t in findings if "never mentions" in t)
    ok = hyp.revise(mechanism="KRAS activates MAPK pathway")
    assert not any("never mentions" in t for _, t in rule_findings(ok, corpus.claims, corpus.pubs))
