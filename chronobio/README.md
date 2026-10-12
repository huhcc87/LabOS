# ChronoBio AI Discovery Engine

An opt-in extension for LabOS that turns literature into evidence-traceable, falsifiable hypotheses. It lives entirely in this folder: it has its own virtual environment, its own SQLite database under `data/`, and its own tests. It imports nothing from `backend/` or `frontend/convex/`.

**Status: Milestone 2 of 9 complete.** Milestone 1 added the skeleton, flags, data contracts, store and local-model access. Milestone 2 adds PDF ingestion with page geometry, literature search with logged queries, retraction checks, and verified claim extraction. There are no agents, graph or UI yet.

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
