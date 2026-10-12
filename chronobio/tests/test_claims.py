import json

import pytest

from chronobio.claims import claim_id, extract_claims
from chronobio.config import Settings
from chronobio.llm import ScriptedLLM
from chronobio.models import Direction, Locator, Provenance, Publication
from chronobio.pdf_ingest import read_pdf

PASSAGE = "metformin use was associated with fewer recurrent polyps (hazard ratio 0.62, 95% CI 0.45-0.85)"
SETTINGS = Settings(max_context_chars=20_000)


@pytest.fixture
def pub():
    return Publication(title="Metformin study", provenance=Provenance(source="test"))


def run(pub, doc, items):
    llm = ScriptedLLM([json.dumps(items)])
    return extract_claims(llm, pub, SETTINGS, doc=doc)


def good(**overrides):
    base = {"claim": "Metformin use is associated with fewer recurrent polyps", "passage": PASSAGE,
            "direction": "supports", "design": "observational", "population": "adults", "n": 1200,
            "method": "cohort", "effect": "hazard ratio 0.62, 95% CI 0.45-0.85",
            "limitations": ["observational"]}
    return base | overrides


def test_verified_claim_gets_exact_pdf_location(paper_pdf, pub):
    res = run(pub, read_pdf(paper_pdf), [good()])
    assert len(res.claims) == 1 and not res.rejections
    c = res.claims[0]
    assert (c.locator, c.page, c.direction, c.n) == (Locator.PDF_EXACT, 1, Direction.SUPPORTS, 1200)
    assert c.highlight_boxes and c.effect.startswith("hazard ratio 0.62")
    assert c.provenance.source == "agent:claim_extractor"


def test_case_changes_are_accepted_but_the_source_wording_is_stored(paper_pdf, pub):
    res = run(pub, read_pdf(paper_pdf), [good(passage=PASSAGE.capitalize())])   # "Metformin use was …"
    assert len(res.claims) == 1
    c = res.claims[0]
    assert c.passage == PASSAGE                       # the paper's casing, not the model's
    assert c.id == claim_id(pub.id, PASSAGE)          # same id whichever casing the model used


def test_fabricated_and_paraphrased_passages_are_rejected(paper_pdf, pub):
    res = run(pub, read_pdf(paper_pdf), [
        good(passage="Metformin cured all polyps in every patient."),         # invented quote
        good(passage="metformin users had fewer polyps that came back"),      # paraphrase
    ])
    assert res.claims == []
    assert [r.reason for r in res.rejections] == ["passage_not_verbatim"] * 2


def test_numbers_not_in_source_are_dropped_but_claim_is_kept(paper_pdf, pub):
    res = run(pub, read_pdf(paper_pdf), [good(n=9999, effect="odds ratio 3.1")])
    c = res.claims[0]
    assert c.n is None and c.effect == ""
    assert {r.reason for r in res.rejections} == {
        "sample_size_not_in_source_dropped", "effect_not_in_source_dropped"}


def test_unparseable_output_and_missing_fields(paper_pdf, pub):
    doc = read_pdf(paper_pdf)
    res = extract_claims(ScriptedLLM(["Sure! Here are some claims:"]), pub, SETTINGS, doc=doc)
    assert res.claims == [] and res.rejections[0].reason == "unparseable_model_output"
    res = run(pub, doc, [good(passage=""), good(claim="")])
    assert [r.reason for r in res.rejections] == ["missing_claim_or_passage"] * 2


def test_overlong_passage_rejected(paper_pdf, pub):
    long_passage = " ".join(["metformin"] * 80)
    assert run(pub, read_pdf(paper_pdf), [good(passage=long_passage)]).rejections[0].reason in {
        "passage_too_long"}


def test_unknown_enum_values_fall_back_to_safe_defaults(paper_pdf, pub):
    c = run(pub, read_pdf(paper_pdf), [good(direction="proves", design="magic")]).claims[0]
    assert (c.direction, c.design.value) == (Direction.INCONCLUSIVE, "unknown")


def test_claim_ids_are_stable_and_duplicates_collapse(paper_pdf, pub):
    res = run(pub, read_pdf(paper_pdf), [good(), good(claim="Same passage, reworded")])
    assert len(res.claims) == 1
    assert res.claims[0].id == claim_id(pub.id, PASSAGE)


def test_passage_spanning_a_page_break_is_rejected(paper_pdf, pub):
    spanning = "The study was observational. Limitations: residual confounding"
    res = run(pub, read_pdf(paper_pdf), [good(passage=spanning)])
    assert res.claims == [] and res.rejections[0].reason == "passage_spans_pages"


def test_scanned_pdf_is_reported_not_guessed(scanned_pdf, pub):
    llm = ScriptedLLM([])
    res = extract_claims(llm, pub, SETTINGS, doc=read_pdf(scanned_pdf))
    assert res.claims == [] and res.rejections[0].reason == "no_text"
    assert llm.calls == []                       # no model call without text


def test_abstract_only_claims_are_marked_text_only():
    abstract = "Metformin reduced polyp recurrence (HR 0.62) in 1,200 adults."
    pub = Publication(title="T", abstract=abstract, provenance=Provenance(source="test"))
    llm = ScriptedLLM([json.dumps([{"claim": "Metformin reduces recurrence",
                                    "passage": "Metformin reduced polyp recurrence (HR 0.62)",
                                    "direction": "supports", "n": 1200, "effect": "HR 0.62"}])])
    c = extract_claims(llm, pub, SETTINGS).claims[0]
    assert (c.locator, c.page, c.highlight_boxes, c.n) == (Locator.TEXT_ONLY, None, [], 1200)
    assert abstract[c.char_start:c.char_end] == "Metformin reduced polyp recurrence (HR 0.62)"


def test_no_text_at_all(pub):
    assert extract_claims(ScriptedLLM([]), pub, SETTINGS).rejections[0].reason == "no_text"
