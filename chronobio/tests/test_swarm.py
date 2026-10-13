import json

import httpx
from swarm_world import A, B, Paper, build

from chronobio.config import Settings
from chronobio.export import export_swarm
from chronobio.literature import LiteratureClient
from chronobio.llm import ScriptedLLM
from chronobio.models import (
    Hypothesis, HypothesisStatus, NoveltyStatus, Relation, Review, SearchLog, Verdict,
)
from chronobio.swarm import run_swarm

SENTENCE = "KRAS knockdown reduced MAPK pathway activity by 60% in xenografts"


def proposal(ids, statement=f"{A} drives {B} activity in mouse tumours"):
    return json.dumps({
        "statement": statement, "mechanism": "KRAS activates MAPK pathway",
        "predictions": ["MAPK pathway activity falls by 50% after KRAS knockdown"],
        "falsifiers": ["MAPK pathway activity is unchanged after KRAS knockdown"],
        "alternative_mechanisms": ["Parallel PI3K signalling"], "supporting_claim_ids": ids})


def critic(verdict="accept"):
    return json.dumps({"verdict": verdict, "reasons": ["Reasonable."], "missing_controls": [], "confounders": []})


def judge(verdict="yes", sentence=SENTENCE):
    return json.dumps({"tests_hypothesis": verdict, "sentence": sentence})


def literature(calls: list, settings: Settings | None = None) -> LiteratureClient:
    prior = {"title": "Prior xenograft study", "abstractText": f"Background. {SENTENCE}. More.", "pubYear": "2020",
             "doi": "10.9/prior", "pmid": "901"}

    def handler(request: httpx.Request) -> httpx.Response:
        q = request.url.params["query"]
        calls.append(q)
        hits = [prior] if q == f'"{A}" AND "{B}"' else [{"title": f"About {q}", "abstractText": q, "pubYear": "2019", "doi": f"10.9/{len(calls)}"}]
        return httpx.Response(200, json={"hitCount": len(hits), "resultList": {"result": hits}})
    return LiteratureClient(settings or Settings(allow_network_literature=True), httpx.Client(transport=httpx.MockTransport(handler)))


def three_animal_corpus(tmp_path):
    return build(tmp_path, [Paper(year=2015), Paper(year=2017), Paper(year=2019)])      # a translational gap


def test_full_pipeline_accepts_checks_novelty_ranks_and_exports(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    calls: list = []
    llm = ScriptedLLM([proposal(corpus.claim_ids), critic("accept"), judge("yes")])
    result = run_swarm(llm, corpus.store, corpus.settings, literature(calls), max_gaps=1)

    (hyp,) = result.hypotheses
    assert hyp.review_status == HypothesisStatus.EVIDENCE_SUPPORTED and hyp.novelty_status == NoveltyStatus.KNOWN
    assert hyp.supporting_claim_ids and hyp.falsifiers and hyp.uncertainty                    # criterion D
    assert result.reviews[0].verdict == Verdict.ACCEPT
    assert len(calls) == 3 and len(corpus.store.list(SearchLog)) == 3                         # criterion F: queries kept
    (c,) = result.cards
    assert c.originality.level == "low" and c.feasibility.level == "not_assessed" and c.validation == "not_performed"

    json_path, md_path = export_swarm(corpus.store, result, tmp_path / "out")
    data = json.loads(json_path.read_text())["hypotheses"][0]
    assert data["computational_validation"] == "NOT PERFORMED" and data["novelty"]["searches"][0]["query"] == f'"{A}" AND "{B}"'
    assert data["supporting_evidence"][0]["quote"] and data["ranking"]["feasibility"]["level"] == "not_assessed"
    md = md_path.read_text()
    assert "NOT PERFORMED" in md and "Opposing evidence" in md and "none found in this corpus" in md
    assert "Absence of search hits is not evidence of novelty." in md


def test_a_revision_round_improves_a_weak_first_draft(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    llm = ScriptedLLM([proposal(corpus.claim_ids[:1]), critic("accept"),                    # single source -> revise
                       proposal(corpus.claim_ids), critic("accept"), judge("no", "")])
    result = run_swarm(llm, corpus.store, corpus.settings, literature([]), max_gaps=1)
    (hyp,) = result.hypotheses
    assert hyp.version >= 2 and len(hyp.supporting_claim_ids) == 3
    verdicts = [r.verdict for r in sorted(result.reviews, key=lambda r: r.hypothesis_version)]
    assert verdicts == [Verdict.REVISE, Verdict.ACCEPT]
    assert "single paper" in llm.calls[2][1]                                                # the critique was passed on


def test_revisions_are_bounded_and_unaccepted_drafts_never_reach_novelty_search(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    corpus.settings = Settings(data_dir=corpus.settings.data_dir, max_agent_iterations=2)
    calls: list = []
    llm = ScriptedLLM([proposal(corpus.claim_ids[:1]), critic("accept"), proposal(corpus.claim_ids[:1]), critic("accept")])
    result = run_swarm(llm, corpus.store, corpus.settings, literature(calls), max_gaps=1)
    assert len(llm.calls) == 4 and calls == []                                               # 2 rounds, then stop, no searches
    assert result.cards == [] and result.hypotheses[0].review_status == HypothesisStatus.PROPOSED


def test_contradicted_hypothesis_is_rejected_marked_and_kept_for_reading(tmp_path):
    corpus = build(tmp_path, [Paper(year=2015), Paper(year=2016, relation=Relation.INHIBITS),
                              Paper(year=2017, relation=Relation.INHIBITS), Paper(year=2018, relation=Relation.INHIBITS)])
    llm = ScriptedLLM([proposal(corpus.claim_ids[:1]), critic("accept")])
    calls: list = []
    result = run_swarm(llm, corpus.store, corpus.settings, literature(calls), max_gaps=1)
    (hyp,) = result.hypotheses
    assert hyp.review_status == HypothesisStatus.CONTRADICTED and calls == [] and result.cards == []
    md = export_swarm(corpus.store, result, tmp_path / "out")[1].read_text()
    assert "contradicted" in md and "Contradicted:" in md                                    # the reason is visible


def test_a_crashed_run_resumes_without_repeating_finished_gaps(tmp_path):
    corpus = build(tmp_path, [Paper(year=2015, src="G1", dst="H1"), Paper(year=2016, src="G2", dst="H2")])   # two gaps

    # One reply pair works for whichever gap runs first: the statement names both pairs, and the
    # citation list names both claims (the one outside the gap's pool is dropped by the proposer).
    round_replies = [json.dumps({"statement": "G1 H1 G2 H2 activity changes", "mechanism": "m",
                                 "predictions": ["activity falls 50%"], "falsifiers": ["activity unchanged"],
                                 "alternative_mechanisms": ["other"], "supporting_claim_ids": corpus.claim_ids}),
                     critic("revise")]
    per_gap = 2 * corpus.settings.max_agent_iterations               # propose + critique, every round

    first = ScriptedLLM(round_replies * 3)
    try:
        run_swarm(_CrashAfter(first, per_gap), corpus.store, corpus.settings, literature([]), max_gaps=2)
    except _Crash:
        pass                                                         # the model died on the second gap
    assert len(corpus.store.resume("swarm")[1]["done"]) == 1

    second = ScriptedLLM(round_replies * 3)
    run_swarm(second, corpus.store, corpus.settings, literature([]), max_gaps=2)
    assert len(second.calls) == per_gap                              # only the unfinished gap was redone
    assert len(corpus.store.resume("swarm")[1]["done"]) == 2

    third = ScriptedLLM([])
    run_swarm(third, corpus.store, corpus.settings, literature([]), max_gaps=2)
    assert third.calls == []                                         # nothing left to do


class _Crash(RuntimeError):
    pass


class _CrashAfter:
    """Wraps an LLM and raises after n calls, like a model server dying mid-run."""

    def __init__(self, inner, n):
        self.inner, self.n, self.name = inner, n, inner.name

    def generate(self, system, prompt, **kwargs):
        if len(self.inner.calls) >= self.n:
            raise _Crash("model died")
        return self.inner.generate(system, prompt, **kwargs)


def test_a_refused_or_malformed_first_reply_is_retried_not_abandoned(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    llm = ScriptedLLM(["I cannot propose a hypothesis that could be used to develop a treatment for cancer.",
                       "Here is some prose, not JSON.",
                       proposal(corpus.claim_ids), critic("accept"), judge("no", "")])
    result = run_swarm(llm, corpus.store, corpus.settings, literature([]), max_gaps=1)
    assert [r.reason for r in result.rejections] == ["model_refused", "unparseable_model_output"]
    assert len(result.hypotheses) == 1 and result.hypotheses[0].review_status.value == "evidence_supported"


def test_retries_are_bounded_by_the_round_limit(tmp_path):
    corpus = three_animal_corpus(tmp_path)
    llm = ScriptedLLM(["I can't help with that."] * 3)
    result = run_swarm(llm, corpus.store, corpus.settings, literature([]), max_gaps=1)
    assert len(llm.calls) == corpus.settings.max_agent_iterations == 3 and result.hypotheses == []
    assert {r.reason for r in result.rejections} == {"model_refused"}


def test_the_proposer_prompt_frames_the_task_as_literature_analysis():
    from chronobio.agents import PROPOSER_SYSTEM
    assert "literature-analysis task" in PROPOSER_SYSTEM and "medical" not in PROPOSER_SYSTEM.lower()
