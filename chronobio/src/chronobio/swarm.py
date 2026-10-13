"""Sequential hypothesis swarm: gaps -> propose -> critique (bounded revisions) -> novelty -> rank.

One shared model, one agent at a time. Each gap is checkpointed when finished,
so a crashed run resumes with the next gap and never repeats paid or slow work.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .agents import RETRYABLE, build_pool, propose, review
from .claims import Rejection
from .config import Settings
from .gaps import find_gaps
from .graph import load_graph, snapshot, suggest_inferred_edges
from .literature import LiteratureClient
from .llm import LLM
from .models import (
    EvidenceClaim, Gap, Hypothesis, HypothesisStatus, NoveltyAssessment, Publication, Review, Verdict,
)
from .novelty import assess_novelty
from .ranking import RankCard, card, order
from .store import Store

# Both mean "the critic accepted it"; the second adds that a dataset analysis supported it.
ACCEPTED = (HypothesisStatus.EVIDENCE_SUPPORTED, HypothesisStatus.COMPUTATIONALLY_TESTED)


@dataclass
class SwarmResult:
    gaps: list[Gap] = field(default_factory=list)
    hypotheses: list[Hypothesis] = field(default_factory=list)      # latest version of each
    reviews: list[Review] = field(default_factory=list)
    novelty: dict[str, NoveltyAssessment] = field(default_factory=dict)
    cards: list[RankCard] = field(default_factory=list)             # accepted hypotheses, ordered
    profiles: dict[str, RankCard] = field(default_factory=dict)     # separate ratings for every hypothesis
    rejections: list[Rejection] = field(default_factory=list)


def _save(store: Store, record) -> None:
    if store.get(record.id, record.version) is None:
        store.save(record)


def run_swarm(
    llm: LLM, store: Store, settings: Settings, lit: LiteratureClient, *,
    cutoff: int | None = None, max_gaps: int = 5, job_id: str = "swarm",
) -> SwarmResult:
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes_list, raw_edges = load_graph(store)
    nodes = {n.id: n for n in nodes_list}
    snap = snapshot(nodes_list, raw_edges + suggest_inferred_edges(raw_edges), claims, pubs, cutoff)

    result = SwarmResult(gaps=find_gaps(snap, claims, nodes)[:max_gaps])
    resumed = store.resume(job_id)
    done: set[str] = set(resumed[1].get("done", [])) if resumed else set()

    for gap in result.gaps:
        _save(store, gap)
        if gap.id in done:
            continue
        pool = build_pool(gap, snap, claims, pubs)
        hyp: Hypothesis | None = None
        critique: list[str] | None = None
        for _ in range(settings.max_agent_iterations):
            candidate, rejected = propose(llm, gap, pool, nodes, pubs, critique=critique, previous=hyp)
            result.rejections += rejected
            if candidate is None:
                if hyp is None and any(r.reason in RETRYABLE for r in rejected):
                    continue                     # a refused or malformed first reply uses one round and tries again
                break
            hyp = candidate
            _save(store, hyp)
            verdict = review(llm, hyp, claims, pubs, available_papers=len({i.claim.publication_id for i in pool}))
            _save(store, verdict)
            if verdict.verdict != Verdict.REVISE:
                break
            critique = [*verdict.rule_findings, *verdict.critic_notes]

        if hyp is not None:
            last = max((r for r in store.list(Review) if r.hypothesis_id == hyp.id), key=lambda r: r.hypothesis_version)
            if last.verdict == Verdict.ACCEPT:
                hyp = hyp.revise(review_status=HypothesisStatus.EVIDENCE_SUPPORTED)
                outcome = assess_novelty(llm, lit, hyp, gap, nodes, list(pubs.values()))
                for log in outcome.logs:
                    _save(store, log)
                _save(store, outcome.assessment)
                hyp = hyp.revise(novelty_status=outcome.assessment.status)
            elif any(f.startswith("Contradicted") for f in last.rule_findings):
                hyp = hyp.revise(review_status=HypothesisStatus.CONTRADICTED)
            _save(store, hyp)
        done.add(gap.id)
        store.checkpoint(job_id, "gap", {"done": sorted(done)})

    return collect_result(store, result.gaps, claims, pubs, result.rejections)


def collect_result(
    store: Store, gaps: list[Gap], claims: dict[str, EvidenceClaim], pubs: dict[str, Publication],
    rejections: list[Rejection] | None = None,
) -> SwarmResult:
    """Assemble a SwarmResult from stored records (used after a run, and by reports/viewers)."""
    result = SwarmResult(gaps=gaps, rejections=rejections or [])
    gap_ids = {g.id for g in gaps}
    result.hypotheses = [h for h in store.list(Hypothesis) if h.gap_id in gap_ids]
    hyp_ids = {h.id for h in result.hypotheses}
    result.reviews = [r for r in store.list(Review) if r.hypothesis_id in hyp_ids]
    result.novelty = {n.hypothesis_id: n for n in store.list(NoveltyAssessment) if n.hypothesis_id in hyp_ids}
    accepted = [h for h in result.hypotheses if h.review_status in ACCEPTED]
    result.profiles = {h.id: card(h, result.novelty.get(h.id), claims, pubs) for h in result.hypotheses}
    result.cards = order([result.profiles[h.id] for h in accepted])
    return result


def load_result(store: Store) -> SwarmResult:
    """The stored swarm state, without running any model."""
    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    return collect_result(store, store.list(Gap), claims, pubs)
