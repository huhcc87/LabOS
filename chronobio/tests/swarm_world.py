"""Builders for small corpora used by the swarm tests."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from chronobio.config import Settings
from chronobio.graph import edge_id, node_id
from chronobio.models import (
    Direction, EvidenceClaim, GraphEdge, GraphNode, Locator, NodeType, Provenance, Publication,
    Relation, RetractionStatus, StudyDesign,
)
from chronobio.store import Store

PROV = Provenance(source="test")
A, B = "KRAS", "MAPK pathway"


@dataclass
class Paper:
    year: int | None = 2018
    design: StudyDesign = StudyDesign.ANIMAL
    direction: Direction = Direction.SUPPORTS
    relation: Relation = Relation.ACTIVATES
    retracted: bool = False
    src: str = A
    dst: str = B


@dataclass
class Corpus:
    store: Store
    settings: Settings
    pubs: dict[str, Publication]
    claims: dict[str, EvidenceClaim]
    claim_ids: list[str]               # in the order the papers were given


def build(tmp_path: Path, papers: list[Paper]) -> Corpus:
    settings = Settings(data_dir=tmp_path / "data", max_agent_iterations=3)
    store = Store(settings.db_path)
    pubs, claims, ids, seen = {}, {}, [], {}
    for i, p in enumerate(papers):
        pub = Publication(
            title=f"Study {i} of {p.src} and {p.dst}", year=p.year, doi=f"10.1/{i}",
            retraction_status=RetractionStatus.RETRACTED if p.retracted else RetractionStatus.NONE_FOUND,
            provenance=PROV)
        claim = EvidenceClaim(
            publication_id=pub.id, claim=f"{p.src} {p.relation.value} {p.dst} in study {i}",
            passage=f"{p.src} {p.relation.value} {p.dst} in study {i}", locator=Locator.TEXT_ONLY,
            direction=p.direction, design=p.design, extraction_version="t", provenance=PROV)
        pubs[pub.id], claims[claim.id] = pub, claim
        ids.append(claim.id)
        store.save(pub)
        store.save(claim)
        for name in (p.src, p.dst):
            nid = node_id(name)
            if nid not in seen:
                seen[nid] = GraphNode(id=nid, type=NodeType.GENE, canonical_name=name, provenance=PROV)
                store.save(seen[nid])
        s, t = node_id(p.src), node_id(p.dst)
        store.save(GraphEdge(
            id=edge_id(claim.id, s, t, p.relation), source=s, target=t, relation=p.relation,
            evidence_claim_ids=[claim.id], provenance=PROV))
    return Corpus(store, settings, pubs, claims, ids)
