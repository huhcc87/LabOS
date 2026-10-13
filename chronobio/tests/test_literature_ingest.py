import httpx
import pytest

from chronobio.config import Settings
from chronobio.ingest import find_existing, ingest_pdf, load_document
from chronobio.literature import (
    LiteratureClient, NetworkDisabled, dedupe, normalize_doi,
)
from chronobio.models import Provenance, Publication, RetractionStatus
from chronobio.store import Store

PROV = Provenance(source="test")


def client(handler, *, network=True) -> LiteratureClient:
    return LiteratureClient(Settings(allow_network_literature=network),
                            httpx.Client(transport=httpx.MockTransport(handler)))


def test_doi_normalization_and_dedupe_prefers_richer_record():
    assert normalize_doi("https://doi.org/10.1/ABC") == "10.1/abc"
    assert normalize_doi("doi: 10.1/ABC") == "10.1/abc"
    thin = Publication(title="Paper", doi="10.1/abc", provenance=PROV)
    rich = Publication(title="Paper", doi="DOI:10.1/ABC", pmid="123", year=2020, abstract="x", provenance=PROV)
    other = Publication(title="Different", pmid="999", provenance=PROV)
    out = dedupe([thin, rich, other])
    assert len(out) == 2 and rich in out and thin not in out


def test_network_off_by_default():
    with pytest.raises(NetworkDisabled):
        client(lambda r: httpx.Response(200, json={}), network=False).search_europepmc("kras")


def test_europepmc_search_maps_results_and_logs_the_query():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["query"] = request.url.params["query"]
        return httpx.Response(200, json={"hitCount": 120, "resultList": {"result": [
            {"title": "KRAS inhibition in tumors.", "authorString": "Lee A, Chen B.", "pubYear": "2021",
             "journalTitle": "Cancer Res", "doi": "10.1/X1", "pmid": "111",
             "abstractText": "<h4>Background</h4> KRAS matters.",
             "pubTypeList": {"pubType": ["Journal Article"]}},
            {"title": "KRAS inhibition in tumors", "pubYear": "2021", "doi": "https://doi.org/10.1/x1"},
            {"pubYear": "2020"},                                  # no title -> skipped
        ]}})

    pubs, log = client(handler).search_europepmc("KRAS", year_from=2019, year_to=2022, limit=25)
    assert "PUB_YEAR:[2019 TO 2022]" in seen["query"]
    assert len(pubs) == 1                                         # duplicate DOI collapsed
    p = pubs[0]
    assert (p.title, p.year, p.doi, p.authors) == ("KRAS inhibition in tumors", 2021, "10.1/x1", ["Lee A", "Chen B"])
    assert p.abstract == "Background KRAS matters."
    assert (log.source, log.result_count, log.returned_count, log.date_from, log.date_to) == (
        "europepmc", 120, 1, 2019, 2022)
    assert "first page of results only" in log.limitations        # coverage is disclosed


def test_crossref_retraction_signals():
    def handler(request):
        updates = {"10.1/retracted": [{"type": "correction"}, {"type": "retraction"}],
                   "10.1/fixed": [{"type": "correction"}], "10.1/clean": []}
        key = request.url.path.removeprefix("/works/")
        return httpx.Response(200, json={"message": {"updated-by": updates[key]}})

    c = client(handler)
    check = lambda doi: c.check_retraction(Publication(title="t", doi=doi, provenance=PROV))
    assert check("10.1/retracted") == RetractionStatus.RETRACTED
    assert check("10.1/fixed") == RetractionStatus.CORRECTED
    assert check("10.1/clean") == RetractionStatus.NONE_FOUND


def test_retraction_falls_back_to_europepmc_when_crossref_has_no_record():
    def handler(request):
        if "crossref" in request.url.host:
            return httpx.Response(404)
        return httpx.Response(200, json={"resultList": {"result": [
            {"pubTypeList": {"pubType": ["Retracted Publication", "Journal Article"]}}]}})

    pub = Publication(title="t", doi="10.9/none", pmid="42", provenance=PROV)
    assert client(handler).check_retraction(pub) == RetractionStatus.RETRACTED


def test_unknown_retraction_status_is_not_reported_as_clean():
    pub = Publication(title="t", provenance=PROV)                 # no DOI, no PMID
    assert client(lambda r: httpx.Response(200, json={})).check_retraction(pub) == RetractionStatus.NOT_CHECKED


def test_ingest_pdf_stores_publication_geometry_and_detects_doi(tmp_path, paper_pdf):
    settings = Settings(data_dir=tmp_path / "data")
    store = Store(settings.db_path)
    pub, doc, was_new = ingest_pdf(store, settings, paper_pdf, year=2021)
    assert was_new and pub.doi == "10.1234/example.2021.001"
    assert pub.fulltext_location == str(paper_pdf.resolve())
    assert "sha256:" in pub.provenance.detail
    assert store.get(pub.id) == pub
    assert load_document(settings, pub.id) == doc


def test_ingesting_the_same_paper_twice_does_not_duplicate(tmp_path, paper_pdf):
    settings = Settings(data_dir=tmp_path / "data")
    store = Store(settings.db_path)
    first, _, new1 = ingest_pdf(store, settings, paper_pdf)
    second, _, new2 = ingest_pdf(store, settings, paper_pdf)
    assert (new1, new2) == (True, False) and second.id == first.id
    assert len(store.list(Publication)) == 1
    assert find_existing(store, first) == first
