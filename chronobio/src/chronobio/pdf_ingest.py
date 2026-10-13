"""PDF text with geometry, and exact passage location.

Each page is stored as a list of words with bounding boxes. Page text is those
words joined by single spaces, so a character offset in the page text maps
directly to words and therefore to highlight rectangles. A passage is located
only if it appears verbatim (ignoring whitespace and case differences); otherwise
`locate` returns None — it never guesses. Letter-case is ignored, but the text
handed back is always the source's own. Passages broken by hyphenation or
spanning a page break are not located.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber

Box = tuple[float, float, float, float]   # x0, top, x1, bottom (PDF points, origin top-left)


@dataclass(frozen=True)
class Word:
    text: str
    box: Box


@dataclass(frozen=True)
class Page:
    number: int                            # 1-based
    words: tuple[Word, ...]
    width: float
    height: float

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)


@dataclass(frozen=True)
class Document:
    pages: tuple[Page, ...]

    @property
    def has_text(self) -> bool:
        return any(p.words for p in self.pages)


@dataclass(frozen=True)
class Location:
    page: int
    char_start: int
    char_end: int
    boxes: tuple[Box, ...]                 # one rectangle per text line
    text: str                              # the passage exactly as it appears in the source


def read_pdf(path: Path) -> Document:
    pages: list[Page] = []
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            words = tuple(
                Word(w["text"], (float(w["x0"]), float(w["top"]), float(w["x1"]), float(w["bottom"])))
                for w in page.extract_words(use_text_flow=True, keep_blank_chars=False)
            )
            pages.append(Page(i, words, float(page.width), float(page.height)))
    return Document(tuple(pages))


def document_to_json(doc: Document) -> str:
    return json.dumps({"pages": [
        {"number": p.number, "width": p.width, "height": p.height,
         "words": [[w.text, *w.box] for w in p.words]}
        for p in doc.pages
    ]})


def document_from_json(raw: str) -> Document:
    data = json.loads(raw)
    return Document(tuple(
        Page(p["number"], tuple(Word(w[0], (w[1], w[2], w[3], w[4])) for w in p["words"]),
             p["width"], p["height"])
        for p in data["pages"]
    ))


_WS = re.compile(r"\s+")


def normalize(text: str) -> str:
    """Whitespace-collapsed text; used for both sides of every comparison."""
    return _WS.sub(" ", text).strip()


def find_ignoring_case(source: str, passage: str) -> tuple[int, int] | None:
    """Span of `passage` in `source` ignoring whitespace and letter-case differences.

    Offsets are into whitespace-normalized `source`. Case is ignored because
    models often capitalize a copied fragment; the caller keeps the SOURCE's text.
    """
    needle = normalize(passage)
    if not needle:
        return None
    match = re.search(re.escape(needle), normalize(source), re.IGNORECASE)
    return (match.start(), match.end()) if match else None


def contains_verbatim(source: str, passage: str) -> bool:
    return find_ignoring_case(source, passage) is not None


def locate(doc: Document, passage: str) -> Location | None:
    """Find `passage` on one page; return its page, offsets, the source's own text, and line boxes."""
    for page in doc.pages:
        span = find_ignoring_case(page.text, passage)
        if span:
            start, end = span
            return Location(page.number, start, end, _boxes_for(page, start, end),
                            text=page.text[start:end])
    return None


def _boxes_for(page: Page, start: int, end: int) -> tuple[Box, ...]:
    """Merge the words overlapping [start, end) into one rectangle per line."""
    lines: list[list[Box]] = []
    pos = 0
    for word in page.words:
        w_start, w_end = pos, pos + len(word.text)
        pos = w_end + 1                     # the joining space
        if w_end <= start or w_start >= end:
            continue
        x0, top, x1, bottom = word.box
        if lines and abs(lines[-1][-1][1] - top) < (bottom - top) / 2:
            lines[-1].append(word.box)
        else:
            lines.append([word.box])
    return tuple(
        (min(b[0] for b in line), min(b[1] for b in line),
         max(b[2] for b in line), max(b[3] for b in line))
        for line in lines
    )
