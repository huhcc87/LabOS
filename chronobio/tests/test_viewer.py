import base64
import hashlib
import io
import json
import re

from PIL import Image
from world import PROV, make_world

from chronobio.graph import suggest_inferred_edges
from chronobio.models import GraphEdge, Locator, Publication
from chronobio.viewer import build_viewer, render_highlight


def embedded_data(html: str) -> dict:
    match = re.search(r"const DATA = (.*?);\nconst \$ =", html, re.S)
    return json.loads(match.group(1))


def build(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    for e in suggest_inferred_edges(w.edges):
        w.store.save(e)
    result = build_viewer(w.store, w.settings, tmp_path / "out")
    return w, result, result.html_path.read_text()


def test_viewer_builds_html_and_static_svgs(tmp_path, paper_pdf):
    w, result, html = build(tmp_path, paper_pdf)
    assert result.years == (2012, 2021) and result.edges >= 4
    assert {p.name for p in result.svg_paths} == {"graph.svg", "timeline.svg", "matrix.svg"}
    assert all(p.read_text().startswith("<svg") for p in result.svg_paths)
    # one hidden graph snapshot per year, so the slider needs no server
    assert len(re.findall(r'<g class="snap" data-year="\d{4}"', html)) == 10


def test_page_image_is_the_real_pdf_page_with_the_passage_highlighted(tmp_path, paper_pdf):
    w, result, html = build(tmp_path, paper_pdf)
    data = embedded_data(html)
    pdf_claim = next(c for c in data["claims"].values() if c["locator"] == Locator.PDF_EXACT.value)
    assert pdf_claim["page"] == 1 and pdf_claim["image"].startswith("data:image/jpeg;base64,")
    img = Image.open(io.BytesIO(base64.b64decode(pdf_claim["image"].split(",", 1)[1]))).convert("RGB")
    assert img.width > 500
    # highlight = yellow/orange pixels drawn over the text region
    px = img.tobytes()
    yellowish = sum(1 for i in range(0, len(px), 3) if px[i] > 240 and px[i + 1] > 200 and px[i + 2] < 120)
    assert yellowish > 200
    # claims without a PDF page get no image and say why
    text_only = [c for c in data["claims"].values() if c["locator"] == Locator.TEXT_ONLY.value]
    assert text_only and all(c["image"] is None for c in text_only)


def test_missing_pdf_falls_back_to_text_instead_of_failing(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    paper_pdf.unlink()
    result = build_viewer(w.store, w.settings, tmp_path / "out")
    assert result.page_images == 0 and result.html_path.exists()
    assert render_highlight(tmp_path / "gone.pdf", 1, [(0, 0, 10, 10)]) is None


def test_edge_payload_carries_evidence_and_hypotheses_have_none(tmp_path, paper_pdf):
    w, _, html = build(tmp_path, paper_pdf)
    edges = embedded_data(html)["edges"]
    kras_mapk = next(e for e in edges.values() if (e["source"], e["target"]) == ("KRAS", "MAPK pathway"))
    assert {i["relation"] for i in kras_mapk["items"]} == {"activates", "inhibits"}
    hyp = [e for e in edges.values() if e["inferred"]]
    assert hyp and all(e["items"] == [] for e in hyp)
    assert all(c in embedded_data(html)["claims"] for e in edges.values() for c in (i["claim"] for i in e["items"]))


def test_csp_only_allows_the_pages_own_script(tmp_path, paper_pdf):
    _, _, html = build(tmp_path, paper_pdf)
    csp = re.search(r'Content-Security-Policy" content="([^"]+)"', html).group(1)
    script = re.search(r"<script>(.*?)</script>", html, re.S).group(1)
    digest = base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
    assert f"script-src 'sha256-{digest}'" in csp
    assert "default-src 'none'" in csp and "connect-src" not in csp.replace("default-src 'none'", "")
    assert len(re.findall(r"<script", html)) == 1                    # no other scripts


def test_hostile_titles_and_quotes_cannot_break_out_of_the_page(tmp_path, paper_pdf):
    w = make_world(tmp_path, paper_pdf)
    evil = Publication(title="</script><script>alert(1)</script>", year=2019, provenance=PROV)
    w.store.save(evil)
    victim = next(iter(w.claims.values()))
    w.store.save(victim.revise(publication_id=evil.id, claim='"><img src=x onerror=alert(1)>'))
    html = build_viewer(w.store, w.settings, tmp_path / "out", title="</title><script>alert(2)</script>").html_path.read_text()
    assert html.count("<script") == 1 and html.count("</script>") == 1          # only the page's own script
    assert "<img src=x" not in html
    assert "<title>&lt;/title&gt;&lt;script&gt;alert(2)" in html                # shown as text, not markup
    data = embedded_data(html)                                       # still valid JSON after escaping
    assert any("onerror" in c["claim"] for c in data["claims"].values())


def test_empty_store_still_produces_a_page(tmp_path):
    from chronobio.config import Settings
    from chronobio.store import Store
    settings = Settings(data_dir=tmp_path / "d")
    result = build_viewer(Store(settings.db_path), settings, tmp_path / "out")
    assert result.years is None and "No dated evidence" in result.html_path.read_text()
