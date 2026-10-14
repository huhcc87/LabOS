"""Literature search, de-duplication and retraction checks.

Network access is off unless CHRONOBIO_ALLOW_NETWORK=1. Every search writes a
`SearchLog` (query, date, filters, counts, limitations) so a novelty or
coverage statement can always be reproduced and audited.
"""

from __future__ import annotations

import re
import time

import httpx

from .config import Settings
from .models import Provenance, Publication, RetractionStatus, SearchLog
from .pdf_ingest import normalize

EUROPE_PMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
CROSSREF = "https://api.crossref.org/works"
RETRY_WAIT_MAX_S = 10.0


class NetworkDisabled(RuntimeError):
    """Raised when a literature call is attempted without CHRONOBIO_ALLOW_NETWORK=1."""


def normalize_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    cleaned = re.sub(r"^(https?://(dx\.)?doi\.org/|doi:\s*)", "", doi.strip(), flags=re.I).lower()
    return cleaned or None


def dedupe_key(pub: Publication) -> str:
    """DOI first, then PMID, then title+year — the order identifiers are most reliable."""
    if doi := normalize_doi(pub.doi):
        return f"doi:{doi}"
    if pub.pmid:
        return f"pmid:{pub.pmid.strip()}"
    return f"title:{re.sub(r'[^a-z0-9]', '', pub.title.lower())}:{pub.year}"


def dedupe(pubs: list[Publication]) -> list[Publication]:
    """Drop duplicates; when two records match, keep the one with more identifiers."""
    best: dict[str, Publication] = {}
    for pub in pubs:
        key = dedupe_key(pub)
        kept = best.get(key)
        if kept is None or _richness(pub) > _richness(kept):
            best[key] = pub
    return list(best.values())


def _richness(pub: Publication) -> int:
    return sum(bool(x) for x in (pub.doi, pub.pmid, pub.abstract, pub.year, pub.authors, pub.journal))


class LiteratureClient:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self._settings = settings
        self._client = client or httpx.Client(timeout=30)

    def _require_network(self) -> None:
        if not self._settings.allow_network_literature:
            raise NetworkDisabled("literature access is off (set CHRONOBIO_ALLOW_NETWORK=1)")

    def search_europepmc(
        self, query: str, *, year_from: int | None = None, year_to: int | None = None, limit: int = 25,
    ) -> tuple[list[Publication], SearchLog]:
        self._require_network()
        full_query = query
        if year_from is not None or year_to is not None:
            full_query += f" AND PUB_YEAR:[{year_from or 1900} TO {year_to or 2100}]"
        resp = self._client.get(EUROPE_PMC, params={
            "query": full_query, "format": "json", "resultType": "core",
            "pageSize": min(limit, 100),
        })
        resp.raise_for_status()
        body = resp.json()
        results = body.get("resultList", {}).get("result", [])
        pubs = dedupe([self._to_publication(r, query) for r in results if r.get("title")])
        log = SearchLog(
            source="europepmc", query=full_query, date_from=year_from, date_to=year_to,
            result_count=int(body.get("hitCount", len(results))), returned_count=len(pubs),
            limitations=["first page of results only", "abstract-level metadata, not full text"],
            provenance=Provenance(source="europepmc", detail=full_query),
        )
        return pubs, log

    @staticmethod
    def _to_publication(r: dict, query: str) -> Publication:
        year = r.get("pubYear")
        return Publication(
            title=normalize(r["title"]).rstrip("."),
            authors=[a.strip() for a in (r.get("authorString") or "").rstrip(".").split(",") if a.strip()],
            year=int(year) if year and str(year).isdigit() else None,
            journal=(r.get("journalTitle") or "").strip(),
            abstract=normalize(re.sub(r"<[^>]+>", " ", r.get("abstractText") or "")),
            doi=normalize_doi(r.get("doi")),
            pmid=r.get("pmid"),
            license=r.get("license") or "unknown",
            retraction_status=_pubtype_status(r.get("pubTypeList", {}).get("pubType", [])),
            provenance=Provenance(source="europepmc", detail=query),
        )

    def check_retraction(self, pub: Publication) -> RetractionStatus:
        """Crossref (Retraction Watch data) when a DOI exists; Europe PMC publication types otherwise."""
        self._require_network()
        if doi := normalize_doi(pub.doi):
            resp = self._get_politely(f"{CROSSREF}/{doi}")
            if resp is not None and resp.status_code == 200:
                return _crossref_status(resp.json().get("message", {}))
        if pub.pmid:
            resp = self._get_politely(EUROPE_PMC, params={
                "query": f"EXT_ID:{pub.pmid} AND SRC:MED", "format": "json", "resultType": "core"})
            if resp is not None and resp.status_code == 200:
                hits = resp.json().get("resultList", {}).get("result", [])
                if hits:
                    return _pubtype_status(hits[0].get("pubTypeList", {}).get("pubType", []))
        return RetractionStatus.NOT_CHECKED          # unreachable or rate-limited: unknown, never "clean"

    def _get_politely(self, url: str, **kwargs) -> httpx.Response | None:
        """GET with one retry when rate-limited or the server hiccups; None if it still fails.

        A registry that is slow, down, or says 429 must not crash a long job: the paper's
        retraction status simply stays 'not checked'.
        """
        for attempt in (0, 1):
            try:
                resp = self._client.get(url, **kwargs)
            except httpx.HTTPError:
                resp = None
            if resp is not None and resp.status_code != 429 and resp.status_code < 500:
                return resp                           # 200, or a definite 404 etc.
            if attempt == 0:
                wait = float(resp.headers.get("Retry-After", 2)) if resp is not None and resp.headers.get("Retry-After", "").isdigit() else 2.0
                time.sleep(min(wait, RETRY_WAIT_MAX_S))
        return None


def _crossref_status(message: dict) -> RetractionStatus:
    types = {u.get("type") for u in message.get("updated-by", [])}
    if "retraction" in types:
        return RetractionStatus.RETRACTED
    if "expression_of_concern" in types:
        return RetractionStatus.CONCERN
    if types & {"correction", "erratum"}:
        return RetractionStatus.CORRECTED
    return RetractionStatus.NONE_FOUND


def _pubtype_status(pub_types: list[str]) -> RetractionStatus:
    lowered = {t.lower() for t in pub_types}
    if "retracted publication" in lowered:
        return RetractionStatus.RETRACTED
    if lowered & {"published erratum", "corrected and republished article"}:
        return RetractionStatus.CORRECTED
    return RetractionStatus.NOT_CHECKED     # absence of a flag here is not proof of no retraction
