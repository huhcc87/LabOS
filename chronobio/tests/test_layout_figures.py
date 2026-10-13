import xml.etree.ElementTree as ET

from world import PROV, make_world

from chronobio.figures import graph_svg, matrix_svg, timeline_svg
from chronobio.graph import snapshot, suggest_inferred_edges
from chronobio.layout import layout
from chronobio.models import GraphNode, NodeType


def parse(svg: str) -> ET.Element:
    return ET.fromstring(svg)          # raises if the SVG is not well-formed XML


def texts(root) -> str:
    return " ".join("".join(t.itertext()) for t in root.iter("{http://www.w3.org/2000/svg}text"))


# ── layout ───────────────────────────────────────────────────────────────────

def min_gap(pos) -> float:
    pts = list(pos.values())
    return min(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
               for i, a in enumerate(pts) for b in pts[i + 1:])


def test_layout_is_deterministic_bounded_and_complete():
    nodes = [f"n{i}" for i in range(12)]
    edges = [(f"n{i}", f"n{(i + 1) % 12}") for i in range(12)]
    a, b = layout(nodes, edges), layout(nodes, edges)
    assert a == b and set(a.pos) == set(nodes)
    assert all(0 <= x <= a.width and 0 <= y <= a.height for x, y in a.pos.values())


def test_many_small_clusters_never_stack_nodes():
    """Regression: one global force layout squeezed every cluster's own nodes onto each other."""
    nodes, edges = [], []
    for c in range(25):                                   # 25 clusters of 2-4 nodes, like real literature graphs
        size = 2 + c % 3
        members = [f"c{c}n{i}" for i in range(size)]
        nodes += members
        edges += list(zip(members, members[1:]))
    placed = layout(nodes, edges)
    assert len(placed.pos) == len(nodes)
    assert min_gap(placed.pos) >= 60                      # labels stay readable
    assert placed.height > 480 and placed.width == 960    # canvas grows instead of cramming


def test_one_dense_cluster_is_also_separated():
    nodes = [f"n{i}" for i in range(30)]
    edges = [(nodes[i], nodes[(i * 7 + 3) % 30]) for i in range(30) if nodes[i] != nodes[(i * 7 + 3) % 30]]
    assert min_gap(layout(nodes, edges).pos) >= 60


def test_layout_edge_cases():
    assert layout([], []).pos == {}
    single = layout(["only"], [])
    assert list(single.pos) == ["only"] and 0 <= single.pos["only"][0] <= single.width
    pair = layout(["a", "b"], [("a", "b")]).pos
    assert abs(pair["a"][0] - pair["b"][0]) == 150 and pair["a"][1] == pair["b"][1]


# ── graph figure ─────────────────────────────────────────────────────────────

def graph_fixture(tmp_path, paper_pdf, cutoff=2021):
    w = make_world(tmp_path, paper_pdf)
    edges = w.edges + suggest_inferred_edges(w.edges)
    snap = snapshot(w.nodes, edges, w.claims, w.pubs, cutoff)
    nodes = {n.id: n for n in w.nodes}
    pos = layout([n.id for n in snap.nodes], [(e.source, e.target) for e in snap.edges]).pos
    return w, snap, nodes, pos


def test_graph_svg_is_valid_has_legend_and_distinguishes_hypotheses(tmp_path, paper_pdf):
    w, snap, nodes, pos = graph_fixture(tmp_path, paper_pdf)
    svg = graph_svg(snap, pos, nodes, title="Test graph")
    root = parse(svg)
    assert "hypothesis — NOT established" in texts(root) and "contested" in texts(root)
    edges = [g for g in root.iter("{http://www.w3.org/2000/svg}g") if "edge" in (g.get("class") or "").split()]
    assert len(edges) == len(snap.edges)
    for g in edges:
        stroke = g.find("{http://www.w3.org/2000/svg}path")
        classes = g.get("class").split()
        # hypotheses are dashed AND labelled; established links cite claims
        if "inferred" in classes:
            assert stroke.get("stroke-dasharray") == "7 5" and g.get("data-claims") == ""
            assert "hypothesis" in "".join(g.itertext())
        else:
            assert g.get("data-claims")
    assert root.get("role") == "img" and root.find("{http://www.w3.org/2000/svg}title") is not None


def test_contested_and_retracted_links_are_marked_in_the_figure(tmp_path, paper_pdf):
    _, snap, nodes, pos = graph_fixture(tmp_path, paper_pdf)
    body = texts(parse(graph_svg(snap, pos, nodes, title="t")))
    assert "contested ×2" in body                    # KRAS->MAPK: 2015 activates vs 2021 inhibits
    assert "retracted source" in body


def test_every_edge_maps_back_to_real_claim_ids(tmp_path, paper_pdf):
    w, snap, nodes, pos = graph_fixture(tmp_path, paper_pdf)
    root = parse(graph_svg(snap, pos, nodes, title="t"))
    for g in root.iter("{http://www.w3.org/2000/svg}g"):
        for cid in filter(None, (g.get("data-claims") or "").split(",")):
            assert cid in w.claims


def test_malicious_text_is_escaped_not_executed(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    evil = '<script>alert(1)</script>"&'
    kras = next(n for n in w.nodes if n.canonical_name == "KRAS")
    w.nodes = [GraphNode(id=kras.id, type=NodeType.GENE, canonical_name=evil, provenance=PROV)
               if n.id == kras.id else n for n in w.nodes]
    snap = snapshot(w.nodes, w.edges, w.claims, w.pubs, 2021)
    nodes = {n.id: n for n in w.nodes}
    pos = layout([n.id for n in snap.nodes], [(e.source, e.target) for e in snap.edges]).pos
    svg = graph_svg(snap, pos, nodes, title="<img src=x onerror=alert(1)>")
    root = parse(svg)                                   # still well-formed
    assert "<script" not in svg and "<img" not in svg
    assert evil[:20] in texts(root)                     # shown as literal text (labels are truncated)
    assert evil in "".join(t.text or "" for t in root.iter("{http://www.w3.org/2000/svg}title"))   # full name in tooltip


# ── timeline and matrix ──────────────────────────────────────────────────────

def test_timeline_counts_claims_per_year_and_dims_future_years(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    root = parse(timeline_svg(list(w.claims.values()), w.pubs, cutoff=2015))
    ns = "{http://www.w3.org/2000/svg}"
    years = {g.get("data-year"): g for g in root.iter(ns + "g") if g.get("data-year")}
    assert set(years) == {str(y) for y in range(2012, 2022)}
    assert years["2021"].get("opacity") == "0.25" and years["2015"].get("opacity") is None
    titles = [t.text for t in years["2021"].iter(ns + "title")]
    assert "2021: 1 supports" in titles and "2021: 1 contradicts" in titles
    assert "claim(s) without a year" in texts(root)


def test_timeline_with_no_data_says_so():
    assert "No dated evidence yet" in texts(parse(timeline_svg([], {})))


def test_matrix_shows_support_and_contradiction_per_paper(tmp_path, paper_pdf):
    w, snap, nodes, _ = graph_fixture(tmp_path, paper_pdf)
    root = parse(matrix_svg(snap, nodes, w.claims, w.pubs))
    body = texts(root)
    assert "S" in body and "C" in body and "contradicts" in body
    assert "KRAS → MAPK pathway" in body
