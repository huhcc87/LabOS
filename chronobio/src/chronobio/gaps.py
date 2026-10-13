"""Gap discovery by explicit rules over the evidence graph.

The model never decides what counts as a gap: each rule below is a plain check
on the graph, so every gap can be audited and re-derived. Not implemented yet:
population gaps (needs structured cohort data) and cross-field gaps (needs
field metadata); both are listed in the README as open.
"""

from __future__ import annotations

import hashlib

from .entities import is_generic
from .graph import Snapshot
from .models import EvidenceClaim, Gap, GapKind, GraphNode, Provenance, StudyDesign

GAP_VERSION = "gaps-v1"
BASE_PRIORITY = {GapKind.CONTRADICTORY: 3.0, GapKind.MECHANISTIC: 2.0,
                 GapKind.TRANSLATIONAL: 2.0, GapKind.UNREPLICATED: 1.0}
HUMAN = {StudyDesign.RANDOMIZED, StudyDesign.OBSERVATIONAL}
NOT_INFORMATIVE = {StudyDesign.UNKNOWN, StudyDesign.REVIEW, StudyDesign.OTHER}


def gap_id(kind: GapKind, node_ids: list[str]) -> str:
    return "gap_" + hashlib.sha1(f"{kind}|{'|'.join(sorted(node_ids))}".encode()).hexdigest()[:12]


def _priority(kind: GapKind, paper_count: int) -> float:
    # Less-covered gaps rank higher within a kind: base weight + 0.5 / papers touching it.
    return round(BASE_PRIORITY[kind] + 0.5 / max(paper_count, 1), 3)


def _papers(claim_ids: list[str], claims: dict[str, EvidenceClaim]) -> set[str]:
    return {claims[c].publication_id for c in claim_ids if c in claims}


def find_gaps(snap: Snapshot, claims: dict[str, EvidenceClaim], nodes: dict[str, GraphNode]) -> list[Gap]:
    name = lambda nid: nodes[nid].canonical_name if nid in nodes else nid
    established = {(e.source, e.target): e for e in snap.edges if not e.inferred}
    gaps: list[Gap] = []

    def add(kind: GapKind, node_ids: list[str], description: str, claim_ids: list[str]) -> None:
        n = len(_papers(claim_ids, claims))
        gaps.append(Gap(
            id=gap_id(kind, node_ids), kind=kind, description=description, node_ids=node_ids,
            claim_ids=sorted(set(claim_ids)), paper_count=n, priority=_priority(kind, n),
            provenance=Provenance(source="rule:gap_finder", detail=kind.value, tool_version=GAP_VERSION)))

    meaningful = lambda e: not (is_generic(name(e.source)) or is_generic(name(e.target)))     # skip links through "cancer", "inhibition" ...
    for e in filter(meaningful, established.values()):
        ids = [c for c, _ in e.evidence]
        label = f"{name(e.source)} → {name(e.target)}"
        papers = _papers(ids, claims)
        if e.contested:
            add(GapKind.CONTRADICTORY, [e.source, e.target],
                f"Evidence conflicts on {label}: {', '.join(e.relations)} are both reported.", ids)
        if len(papers) == 1:
            add(GapKind.UNREPLICATED, [e.source, e.target],
                f"{label} is reported by a single paper and has not been replicated in this corpus.", ids)
        designs = {claims[c].design for c in ids if c in claims} - NOT_INFORMATIVE
        if designs and not designs & HUMAN:
            add(GapKind.TRANSLATIONAL, [e.source, e.target],
                f"{label} is supported only by {', '.join(sorted(d.value for d in designs))} "
                f"studies; no human (observational or randomized) evidence in this corpus.", ids)

    for e in snap.edges:
        if not e.inferred or not meaningful(e):
            continue
        # Two-step path A → X → B behind the hypothesised A → B link.
        for (a, x), first in established.items():
            second = established.get((x, e.target))
            if a == e.source and second is not None:
                ids = [c for c, _ in first.evidence] + [c for c, _ in second.evidence]
                add(GapKind.MECHANISTIC, [e.source, x, e.target],
                    f"{name(a)} → {name(x)} and {name(x)} → {name(e.target)} are reported, "
                    f"but no paper examines {name(a)} → {name(e.target)} directly.", ids)

    return sorted(gaps, key=lambda g: (-g.priority, g.id))
