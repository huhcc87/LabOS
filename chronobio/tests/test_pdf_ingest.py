from chronobio.pdf_ingest import (
    contains_verbatim, document_from_json, document_to_json, locate, read_pdf,
)

PASSAGE = "metformin use was associated with fewer recurrent polyps (hazard ratio 0.62, 95% CI 0.45-0.85)"


def test_locates_passage_with_page_offsets_and_line_boxes(paper_pdf):
    doc = read_pdf(paper_pdf)
    loc = locate(doc, PASSAGE)
    assert loc is not None and loc.page == 1
    assert doc.pages[0].text[loc.char_start:loc.char_end] == PASSAGE
    # The sentence wraps across two printed lines -> two highlight rectangles.
    assert len(loc.boxes) == 2
    page = doc.pages[0]
    for x0, top, x1, bottom in loc.boxes:
        assert 0 <= x0 < x1 <= page.width and 0 <= top < bottom <= page.height
    # Line 1 starts mid-line (after "In a cohort of 1,200 adults,"); line 2 starts at the margin.
    assert loc.boxes[0][0] > 150
    assert abs(loc.boxes[1][0] - 72) < 2
    assert loc.boxes[0][1] < loc.boxes[1][1]    # first line sits above the second


def test_finds_passage_on_the_second_page(paper_pdf):
    loc = locate(read_pdf(paper_pdf), "residual confounding could not be excluded")
    assert loc is not None and loc.page == 2


def test_whitespace_differences_are_tolerated_but_paraphrase_is_not(paper_pdf):
    doc = read_pdf(paper_pdf)
    assert locate(doc, "  residual   confounding\ncould not be excluded ") is not None
    assert locate(doc, "confounding cannot be ruled out") is None
    assert locate(doc, "") is None


def test_case_is_ignored_and_source_text_is_returned(paper_pdf):
    loc = locate(read_pdf(paper_pdf), "RESIDUAL Confounding could not be excluded")
    assert loc is not None and loc.text == "residual confounding could not be excluded"


def test_scanned_pdf_has_no_text(scanned_pdf):
    assert read_pdf(scanned_pdf).has_text is False


def test_geometry_survives_json_roundtrip(paper_pdf):
    doc = read_pdf(paper_pdf)
    assert document_from_json(document_to_json(doc)) == doc


def test_contains_verbatim():
    assert contains_verbatim("a  b\nc", "a b c")
    assert not contains_verbatim("a b c", "a c")
