"""Temporal evidence graph.

Edges are stored one per (claim, subject, relation, object) so each keeps its own
publication date. Time-slicing therefore works by filtering evidence, not by
guessing: `snapshot(cutoff)` keeps only claims from papers published up to the
cutoff year, and an edge survives only if some of its evidence does.

Entities the model names must appear in the claim text or passage, so a model
cannot invent nodes. Edges drawn as established always carry evidence claim ids;
`suggest_inferred_edges` adds clearly flagged, evidence-free hypotheses.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .claims import Rejection
from .config import Settings
from .llm import LLM
from .models import (
    Direction, EvidenceClaim, GraphEdge, GraphNode, NodeType, Provenance, Publication,
    Relation, RetractionStatus,
)
from .pdf_ingest import contains_verbatim, normalize
from .store import Store

GRAPH_VERSION = "graph-v1"
TRIPLE_BATCH = 6                      # claims per model call (keeps prompts small on 16 GB)

SIGN = {Relation.ACTIVATES: 1, Relation.INHIBITS: -1}

SYSTEM_PROMPT = (
    "You turn scientific claims into graph edges. Reply with ONLY a JSON array. Each item: "
    "{\"claim\": <number>, \"subject\": str, \"subject_type\": \"gene\"|\"pathway\"|\"disease\"|\"intervention\"|\"measurement\"|\"concept\", "
    "\"relation\": \"activates\"|\"inhibits\"|\"associated\"|\"no_effect\", "
    "\"object\": str, \"object_type\": <same options>}. "
    "RULES: 'subject' and 'object' MUST be words that appear in the claim text. "
    "Use 'associated' when direction of effect is not stated. Use 'no_effect' only when the claim says there was no effect. "
    "One claim may give several edges or none. Never add entities that are not in the claim."
)


@dataclass
class GraphBuild:
    nodes: list[GraphNode] = field(default_factory=list)
    edges: list[GraphEdge] = field(default_factory=list)
    rejections: list[Rejection] = field(default_factory=list)


def node_id(name: str) -> str:
    return "nod_" + hashlib.sha1(normalize(name).casefold().encode()).hexdigest()[:12]


def edge_id(claim_id: str, source: str, target: str, relation: Relation) -> str:
    return "edg_" + hashlib.sha1(f"{claim_id}|{source}|{target}|{relation}".encode()).hexdigest()[:12]


def _year_date(year: int | None) -> datetime | None:
    return datetime(year, 1, 1, tzinfo=timezone.utc) if year else None


def _parse(raw: str) -> list[dict] | None:
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return None
    return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else None


def _enum(cls, value, default):
    try:
        return cls(value)
    except ValueError:
        return default


def extract_edges(
    llm: LLM, claims: list[EvidenceClaim], pubs: dict[str, Publication],
) -> GraphBuild:
    """Model proposes triples for a batch of claims; code keeps only grounded ones."""
    build = GraphBuild()
    numbered = "\n".join(f"{i}. {c.claim}" for i, c in enumerate(claims, start=1))
    items = _parse(llm.generate(SYSTEM_PROMPT, numbered))
    if items is None:
        build.rejections.append(Rejection("unparseable_model_output", numbered[:80]))
        return build

    nodes: dict[str, GraphNode] = {}
    for item in items:
        idx = item.get("claim")
        if not isinstance(idx, int) or not 1 <= idx <= len(claims):
            build.rejections.append(Rejection("bad_claim_index", str(idx)))
            continue
        claim = claims[idx - 1]
        subject = normalize(str(item.get("subject") or ""))
        obj = normalize(str(item.get("object") or ""))
        relation = _enum(Relation, item.get("relation"), None)
        if relation not in (Relation.ACTIVATES, Relation.INHIBITS, Relation.ASSOCIATED, Relation.NO_EFFECT):
            build.rejections.append(Rejection("invalid_relation", str(item.get("relation"))))
            continue
        if len(subject) < 2 or len(obj) < 2 or subject.casefold() == obj.casefold():
            build.rejections.append(Rejection("invalid_entities", f"{subject!r} / {obj!r}"))
            continue
        grounded = [e for e in (subject, obj) if contains_verbatim(f"{claim.claim} {claim.passage}", e)]
        if len(grounded) != 2:
            build.rejections.append(Rejection("entity_not_in_claim", f"{subject!r} / {obj!r}"))
            continue

        for name, kind in ((subject, item.get("subject_type")), (obj, item.get("object_type"))):
            nid = node_id(name)
            nodes.setdefault(nid, GraphNode(
                id=nid, type=_enum(NodeType, kind, NodeType.CONCEPT), canonical_name=name,
                provenance=Provenance(source="agent:graph_builder", detail=llm.name, tool_version=GRAPH_VERSION)))
        pub = pubs.get(claim.publication_id)
        s_id, t_id = node_id(subject), node_id(obj)
        build.edges.append(GraphEdge(
            id=edge_id(claim.id, s_id, t_id, relation), source=s_id, target=t_id, relation=relation,
            sign=SIGN.get(relation, 0), evidence_claim_ids=[claim.id],
            publication_date=_year_date(pub.year if pub else None), inferred=False,
            provenance=Provenance(source="agent:graph_builder", detail=llm.name, tool_version=GRAPH_VERSION)))
    build.nodes = list(nodes.values())
    return build


def build_graph(
    llm: LLM, store: Store, claims: list[EvidenceClaim], pubs: dict[str, Publication],
    *, job_id: str = "graph", batch: int = TRIPLE_BATCH,
) -> GraphBuild:
    """Resumable: processed claim ids are checkpointed, saved records are never duplicated."""
    resumed = store.resume(job_id)
    done: set[str] = set(resumed[1].get("done", [])) if resumed else set()
    total = GraphBuild()
    todo = [c for c in claims if c.id not in done]
    for i in range(0, len(todo), batch):
        part = todo[i:i + batch]
        built = extract_edges(llm, part, pubs)
        for rec in [*built.nodes, *built.edges]:
            if store.get(rec.id) is None:
                store.save(rec)
        total.nodes += built.nodes
        total.edges += built.edges
        total.rejections += built.rejections
        done.update(c.id for c in part)
        store.checkpoint(job_id, "edges", {"done": sorted(done)})
    return total


# ── Time slicing ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class DisplayEdge:
    source: str
    target: str
    evidence: tuple[tuple[str, str], ...]      # (claim_id, relation) per supporting claim
    first_year: int | None
    contested: bool
    inferred: bool
    has_retracted_source: bool

    @property
    def key(self) -> str:
        return f"{self.source}>{self.target}"

    @property
    def relations(self) -> tuple[str, ...]:
        return tuple(sorted({r for _, r in self.evidence})) or (Relation.ASSOCIATED.value,)


@dataclass(frozen=True)
class Snapshot:
    cutoff: int | None
    nodes: tuple[GraphNode, ...]
    edges: tuple[DisplayEdge, ...]
    claim_ids: frozenset[str]                  # every claim visible at this cutoff
    excluded_undated: int                      # evidence skipped because its paper has no year


def snapshot(
    nodes: list[GraphNode], edges: list[GraphEdge], claims: dict[str, EvidenceClaim],
    pubs: dict[str, Publication], cutoff: int | None, *, include_inferred: bool = True,
) -> Snapshot:
    """The graph as it was known at `cutoff` (inclusive). None = everything dated."""
    def year_of(claim_id: str) -> int | None:
        claim = claims.get(claim_id)
        pub = pubs.get(claim.publication_id) if claim else None
        return pub.year if pub else None

    grouped: dict[tuple[str, str], list[tuple[str, str]]] = {}
    inferred_pairs: set[tuple[str, str]] = set()
    excluded_undated = 0
    visible: set[str] = set()
    for edge in edges:
        pair = (edge.source, edge.target)
        if edge.inferred:
            inferred_pairs.add(pair)
            continue
        for cid in edge.evidence_claim_ids:
            year = year_of(cid)
            if year is None:
                excluded_undated += 1
            elif cutoff is None or year <= cutoff:
                grouped.setdefault(pair, []).append((cid, edge.relation.value))
                visible.add(cid)

    display: list[DisplayEdge] = []
    for (src, tgt), evidence in grouped.items():
        rels = {r for _, r in evidence}
        directions = {claims[c].direction for c, _ in evidence}
        contested = (
            {Relation.ACTIVATES.value, Relation.INHIBITS.value} <= rels
            or (Relation.NO_EFFECT.value in rels and bool(rels & {"activates", "inhibits"}))
            or {Direction.SUPPORTS, Direction.CONTRADICTS} <= directions
        )
        retracted = any(
            pubs[claims[c].publication_id].retraction_status == RetractionStatus.RETRACTED
            for c, _ in evidence if claims[c].publication_id in pubs
        )
        first = min(y for c, _ in evidence if (y := year_of(c)) is not None)
        display.append(DisplayEdge(src, tgt, tuple(sorted(set(evidence))), first, contested, False, retracted))

    present = {n for e in display for n in (e.source, e.target)}
    if include_inferred:
        for src, tgt in sorted(inferred_pairs):
            if src in present and tgt in present and (src, tgt) not in grouped:
                display.append(DisplayEdge(src, tgt, (), None, False, True, False))
    used = present
    return Snapshot(
        cutoff, tuple(n for n in nodes if n.id in used),
        tuple(sorted(display, key=lambda e: (e.inferred, e.first_year or 0, e.key))),
        frozenset(visible), excluded_undated,
    )


def restrict(snap: Snapshot, node_ids: list[str]) -> Snapshot:
    """The part of a snapshot that lies among `node_ids` (for a per-hypothesis mechanism diagram)."""
    keep = set(node_ids)
    edges = tuple(e for e in snap.edges if e.source in keep and e.target in keep)
    used = {n for e in edges for n in (e.source, e.target)} | keep
    claim_ids = frozenset(c for e in edges for c, _ in e.evidence)
    return Snapshot(snap.cutoff, tuple(n for n in snap.nodes if n.id in used), edges, claim_ids, snap.excluded_undated)


def suggest_inferred_edges(edges: list[GraphEdge]) -> list[GraphEdge]:
    """Two-hop hypotheses: A activates B and B activates C suggests A is linked to C.

    These are guesses, not findings: they carry no evidence and are flagged
    `inferred` so every figure draws them dashed and labels them hypothesis.
    """
    direct = {(e.source, e.target) for e in edges if not e.inferred}
    activating = [e for e in edges if not e.inferred and e.relation == Relation.ACTIVATES]
    out: dict[tuple[str, str], GraphEdge] = {}
    for first in activating:
        for second in activating:
            pair = (first.source, second.target)
            if (first.target == second.source and first.source != second.target
                    and pair not in direct and pair not in out):
                out[pair] = GraphEdge(
                    id=edge_id("inferred", *pair, Relation.ASSOCIATED), source=pair[0], target=pair[1],
                    relation=Relation.ASSOCIATED, inferred=True,
                    provenance=Provenance(source="rule:two_hop", detail=f"via {first.target}",
                                          tool_version=GRAPH_VERSION))
    return list(out.values())


def load_graph(store: Store) -> tuple[list[GraphNode], list[GraphEdge]]:
    return store.list(GraphNode), store.list(GraphEdge)


def year_range(pubs: dict[str, Publication]) -> tuple[int, int] | None:
    years = [p.year for p in pubs.values() if p.year]
    return (min(years), max(years)) if years else None
