from swarm_world import A, B, Paper, build

from chronobio.gaps import find_gaps, gap_id
from chronobio.graph import load_graph, snapshot, suggest_inferred_edges
from chronobio.models import Direction, GapKind, Relation, StudyDesign


def gaps_for(corpus, cutoff=None):
    nodes, edges = load_graph(corpus.store)
    snap = snapshot(nodes, edges + suggest_inferred_edges(edges), corpus.claims, corpus.pubs, cutoff)
    return find_gaps(snap, corpus.claims, {n.id: n for n in nodes})


def kinds(gaps):
    return [g.kind for g in gaps]


def test_single_paper_link_is_an_unreplicated_gap(tmp_path):
    gaps = gaps_for(build(tmp_path, [Paper(design=StudyDesign.UNKNOWN)]))
    assert kinds(gaps) == [GapKind.UNREPLICATED] and gaps[0].paper_count == 1


def test_replicated_link_has_no_unreplicated_gap(tmp_path):
    gaps = gaps_for(build(tmp_path, [Paper(design=StudyDesign.UNKNOWN), Paper(design=StudyDesign.UNKNOWN)]))
    assert gaps == []


def test_conflicting_evidence_is_a_contradictory_gap_and_ranks_first(tmp_path):
    corpus = build(tmp_path, [Paper(design=StudyDesign.UNKNOWN), Paper(design=StudyDesign.UNKNOWN, relation=Relation.INHIBITS),
                              Paper(design=StudyDesign.UNKNOWN, src=B, dst="tumor growth")])
    gaps = gaps_for(corpus)
    assert gaps[0].kind == GapKind.CONTRADICTORY and gaps[0].paper_count == 2
    assert gaps[0].priority > gaps[-1].priority


def test_preclinical_only_evidence_is_a_translational_gap(tmp_path):
    two_animal = build(tmp_path / "a", [Paper(design=StudyDesign.ANIMAL), Paper(design=StudyDesign.IN_VITRO)])
    assert kinds(gaps_for(two_animal)) == [GapKind.TRANSLATIONAL]
    with_human = build(tmp_path / "b", [Paper(design=StudyDesign.ANIMAL), Paper(design=StudyDesign.OBSERVATIONAL)])
    assert gaps_for(with_human) == []


def test_unknown_design_is_not_treated_as_preclinical(tmp_path):
    """The model often cannot tell the design; that must not create a translational gap."""
    assert GapKind.TRANSLATIONAL not in kinds(gaps_for(build(tmp_path, [Paper(design=StudyDesign.UNKNOWN)] * 2)))


def test_two_step_path_without_direct_evidence_is_a_mechanistic_gap(tmp_path):
    corpus = build(tmp_path, [Paper(design=StudyDesign.UNKNOWN), Paper(design=StudyDesign.UNKNOWN),
                              Paper(design=StudyDesign.UNKNOWN, src=B, dst="tumor growth"),
                              Paper(design=StudyDesign.UNKNOWN, src=B, dst="tumor growth")])
    mech = [g for g in gaps_for(corpus) if g.kind == GapKind.MECHANISTIC]
    assert len(mech) == 1 and len(mech[0].node_ids) == 3
    assert "directly" in mech[0].description and mech[0].paper_count == 4


def test_gaps_respect_the_time_cutoff(tmp_path):
    corpus = build(tmp_path, [Paper(year=2015, design=StudyDesign.UNKNOWN),
                              Paper(year=2021, design=StudyDesign.UNKNOWN, relation=Relation.INHIBITS)])
    assert kinds(gaps_for(corpus, cutoff=2016)) == [GapKind.UNREPLICATED]       # conflict not yet published
    assert GapKind.CONTRADICTORY in kinds(gaps_for(corpus, cutoff=2021))


def test_less_covered_gaps_rank_higher_within_a_kind_and_ids_are_stable(tmp_path):
    corpus = build(tmp_path, [Paper(design=StudyDesign.UNKNOWN, src="A1", dst="B1"),
                              Paper(design=StudyDesign.UNKNOWN, src="A2", dst="B2")])
    gaps = gaps_for(corpus)
    assert [g.kind for g in gaps] == [GapKind.UNREPLICATED] * 2
    assert gaps_for(corpus)[0].id == gaps[0].id == gap_id(GapKind.UNREPLICATED, gaps[0].node_ids)


def test_contested_by_claim_direction_alone(tmp_path):
    corpus = build(tmp_path, [Paper(design=StudyDesign.UNKNOWN), Paper(design=StudyDesign.UNKNOWN, direction=Direction.CONTRADICTS)])
    assert GapKind.CONTRADICTORY in kinds(gaps_for(corpus))
