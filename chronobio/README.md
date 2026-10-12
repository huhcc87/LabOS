# ChronoBio AI Discovery Engine

An opt-in extension for LabOS that turns literature into evidence-traceable, falsifiable hypotheses. It lives entirely in this folder: it has its own virtual environment, its own SQLite database under `data/`, and its own tests. It imports nothing from `backend/` or `frontend/convex/`.

**Status: Milestone 3 of 9 complete.** Milestone 1 added the skeleton, flags, data contracts, store and local-model access. Milestone 2 added PDF ingestion with page geometry, literature search with logged queries, retraction checks, and verified claim extraction. Milestone 3 adds the temporal evidence graph, a year slider, source-linked figures and an interactive viewer. There are no hypothesis agents yet, and the viewer is a standalone file, not a tab inside LabOS.

## What Milestone 3 does

| Module | Purpose |
|---|---|
| `graph.py` | Turns claims into graph edges. The model proposes subject–relation–object triples; both entities must appear in the claim text or the triple is rejected. Edges are stored one per claim, each with its paper's publication year. `snapshot(cutoff)` rebuilds the graph as known at a given year. |
| `layout.py` | Deterministic layout. Each connected cluster is laid out in its own box and the boxes are packed, so nodes never stack on each other. Positions are fixed across years, so nothing jumps when the slider moves. |
| `figures.py` | Editable SVG: evidence graph, year-by-year timeline, and a for/against matrix. Every figure has a legend, accessible titles, and `data-claims` attributes that map each element back to claim ids. |
| `viewer.py` | One self-contained HTML file with no network access: year slider, graph/timeline/matrix tabs, click-a-link evidence panel, SVG and PNG download. When the source PDF is on this computer, the panel shows the real page with the supporting passage highlighted. |

Rules the graph and figures enforce:

- Time slicing filters evidence, not guesses. A 2016 snapshot contains no claim from a later paper, and a link disappears if all its evidence is later.
- Claims whose paper has no publication year never appear on the timeline; their count is shown instead.
- Solid links cite evidence. Hypotheses (`inferred`, no evidence, from a simple two-step rule) are dashed, labelled "hypothesis", and can be hidden. The legend says "NOT established".
- A link is marked contested when its evidence conflicts (activates vs inhibits, or supporting vs contradicting claims). Links with a retracted source are flagged.
- Meaning never depends on colour alone: line style and text labels differ too, and the palette is colour-blind safe.
- All paper and model text is shown as text, never as HTML. The viewer sets a Content-Security-Policy that allows only its own script.

Measured on real literature: 12 Europe PMC abstracts on KRAS inhibitors (2016–2025), local llama3.1 8B.

- 53 claims were extracted, all abstract-level, so none had a PDF page to highlight in this run. PDF highlighting is tested on generated PDFs only.
- The model proposed 118 graph edges. 55 were rejected (invalid relation, or an entity not in the claim). 62 edges and 80 entities were kept.
- The slider showed 12, 38, 45 and 61 links at 2016, 2019, 2022 and 2025. It grows steadily and never shows later evidence early.
- SVG and a 2880×1980 PNG export worked in the browser.

Known limits:

- Entity names are noisy. Generic terms such as "inhibition" and "tumor growth" become nodes, and near-duplicates such as "p38MAPK" and "p38MAPK signaling" are not merged. There is no synonym or ontology matching yet.
- Dense clusters can still have overlapping labels.
- This corpus produced no contested links and no hypotheses (only 5 "activates" edges), so those paths are covered by tests on a fixed fixture, not by real data.
- The mechanism diagram is the same graph; the hypothesis-to-experiment workflow figure comes in a later milestone. PNG export is browser-side only, and PDF export is the browser's Print command.

## What Milestone 2 does

| Module | Purpose |
|---|---|
| `pdf_ingest.py` | Reads a PDF into words with bounding boxes. Locates a passage and returns its page, character offsets, highlight rectangles (one per text line) and the source's own wording. |
| `claims.py` | Asks the model for atomic claims, then keeps only those whose passage is found in the source. Sample sizes and effect estimates are kept only if they also appear in the source. |
| `literature.py` | Europe PMC search with a year filter, DOI/PMID/title de-duplication, and retraction checks (Crossref/Retraction Watch first, Europe PMC publication types as a fallback). Every search is saved as a `SearchLog`. |
| `ingest.py` | Stores a PDF as a `Publication` plus word geometry under `data/fulltext/`. Re-ingesting the same paper returns the existing record. |

How claim verification works:

- A passage is accepted if it appears in the paper ignoring whitespace and letter-case. The stored passage is always the paper's own text, never the model's copy.
- A paraphrase, a passage that spans a page break, or text broken by hyphenation is rejected, not guessed at.
- Everything dropped is returned in `result.rejections` with a reason, so nothing disappears silently.
- A claim is marked `pdf_exact` only when it has a real page and highlight boxes. Abstract-only claims are marked `text_only`.
- Scanned PDFs with no selectable text are reported as `no_text` and never sent to the model.

Measured with the real local model (llama3.1 8B) on a generated two-page PDF: 10.4 s, both claims kept with page numbers and highlight boxes, the paper's sample size (n=1,200) carried through, and no rejections. This is one small fixture, not a benchmark; the 20-paper accuracy check from the spec is still to do.

## Quick start

```bash
cd chronobio
uv sync --python 3.12
uv run pytest -q
uv run python -m chronobio doctor
```

## Feature flags

Every flag defaults to the safe setting. Set them as environment variables.

| Variable | Default | Meaning |
|---|---|---|
| `CHRONOBIO_ENABLED` | `0` | Master switch. When off, no model calls are made. |
| `CHRONOBIO_DRY_RUN` | `1` | Plans steps but skips model calls and network access. |
| `CHRONOBIO_ALLOW_CLOUD_LLM` | `0` | Required for any non-localhost model URL. Never use it with patient-level data. |
| `CHRONOBIO_ALLOW_NETWORK` | `0` | Allows literature API calls (Europe PMC, Crossref). |
| `CHRONOBIO_OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama server. |
| `CHRONOBIO_MODEL` | `llama3.1:latest` | One shared model for all agents. |
| `CHRONOBIO_DATA_DIR` | `chronobio/data` | Separate data directory, gitignored. |

## Resource budget (16 GB Apple Silicon)

- The model is `llama3.1` 8B, using about 5 GB of RAM. A short request took 11.9 s on this Mac; extracting claims from a two-page PDF took about 10-22 s.
- Agents run one at a time with no parallel model calls.
- Each prompt is capped at `CHRONOBIO_MAX_CONTEXT_CHARS` (default 12,000). Papers are processed in batches of `CHRONOBIO_MAX_BATCH_PAPERS` (default 5). Agent loops stop after `CHRONOBIO_MAX_AGENT_ITERATIONS` (default 3).
- Job checkpoints (`Store.checkpoint` / `Store.resume`) let a crashed pipeline resume where it stopped.

## Rules the code enforces

- Records are immutable and versioned. A revision is saved as a new row, so the full history is kept.
- An edge shown as established must cite at least one evidence claim. Hypothesized edges are flagged `inferred=True`.
- A validation run can carry metrics only if its status is `executed`. Planned analyses cannot carry numbers.
- Every hypothesis needs at least one prediction and one falsifier.
- Novelty defaults to `not_searched`. Finding no search hits gives `unknown`, never "novel".
- Unknown fields are rejected, so no stray confidence scores can creep into records.

## Legacy baseline (acceptance criterion A)

- Milestone 1 was built on LabOS commit `adbc338`.
- To confirm ChronoBio left LabOS untouched, this diff should show only the separate Research AI bug fixes:

```bash
git diff adbc338 -- . ':!chronobio'
```

## Rollback

1. Delete this `chronobio/` folder.
2. Nothing else needs undoing: there are no LabOS migrations, routes or dependencies.

## Licensing decisions (Milestone 0)

| Component | Decision | Why |
|---|---|---|
| MiroFish (AGPL-3.0) | Ideas only | Its AGPL license would apply to the hosted LabOS service, and it needs a Zep Cloud key. |
| Biomni (Apache-2.0) | Optional, later, sandboxed | It runs LLM-generated code with full system privileges and needs an 11 GB data download. |
| PyMuPDF (AGPL-3.0) | Rejected | Use `pdfplumber` (MIT) for passage coordinates instead. |
| DeepEvidence, BioCortex | Rejected | No authoritative repository could be found. |

## Building the viewer

```bash
cd chronobio
CHRONOBIO_ENABLED=1 CHRONOBIO_DRY_RUN=0 uv run python -c "
from chronobio.config import load_settings
from chronobio.store import Store
from chronobio.viewer import build_viewer
s = load_settings()
print(build_viewer(Store(s.db_path), s).html_path)"
```

The output goes to `chronobio/data/figures/` (`viewer.html`, `graph.svg`, `timeline.svg`, `matrix.svg`). Open `viewer.html` directly in a browser.
