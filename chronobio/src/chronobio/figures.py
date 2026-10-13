"""Editable SVG figures: evidence graph, year-by-year timeline, for/against matrix.

Every figure carries a legend, accessible titles, and `data-*` attributes that
map each drawn element back to claim ids. Established links are solid;
hypothesized links are dashed and labelled; contested links use a distinct
colour AND dash pattern so meaning never depends on colour alone.
(Colours follow the Okabe-Ito colour-blind-safe palette.)
"""

from __future__ import annotations

import math
from xml.sax.saxutils import escape, quoteattr

from .graph import DisplayEdge, Snapshot
from .models import Direction, EvidenceClaim, GraphNode, NodeType, Publication

GREEN, VERMILION, BLUE, PURPLE, GREY, INK = "#009E73", "#D55E00", "#0072B2", "#CC79A7", "#6b7280", "#1f2937"
NODE_FILL = {
    NodeType.GENE: "#E69F00", NodeType.PATHWAY: "#56B4E9", NodeType.DISEASE: "#F0E442",
    NodeType.INTERVENTION: "#B8E6D5", NodeType.MEASUREMENT: "#BBBBBB",
    NodeType.CONCEPT: "#E5E7EB", NodeType.STUDY: "#FFFFFF",
}
RADIUS = 17
FONT = "font-family=\"system-ui, -apple-system, 'Segoe UI', sans-serif\""

Point = tuple[float, float]


def _t(text: str, x: float, y: float, *, size: int = 12, anchor: str = "middle",
       weight: str = "400", fill: str = INK, extra: str = "") -> str:
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" text-anchor="{anchor}" '
            f'font-weight="{weight}" fill="{fill}" {FONT} {extra}>{escape(text)}</text>')


def _short(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ── Evidence graph ───────────────────────────────────────────────────────────

def edge_style(edge: DisplayEdge) -> dict:
    n = len(edge.evidence)
    width = 1.6 + min(n, 4) * 0.7
    if edge.inferred:
        return dict(color=BLUE, dash="7 5", marker="arrow-hyp", label="hypothesis", width=1.8)
    if edge.contested:
        return dict(color=PURPLE, dash="2 3 9 3", marker="arrow-con", label=f"contested ×{n}", width=width)
    rels = set(edge.relations)
    if "inhibits" in rels:
        return dict(color=VERMILION, dash="", marker="tbar", label=_count("inhibits", n), width=width)
    if "activates" in rels:
        return dict(color=GREEN, dash="", marker="arrow-pos", label=_count("activates", n), width=width)
    if "no_effect" in rels:
        return dict(color=GREY, dash="", marker="arrow-grey", label=_count("no effect", n), width=width)
    return dict(color=GREY, dash="", marker="", label=_count("associated", n), width=width)


def _count(name: str, n: int) -> str:
    return f"{name} ×{n}" if n > 1 else name


def _defs() -> str:
    def arrow(mid: str, color: str) -> str:
        return (f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" '
                f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>')
    return ("<defs>" + arrow("arrow-pos", GREEN) + arrow("arrow-hyp", BLUE) + arrow("arrow-con", PURPLE)
            + arrow("arrow-grey", GREY)
            + f'<marker id="tbar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" '
              f'orient="auto"><path d="M9,0 L9,10" stroke="{VERMILION}" stroke-width="3"/></marker>'
            + f'<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
              f'<rect width="6" height="6" fill="{VERMILION}"/><line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="2.5"/></pattern>'
            + "</defs>")


def _edge_geometry(a: Point, b: Point, curve: float) -> tuple[str, Point]:
    """Path from a to b, trimmed to node radius; returns (path, label position)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    dist = math.hypot(dx, dy) or 1.0
    ux, uy = dx / dist, dy / dist
    start = (a[0] + ux * RADIUS, a[1] + uy * RADIUS)
    end = (b[0] - ux * (RADIUS + 3), b[1] - uy * (RADIUS + 3))
    mid = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
    ctrl = (mid[0] - uy * curve, mid[1] + ux * curve)
    label = ((start[0] + 2 * ctrl[0] + end[0]) / 4, (start[1] + 2 * ctrl[1] + end[1]) / 4)
    return f"M{start[0]:.1f},{start[1]:.1f} Q{ctrl[0]:.1f},{ctrl[1]:.1f} {end[0]:.1f},{end[1]:.1f}", label


def graph_body(snap: Snapshot, pos: dict[str, Point], nodes: dict[str, GraphNode]) -> str:
    """The <g> content for one snapshot (shared by static export and the viewer)."""
    pairs = {(e.source, e.target) for e in snap.edges}
    parts = ['<g class="edges">']
    for e in snap.edges:
        if e.source not in pos or e.target not in pos:
            continue
        st = edge_style(e)
        curve = 26 if (e.target, e.source) in pairs else 0
        path, (lx, ly) = _edge_geometry(pos[e.source], pos[e.target], curve)
        names = f"{nodes[e.source].canonical_name} → {nodes[e.target].canonical_name}"
        kind = "hypothesized, no direct evidence" if e.inferred else f"{len(e.evidence)} evidence claim(s)"
        label = st["label"] + (" ⚠ retracted source" if e.has_retracted_source else "")
        claim_ids = ",".join(c for c, _ in e.evidence)
        parts.append(
            f'<g class="edge{" inferred" if e.inferred else ""}{" contested" if e.contested else ""}" '
            f'data-edge={quoteattr(e.key)} data-claims={quoteattr(claim_ids)} tabindex="0" role="button" '
            f'aria-label={quoteattr(f"{names}: {label}; {kind}")}>'
            f'<title>{escape(names)} — {escape(label)} ({escape(kind)})</title>'
            f'<path d="{path}" fill="none" stroke="{st["color"]}" stroke-width="{st["width"]:.1f}" '
            + (f'stroke-dasharray="{st["dash"]}" ' if st["dash"] else "")
            + (f'marker-end="url(#{st["marker"]})" ' if st["marker"] else "") + "/>"
            f'<path class="hit" d="{path}" fill="none" stroke="transparent" stroke-width="16"/>'
            + _t(label, lx, ly - 5, size=10, fill=st["color"], weight="600",
                 extra='paint-order="stroke" stroke="#fff" stroke-width="3"')
            + "</g>")
    parts.append("</g><g class=\"nodes\">")
    for n in snap.nodes:
        if n.id not in pos:
            continue
        x, y = pos[n.id]
        parts.append(
            f'<g class="node" data-node={quoteattr(n.id)}><title>{escape(n.canonical_name)} ({n.type.value})</title>'
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{RADIUS}" fill="{NODE_FILL[n.type]}" stroke="{INK}" stroke-width="1.4"/>'
            + _t(_short(n.canonical_name, 24), x, y + RADIUS + 14, size=12, weight="600",
                 extra='paint-order="stroke" stroke="#fff" stroke-width="3"')
            + "</g>")
    parts.append("</g>")
    return "".join(parts)


def legend(width: float, y: float, *, with_nodes: bool = True) -> str:
    items = [
        (GREEN, "", "arrow-pos", "activates (evidence)"),
        (VERMILION, "", "tbar", "inhibits (evidence)"),
        (GREY, "", "", "associated / no effect"),
        (PURPLE, "2 3 9 3", "arrow-con", "contested (conflicting evidence)"),
        (BLUE, "7 5", "arrow-hyp", "hypothesis — NOT established"),
    ]
    out = [f'<g class="legend" role="group" aria-label="Legend"><rect x="8" y="{y - 18:.0f}" width="{width - 16:.0f}" '
           f'height="{58 if with_nodes else 40}" rx="6" fill="#ffffff" stroke="#d1d5db"/>']
    x = 20.0
    for color, dash, marker, text in items:
        out.append(f'<line x1="{x:.0f}" y1="{y - 2:.0f}" x2="{x + 34:.0f}" y2="{y - 2:.0f}" stroke="{color}" stroke-width="2.4"'
                   + (f' stroke-dasharray="{dash}"' if dash else "")
                   + (f' marker-end="url(#{marker})"' if marker else "") + "/>")
        out.append(_t(text, x + 40, y + 2, size=11, anchor="start"))
        x += 48 + 6.2 * len(text)
    if with_nodes:
        x = 20.0
        for kind in (NodeType.GENE, NodeType.PATHWAY, NodeType.DISEASE, NodeType.INTERVENTION,
                     NodeType.MEASUREMENT, NodeType.CONCEPT):
            out.append(f'<circle cx="{x + 6:.0f}" cy="{y + 22:.0f}" r="6" fill="{NODE_FILL[kind]}" stroke="{INK}"/>')
            out.append(_t(kind.value, x + 17, y + 26, size=11, anchor="start"))
            x += 36 + 6.5 * len(kind.value)
    out.append("</g>")
    return "".join(out)


def graph_svg(
    snap: Snapshot, pos: dict[str, Point], nodes: dict[str, GraphNode], *,
    title: str, width: int = 960, height: int = 660,
) -> str:
    year = f"evidence up to {snap.cutoff}" if snap.cutoff else "all dated evidence"
    desc = (f"{len(snap.nodes)} entities and {len(snap.edges)} links, {year}. Solid links cite evidence; "
            f"dashed links are hypotheses.")
    note = f" ({snap.excluded_undated} claim(s) without a publication year omitted)" if snap.excluded_undated else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'role="img" aria-labelledby="gt gd">'
        f'<title id="gt">{escape(title)}</title><desc id="gd">{escape(desc + note)}</desc>'
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>' + _defs()
        + _t(title + (f" — {year}" if snap.cutoff else ""), 16, 24, size=15, anchor="start", weight="700")
        + graph_body(snap, pos, nodes) + legend(width, height - 40) + "</svg>"
    )


def graph_svg_slider(
    snaps: dict[int, Snapshot], pos: dict[str, Point], nodes: dict[str, GraphNode], *,
    title: str, svg_id: str = "graph-svg", width: int = 960, height: int = 660,
) -> str:
    """One <svg> holding a hidden <g class="snap" data-year> per year; the viewer shows one."""
    groups = "".join(
        f'<g class="snap" data-year="{year}" display="none">{graph_body(s, pos, nodes)}</g>'
        for year, s in sorted(snaps.items())
    )
    return (
        f'<svg id="{svg_id}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" '
        f'height="{height}" role="img" aria-labelledby="gt gd"><title id="gt">{escape(title)}</title>'
        f'<desc id="gd">Evidence graph that changes with the selected year. Solid links cite evidence; dashed links are hypotheses.</desc>'
        f'<rect width="{width}" height="{height}" fill="#ffffff"/>' + _defs()
        + _t(title, 16, 24, size=15, anchor="start", weight="700")
        + f'<text class="year-label" x="{width - 16}" y="24" font-size="15" text-anchor="end" font-weight="700" fill="{INK}" {FONT}></text>'
        + groups + legend(width, height - 40) + "</svg>"
    )


# ── Timeline ─────────────────────────────────────────────────────────────────

def timeline_svg(
    claims: list[EvidenceClaim], pubs: dict[str, Publication], *,
    cutoff: int | None = None, title: str = "Evidence by year", width: int = 960, height: int = 320,
) -> str:
    counts: dict[int, dict[Direction, int]] = {}
    undated = 0
    for c in claims:
        pub = pubs.get(c.publication_id)
        if not pub or not pub.year:
            undated += 1
            continue
        counts.setdefault(pub.year, {d: 0 for d in Direction})[c.direction] += 1
    head = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
            f'role="img" aria-labelledby="tt td"><title id="tt">{escape(title)}</title>'
            f'<desc id="td">Number of evidence claims per publication year, split by whether they support, contradict '
            f'or are inconclusive about their finding.</desc><rect width="{width}" height="{height}" fill="#fff"/>' + _defs())
    if not counts:
        return head + _t("No dated evidence yet", width / 2, height / 2) + "</svg>"
    years = range(min(counts), max(counts) + 1)
    top = max(sum(c.values()) for c in counts.values())
    left, right, base, ceiling = 50, 20, height - 70, 50
    slot = (width - left - right) / len(years)
    bar_w = min(46.0, slot * 0.7)
    out = [head, _t(title, 16, 24, size=15, anchor="start", weight="700")]
    for i, year in enumerate(years):
        x = left + i * slot + (slot - bar_w) / 2
        dim = ' opacity="0.25"' if cutoff is not None and year > cutoff else ""
        y = base
        stack = counts.get(year)
        out.append(f'<g class="year" data-year="{year}"{dim}>')
        if stack:
            for direction, fill in ((Direction.SUPPORTS, GREEN), (Direction.INCONCLUSIVE, "#9ca3af"),
                                    (Direction.CONTRADICTS, "url(#hatch)")):
                n = stack[direction]
                if not n:
                    continue
                h = (base - ceiling) * n / top
                y -= h
                out.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" height="{h:.1f}" fill="{fill}" stroke="#fff">'
                           f'<title>{year}: {n} {direction.value}</title></rect>')
                if h >= 14:
                    out.append(_t(str(n), x + bar_w / 2, y + h / 2 + 4, size=11, fill="#fff", weight="700"))
        out.append(_t(str(year), x + bar_w / 2, base + 16, size=11) + "</g>")
    out.append(f'<line x1="{left}" y1="{base}" x2="{width - right}" y2="{base}" stroke="{INK}"/>')
    for fill, text, x in ((GREEN, "supports", 20), ("#9ca3af", "inconclusive", 120), ("url(#hatch)", "contradicts", 240)):
        out.append(f'<rect x="{x}" y="{height - 34}" width="14" height="14" fill="{fill}"/>' + _t(text, x + 20, height - 23, size=11, anchor="start"))
    note = f"  ({undated} claim(s) without a year not shown)" if undated else ""
    out.append(_t("Bars show claims per publication year." + note, 350, height - 23, size=11, anchor="start", fill=GREY))
    out.append("</svg>")
    return "".join(out)


# ── Evidence for/against matrix ──────────────────────────────────────────────

def matrix_svg(
    snap: Snapshot, nodes: dict[str, GraphNode], claims: dict[str, EvidenceClaim],
    pubs: dict[str, Publication], *, title: str = "Evidence for / against", max_rows: int = 25, max_cols: int = 18,
) -> str:
    rows = [e for e in snap.edges if not e.inferred][:max_rows]
    pub_ids = sorted({claims[c].publication_id for e in rows for c, _ in e.evidence},
                     key=lambda p: (pubs[p].year or 0, pubs[p].title))[:max_cols]
    cell, label_w, top = 34, 280, 120
    width = label_w + cell * max(len(pub_ids), 1) + 30
    height = top + cell * max(len(rows), 1) + 60
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
           f'role="img" aria-labelledby="mt md"><title id="mt">{escape(title)}</title>'
           f'<desc id="md">Rows are links between entities; columns are papers; each cell shows whether that paper '
           f'supports (S), contradicts (C) or is inconclusive (?) about the link.</desc>'
           f'<rect width="{width}" height="{height}" fill="#fff"/>', _t(title, 16, 24, size=15, anchor="start", weight="700")]
    for j, pid in enumerate(pub_ids):
        x = label_w + j * cell + cell / 2
        out.append(f'<text transform="translate({x:.0f},{top - 8}) rotate(-55)" font-size="10" fill="{INK}" {FONT}>'
                   f'{escape(_short(f"{pubs[pid].year or "n.d."} {pubs[pid].title}", 34))}</text>')
    glyph = {Direction.SUPPORTS: ("S", GREEN), Direction.CONTRADICTS: ("C", VERMILION), Direction.INCONCLUSIVE: ("?", "#9ca3af")}
    for i, e in enumerate(rows):
        y = top + i * cell
        name = f"{nodes[e.source].canonical_name} → {nodes[e.target].canonical_name}"
        out.append(_t(_short(name, 42), label_w - 8, y + cell / 2 + 4, size=11, anchor="end"))
        for j, pid in enumerate(pub_ids):
            hits = [claims[c] for c, _ in e.evidence if claims[c].publication_id == pid]
            x = label_w + j * cell
            out.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" fill="#fff" stroke="#e5e7eb"/>')
            if hits:
                letter, color = glyph[hits[0].direction]
                ids = ",".join(h.id for h in hits)
                out.append(f'<g data-claims={quoteattr(ids)}><title>{escape(pubs[pid].title)}: {hits[0].direction.value}</title>'
                           f'<rect x="{x + 3}" y="{y + 3}" width="{cell - 6}" height="{cell - 6}" rx="4" fill="{color}"/>'
                           + _t(letter, x + cell / 2, y + cell / 2 + 5, size=13, fill="#fff", weight="700") + "</g>")
    ly = height - 28
    for x, (letter, color), text in ((16, glyph[Direction.SUPPORTS], "supports"), (110, glyph[Direction.CONTRADICTS], "contradicts"),
                                      (225, glyph[Direction.INCONCLUSIVE], "inconclusive")):
        out.append(f'<rect x="{x}" y="{ly - 12}" width="16" height="16" rx="3" fill="{color}"/>'
                   + _t(letter, x + 8, ly + 1, size=11, fill="#fff", weight="700") + _t(text, x + 22, ly + 1, size=11, anchor="start"))
    out.append("</svg>")
    return "".join(out)
