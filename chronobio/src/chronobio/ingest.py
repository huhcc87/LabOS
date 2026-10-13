"""Turn a local PDF into a stored Publication plus searchable word geometry."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .config import Settings
from .literature import dedupe_key, normalize_doi
from .models import Provenance, Publication
from .pdf_ingest import Document, document_from_json, document_to_json, read_pdf
from .store import Store

_DOI = re.compile(r"\b(10\.\d{4,9}/[^\s\"<>]+[^\s\"<>.,;)\]])", re.I)


def fulltext_path(settings: Settings, publication_id: str) -> Path:
    return settings.data_dir / "fulltext" / f"{publication_id}.json"


def find_existing(store: Store, pub: Publication) -> Publication | None:
    key = dedupe_key(pub)
    return next((p for p in store.list(Publication) if dedupe_key(p) == key), None)


def ingest_pdf(
    store: Store, settings: Settings, path: Path, *,
    title: str | None = None, year: int | None = None,
    doi: str | None = None, pmid: str | None = None,
) -> tuple[Publication, Document, bool]:
    """Parse a PDF and store it. Returns (publication, document, was_new).

    The PDF itself stays where it is; only word geometry is copied into the
    ChronoBio data directory. A DOI is taken from the first page only when the
    caller did not supply one, and the title falls back to the file name.
    """
    doc = read_pdf(path)
    sha = hashlib.sha256(path.read_bytes()).hexdigest()[:16]
    if not doi and doc.pages:
        match = _DOI.search(doc.pages[0].text)
        doi = match.group(1) if match else None
    pub = Publication(
        title=title or path.stem.replace("_", " "),
        year=year, doi=normalize_doi(doi), pmid=pmid,
        fulltext_location=str(path.resolve()),
        provenance=Provenance(source="user_upload", detail=f"{path.name} sha256:{sha}"),
    )
    existing = find_existing(store, pub)
    if existing:
        return existing, doc, False
    store.save(pub)
    out = fulltext_path(settings, pub.id)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(document_to_json(doc))
    return pub, doc, True


def load_document(settings: Settings, publication_id: str) -> Document | None:
    path = fulltext_path(settings, publication_id)
    return document_from_json(path.read_text()) if path.exists() else None
