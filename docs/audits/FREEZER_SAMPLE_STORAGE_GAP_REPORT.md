# Freezer / Sample Storage / Labels / Export — Gap Report

**Checkpoint A — audit only. No behaviour-changing code was modified.**

Date: 2026-09-20
Scope: freezer, storage hierarchy, samples, barcode/label printing, export.
Method: read the actual source and schema. Nothing below is inferred from a
component existing or a button being visible.

---

## 0. Two blocking corrections to the source prompt

### 0.1 The prompt targets the wrong backend

The prompt instructs edits to `backend/app/api/freezer.py`,
`backend/app/models/models.py`, and Alembic migrations, and specifies
FastAPI/SQLAlchemy/PostgreSQL throughout.

**The FastAPI backend is not in the production path.** Evidence:

| Evidence | File | Detail |
|---|---|---|
| Frontend API layer is a no-op stub | `frontend/src/lib/api.ts:59-67` | `fakeClient` — every `get/post/put/patch/delete` returns `{ data: null }` |
| All real calls go to Convex | `frontend/src/lib/convexClient.ts` | `freezerApi`, `samplesApi` call `client.query/mutation(api.freezer.*, api.samples.*)` |
| REST base URL is empty | `frontend/.env.example:22` | `VITE_API_URL=` (unset) |
| FastAPI routers exist and are mounted | `backend/app/main.py:109,141` | `freezer.router`, `samples.router` — reachable by HTTP, but no client calls them |

So `backend/app/api/freezer.py` and `backend/app/api/samples.py` are a
**complete, mounted, but unreachable duplicate implementation**. Per the
decision recorded in `docs/adr/ADR-freezer-storage-hierarchy.md`, Convex is the
system of record and this work lands in Convex. There are no Alembic migrations
in this plan.

### 0.2 Git safety rules cannot be satisfied as written

Prompt rules 1–3 require branch `feature/freezer-sample-storage` and forbid
working on `main`. **`LabOS-main/` is an extracted archive, not a git
repository** (no `.git`). Nothing here is version-controlled or recoverable.

**This must be resolved before Checkpoint B.** Options: `git init` + add the
`huhcc87/LabOS` remote, or move the work into a real clone.

---

## 1. What exists today

### 1.1 Data model (Convex — `frontend/convex/schema.ts`)

```
freezers        (schema.ts:495)  name, location, temperature,
                                 capacity_racks, capacity_boxes, notes, created_at
freezer_slots   (schema.ts:505)  freezer_id, rack:number, box:number,
                                 row:number, col:number, sample_id:string?,
                                 label?, barcode?, expiry_date?, notes?, updated_at
samples         (schema.ts:118)  sample_id, name, type?, status, location:string?,
                                 collected_at?, collected_by?, barcode?, metadata?
sample_events   (schema.ts:136)  sample_id, event_type, description?,
                                 performed_by?, performed_at, notes?
```

### 1.2 Functions

- `convex/freezer.ts` — `list`, `create`, `remove`, `getSlots`, `upsertSlot`, `getExpiring`, `search`
- `convex/samples.ts` — `list`, `get`, `create`, `update`, `remove`, `listEvents`, `createEvent`, `updateEvent`, `deleteEvent`

### 1.3 Frontend

| Page | Lines | Wired into `App.tsx`? |
|---|---|---|
| `FreezerBiobankPage.tsx` | 425 | Yes (`freezer-biobank`) |
| `StorageMapPage.tsx` | 431 | Yes (`storage-map`) |
| `SampleHubPage.tsx` | 2219 | Yes (`samples`) |
| `LabelPrinterPage.tsx` | 827 | Yes (`label-printer`) |
| `PrintLabelsPage.tsx` | 833 | **No — dead code** |
| `SamplesPage.tsx` | 327 | **No — dead code** |

1,160 lines of orphaned duplicate implementation.

### 1.4 What genuinely works

- **Barcode scanning is real.** `BarcodeScanner.tsx` uses `@zxing/browser`
  `BrowserMultiFormatReader`, `navigator.mediaDevices.getUserMedia`, plus a USB
  keyboard-wedge input path. Keep it.
- **Barcode/QR rendering is real.** `LabelPrinterPage.tsx` renders via the
  `Barcode` component (bwip-js dependency present).
- **Position grid UI exists** and renders occupancy from real Convex data.
- **Expiry tracking exists** (`freezer.getExpiring`).

---

## 2. Gaps — by severity

### CRITICAL — data-integrity and data-loss

| # | Finding | Evidence | Impact |
|---|---|---|---|
| C1 | **Silent overwrite of an occupied position.** `upsertSlot` looks up the position and, if a slot exists, patches `sample_id` with no occupancy check. | `convex/freezer.ts:124-148` | Placing into an occupied position destroys the previous placement. No error, no event. Directly violates prompt §3.3 and §4 "only one active sample per position". |
| C2 | **Slots are not linked to samples.** `freezer_slots.sample_id` is `v.optional(v.string())` — a free-text string, not `v.id("samples")`. | `schema.ts:511` | No referential integrity. A slot can reference a sample that does not exist. Cannot join reliably. |
| C3 | **Location is double-bookkept.** `samples.location` is a free-text string, independent of `freezer_slots`. | `schema.ts:123` | The two can disagree with nothing to reconcile them. No single source of truth for "where is this sample". |
| C4 | **Freezer delete hard-deletes occupied slots.** `remove` cascade-deletes every slot including occupied ones, then the freezer. | `convex/freezer.ts:43-64` | Irreversible sample-location loss by any authenticated user. Violates prompt rule 7 and §2.5. |
| C5 | **Sample delete is a hard delete.** No archive, no disposal workflow, no tombstone. `sample_events` rows are orphaned. | `convex/samples.ts:116-123` | Destroys chain-of-custody. Violates prompt §3.5. |
| C6 | **No move operation exists.** Moving = clear one slot + write another, as two separate mutations from the client. | no `move` export in `freezer.ts` | Non-atomic. Crash between calls duplicates or loses the sample. No move event. |

### HIGH — missing required structure

| # | Finding | Impact |
|---|---|---|
| H1 | **No Shelf level.** Hierarchy is `freezer → rack:number → box:number → row/col`. Racks/boxes are bare integers, not entities. | The target workflow (`Freezers > 316 -80C > Top Shelf > Rack 5 > Box A`) is not representable. Racks/boxes cannot be named, moved, archived, or labelled. |
| H2 | **No workspace scoping anywhere.** `workspaces`, `labs`, `lab_memberships` tables exist, but `workspace_id` appears **zero times** in the entire 60-table schema. | No tenant isolation. Every authenticated user sees every freezer and sample. Prompt §4/§9 unsatisfiable without this. |
| H3 | **No audit/version columns** on `freezers`/`freezer_slots` — no `created_by`, `updated_by`, `version`, `archived_at`. | No optimistic locking (§2.3), no archive/restore (§2.4), no actor attribution. |
| H4 | **No archive/restore at any level.** Only hard delete. | Prompt §2.4 entirely unimplemented. |
| H5 | **No permission model.** Every function calls `requireAuth` only — authenticated == fully authorised. | The 16 granular permissions in prompt §9 do not exist. |
| H6 | **No label/print persistence.** No `label_templates`, no `print_jobs` tables. | No print history, no reprint-with-reason, no idempotency (§6.5). |
| H7 | **No export job/manifest model.** | No export ID, checksum, or audit (§7.3). No background jobs for large exports. |

### MEDIUM — feature quality

| # | Finding | Evidence |
|---|---|---|
| M1 | **"XLSX export" actually writes CSV.** The `'excel'` case falls through to the `'csv'` case and downloads a `.csv`. | `exportUtils.ts:76-81` |
| M2 | **"PDF export" is a browser print dialog**, not a generated file. `window.open` + `window.print()`. | `exportUtils.ts:87-97` |
| M3 | **Exports are unfiltered client-side dumps** — no permission-aware column selection, no manifest, no audit. | `exportUtils.ts:67` |
| M4 | **Fixed position-grid layout** — no configurable 5×5 / 8×8 / 9×9 / 10×10 / 12×12 / custom. | `schema.ts:505` (no box dimension fields) |
| M5 | **Position states are binary** (empty / occupied). No reserved, quarantined, checked-out, unavailable, archived. | `schema.ts:505` |
| M6 | **No check-out / return workflow.** | no such fields or functions |
| M7 | **No batch import** (CSV/XLSX → validate → preview → commit → rollback). | `SampleHubPage.tsx` has no import wizard |
| M8 | **No hierarchy templates** ("2 shelves × 5 racks × 4 boxes × 81 positions"). | `freezer.create` takes flat capacity numbers only |

### SECURITY

| # | Finding | Evidence |
|---|---|---|
| S1 | **HTML injection in PDF/print export.** `generatePrintableHTML` interpolates record values straight into an HTML string with no escaping, then writes it into a new window via `document.write`. A sample name/note containing markup executes in that window. | `exportUtils.ts:113-126` |
| S2 | **No authorisation on reads.** Any authenticated user can list/search/export all freezers and samples (follows from H2/H5). Counts leak existence. | `convex/freezer.ts:7`, `convex/samples.ts:5` |
| S3 | **Barcode values are not constrained unique**, and Convex has no unique indexes — duplicates are silently possible. | `schema.ts:127,513` |

---

## 3. Requirement coverage

| Prompt section | Status | Note |
|---|---|---|
| §1.1 Freezer overview | PARTIAL | Cards + expiry exist. No capacity/alert state/owner/IoT temp/filter/sort/table toggle. |
| §1.2 Hierarchical navigation | NOT_STARTED | No shelf entity, no breadcrumbs, no per-level actions. |
| §1.3 Shelf and rack view | NOT_STARTED | Racks are integers. |
| §1.4 Box and position grid | PARTIAL | Grid renders; layout fixed, states binary. |
| §1.5 Occupancy summary | PARTIAL | Computed client-side from all slots — will not scale (§1.5 forbids this). |
| §2.1–2.2 Add storage / batch | PARTIAL | Flat freezer create only. No templates, no batch, no preview. |
| §2.3 Edit + optimistic lock | NOT_STARTED | No `version` field. |
| §2.4 Archive / restore | NOT_STARTED | Hard delete only. |
| §2.5 Permanent delete rules | NOT_STARTED | Unguarded hard delete is the default path. |
| §3.1 Sample record fields | PARTIAL | ~8 of ~28 required fields exist. |
| §3.2 Add sample / batch import | PARTIAL | Single add only. |
| §3.3 Move (transactional) | NOT_STARTED | See C6. |
| §3.4 Check-out / return | NOT_STARTED | |
| §3.5 Disposal | NOT_STARTED | Hard delete instead. |
| §4 Data model guarantees | NOT_STARTED | 0 of 9 guarantees enforced. |
| §5 API | PARTIAL | Convex equivalents of ~40% of listed operations. |
| §6 Labels | PARTIAL | Rendering + browser print real. No templates, history, ZPL, or server render. |
| §7 Export | PARTIAL | CSV + JSON real. XLSX is CSV, PDF is print dialog. No manifest/jobs. |
| §8 Search and scanning | GOOD | Scanner is genuinely solid. Search is name/barcode substring only. |
| §9 Permissions | NOT_STARTED | |
| §10 Frontend structure | NOT_STARTED | Monolithic pages; `SampleHubPage.tsx` is 2,219 lines. |
| §11 Accessibility | PARTIAL | Grid is not a semantic grid; state conveyed largely by colour. |

---

## 4. Recommended sequencing change

The prompt's Checkpoint B ("models/migrations/services/APIs") assumes tenancy
already exists. It does not (H2). Enforcing `workspace_id` on new storage tables
while the other 58 tables remain unscoped produces an inconsistent model.

**Recommendation:** in Checkpoint B, scope the *new* storage/sample tables by
`workspace_id` from day one and resolve the active workspace server-side, but
treat retrofitting the other 58 tables as separate work. This is called out
because it is a deviation from the prompt and needs approval.

---

## 5. Evidence index

| Claim | File:line |
|---|---|
| REST client is a stub | `frontend/src/lib/api.ts:59-67` |
| Convex is the live path | `frontend/src/lib/convexClient.ts:672-708` |
| FastAPI mounted but unused | `backend/app/main.py:109,141` |
| Occupied-position overwrite | `frontend/convex/freezer.ts:124-148` |
| Slot→sample is a string | `frontend/convex/schema.ts:511` |
| Freezer cascade hard delete | `frontend/convex/freezer.ts:56-62` |
| Sample hard delete | `frontend/convex/samples.ts:116-123` |
| XLSX writes CSV | `frontend/src/utils/exportUtils.ts:76-81` |
| PDF is window.print | `frontend/src/utils/exportUtils.ts:87-97` |
| HTML injection | `frontend/src/utils/exportUtils.ts:113-126` |
| No workspace_id | `frontend/convex/schema.ts` (0 matches) |
| Dead pages | `PrintLabelsPage.tsx`, `SamplesPage.tsx` (0 importers) |
