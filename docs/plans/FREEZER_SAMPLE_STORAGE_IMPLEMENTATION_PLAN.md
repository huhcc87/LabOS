# Freezer / Sample Storage — Implementation Plan (Checkpoints B–F)

Checkpoint A deliverable. **Nothing here is implemented yet.**
Depends on: `docs/adr/ADR-freezer-storage-hierarchy.md`,
`docs/audits/FREEZER_SAMPLE_STORAGE_GAP_REPORT.md`.

---

> **Correction, 2026-09-20:** every "workspace" below is `lab_id` against the
> existing `labs`/`lab_memberships` tables, not `workspace_id` against
> `workspaces` (which has no membership table — see ADR correction note).
> Permission checks map to the existing `users.role` enum
> (`superadmin|admin|pi|manager|staff|trainee`) rather than an undocumented
> 16-permission list: `superadmin`/`admin` = Owner tier, `pi` = Lab Admin
> tier, `manager`/`staff` = standard write access, `trainee` = read +
> checkout only. See `convex/permissions.ts`.

## 1. API plan (Convex functions, not REST)

The prompt lists REST paths for a FastAPI backend that is not in the production
path. Equivalent Convex functions, preserving the prompt's operation set:

### `convex/storageUnits.ts`
| Function | Kind | Replaces prompt route | Notes |
|---|---|---|---|
| `list` | query | `GET /storage-units` | workspace-scoped, filter by type/status/owner, paginated |
| `get` | query | `GET /storage-units/{id}` | |
| `create` | mutation | `POST /storage-units` | optional `template` arg; returns preview count first via `previewTemplate` |
| `previewTemplate` | query | — | "this will create 2 shelves, 10 racks, 40 boxes" before commit (§2.1) |
| `update` | mutation | `PATCH /storage-units/{id}` | requires `version`; throws `CONFLICT` on mismatch |
| `archive` / `restore` | mutation | `POST .../archive`,`/restore` | blocked if occupied descendants (§2.4) |
| `occupancy` | query | `GET .../occupancy` | server-side aggregate (§1.5 forbids client-side) |
| `purge` | mutation | permanent delete | admin-only, dependency check, name confirmation (§2.5) |

### `convex/storageNodes.ts`
`list` (by unit/parent) · `get` · `create` · `createBatch` (count, prefix, start,
padding — §2.2) · `update` (version-checked) · `move` (cycle check via `path`,
`ALLOWED_PARENT` check, descendant path rewrite) · `archive` / `restore` ·
`breadcrumbs` (zero-traversal, reads `path`) · `occupancy`

### `convex/storagePositions.ts`
`listForBox` (returns dimensions + sparse occupied map) · `reserve` · `release`

### `convex/samples.ts` (extend, keep existing signatures working)
`place` · `move` · `checkout` · `returnSample` · `dispose` · `archive` /
`restore` · `history` · `batchValidate` · `batchCommit` (all-or-nothing) ·
`resolveBarcode` (scan → sample + location)

### `convex/labels.ts` (new)
`listTemplates` · `saveTemplate` · `render` · `createPrintJob` (idempotent on
`request_id`) · `listPrintJobs`

### `convex/exports.ts` (new)
`create` (scope + fields + format) · `get` · `download` · large scopes run via
`ctx.scheduler` into Convex file storage with an expiring URL

**Cross-cutting, applied to every function above:** workspace resolution
server-side; permission check against the §9 permission list; `version` check on
updates; audit row written in the same mutation; `request_id` idempotency on
batch/move/print/export.

---

## 2. Frontend component plan

Follows the prompt's §10 structure. Existing monolithic pages stay working and
are progressively re-pointed at the new feature modules — they are **not**
rewritten wholesale in one commit.

```
frontend/src/features/storage/
  api/          useStorageUnits.ts  useStorageNodes.ts  usePositions.ts
  components/   StorageUnitCard.tsx  StorageBreadcrumbs.tsx  ShelfSection.tsx
                RackCard.tsx  BoxCard.tsx  PositionGrid.tsx  PositionCell.tsx
                OccupancySummary.tsx  StorageActionMenu.tsx  StorageHistoryDrawer.tsx
  dialogs/      StorageUnitForm.tsx  StorageNodeForm.tsx  BatchCreateStorageForm.tsx
                ArchiveStorageDialog.tsx  MoveStorageDialog.tsx
  hooks/        useStorageNavigation.ts   (breadcrumb + preserved filter state)
  pages/        StorageBrowserPage.tsx
  schemas/      storage.schemas.ts        (zod)
  tests/

frontend/src/features/samples/
  dialogs/      SampleForm.tsx  SampleMoveDialog.tsx  SampleCheckoutDialog.tsx
                SampleDisposeDialog.tsx  SampleBatchImportWizard.tsx
  api/ hooks/ schemas/ tests/

frontend/src/features/labels/    api/ components/ templates/ tests/
frontend/src/features/exports/   api/ components/ tests/
```

`PositionGrid` is a semantic `role="grid"` with row/column headers; each cell
announces label + state in text (§11 — not colour alone).

---

## 3. Testing plan

### Backend (Convex — `convex-test` + vitest)
1. shelf→rack→box creation succeeds; rack→shelf rejected (`ALLOWED_PARENT`)
2. move node into its own descendant → rejected via `path` check
3. `path`/`depth` correctly rewritten for all descendants after a move
4. workspace isolation: workspace B cannot read/search/export workspace A
5. place into occupied position → throws, original placement intact
6. **concurrent placement**: two simultaneous `place` calls on one position → exactly one wins
7. move is atomic: source cleared + destination set + `storage_moves` row, or nothing
8. archive blocked while descendants hold samples; allowed when empty
9. restore into a since-occupied position → conflict surfaced
10. permission matrix per function (16 permissions)
11. batch import: invalid row → whole commit rolls back, error report returned
12. export manifest: checksum + record count + applied filters present
13. print job idempotency: same `request_id` twice → one job
14. sample dispose retains history; hard delete no longer reachable

### Frontend (vitest + RTL)
breadcrumb navigation; add/edit/archive/restore dialogs; position grid renders
all six states with non-colour affordances; add-sample-from-empty-position
prefills location; move conflict surfaces a usable error; batch import
preview/error flow; label preview; export field/format selection; loading /
empty / error / permission-denied / archived states; keyboard traversal of the
grid; axe accessibility pass.

### Playwright E2E
The prompt's 11 scenarios, unchanged.

### Regression gate (must stay green)
`npx tsc --noEmit` · `npx vitest run` (currently 43/43) · `npm run build`
(currently clean) · existing 125 backend pytest tests.

---

## 4. Exact file list

### Create — Convex
```
convex/storageUnits.ts          convex/storageNodes.ts
convex/storagePositions.ts      convex/labels.ts
convex/exports.ts               convex/permissions.ts
convex/migrations/backfillStorage.ts
convex/lib/storageTree.ts       (ALLOWED_PARENT, path helpers, cycle check)
convex/lib/audit.ts
```

### Create — frontend
All files under the four `features/*` trees in §2 (~40 files).

### Modify
```
convex/schema.ts                 add 8 tables, extend `samples` (optional fields only)
convex/samples.ts                add place/move/checkout/return/dispose/archive/batch
convex/freezer.ts                mark legacy; keep working, stop being the write path
frontend/src/lib/convexClient.ts extend freezerApi/samplesApi; keep existing signatures
frontend/src/utils/exportUtils.ts fix M1 (real XLSX), M2 (real PDF), S1 (escape HTML)
frontend/src/pages/FreezerBiobankPage.tsx   re-point at features/storage
frontend/src/pages/StorageMapPage.tsx       re-point
frontend/src/pages/SampleHubPage.tsx        extract 2,219 lines into features/samples
frontend/src/pages/LabelPrinterPage.tsx     re-point at features/labels
frontend/src/components/Layout.tsx          Inventory sub-nav → new storage browser
```

### Delete (dead code — 1,160 lines, zero importers)
```
frontend/src/pages/PrintLabelsPage.tsx
frontend/src/pages/SamplesPage.tsx
```
Confirm with a repo-wide reference check immediately before removal.

### Explicitly NOT touched
`backend/app/api/freezer.py`, `backend/app/api/samples.py`,
`backend/app/models/models.py`, `backend/migrations/` — dead path per ADR.
Their disposition is a separate decision.

---

## 5. Open questions — resolved 2026-09-20 (unblocks Checkpoint B)

1. **Git.** ~~`LabOS-main/` is not a repository.~~ Resolved: repo initialized,
   work proceeds on branch `claude/whats-next-7e19d9` (baseline commit
   `75f54f4`).
2. **Tenancy scope.** RESOLVED — new storage tables only, scoped by
   `workspace_id`. The existing 58 tables are not retrofitted.
3. **Existing production data.** RESOLVED — create a dev Convex deployment,
   push schema + run the backfill there first and verify, then run against
   the live deployment (`tame-ladybug-197`).
4. **Unresolved legacy slots.** RESOLVED — leave the position occupied with a
   label, flag it for manual reconciliation (no stub samples created). Matches
   the plan's original assumption.
5. **ZPL / thermal printers.** RESOLVED — browser-print only for Checkpoint E.
   ZPL deferred until physical hardware is available to test against.
6. **Permanent delete.** RESOLVED — `storage.delete` granted to Owner **and**
   Lab Admin.
