import json

from swarm_world import A, B, Paper, build

from chronobio.agents import build_pool, describe_uncertainty, opposing_claims, propose, review, rule_findings
from chronobio.gaps import find_gaps
from chronobio.graph import load_graph, snapshot, suggest_inferred_edges
from chronobio.llm import ScriptedLLM
from chronobio.models import Direction, GapKind, Relation, StudyDesign, Verdict


def setup(tmp_path, papers):
    corpus = build(tmp_path, papers)
    nodes, edges = load_graph(corpus.store)
    snap = snapshot(nodes, edges + suggest_inferred_edges(edges), corpus.claims, corpus.pubs, None)
    node_map = {n.id: n for n in nodes}
    gaps = find_gaps(snap, corpus.claims, node_map)
    return corpus, snap, node_map, gaps


def proposal(ids, **overrides):
    base = {"statement": f"{A} activity drives {B} signalling in tumours",
            "mechanism": "KRAS activates MAPK pathway",
            "predictions": ["MAPK pathway activity falls by at least 50% after KRAS knockdown"],
            "falsifiers": ["MAPK pathway activity is unchanged after KRAS knockdown"],
            "alternative_mechanisms": ["Parallel PI3K signalling"], "supporting_claim_ids": ids}
    return json.dumps(base | overrides)


def three_animal_papers():
    return [Paper(year=2015), Paper(year=2017), Paper(year=2019)]


# ── proposer ─────────────────────────────────────────────────────────────────

def test_valid_proposal_becomes_a_hypothesis_with_computed_evidence_fields(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, three_animal_papers() + [Paper(year=2020, relation=Relation.INHIBITS)])
    gap = next(g for g in gaps if g.kind == GapKind.CONTRADICTORY)
    pool = build_pool(gap, snap, corpus.claims, corpus.pubs)
    hyp, rejected = propose(ScriptedLLM([proposal(corpus.claim_ids[:3])]), gap, pool, nodes, corpus.pubs)
    assert rejected == [] and hyp is not None
    assert hyp.supporting_claim_ids == corpus.claim_ids[:3]
    assert hyp.contradicting_claim_ids == [corpus.claim_ids[3]]           # found by code, not the model
    assert hyp.gap_id == gap.id and hyp.provenance.source == "agent:hypothesis_proposer"
    text = " ".join(hyp.uncertainty)
    assert "3 paper(s)" in text and "No human" in text and "1 claim(s)" in text and "2015–2019" in text


def test_invented_claim_ids_are_dropped_and_no_real_support_is_rejected(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, three_animal_papers())
    gap = gaps[0]
    pool = build_pool(gap, snap, corpus.claims, corpus.pubs)
    hyp, rejected = propose(ScriptedLLM([proposal([corpus.claim_ids[0], "clm_invented"])]), gap, pool, nodes, corpus.pubs)
    assert hyp.supporting_claim_ids == [corpus.claim_ids[0]]
    assert rejected[0].reason == "unknown_claim_id_dropped"
    none, rejected = propose(ScriptedLLM([proposal(["clm_invented"])]), gap, pool, nodes, corpus.pubs)
    assert none is None and rejected[-1].reason == "no_valid_supporting_claims"


def test_proposals_that_are_off_topic_unfalsifiable_or_unparseable_are_rejected(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, three_animal_papers())
    gap, ids = gaps[0], corpus.claim_ids
    pool = build_pool(gap, snap, corpus.claims, corpus.pubs)
    cases = {
        "off_topic_statement": proposal(ids, statement="Vitamin D lowers blood pressure"),
        "missing_prediction_or_falsifier": proposal(ids, falsifiers=[]),
        "falsifier_restates_prediction": proposal(ids, falsifiers=["MAPK pathway activity falls by at least 50% after KRAS knockdown"]),
        "unparseable_model_output": "Here is a hypothesis: KRAS is important.",
    }
    for reason, reply in cases.items():
        hyp, rejected = propose(ScriptedLLM([reply]), gap, pool, nodes, corpus.pubs)
        assert hyp is None and rejected[-1].reason == reason, reason


def test_revision_keeps_the_id_and_bumps_the_version(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, three_animal_papers())
    gap = gaps[0]
    pool = build_pool(gap, snap, corpus.claims, corpus.pubs)
    first, _ = propose(ScriptedLLM([proposal(corpus.claim_ids[:1])]), gap, pool, nodes, corpus.pubs)
    llm = ScriptedLLM([proposal(corpus.claim_ids, statement=f"{A} drives {B} activity in mouse tumours")])
    second, _ = propose(llm, gap, pool, nodes, corpus.pubs, critique=["Single source."], previous=first)
    assert (second.id, second.version) == (first.id, 2) and len(second.supporting_claim_ids) == 3
    assert "Single source." in llm.calls[0][1] and first.statement in llm.calls[0][1]      # critique reaches the model


def test_pool_is_bounded_and_starts_with_the_gaps_own_claims(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, [Paper() for _ in range(20)])
    pool = build_pool(gaps[0], snap, corpus.claims, corpus.pubs)
    assert len(pool) == 12 and pool[0].claim.id in gaps[0].claim_ids


# ── opposing evidence and uncertainty ────────────────────────────────────────

def test_opposing_claims_use_relations_and_directions(tmp_path):
    corpus, snap, nodes, gaps = setup(tmp_path, [Paper(), Paper(relation=Relation.INHIBITS),
                                                 Paper(direction=Direction.CONTRADICTS), Paper(relation=Relation.ASSOCIATED)])
    pool = build_pool(next(g for g in gaps if g.kind == GapKind.CONTRADICTORY), snap, corpus.claims, corpus.pubs)
    ids = corpus.claim_ids
    assert set(opposing_claims([ids[0]], pool)) == {ids[1], ids[2]}          # inhibits and a contradicting finding
    assert set(opposing_claims([ids[1]], pool)) == {ids[0], ids[2]}


def test_uncertainty_flags_retraction_and_missing_human_evidence(tmp_path):
    corpus = build(tmp_path, [Paper(retracted=True), Paper(design=StudyDesign.OBSERVATIONAL)])
    notes = describe_uncertainty(list(corpus.claims.values()), [], corpus.pubs)
    joined = " ".join(notes)
    assert "retracted" in joined and "No human" not in joined and "abstracts" in joined


# ── critic: rules the model cannot override (acceptance criterion E) ─────────

def make_hyp(tmp_path, papers, support_idx, **overrides):
    corpus, snap, nodes, gaps = setup(tmp_path, papers)
    gap = next(g for g in gaps if A in {nodes[n].canonical_name for n in g.node_ids})
    pool = build_pool(gap, snap, corpus.claims, corpus.pubs)
    hyp, _ = propose(ScriptedLLM([proposal([corpus.claim_ids[i] for i in support_idx], **overrides)]), gap, pool, nodes, corpus.pubs)
    return corpus, hyp


def critic_reply(verdict="accept", reasons=("Looks fine.",)):
    return json.dumps({"verdict": verdict, "reasons": list(reasons), "missing_controls": ["Isogenic control"], "confounders": ["Batch"]})


def test_well_supported_hypothesis_is_accepted(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2])
    rev = review(ScriptedLLM([critic_reply()]), hyp, corpus.claims, corpus.pubs)
    assert rev.verdict == Verdict.ACCEPT and rev.rule_findings == []
    assert rev.missing_controls == ["Isogenic control"] and rev.hypothesis_version == hyp.version


def test_contradicted_hypothesis_is_rejected_even_if_the_model_accepts(tmp_path):
    """Deliberately contradictory fixture: one paper for, three against."""
    papers = [Paper(year=2015), Paper(year=2016, relation=Relation.INHIBITS), Paper(year=2017, relation=Relation.INHIBITS),
              Paper(year=2018, relation=Relation.INHIBITS)]
    corpus, hyp = make_hyp(tmp_path, papers, [0])
    assert len(hyp.contradicting_claim_ids) == 3
    rev = review(ScriptedLLM([critic_reply("accept")]), hyp, corpus.claims, corpus.pubs)
    assert rev.verdict == Verdict.REJECT and any(f.startswith("Contradicted") for f in rev.rule_findings)


def test_single_source_forces_revise_and_model_cannot_lower_it(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0])
    rev = review(ScriptedLLM([critic_reply("accept")]), hyp, corpus.claims, corpus.pubs)
    assert rev.verdict == Verdict.REVISE and any("single paper" in f for f in rev.rule_findings)


def test_single_source_is_only_a_limit_when_no_other_paper_exists(tmp_path):
    """Regression: a one-paper gap can never be 'fixed' by redrafting, so it must not loop forever."""
    corpus, hyp = make_hyp(tmp_path, [Paper()], [0])
    only_one = review(ScriptedLLM([critic_reply("accept")]), hyp, corpus.claims, corpus.pubs, available_papers=1)
    assert only_one.verdict == Verdict.ACCEPT
    assert any("single paper" in f and "limit" in f for f in only_one.rule_findings)      # still recorded
    could_cite_more = review(ScriptedLLM([critic_reply("accept")]), hyp, corpus.claims, corpus.pubs, available_papers=3)
    assert could_cite_more.verdict == Verdict.REVISE


def test_statement_asserting_human_effects_without_human_evidence_is_sent_back(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2],
                           statement="KRAS inhibition improves survival in patients with MAPK pathway activation")
    findings = rule_findings(hyp, corpus.claims, corpus.pubs)
    assert any(v == Verdict.REVISE and "human or clinical" in t for v, t in findings)
    # Human evidence behind it, or the human outcome only in a prediction, is fine.
    human, ok = make_hyp(tmp_path / "h", [Paper(design=StudyDesign.OBSERVATIONAL)], [0],
                         statement="KRAS inhibition improves survival in patients with MAPK pathway activation")
    assert not any("human or clinical" in t for _, t in rule_findings(ok, human.claims, human.pubs))
    _, framed = make_hyp(tmp_path / "f", three_animal_papers(), [0, 1, 2],
                         predictions=["Survival in patients is 20% higher"])
    assert not any("human or clinical" in t for _, t in rule_findings(framed, corpus.claims, corpus.pubs))


def test_model_can_make_the_verdict_stricter(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2])
    rev = review(ScriptedLLM([critic_reply("reject", ["Mechanism is not supported by the evidence."])]), hyp, corpus.claims, corpus.pubs)
    assert rev.verdict == Verdict.REJECT and rev.critic_notes == ["Mechanism is not supported by the evidence."]


def test_retracted_only_support_is_rejected(tmp_path):
    corpus, hyp = make_hyp(tmp_path, [Paper(retracted=True), Paper(retracted=True), Paper(retracted=True)], [0, 1, 2])
    assert review(ScriptedLLM([critic_reply()]), hyp, corpus.claims, corpus.pubs).verdict == Verdict.REJECT


def test_unmeasurable_prediction_needs_revision(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2], predictions=["Things will be interesting"])
    findings = rule_findings(hyp, corpus.claims, corpus.pubs)
    assert (Verdict.REVISE, "Prediction not clearly measurable: Things will be interesting") in findings


def test_a_hypothesis_is_never_accepted_without_a_usable_independent_critique(tmp_path):
    """Regression: with no usable model critique, rules alone let through a self-contradicting hypothesis."""
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2])
    llm = ScriptedLLM(["I think this is fine.", "Still fine."])
    rev = review(llm, hyp, corpus.claims, corpus.pubs)
    assert len(llm.calls) == 2                                  # one retry
    assert rev.verdict == Verdict.REVISE and "no independent check" in rev.critic_notes[0]
    bad = review(ScriptedLLM([critic_reply("maybe")]), hyp, corpus.claims, corpus.pubs)
    assert bad.verdict == Verdict.REVISE                        # an invalid verdict is never read as 'accept'


def test_critic_retry_uses_the_second_reply_when_the_first_is_malformed(tmp_path):
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2])
    llm = ScriptedLLM(["{not json", critic_reply("accept")])
    rev = review(llm, hyp, corpus.claims, corpus.pubs)
    assert rev.verdict == Verdict.ACCEPT and "valid JSON" in llm.calls[1][1]


def test_restating_a_reported_finding_is_sent_back(tmp_path):
    """Regression: the proposer repeated the paper's own claim and called it a hypothesis."""
    corpus, hyp = make_hyp(tmp_path, three_animal_papers(), [0, 1, 2],
                           statement="KRAS activates MAPK pathway in study 0")
    assert any(v == Verdict.REVISE and "restates" in t for v, t in rule_findings(hyp, corpus.claims, corpus.pubs))
    ext_corpus, ext = make_hyp(tmp_path / "ext", three_animal_papers(), [0, 1, 2],
                               statement="KRAS activates MAPK pathway in patient-derived organoids exposed to hypoxia")
    assert not any("restates" in t for _, t in rule_findings(ext, ext_corpus.claims, ext_corpus.pubs))
