"""Ranking that never collapses to one confidence number.

Each dimension is reported on its own with the reason behind it. `order` sorts
cards by configurable weights purely as a reading aid; it is not a probability
of being true. Feasibility and impact need the experiment designer (a later
milestone) and are reported as "not_assessed" until then, and validation is
"not_performed" until a dataset analysis has actually been run.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .agents import HUMAN, MEASURABLE
from .models import (
    EvidenceClaim, Hypothesis, NoveltyAssessment, NoveltyStatus, Publication, RetractionStatus,
)

LEVELS = {"low": 0, "medium": 1, "high": 2}
NOT_ASSESSED = "not_assessed"
DEFAULT_WEIGHTS = {"evidence_strength": 1.0, "falsifiability": 1.0, "originality": 1.0}


@dataclass(frozen=True)
class Dimension:
    level: str                         # low | medium | high | not_assessed
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class RankCard:
    hypothesis_id: str
    statement: str
    evidence_strength: Dimension
    falsifiability: Dimension
    originality: Dimension
    feasibility: Dimension = field(default_factory=lambda: Dimension(NOT_ASSESSED, ("Needs the experiment designer.",)))
    impact: Dimension = field(default_factory=lambda: Dimension(NOT_ASSESSED, ("Not estimated by this system.",)))
    validation: str = "not_performed"  # no dataset analysis has been run


def _evidence(hyp: Hypothesis, claims: dict[str, EvidenceClaim], pubs: dict[str, Publication]) -> Dimension:
    support = [claims[c] for c in hyp.supporting_claim_ids if c in claims]
    papers = {c.publication_id for c in support}
    reasons = [f"{len(papers)} supporting paper(s)"]
    level = 2 if len(papers) >= 3 else 1 if len(papers) == 2 else 0
    if not {c.design for c in support} & HUMAN:
        reasons.append("no human evidence")
        level = min(level, 1)
    if hyp.contradicting_claim_ids:
        reasons.append(f"{len(hyp.contradicting_claim_ids)} conflicting claim(s)")
        level = max(level - 1, 0)
    if any(pubs.get(c.publication_id) and pubs[c.publication_id].retraction_status == RetractionStatus.RETRACTED
           for c in support):
        reasons.append("includes retracted source")
        level = 0
    return Dimension(("low", "medium", "high")[level], tuple(reasons))


def _falsifiability(hyp: Hypothesis) -> Dimension:
    measurable = sum(bool(MEASURABLE.search(p)) for p in hyp.predictions)
    reasons = (f"{len(hyp.predictions)} prediction(s), {measurable} clearly measurable",
               f"{len(hyp.falsifiers)} falsifier(s)")
    if measurable == len(hyp.predictions) and len(hyp.falsifiers) >= 2:
        return Dimension("high", reasons)
    return Dimension("medium" if measurable else "low", reasons)


def _originality(novelty: NoveltyAssessment | None) -> Dimension:
    if novelty is None or novelty.status in (NoveltyStatus.NOT_SEARCHED, NoveltyStatus.UNKNOWN):
        return Dimension(NOT_ASSESSED, ("Prior-work search not run or inconclusive.",))
    mapping = {NoveltyStatus.KNOWN: "low", NoveltyStatus.PARTIALLY_TESTED: "medium",
               NoveltyStatus.POSSIBLE_NOVEL_COMBINATION: "high"}
    note = ("Possible only: limited to abstract search, absence of hits is not proof."
            if novelty.status == NoveltyStatus.POSSIBLE_NOVEL_COMBINATION else novelty.status.value)
    return Dimension(mapping[novelty.status], (note,))


def card(
    hyp: Hypothesis, novelty: NoveltyAssessment | None, claims: dict[str, EvidenceClaim],
    pubs: dict[str, Publication],
) -> RankCard:
    return RankCard(hyp.id, hyp.statement, _evidence(hyp, claims, pubs), _falsifiability(hyp), _originality(novelty))


def order(cards: list[RankCard], weights: dict[str, float] | None = None) -> list[RankCard]:
    """Sort by weighted levels. Dimensions that are not assessed contribute nothing."""
    w = DEFAULT_WEIGHTS | (weights or {})

    def key(c: RankCard) -> float:
        return sum(w[name] * LEVELS.get(getattr(c, name).level, 0) for name in DEFAULT_WEIGHTS)

    return sorted(cards, key=lambda c: (-key(c), c.hypothesis_id))
