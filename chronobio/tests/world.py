"""A small fixed 'literature' used by graph, figure and viewer tests.

KRAS -activates-> MAPK (2015 PDF paper), MAPK -activates-> tumor growth (2018),
Drug X -inhibits-> KRAS (2021, retracted source), and a 2021 paper contradicting
KRAS -> MAPK. A 2012 paper has no graph edges; one paper has no year.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from chronobio.config import Settings
from chronobio.graph import edge_id, node_id
from chronobio.ingest import ingest_pdf
from chronobio.models import (
    Direction, EvidenceClaim, GraphEdge, GraphNode, Locator, NodeType, Provenance, Publication,
    Relation, RetractionStatus,
)
from chronobio.pdf_ingest import locate
from chronobio.store import Store

PROV = Provenance(source="test")
PASSAGE = "metformin use was associated with fewer recurrent polyps (hazard ratio 0.62, 95% CI 0.45-0.85)"


@dataclass
class World:
    store: Store
    settings: Settings
    pubs: dict[str, Publication]
    claims: dict[str, EvidenceClaim]
    nodes: list[GraphNode]
    edges: list[GraphEdge]


def _pub(title, year, **kw) -> Publication:
    return Publication(title=title, year=year, provenance=PROV, **kw)


def _text_claim(pub, text, direction=Direction.SUPPORTS) -> EvidenceClaim:
    return EvidenceClaim(publication_id=pub.id, claim=text, passage=text, direction=direction,
                         locator=Locator.TEXT_ONLY, extraction_version="t", provenance=PROV)


def _edge(claim, src, tgt, rel) -> GraphEdge:
    s, t = node_id(src), node_id(tgt)
    year = None
    return GraphEdge(id=edge_id(claim.id, s, t, rel), source=s, target=t, relation=rel,
                     sign={Relation.ACTIVATES: 1, Relation.INHIBITS: -1}.get(rel, 0),
                     evidence_claim_ids=[claim.id], publication_date=year, provenance=PROV)


def make_world(tmp_path: Path, paper_pdf: Path) -> World:
    settings = Settings(data_dir=tmp_path / "data")
    store = Store(settings.db_path)

    pdf_pub, doc, _ = ingest_pdf(store, settings, paper_pdf, title="KRAS and MAPK signalling", year=2015)
    loc = locate(doc, PASSAGE)
    c_pdf = EvidenceClaim(
        publication_id=pdf_pub.id, claim="KRAS activates the MAPK pathway", passage=loc.text,
        locator=Locator.PDF_EXACT, page=loc.page, char_start=loc.char_start, char_end=loc.char_end,
        highlight_boxes=list(loc.boxes), direction=Direction.SUPPORTS, n=1200,
        effect="hazard ratio 0.62", extraction_version="t", provenance=PROV)

    p2018 = _pub("MAPK drives growth", 2018, doi="10.1/growth", pmid="2018001", journal="Cell Rep", authors=["Lee A"])
    p2021 = _pub("Drug X blocks KRAS", 2021, retraction_status=RetractionStatus.RETRACTED)
    p2021b = _pub("KRAS does not drive MAPK", 2021)
    p2012 = _pub("Old unrelated paper", 2012)
    p_nodate = _pub("Undated preprint", None)
    c2018 = _text_claim(p2018, "MAPK pathway activation drives tumor growth")
    c2021 = _text_claim(p2021, "Drug X inhibits KRAS activity")
    c2021b = _text_claim(p2021b, "KRAS inhibits MAPK signalling in this model", Direction.CONTRADICTS)
    c2012 = _text_claim(p2012, "An unrelated finding")
    c_nodate = _text_claim(p_nodate, "KRAS activates MAPK in an undated preprint")

    pubs = {p.id: p for p in (pdf_pub, p2018, p2021, p2021b, p2012, p_nodate)}
    claims = {c.id: c for c in (c_pdf, c2018, c2021, c2021b, c2012, c_nodate)}
    for rec in [*pubs.values(), *claims.values()]:
        if store.get(rec.id) is None:
            store.save(rec)

    names = {"KRAS": NodeType.GENE, "MAPK pathway": NodeType.PATHWAY, "tumor growth": NodeType.CONCEPT,
             "Drug X": NodeType.INTERVENTION}
    nodes = [GraphNode(id=node_id(n), type=t, canonical_name=n, provenance=PROV) for n, t in names.items()]
    edges = [
        _edge(c_pdf, "KRAS", "MAPK pathway", Relation.ACTIVATES),
        _edge(c2018, "MAPK pathway", "tumor growth", Relation.ACTIVATES),
        _edge(c2021, "Drug X", "KRAS", Relation.INHIBITS),
        _edge(c2021b, "KRAS", "MAPK pathway", Relation.INHIBITS),
        _edge(c_nodate, "KRAS", "MAPK pathway", Relation.ACTIVATES),
    ]
    for rec in [*nodes, *edges]:
        store.save(rec)
    return World(store, settings, pubs, claims, nodes, edges)
