import pytest
from swarm_world import A, B, PROV, Paper, build

from chronobio.experiment import design_experiment, sample_size_per_group
from chronobio.models import (
    EvidenceClaim, Hypothesis, Locator, RunStatus, StudyDesign, ValidationRun,
)


def corpus_and_hyp(tmp_path, **claim_kw):
    corpus = build(tmp_path, [Paper(), Paper()])
    for cid in corpus.claim_ids:                                  # give the cited studies method detail
        c = corpus.claims[cid]
        corpus.claims[cid] = c.revise(**claim_kw) if claim_kw else c
    hyp = Hypothesis(statement=f"{A} drives {B} activity in organoids", predictions=["MAPK activity falls by 50% after KRAS knockdown", "Cell growth slows"],
                     falsifiers=["MAPK activity is unchanged"], alternative_mechanisms=["Parallel PI3K signalling"],
                     supporting_claim_ids=corpus.claim_ids, provenance=PROV)
    return corpus, hyp


def test_sample_size_matches_the_textbook_values():
    assert sample_size_per_group(0.5) == 63 and sample_size_per_group(0.8) == 25 and sample_size_per_group(1.0, power=0.9) == 22
    with pytest.raises(ValueError):
        sample_size_per_group(0)


def test_without_any_effect_size_the_plan_declines_to_size_the_study(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path)
    plan = design_experiment(hyp, corpus.claims, corpus.pubs)
    assert "No sample-size calculation" in plan.power_plan and plan.assumptions == []


def test_a_user_supplied_effect_size_is_labelled_an_assumption(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path)
    plan = design_experiment(hyp, corpus.claims, corpus.pubs, assumed_effect_size=0.8)
    assert "About 25 independent samples per group" in plan.power_plan
    assert any("assumption supplied by the user" in a for a in plan.assumptions)


def test_a_measured_effect_is_used_and_called_optimistic(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path)
    run = ValidationRun(hypothesis_id=hyp.id, dataset_id="d", method="m", code_version="v", status=RunStatus.EXECUTED,
                        metrics={"hedges_g_heldout": -1.2}, verdict="consistent", provenance=PROV)
    plan = design_experiment(hyp, corpus.claims, corpus.pubs, [run])
    assert "effect size 1.20" in plan.power_plan and any("optimistic" in a for a in plan.assumptions)
    both = design_experiment(hyp, corpus.claims, corpus.pubs, [run], assumed_effect_size=0.5)      # the smaller estimate wins
    assert "effect size 0.50" in both.power_plan and any("smaller (0.50)" in a for a in both.assumptions)


def test_models_and_assays_come_only_from_the_cited_studies(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path, method="CRISPR knockdown with western blot", population="mouse xenograft")
    plan = design_experiment(hyp, corpus.claims, corpus.pubs)
    assert all("CRISPR knockdown with western blot" in m and "used in: Study" in m for m in plan.models_and_assays)
    bare_corpus, bare_hyp = corpus_and_hyp(tmp_path / "bare")
    bare = design_experiment(bare_hyp, bare_corpus.claims, bare_corpus.pubs)
    assert bare.models_and_assays == [] and any("no usable method detail" in f for f in bare.flags)


def test_ethics_and_cost_flags_follow_rules(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path, population="mouse xenograft")
    flags = " ".join(design_experiment(hyp, corpus.claims, corpus.pubs).flags)
    assert "animal-care approval" in flags and "Cost and timeline have not been estimated" in flags
    human = hyp.revise(statement="KRAS inhibition improves survival in patients")
    assert "ethics review" in " ".join(design_experiment(human, corpus.claims, corpus.pubs).flags)


def test_plan_structure_respects_the_spec(tmp_path):
    corpus, hyp = corpus_and_hyp(tmp_path)
    plan = design_experiment(hyp, corpus.claims, corpus.pubs)
    assert 1 <= len(plan.aims) <= 3 and any("alternative" in a.lower() for a in plan.aims)
    assert plan.endpoints == hyp.predictions and plan.expected_outcomes == hyp.predictions
    assert any("Negative control" in c for c in plan.controls) and any("Positive control" in c for c in plan.controls)
    assert any("falsifier" in c.lower() for c in plan.controls) and plan.alternative_outcomes[0] == "MAPK activity is unchanged"
    assert plan.go_no_go and plan.provenance.source == "rule:experiment_designer"
