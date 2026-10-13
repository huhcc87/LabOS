"""Editable SVG figures: evidence graph, year-by-year timeline, for/against matrix.

Every figure carries a legend, accessible titles, and `data-*` attributes that
map each drawn element back to claim ids. Established links are solid;
hypothesized links are dashed and labelled; contested links use a distinct
colour AND dash pattern so meaning never depends on colour alone.
(Colours follow the Okabe-Ito colour-blind-safe palette.)
"""

from __future__ import annotations

import math
import re
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


def _wrap(text: str, width: int, max_lines: int) -> list[str]:
    """Break text into at most `max_lines` lines on word boundaries; the last line is shortened with an ellipsis."""
    lines, current = [], ""
    for word in text.split():
        if current and len(current) + 1 + len(word) > width:
            lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()
    lines.append(current)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = _short(lines[-1] + "…", width)
    return lines


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


LEGEND_ITEMS = [
    (GREEN, "", "arrow-pos", "activates (evidence)"),
    (VERMILION, "", "tbar", "inhibits (evidence)"),
    (GREY, "", "", "associated / no effect"),
    (PURPLE, "2 3 9 3", "arrow-con", "contested (conflicting evidence)"),
    (BLUE, "7 5", "arrow-hyp", "hypothesis — NOT established"),
]
LEGEND_NODE_KINDS = (NodeType.GENE, NodeType.PATHWAY, NodeType.DISEASE, NodeType.INTERVENTION,
                     NodeType.MEASUREMENT, NodeType.CONCEPT)
LEGEND_ROW = 22


def _flow(widths: list[float], limit: float) -> tuple[list[tuple[float, int]], int]:
    """Lay items left to right, starting a new row whenever the next would pass `limit`."""
    placed, x, row = [], 20.0, 0
    for w in widths:
        if x + w > limit and x > 20:
            x, row = 20.0, row + 1
        placed.append((x, row))
        x += w
    return placed, row + 1


def _legend_layout(width: float, with_nodes: bool):
    edge_pos, edge_rows = _flow([48 + 6.2 * len(i[3]) for i in LEGEND_ITEMS], width - 24)
    node_pos, node_rows = _flow([36 + 6.5 * len(k.value) for k in LEGEND_NODE_KINDS], width - 24) if with_nodes else ([], 0)
    return edge_pos, edge_rows, node_pos, node_rows


def legend_height(width: float, *, with_nodes: bool = True) -> int:
    """Vertical space a figure of this width must reserve under its drawing for the legend."""
    _, edge_rows, _, node_rows = _legend_layout(width, with_nodes)
    return (edge_rows + node_rows) * LEGEND_ROW + 20


def legend(width: float, bottom: float, *, with_nodes: bool = True) -> str:
    """Legend that wraps into rows and sits at the bottom edge of the figure (never clipped)."""
    edge_pos, edge_rows, node_pos, node_rows = _legend_layout(width, with_nodes)
    rows = edge_rows + node_rows
    top = bottom - (rows * LEGEND_ROW + 12)
    out = [f'<g class="legend" role="group" aria-label="Legend"><rect x="8" y="{top:.0f}" width="{width - 16:.0f}" '
           f'height="{rows * LEGEND_ROW + 8}" rx="6" fill="#ffffff" stroke="#d1d5db"/>']
    for (color, dash, marker, text), (px, r) in zip(LEGEND_ITEMS, edge_pos):
        y = top + 20 + r * LEGEND_ROW
        out.append(f'<line x1="{px:.0f}" y1="{y - 4:.0f}" x2="{px + 34:.0f}" y2="{y - 4:.0f}" stroke="{color}" stroke-width="2.4"'
                   + (f' stroke-dasharray="{dash}"' if dash else "")
                   + (f' marker-end="url(#{marker})"' if marker else "") + "/>")
        out.append(_t(text, px + 40, y, size=11, anchor="start"))
    for kind, (px, r) in zip(LEGEND_NODE_KINDS, node_pos):
        y = top + 20 + (edge_rows + r) * LEGEND_ROW
        out.append(f'<circle cx="{px + 6:.0f}" cy="{y - 4:.0f}" r="6" fill="{NODE_FILL[kind]}" stroke="{INK}"/>')
        out.append(_t(kind.value, px + 17, y, size=11, anchor="start"))
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
        + graph_body(snap, pos, nodes) + legend(width, height) + "</svg>"
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
        + groups + legend(width, height) + "</svg>"
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


# ── Hypothesis figures ───────────────────────────────────────────────────────

LEVEL_TINT = {"high": "#c9ecd9", "medium": "#fdf1b8", "low": "#f8d3c0", "not_assessed": "#e5e7eb"}
STATUS_TINT = {"evidence_supported": "#c9ecd9", "proposed": "#e5e7eb", "contradicted": "#f8d3c0"}
VERDICT_TINT = {"accept": "#c9ecd9", "revise": "#fdf1b8", "reject": "#f8d3c0"}


def _pretty(value: str) -> str:
    return value.replace("_", " ")


def hypothesis_matrix_svg(records: list[dict], *, title: str = "Hypothesis comparison") -> str:
    """Hypotheses side by side. Each cell has a text label, so colour is never the only signal."""
    columns = ["status", "critic", "evidence", "falsifiability", "originality", "prior-work search", "validation"]
    label_w, cell_w, row_h, top = 330, 118, 40, 74
    width = label_w + cell_w * len(columns) + 20
    height = top + row_h * max(len(records), 1) + 70
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
           f'role="img" aria-labelledby="hmt hmd"><title id="hmt">{escape(title)}</title>'
           f'<desc id="hmd">One row per hypothesis. Columns show review status, critic verdict, and separately rated '
           f'evidence strength, falsifiability and originality, the prior-work search result, and validation status. '
           f'There is no combined score.</desc><rect width="{width}" height="{height}" fill="#fff"/>',
           _t(title, 16, 26, size=15, anchor="start", weight="700")]
    for j, name in enumerate(columns):
        out.append(_t(name, label_w + j * cell_w + cell_w / 2, top - 12, size=11, weight="600"))
    if not records:
        out.append(_t("No hypotheses yet", width / 2, top + 30))
    for i, r in enumerate(records):
        y = top + i * row_h
        out.append(f'<g data-hypothesis={quoteattr(r["id"])}><title>{escape(r["statement"])}</title>'
                   + _t(f"{i + 1}. " + _short(r["statement"], 52), label_w - 8, y + row_h / 2 + 4, size=11, anchor="end") + "</g>")
        rank = r.get("ranking") or {}
        verdict = (r.get("critic") or {}).get("verdict", "not reviewed")
        cells = [
            (_pretty(r["status"]), STATUS_TINT.get(r["status"], "#e5e7eb")),
            (verdict, VERDICT_TINT.get(verdict, "#e5e7eb")),
            *[((rank.get(k) or {}).get("level", "not_assessed").replace("_", " "),
               LEVEL_TINT[(rank.get(k) or {}).get("level", "not_assessed")]) for k in ("evidence_strength", "falsifiability", "originality")],
            (_pretty(r["novelty_status"]), "#e5e7eb"),
            (validation_label(r)[0].replace("executed: ", "").replace("planned, not run", "planned").replace("failed to run", "failed").replace("NOT PERFORMED", "not performed"), {"done": "#c9ecd9", "stop": "#f8d3c0", "open": "#fdf1b8"}.get(validation_label(r)[1], "#e5e7eb")),
        ]
        for j, (text, tint) in enumerate(cells):
            x = label_w + j * cell_w
            out.append(f'<rect x="{x + 2}" y="{y + 3}" width="{cell_w - 4}" height="{row_h - 6}" rx="5" fill="{tint}" stroke="#d1d5db"/>'
                       + _t(_short(text, 16), x + cell_w / 2, y + row_h / 2 + 4, size=11, weight="600"))
    out.append(_t("Dimensions are rated separately; none is a probability that the hypothesis is true.",
                  16, height - 24, size=11, anchor="start", fill=GREY))
    out.append("</svg>")
    return "".join(out)


def workflow_svg(record: dict, *, title: str = "From gap to experiment") -> str:
    """Pipeline for one hypothesis, showing where it stopped and what has not been done."""
    verdict = (record.get("critic") or {}).get("verdict")
    history = record.get("verdict_history") or []
    passed = verdict == "accept"
    novelty = record.get("novelty")
    stages = [
        ("Gap", (record.get("gap") or {}).get("kind", "none"), "done"),
        ("Hypothesis", f"drafted, version {record['version']}", "done"),
        ("Critic", f"{verdict or 'not reviewed'} after {len(history)} round(s)",
         "done" if passed else "stop" if verdict == "reject" else "open"),
        ("Prior-work search", _pretty(novelty["status"]) if novelty else "not run",
         "done" if novelty else "pending"),
        ("Validation", *validation_label(record)),
        ("Experiment plan", *(("plan drafted", "done") if record.get("experiment_plan") else ("not designed yet", "pending"))),
    ]
    fill = {"done": "#c9ecd9", "open": "#fdf1b8", "stop": "#f8d3c0", "pending": "#f3f4f6"}
    word = {"done": "done", "open": "unresolved", "stop": "stopped", "pending": "not reached" if not passed else "not done"}
    box_w, box_h, gap_x, top = 138, 104, 22, 70
    width = 20 + len(stages) * (box_w + gap_x)
    height = 230
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
           f'role="img" aria-labelledby="wft wfd"><title id="wft">{escape(title)}</title>'
           f'<desc id="wfd">Steps from literature gap to experiment for one hypothesis, with the state of each step.</desc>'
           f'<rect width="{width}" height="{height}" fill="#fff"/>' + _defs(),
           _t(title + ": " + _short(record["statement"], 80), 16, 26, size=14, anchor="start", weight="700")]
    for i, (name, detail, state) in enumerate(stages):
        x = 20 + i * (box_w + gap_x)
        dash = ' stroke-dasharray="6 4"' if state == "pending" else ""
        out.append(f'<g data-stage={quoteattr(name)}><title>{escape(name)}: {escape(detail)} ({word[state]})</title>'
                   f'<rect x="{x}" y="{top}" width="{box_w}" height="{box_h}" rx="8" fill="{fill[state]}" stroke="{INK}"{dash}/>'
                   + _t(name, x + box_w / 2, top + 22, size=12, weight="700")
                   + "".join(_t(line, x + box_w / 2, top + 44 + 14 * k, size=11) for k, line in enumerate(_wrap(detail, 20, 2)))
                   + _t(word[state], x + box_w / 2, top + box_h - 10, size=11, weight="600", fill=GREY) + "</g>")
        if i:
            out.append(f'<line x1="{x - gap_x + 2}" y1="{top + box_h / 2}" x2="{x - 2}" y2="{top + box_h / 2}" '
                       f'stroke="{INK}" stroke-width="1.6" marker-end="url(#arrow-grey)"/>')
    out.append(_t("Solid box = step completed; dashed box = not done. Nothing past the critic has been validated.",
                  16, height - 24, size=11, anchor="start", fill=GREY))
    out.append("</svg>")
    return "".join(out)


def scope_ids(svg: str, suffix: str) -> str:
    """Give every id in an inline SVG a unique suffix, so several figures can share one HTML page."""
    ids = re.findall(r'\bid="([^"]+)"', svg)
    for old in sorted(set(ids), key=len, reverse=True):
        svg = svg.replace(f'id="{old}"', f'id="{old}-{suffix}"').replace(f"url(#{old})", f"url(#{old}-{suffix})")

    def fix_labels(m: re.Match) -> str:
        return 'aria-labelledby="' + " ".join(f"{i}-{suffix}" if i in ids else i for i in m.group(1).split()) + '"'

    return re.sub(r'aria-labelledby="([^"]+)"', fix_labels, svg)


def validation_label(record: dict) -> tuple[str, str]:
    """(text, state) for a hypothesis's computational validation: state is done|open|stop|pending."""
    runs = record.get("validation") or []
    executed = [r for r in runs if r["status"] == "executed"]
    if executed:
        verdict = executed[-1]["verdict"]
        return f"executed: {verdict}", {"consistent": "done", "contradicted": "stop"}.get(verdict, "open")
    if any(r["status"] == "failed" for r in runs):
        return "failed to run", "stop"
    if runs:
        return "planned, not run", "pending"
    return "NOT PERFORMED", "pending"
