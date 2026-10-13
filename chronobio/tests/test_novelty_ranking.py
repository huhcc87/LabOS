import json

import httpx
from swarm_world import A, B, Paper, build, PROV

from chronobio.config import Settings
from chronobio.gaps import find_gaps
from chronobio.graph import load_graph, snapshot
from chronobio.literature import LiteratureClient
from chronobio.llm import ScriptedLLM
from chronobio.models import (
    Hypothesis, NoveltyAssessment, NoveltyStatus, Publication, Relation, RetractionStatus,
)
from chronobio.novelty import assess_novelty
from chronobio.ranking import NOT_ASSESSED, card, order


def epmc(results_by_query: dict[str, list[dict]], calls: list | None = None) -> httpx.Client:
    """Fake Europe PMC: answers by exact query string."""
    def handler(request: httpx.Request) -> httpx.Response:
        q = request.url.params["query"]
        if calls is not None:
            calls.append(q)
        hits = results_by_query.get(q, [])
        return httpx.Response(200, json={"hitCount": len(hits), "resultList": {"result": hits}})
    return httpx.Client(transport=httpx.MockTransport(handler))


def hit(title, abstract, doi):
    return {"title": title, "abstractText": abstract, "pubYear": "2020", "doi": doi, "pmid": doi[-3:]}


def novelty_setup(tmp_path):
    corpus = build(tmp_path, [Paper(), Paper(), Paper()])
    nodes_list, edges = load_graph(corpus.store)
    nodes = {n.id: n for n in nodes_list}
    snap = snapshot(nodes_list, edges, corpus.claims, corpus.pubs, None)
    gap = find_gaps(snap, corpus.claims, nodes)[0]
    hyp = Hypothesis(statement=f"{A} drives {B} activity", predictions=["activity falls 50%"], falsifiers=["no change"],
                     supporting_claim_ids=corpus.claim_ids, provenance=PROV)
    return corpus, nodes, gap, hyp


def lit(client, network=True):
    return LiteratureClient(Settings(allow_network_literature=network), client)


BOTH, ONLY_A, ONLY_B = f'"{A}" AND "{B}"', f'"{A}"', f'"{B}"'
SENTENCE = "KRAS knockdown reduced MAPK pathway activity by 60% in xenografts"
ABSTRACT = f"Background text. {SENTENCE}. Further text."


def judge(verdict, sentence=SENTENCE):
    return ScriptedLLM([json.dumps({"tests_hypothesis": verdict, "sentence": sentence})])


# ── novelty ──────────────────────────────────────────────────────────────────

def test_verified_prior_test_means_known_and_every_search_is_logged(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    calls: list = []
    client = epmc({BOTH: [hit("Prior test", ABSTRACT, "10.9/aaa")], ONLY_A: [hit("A only", "KRAS", "10.9/bbb")],
                   ONLY_B: [hit("B only", "MAPK pathway", "10.9/ccc")]}, calls)
    out = assess_novelty(judge("yes"), lit(client), hyp, gap, nodes, list(corpus.pubs.values()))
    assert out.assessment.status == NoveltyStatus.KNOWN
    assert out.assessment.verified_quotes == [f"Prior test (2020): “{SENTENCE}”"]
    assert calls == [BOTH, ONLY_A, ONLY_B]                                   # reproducible queries
    assert [l.query for l in out.logs] == calls and all(l.run_at for l in out.logs)
    assert out.assessment.search_log_ids == [l.id for l in out.logs]


def test_unverifiable_quote_is_not_counted_as_prior_work(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    client = epmc({BOTH: [hit("Prior", ABSTRACT, "10.9/aaa")], ONLY_A: [hit("a", "KRAS", "10.9/bbb")], ONLY_B: [hit("b", "MAPK pathway", "10.9/ccc")]})
    out = assess_novelty(judge("yes", "KRAS cures everything"), lit(client), hyp, gap, nodes, [])
    assert out.assessment.status == NoveltyStatus.PARTIALLY_TESTED and out.assessment.verified_quotes == []
    assert any("unverifiable" in x for x in out.assessment.limitations)


def test_co_mentioned_but_untested_is_partially_tested(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    client = epmc({BOTH: [hit("Related", ABSTRACT, "10.9/aaa")]})
    out = assess_novelty(judge("no", ""), lit(client), hyp, gap, nodes, [])
    assert out.assessment.status == NoveltyStatus.PARTIALLY_TESTED
    assert any("co-mentioned" in x for x in out.assessment.limitations)


def test_search_engine_loose_matches_are_ignored(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    client = epmc({BOTH: [hit("Only mentions one", "KRAS is a gene", "10.9/aaa")],
                   ONLY_A: [hit("a", "KRAS", "10.9/bbb")], ONLY_B: [hit("b", "MAPK pathway", "10.9/ccc")]})
    llm = ScriptedLLM([])
    out = assess_novelty(llm, lit(client), hyp, gap, nodes, [])
    assert out.assessment.status == NoveltyStatus.POSSIBLE_NOVEL_COMBINATION and llm.calls == []


def test_papers_from_the_users_own_corpus_are_not_prior_work(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    own = next(iter(corpus.pubs.values()))
    mine = hit(own.title, ABSTRACT, own.doi)
    client = epmc({BOTH: [mine], ONLY_A: [hit("a", "KRAS", "10.9/bbb")], ONLY_B: [hit("b", "MAPK pathway", "10.9/ccc")]})
    out = assess_novelty(ScriptedLLM([]), lit(client), hyp, gap, nodes, list(corpus.pubs.values()))
    assert out.assessment.status == NoveltyStatus.POSSIBLE_NOVEL_COMBINATION


def test_no_hits_is_unknown_never_novel(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    out = assess_novelty(ScriptedLLM([]), lit(epmc({})), hyp, gap, nodes, [])
    assert out.assessment.status == NoveltyStatus.UNKNOWN
    assert "Absence of search hits is not evidence of novelty." in out.assessment.limitations
    one_sided = epmc({ONLY_A: [hit("a", "KRAS", "10.9/bbb")]})
    assert assess_novelty(ScriptedLLM([]), lit(one_sided), hyp, gap, nodes, []).assessment.status == NoveltyStatus.UNKNOWN


def test_network_off_means_not_searched(tmp_path):
    corpus, nodes, gap, hyp = novelty_setup(tmp_path)
    out = assess_novelty(ScriptedLLM([]), lit(epmc({}), network=False), hyp, gap, nodes, [])
    assert out.assessment.status == NoveltyStatus.NOT_SEARCHED and out.logs == []
    assert any("off" in x for x in out.assessment.limitations)


# ── ranking ──────────────────────────────────────────────────────────────────

def ranked(tmp_path, papers, support_idx, novelty=None, **hyp_kw):
    corpus = build(tmp_path, papers)
    hyp = Hypothesis(statement="s", predictions=hyp_kw.pop("predictions", ["rate falls by 50%"]),
                     falsifiers=hyp_kw.pop("falsifiers", ["no change", "rate rises"]),
                     supporting_claim_ids=[corpus.claim_ids[i] for i in support_idx],
                     contradicting_claim_ids=hyp_kw.pop("opposing", []), provenance=PROV)
    return card(hyp, novelty, corpus.claims, corpus.pubs), corpus


def test_dimensions_are_reported_separately_with_no_combined_score(tmp_path):
    c, _ = ranked(tmp_path, [Paper(), Paper(), Paper()], [0, 1, 2])
    assert c.evidence_strength.level == "medium" and "no human evidence" in c.evidence_strength.reasons    # capped without human data
    assert c.falsifiability.level == "high"
    assert c.feasibility.level == NOT_ASSESSED and c.impact.level == NOT_ASSESSED and c.originality.level == NOT_ASSESSED
    assert c.validation == "not_performed"
    assert not hasattr(c, "score") and not hasattr(c, "confidence")


def test_retraction_and_conflict_lower_evidence_strength(tmp_path):
    retracted, _ = ranked(tmp_path / "r", [Paper(retracted=True)] * 3, [0, 1, 2])
    assert retracted.evidence_strength.level == "low"
    conflicted, corpus = ranked(tmp_path / "c", [Paper(), Paper(), Paper(), Paper(relation=Relation.INHIBITS)], [0, 1, 2], opposing=["x"])
    assert conflicted.evidence_strength.level == "low" and any("conflicting" in r for r in conflicted.evidence_strength.reasons)


def test_originality_follows_the_novelty_status_and_never_claims_certainty(tmp_path):
    def nov(status):
        return NoveltyAssessment(hypothesis_id="h", status=status, provenance=PROV)
    levels = {s: ranked(tmp_path / s.value, [Paper()], [0], nov(s))[0].originality for s in
              (NoveltyStatus.KNOWN, NoveltyStatus.PARTIALLY_TESTED, NoveltyStatus.POSSIBLE_NOVEL_COMBINATION, NoveltyStatus.UNKNOWN)}
    assert [levels[s].level for s in levels] == ["low", "medium", "high", NOT_ASSESSED]
    assert "not proof" in levels[NoveltyStatus.POSSIBLE_NOVEL_COMBINATION].reasons[0]


def test_unmeasurable_predictions_lower_falsifiability(tmp_path):
    c, _ = ranked(tmp_path, [Paper()], [0], predictions=["It will be interesting"], falsifiers=["Nothing"])
    assert c.falsifiability.level == "low"


def test_order_uses_weights_and_ignores_unassessed_dimensions(tmp_path):
    strong, _ = ranked(tmp_path / "s", [Paper(), Paper(), Paper()], [0, 1, 2],
                       NoveltyAssessment(hypothesis_id="h", status=NoveltyStatus.KNOWN, provenance=PROV))
    original, _ = ranked(tmp_path / "o", [Paper()], [0],
                         NoveltyAssessment(hypothesis_id="h2", status=NoveltyStatus.POSSIBLE_NOVEL_COMBINATION, provenance=PROV))
    # Equal default weights: strong = 1 + 2 + 0, original = 0 + 2 + 2.
    assert order([strong, original])[0] is original
    assert order([original, strong], {"evidence_strength": 5.0})[0] is strong       # weights are configurable
    assert order([strong, original], {"originality": 10.0})[0] is original
    # A not-assessed dimension adds nothing (same as "low"), and ties break by id, so order is deterministic.
    unassessed, _ = ranked(tmp_path / "u", [Paper(), Paper(), Paper()], [0, 1, 2])
    assert order([unassessed, strong]) == order([strong, unassessed])
