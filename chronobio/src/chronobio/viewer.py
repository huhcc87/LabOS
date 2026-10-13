"""Self-contained interactive viewer (single HTML file, no network, no libraries).

Year slider re-draws the evidence graph, timeline and matrix from precomputed
snapshots (node positions are fixed, so nothing jumps). Clicking a link shows
every evidence claim behind it with the quoted passage, citation, and — when
the source PDF is available — the real page with the passage highlighted.

Security: all paper/model text is inserted with textContent, never as HTML, and
the page ships a Content-Security-Policy that only allows its own inline script.
"""

from __future__ import annotations

import base64
import hashlib
import io
import json
from dataclasses import dataclass
from pathlib import Path
from xml.sax.saxutils import escape

import pypdfium2 as pdfium
from PIL import Image, ImageDraw

from .config import Settings
from .figures import graph_svg, graph_svg_slider, matrix_svg, timeline_svg
from .graph import load_graph, snapshot, suggest_inferred_edges, year_range
from .layout import layout
from .models import EvidenceClaim, Locator, Publication
from .store import Store

LEGEND_SPACE = 80          # room under the drawing area for the legend
MAX_PAGE_IMAGES = 60
RENDER_SCALE = 1.4
CONTEXT_PT = 90            # points of page shown above and below the highlighted passage


@dataclass(frozen=True)
class ViewerResult:
    html_path: Path
    svg_paths: list[Path]
    years: tuple[int, int] | None
    nodes: int
    edges: int
    page_images: int


def render_highlight(pdf_path: Path, page: int, boxes: list[tuple[float, float, float, float]]) -> str | None:
    """JPEG data-URI of the PDF page region around `boxes`, with the passage highlighted."""
    try:
        pdf = pdfium.PdfDocument(str(pdf_path))
        try:
            pdf_page = pdf[page - 1]
            image = pdf_page.render(scale=RENDER_SCALE).to_pil().convert("RGBA")
        finally:
            pdf.close()
    except Exception:       # missing/corrupt file: caller falls back to text only
        return None
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x0, top, x1, bottom in boxes:
        draw.rectangle([x0 * RENDER_SCALE - 2, top * RENDER_SCALE - 1, x1 * RENDER_SCALE + 2, bottom * RENDER_SCALE + 1],
                       fill=(255, 224, 0, 105), outline=(255, 150, 0, 255), width=2)
    merged = Image.alpha_composite(image, overlay).convert("RGB")
    ys = [b[1] for b in boxes] + [b[3] for b in boxes]
    y0 = max(0, int((min(ys) - CONTEXT_PT) * RENDER_SCALE))
    y1 = min(merged.height, int((max(ys) + CONTEXT_PT) * RENDER_SCALE))
    buf = io.BytesIO()
    merged.crop((0, y0, merged.width, y1)).save(buf, "JPEG", quality=72)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def _claim_payload(claim: EvidenceClaim, pubs: dict[str, Publication], years: dict[str, int | None],
                   image: str | None) -> dict:
    return {
        "claim": claim.claim, "passage": claim.passage, "direction": claim.direction.value,
        "design": claim.design.value, "n": claim.n, "effect": claim.effect, "limitations": claim.limitations,
        "origin": claim.origin.value, "page": claim.page, "locator": claim.locator.value,
        "pub": claim.publication_id, "year": years.get(claim.id), "image": image,
    }


def _pub_payload(pub: Publication) -> dict:
    pdf = None
    if pub.fulltext_location and Path(pub.fulltext_location).exists():
        pdf = Path(pub.fulltext_location).resolve().as_uri()
    return {"title": pub.title, "authors": pub.authors[:6], "etal": len(pub.authors) > 6, "year": pub.year,
            "journal": pub.journal, "doi": pub.doi, "pmid": pub.pmid,
            "retraction": pub.retraction_status.value, "pdf": pdf}


def build_viewer(store: Store, settings: Settings, out_dir: Path | None = None,
                 *, title: str = "ChronoBio evidence graph") -> ViewerResult:
    out_dir = out_dir or settings.data_dir / "figures"
    out_dir.mkdir(parents=True, exist_ok=True)

    pubs = {p.id: p for p in store.list(Publication)}
    claims = {c.id: c for c in store.list(EvidenceClaim)}
    nodes_list, raw_edges = load_graph(store)
    edges = raw_edges + suggest_inferred_edges(raw_edges)
    nodes = {n.id: n for n in nodes_list}
    years = {cid: pubs[c.publication_id].year if c.publication_id in pubs else None for cid, c in claims.items()}
    span = year_range(pubs)

    full = snapshot(nodes_list, edges, claims, pubs, None)
    placed = layout([n.id for n in full.nodes], [(e.source, e.target) for e in full.edges])
    pos, fig_w, fig_h = placed.pos, placed.width, placed.height + LEGEND_SPACE
    snaps = {y: snapshot(nodes_list, edges, claims, pubs, y) for y in range(span[0], span[1] + 1)} if span else {}

    # Real PDF pages with the passage highlighted, only for claims actually drawn.
    images: dict[str, str] = {}
    for cid in sorted(full.claim_ids):
        claim, pub = claims[cid], pubs.get(claims[cid].publication_id)
        if (len(images) < MAX_PAGE_IMAGES and claim.locator == Locator.PDF_EXACT and claim.page
                and pub and pub.fulltext_location and Path(pub.fulltext_location).exists()):
            if img := render_highlight(Path(pub.fulltext_location), claim.page, claim.highlight_boxes):
                images[cid] = img

    edge_data: dict[str, dict] = {}
    for snap in [full, *snaps.values()]:
        for e in snap.edges:
            edge_data.setdefault(e.key, {
                "source": nodes[e.source].canonical_name, "target": nodes[e.target].canonical_name,
                "inferred": e.inferred, "items": [{"claim": c, "relation": r} for c, r in e.evidence]})
    data = {
        "span": list(span) if span else None, "undated": full.excluded_undated,
        "claims": {cid: _claim_payload(claims[cid], pubs, years, images.get(cid)) for cid in full.claim_ids},
        "pubs": {pid: _pub_payload(pubs[pid]) for pid in {claims[c].publication_id for c in full.claim_ids} if pid in pubs},
        "edges": edge_data,
    }

    size = dict(width=fig_w, height=fig_h)
    graph = (graph_svg_slider(snaps, pos, nodes, title=title, **size) if snaps
             else graph_svg(full, pos, nodes, title=title, **size))
    timeline = timeline_svg(list(claims.values()), pubs)
    matrices = "".join(
        f'<div class="snap" data-year="{y}" hidden>{matrix_svg(s, nodes, claims, pubs)}</div>' for y, s in sorted(snaps.items()))

    svg_paths = []
    if snaps:
        last = max(snaps)
        for name, svg in (("graph.svg", graph_svg(snaps[last], pos, nodes, title=title, **size)),
                          ("timeline.svg", timeline), ("matrix.svg", matrix_svg(snaps[last], nodes, claims, pubs))):
            (out_dir / name).write_text(svg)
            svg_paths.append(out_dir / name)

    html = _render_html(title, graph, timeline, matrices, data)
    path = out_dir / "viewer.html"
    path.write_text(html)
    return ViewerResult(path, svg_paths, span, len(full.nodes), len(full.edges), len(images))


def _json_for_script(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def _render_html(title: str, graph: str, timeline: str, matrices: str, data: dict) -> str:
    script = _SCRIPT.replace("__DATA__", _json_for_script(data))
    digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
    csp = (f"default-src 'none'; script-src 'sha256-{digest}'; style-src 'unsafe-inline'; "
           f"img-src data:; base-uri 'none'; form-action 'none'")
    return (_TEMPLATE.replace("__CSP__", csp).replace("__TITLE__", escape(title)).replace("__GRAPH__", graph)
            .replace("__TIMELINE__", timeline).replace("__MATRICES__", matrices or "")
            .replace("__SCRIPT__", script))


_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="__CSP__">
<title>__TITLE__</title>
<style>
:root { --bg:#f8fafc; --card:#fff; --ink:#1f2937; --muted:#6b7280; --line:#d1d5db; --accent:#0072B2; --warn:#b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg:#0f172a; --card:#1e293b; --ink:#e5e7eb; --muted:#9ca3af; --line:#334155; --accent:#56B4E9; --warn:#f87171; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif; }
header { padding:14px 20px 8px; }
h1 { margin:0 0 2px; font-size:20px; }
.sub { color:var(--muted); margin:0; font-size:13px; }
.bar { display:flex; flex-wrap:wrap; gap:14px; align-items:center; padding:8px 20px 12px; }
.bar label { font-weight:600; }
input[type=range] { width:min(380px, 60vw); accent-color:var(--accent); }
button { font:inherit; padding:6px 12px; border:1px solid var(--line); background:var(--card); color:var(--ink); border-radius:8px; cursor:pointer; }
button:hover, button:focus-visible { border-color:var(--accent); outline:2px solid color-mix(in srgb, var(--accent) 30%, transparent); }
.tabs { display:flex; gap:6px; padding:0 20px; }
.tabs button[aria-selected=true] { background:var(--accent); color:#fff; border-color:var(--accent); }
.layout { display:grid; grid-template-columns:minmax(0,1fr) 400px; gap:16px; padding:12px 20px 28px; align-items:start; }
@media (max-width: 1000px) { .layout { grid-template-columns:1fr; } }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:10px; overflow:auto; }
.card svg { max-width:100%; height:auto; display:block; background:#fff; border-radius:8px; }
.edge { cursor:pointer; } .edge:hover path:not(.hit), .edge:focus-visible path:not(.hit), .edge.sel path:not(.hit) { filter:drop-shadow(0 0 3px #000); }
.edge:focus-visible { outline:none; }
aside h2 { margin:0 0 6px; font-size:16px; }
.hint { color:var(--muted); }
.claim { border:1px solid var(--line); border-radius:10px; padding:10px; margin:10px 0; }
.claim blockquote { margin:6px 0; padding:6px 10px; border-left:4px solid #E69F00; background:color-mix(in srgb, #E69F00 12%, transparent); }
.badge { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; font-weight:700; border:1px solid var(--line); margin-right:6px; }
.meta { color:var(--muted); font-size:12px; margin:2px 0; }
.warn { color:var(--warn); font-weight:700; }
.claim img { width:100%; border:1px solid var(--line); border-radius:6px; margin-top:6px; }
a { color:var(--accent); }
.sr { position:absolute; left:-9999px; }
</style>
</head>
<body>
<header>
  <h1>__TITLE__</h1>
  <p class="sub">Move the slider to see what the literature supported at that time. Click a link to read the evidence behind it. Dashed links are hypotheses, not findings.</p>
</header>
<div class="bar">
  <label for="year">Evidence up to <output id="year-out"></output></label>
  <input type="range" id="year" min="0" max="0" step="1" aria-describedby="undated">
  <label><input type="checkbox" id="hyp" checked> show hypothesized links</label>
  <button id="dl-svg" type="button">Download SVG</button>
  <button id="dl-png" type="button">Download PNG</button>
  <span class="hint" id="undated"></span>
</div>
<div class="tabs" role="tablist" aria-label="Figures">
  <button role="tab" id="tab-graph" aria-selected="true" aria-controls="view-graph">Evidence graph</button>
  <button role="tab" id="tab-timeline" aria-selected="false" aria-controls="view-timeline">Timeline</button>
  <button role="tab" id="tab-matrix" aria-selected="false" aria-controls="view-matrix">For / against matrix</button>
</div>
<div class="layout">
  <section>
    <div class="card" id="view-graph" role="tabpanel" aria-labelledby="tab-graph">__GRAPH__</div>
    <div class="card" id="view-timeline" role="tabpanel" aria-labelledby="tab-timeline" hidden>__TIMELINE__</div>
    <div class="card" id="view-matrix" role="tabpanel" aria-labelledby="tab-matrix" hidden>__MATRICES__</div>
  </section>
  <aside class="card" aria-live="polite">
    <h2 id="panel-title">Evidence</h2>
    <div id="panel"><p class="hint">Select a link in the graph to see its source passages.</p></div>
  </aside>
</div>
<script>__SCRIPT__</script>
</body>
</html>
"""

_SCRIPT = r"""
const DATA = __DATA__;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const slider = $('#year'), out = $('#year-out');
const span = DATA.span || [0, 0];
let year = span[1], selected = null;

function el(tag, text, cls) { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; }

function showYear(y) {
  year = y; out.textContent = y || 'n/a'; slider.value = y;
  $$('.snap').forEach(g => {
    const on = Number(g.dataset.year) === y;
    g.tagName.toLowerCase() === 'g' ? g.setAttribute('display', on ? 'inline' : 'none') : (g.hidden = !on);
  });
  const lbl = $('.year-label'); if (lbl) lbl.textContent = 'Evidence up to ' + y;
  $$('#view-timeline .year').forEach(g => g.setAttribute('opacity', Number(g.dataset.year) > y ? '0.25' : '1'));
  applyHyp(); if (selected) showEdge(selected, true);
}
function applyHyp() { const show = $('#hyp').checked; $$('.edge.inferred').forEach(e => e.style.display = show ? '' : 'none'); }

function safeLink(text, href, prefix) {
  const a = el('a', text); if (href.startsWith(prefix)) { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; } return a;
}
function claimCard(item) {
  const c = DATA.claims[item.claim], p = DATA.pubs[c.pub] || {};
  const card = el('div', null, 'claim');
  const head = el('div'); head.append(el('span', item.relation, 'badge'), el('span', c.direction, 'badge'));
  if (p.retraction === 'retracted') head.append(el('span', 'RETRACTED SOURCE', 'badge warn'));
  card.append(head, el('div', c.claim));
  const q = el('blockquote', '“' + c.passage + '”'); card.append(q);
  const bits = [c.design !== 'unknown' ? c.design : null, c.n != null ? 'n = ' + c.n : null, c.effect || null].filter(Boolean);
  if (bits.length) card.append(el('div', bits.join(' · '), 'meta'));
  if (c.limitations.length) card.append(el('div', 'Limitations: ' + c.limitations.join('; '), 'meta'));
  const cite = el('div', null, 'meta');
  cite.append(document.createTextNode((p.authors || []).join(', ') + (p.etal ? ' et al.' : '') + (p.authors && p.authors.length ? '. ' : '')
    + (p.title || 'Unknown source') + '. ' + (p.journal ? p.journal + ' ' : '') + (p.year || 'n.d.') + '. '));
  if (p.doi && p.doi.startsWith('10.')) cite.append(safeLink('DOI', 'https://doi.org/' + p.doi, 'https://doi.org/'), document.createTextNode(' '));
  if (p.pmid && /^\d+$/.test(p.pmid)) cite.append(safeLink('PubMed', 'https://pubmed.ncbi.nlm.nih.gov/' + p.pmid + '/', 'https://pubmed.ncbi.nlm.nih.gov/'), document.createTextNode(' '));
  if (p.pdf && c.page) cite.append(safeLink('Open PDF page ' + c.page, p.pdf + '#page=' + c.page, 'file://'));
  card.append(cite);
  if (c.image) { const img = el('img'); img.src = c.image; img.alt = 'PDF page ' + c.page + ' with the supporting passage highlighted'; card.append(img, el('div', 'Page ' + c.page + ' of the PDF; yellow marks the supporting passage.', 'meta')); }
  else card.append(el('div', c.locator === 'pdf_exact' ? 'Source PDF not found on this computer, so the page cannot be shown.' : 'Exact PDF location unavailable: this claim comes from abstract text, not a PDF page.', 'meta'));
  return card;
}
function showEdge(key, keep) {
  selected = key;
  $$('.edge').forEach(e => e.classList.toggle('sel', e.dataset.edge === key));
  const data = DATA.edges[key], panel = $('#panel'); panel.replaceChildren();
  $('#panel-title').textContent = data ? data.source + ' → ' + data.target : 'Evidence';
  if (!data) return;
  if (data.inferred) { panel.append(el('p', 'Hypothesis: no paper directly reports this link. It is suggested only because the two shorter links around it are reported.', 'warn')); return; }
  const items = data.items.filter(i => { const y = DATA.claims[i.claim].year; return y != null && y <= year; });
  panel.append(el('p', items.length + ' claim(s) published up to ' + year + (items.length < data.items.length ? ' (' + (data.items.length - items.length) + ' later one(s) hidden)' : ''), 'hint'));
  items.sort((a, b) => DATA.claims[a.claim].year - DATA.claims[b.claim].year).forEach(i => panel.append(claimCard(i)));
}
function svgBlob(clone) {
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' });
}
function currentSvg() {
  const live = $('#view-graph svg'), clone = live.cloneNode(true);
  $$('.snap', clone).forEach(g => { if (Number(g.dataset.year) !== year) g.remove(); else g.setAttribute('display', 'inline'); });
  $$('.edge.sel', clone).forEach(e => e.classList.remove('sel'));
  return clone;
}
function download(blob, name) { const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
$('#dl-svg').onclick = () => download(svgBlob(currentSvg()), 'chronobio-graph-' + year + '.svg');
$('#dl-png').onclick = () => {
  const svg = currentSvg(), vb = svg.viewBox.baseVal, scale = 3, img = new Image();
  img.onload = () => {
    const c = el('canvas'); c.width = vb.width * scale; c.height = vb.height * scale;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(b => download(b, 'chronobio-graph-' + year + '.png'), 'image/png');
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
};
document.addEventListener('click', e => { const g = e.target.closest && e.target.closest('.edge'); if (g) showEdge(g.dataset.edge); });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('edge')) { e.preventDefault(); showEdge(e.target.dataset.edge); } });
slider.addEventListener('input', () => showYear(Number(slider.value)));
$('#hyp').addEventListener('change', applyHyp);
['graph', 'timeline', 'matrix'].forEach(name => $('#tab-' + name).addEventListener('click', () => {
  ['graph', 'timeline', 'matrix'].forEach(n => { $('#view-' + n).hidden = n !== name; $('#tab-' + n).setAttribute('aria-selected', String(n === name)); });
  $('#dl-svg').disabled = $('#dl-png').disabled = name !== 'graph';
}));
slider.min = span[0]; slider.max = span[1];
$('#undated').textContent = DATA.undated ? DATA.undated + ' claim(s) have no publication year and are not on the timeline.' : '';
if (DATA.span) showYear(span[1]); else $('#panel').replaceChildren(el('p', 'No dated evidence yet. Add papers with a publication year.', 'hint'));
"""
