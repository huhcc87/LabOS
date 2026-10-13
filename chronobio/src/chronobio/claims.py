"""Atomic claim extraction with mandatory source verification.

The model proposes claims; code decides what survives. A claim is kept only if
its supporting passage appears verbatim in the source. Numbers and effect
estimates the model reports are kept only if they also appear in the source.
Everything dropped is returned in `rejections` so nothing disappears silently.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field

from .config import Settings
from .llm import LLM, UNTRUSTED_DATA_NOTICE
from .models import (
    ClaimOrigin, Direction, EvidenceClaim, Locator, Provenance, Publication, StudyDesign,
)
from .pdf_ingest import Document, contains_verbatim, find_ignoring_case, locate, normalize

EXTRACTION_VERSION = "claims-v1"
MAX_PASSAGE_CHARS = 400          # "short verbatim snippet", not a pasted paragraph
MAX_CLAIMS_PER_CHUNK = 8

SYSTEM_PROMPT = UNTRUSTED_DATA_NOTICE + (
    "You extract atomic scientific claims from a paper excerpt. Reply with ONLY a JSON array. "
    "Each item: {\"claim\": str, \"passage\": str, \"direction\": \"supports\"|\"contradicts\"|\"inconclusive\", "
    "\"design\": \"randomized\"|\"observational\"|\"mechanistic\"|\"in_vitro\"|\"animal\"|\"computational\"|\"review\"|\"other\"|\"unknown\", "
    "\"population\": str, \"n\": int|null, \"method\": str, \"effect\": str, \"limitations\": [str]}. "
    "RULES: 'passage' MUST be copied exactly, word for word, from the excerpt (under 400 characters). "
    "Never paraphrase the passage. Use null / empty strings for anything the excerpt does not state. "
    "Do not infer effect sizes or sample sizes that are not written in the excerpt."
)


@dataclass(frozen=True)
class Rejection:
    reason: str
    detail: str = ""


@dataclass
class ExtractionResult:
    claims: list[EvidenceClaim] = field(default_factory=list)
    rejections: list[Rejection] = field(default_factory=list)


def claim_id(publication_id: str, passage: str) -> str:
    """Stable id: re-extracting the same passage yields the same claim id."""
    digest = hashlib.sha1(f"{publication_id}|{normalize(passage).lower()}".encode()).hexdigest()[:12]
    return f"clm_{digest}"


def chunk_pages(doc: Document, max_chars: int) -> list[tuple[str, str]]:
    """Group consecutive pages into prompt-sized chunks: (prompt_text, plain_source_text)."""
    chunks: list[tuple[str, str]] = []
    prompt_parts: list[str] = []
    source_parts: list[str] = []
    size = 0
    for page in doc.pages:
        text = page.text
        if not text:
            continue
        piece = f"[Page {page.number}]\n{text}"
        if prompt_parts and size + len(piece) > max_chars:
            chunks.append(("\n\n".join(prompt_parts), "\n".join(source_parts)))
            prompt_parts, source_parts, size = [], [], 0
        prompt_parts.append(piece[:max_chars])
        source_parts.append(text)
        size += len(piece)
    if prompt_parts:
        chunks.append(("\n\n".join(prompt_parts), "\n".join(source_parts)))
    return chunks


def _parse_array(raw: str) -> list[dict] | None:
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError:
        return None
    return [d for d in data if isinstance(d, dict)] if isinstance(data, list) else None


def _enum(cls, value, default):
    try:
        return cls(value)
    except ValueError:
        return default


def _number_in_source(n, source: str) -> int | None:
    if not isinstance(n, int) or isinstance(n, bool) or n < 0:
        return None
    digits = f"{n:,}"
    pattern = rf"(?<![\d.,]){re.escape(str(n))}(?![\d])|(?<![\d.,]){re.escape(digits)}(?![\d])"
    return n if re.search(pattern, source) else None


def extract_claims(
    llm: LLM,
    publication: Publication,
    settings: Settings,
    *,
    doc: Document | None = None,
) -> ExtractionResult:
    """Extract verified claims from a parsed PDF (`doc`) or the publication's abstract."""
    result = ExtractionResult()
    if doc is not None:
        if not doc.has_text:
            result.rejections.append(Rejection("no_text", "PDF has no selectable text (scanned?). Run OCR first."))
            return result
        chunks = chunk_pages(doc, settings.max_context_chars)
        full_source = "\n".join(src for _, src in chunks)
    else:
        if not publication.abstract.strip():
            result.rejections.append(Rejection("no_text", "no PDF and no abstract to extract from"))
            return result
        chunks = [(publication.abstract[: settings.max_context_chars], publication.abstract)]
        full_source = publication.abstract

    seen: set[str] = set()
    for prompt_text, source_text in chunks:
        raw = llm.generate(SYSTEM_PROMPT, prompt_text)
        items = _parse_array(raw)
        if items is None:
            result.rejections.append(Rejection("unparseable_model_output", raw[:120]))
            continue
        for item in items[:MAX_CLAIMS_PER_CHUNK]:
            claim = _verify(item, publication, doc, source_text, full_source, llm.name, result)
            if claim and claim.id not in seen:
                seen.add(claim.id)
                result.claims.append(claim)
    return result


def _verify(item, publication, doc, source_text, full_source, model_name, result) -> EvidenceClaim | None:
    claim_text = str(item.get("claim") or "").strip()
    passage = normalize(str(item.get("passage") or ""))
    if not claim_text or not passage:
        result.rejections.append(Rejection("missing_claim_or_passage", claim_text[:80]))
        return None
    if len(passage) > MAX_PASSAGE_CHARS:
        result.rejections.append(Rejection("passage_too_long", claim_text[:80]))
        return None
    span = find_ignoring_case(source_text, passage)
    if span is None:
        result.rejections.append(Rejection("passage_not_verbatim", passage[:120]))
        return None

    location = locate(doc, passage) if doc is not None else None
    if doc is not None and location is None:
        # Verbatim in the joined chunk but not on a single page (spans a page break).
        result.rejections.append(Rejection("passage_spans_pages", passage[:120]))
        return None
    # Store the source's own wording, never the model's copy of it.
    passage = location.text if location else normalize(source_text)[span[0]:span[1]]

    effect = normalize(str(item.get("effect") or ""))
    if effect and not contains_verbatim(full_source, effect):
        result.rejections.append(Rejection("effect_not_in_source_dropped", effect[:80]))
        effect = ""
    n = _number_in_source(item.get("n"), full_source)
    if item.get("n") is not None and n is None:
        result.rejections.append(Rejection("sample_size_not_in_source_dropped", str(item.get("n"))))

    limitations = [str(x) for x in item.get("limitations") or [] if isinstance(x, str) and x.strip()]
    common = dict(
        id=claim_id(publication.id, passage),
        publication_id=publication.id,
        claim=claim_text,
        passage=passage,
        direction=_enum(Direction, item.get("direction"), Direction.INCONCLUSIVE),
        origin=ClaimOrigin.REPORTED,
        design=_enum(StudyDesign, item.get("design"), StudyDesign.UNKNOWN),
        population=normalize(str(item.get("population") or "")),
        n=n,
        method=normalize(str(item.get("method") or "")),
        effect=effect,
        limitations=limitations,
        extraction_version=EXTRACTION_VERSION,
        provenance=Provenance(source="agent:claim_extractor", detail=model_name,
                              tool_version=EXTRACTION_VERSION),
    )
    if location:
        return EvidenceClaim(**common, locator=Locator.PDF_EXACT, page=location.page,
                             char_start=location.char_start, char_end=location.char_end,
                             highlight_boxes=list(location.boxes))
    return EvidenceClaim(**common, locator=Locator.TEXT_ONLY, char_start=span[0], char_end=span[1])
