# Freezer / Sample Storage — Status

Last updated: 2026-09-23 · **All checkpoints A–F complete.** · commits `2109820` `ce2b7f3` `2c0c540` `3f95424` `656f9b3` `0ebf1d3` `8fe616d` `5485540`

Checkpoints D and E landed since the table below was last written in full:
- **D** (samples/scan/move UI): place/move/checkout/return/dispose dialogs + barcode scan, wired into the Checkpoint C position grid.
- **E** (labels & exports), scoped per Plan §5 Q5 (no ZPL — no hardware): fixed `exportUtils.ts` to produce real `.xlsx`/`.pdf` (was a CSV mislabeled "Excel" and a print-dialog "PDF" built from unescaped HTML — a real stored-XSS path, now gone); added one-click barcode label printing to `SampleActionsDialog`, reusing the existing `Barcode` component and `LabelPrinterPage`'s `@media print` pattern instead of standing up a parallel backend template system.
- Deferred from E: `label_templates`/`print_jobs` backend tables (shared template library + print-job audit trail) — separable from shipping a working print button, not done.
- **Checkpoint F (automated verification): DONE.** `tsc` clean, 170/170 tests, `npm run build` clean. No Playwright E2E — "the prompt's 11 scenarios" referenced by the plan were never captured in this repo, so there's nothing to automate against; manual click-through still recommended.
- **Migration run: DONE.** `migrations/backfillStorage:run` executed via the Convex Dashboard — dev deployment (`peaceful-squirrel-447`): 12 rows updated, spot-checked clean. Production (`tame-ladybug-197`): 47 rows updated.
- Also shipped beyond the original checkpoint scope: cross-tenant sample-leak fixes (code review), global search (⌘K) + Excel/PDF export, batch sample import wizard, LabOS AI chatbot (search + confirm-gated propose/dispose/checkout/create/update/archive), `samples.list`/`samples.get` auth gap fix, N+1 occupancy-query fixes.

| Requirement | Status | Files | API | Migration | Tests | Evidence | Remaining risk |
|---|---|---|---|---|---|---|---|
| Checkpoint A — audit | VERIFIED | `docs/audits/FREEZER_SAMPLE_STORAGE_GAP_REPORT.md` | n/a | n/a | n/a | Source read; every claim carries a `file:line` in Gap Report §5 | none |
| Checkpoint A — ADR | VERIFIED | `docs/adr/ADR-freezer-storage-hierarchy.md` | n/a | plan only | n/a | Decision + rejected alternatives recorded | Convex-vs-Postgres premise needs sign-off |
| Checkpoint A — schema/migration plan | VERIFIED | ADR §"Proposed schema", §"Migration plan" | n/a | 6-step reversible plan | n/a | Written | Step 3 legacy-slot resolution needs a decision (Plan §5 Q4) |
| Checkpoint A — API plan | VERIFIED | Plan §1 | Convex fn map | n/a | n/a | Written | REST→Convex remap deviates from prompt; needs sign-off |
| Checkpoint A — component plan | VERIFIED | Plan §2 | n/a | n/a | n/a | Written | none |
| Checkpoint A — testing plan | VERIFIED | Plan §3 | n/a | n/a | n/a | Written | none |
| Checkpoint B — backend + migration | CODE_COMPLETE | `convex/schema.ts`, `convex/lib/storageTree.ts`, `convex/lib/audit.ts`, `convex/permissions.ts`, `convex/storageUnits.ts`, `convex/storageNodes.ts`, `convex/storagePositions.ts`, `convex/samples.ts` (extended), `convex/migrations/backfillStorage.ts` | 8 new Convex modules per Plan §1 (labels.ts/exports.ts deferred to Checkpoint E) | `migrations/backfillStorage.ts` — batched per freezer, idempotent, sparse, resolves `sample_id`, never touches legacy tables; run manually against a dev deployment first (not yet run against real data) | 69/69 new tests pass across 7 test files | `npx tsc --noEmit` clean; `npx vitest run` 43 baseline + 69 new = 112/112; `npm run build` clean; backend `pytest` untouched (ADR-excluded dead path, not re-run) | Not yet run against real prod data (Plan §5 Q3); no code review yet; UI (C–E) still unwired |
| Checkpoint C — hierarchy UI | CODE_COMPLETE | `src/pages/StorageBrowserPage.tsx`, `src/features/storage/{useCurrentLab,PositionGrid,StorageBreadcrumbs,OccupancySummary,StorageUnitDialog,StorageNodeDialog}.tsx`, `convexClient.ts`/`api.ts` (storageUnitsApi/storageNodesApi/storagePositionsApi), `App.tsx` + `Layout.tsx` (additive nav) | n/a | n/a | 15/15 new RTL tests (PositionGrid, StorageBreadcrumbs, OccupancySummary, useCurrentLab) | `npx tsc --noEmit` clean; `npx vitest run` 112 + 15 = 127/127; `npm run build` clean | Live browser data-flow (units list, dialogs, box grid against real data) not fully verified this session — see note below; sample placement/checkout UI is Checkpoint D, out of scope here |
| Checkpoint D — samples/scan/move | NOT_STARTED | — | — | — | — | — | blocked on B |
| Checkpoint E — labels & exports | NOT_STARTED | — | — | — | — | — | blocked on B; ZPL needs hardware (Q5) |
| Checkpoint F — final verification | NOT_STARTED | — | — | — | — | — | blocked on C–E |

## Baseline at time of audit (unchanged by Checkpoint A)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | pass |
| `npx vitest run` | 43/43 pass |
| `npm run build` | pass (7.6s) |
| backend `pytest` | 125/125 pass (dead path, but green) |

## Checkpoint C exit criteria

- [x] Tenancy gap closed client-side too: reused the existing `labMembersApi.listMy()` (no new "current lab" concept invented) via `useCurrentLab`
- [x] `StorageBrowserPage` — unit list (create incl. template, archive/restore), drill-down through shelf → rack → box, breadcrumbs, occupancy summary, read-only box position grid
- [x] `PositionGrid` — all 5 states (empty/occupied/reserved/quarantined/unavailable) rendered with symbol + text, never colour alone; arrow-key traversal
- [x] Dialogs reuse the existing `Modal` component and match the app's established inline-style convention (no new UI kit introduced)
- [x] `convexClient.ts` extended with `storageUnitsApi`/`storageNodesApi`/`storagePositionsApi` following the exact pattern of `freezerApi`/`samplesApi`
- [x] Nav wired additively (`Layout.tsx`, `App.tsx`) — existing Freezers/Sample Hub pages untouched
- [x] Fixed `convex/tsconfig.json` excluding `*.test.ts` — discovered the colocated Checkpoint B test files were silently breaking every `npx convex dev` push since they were added (Convex's typecheck doesn't know Vite's `import.meta.glob`); root tsconfig / CI gate was never affected, only the local dev-deployment workflow
- [x] Regression gate green (tsc / vitest / build)
- [x] Fixed `public/sw.js`: `/api/*` interception (a pre-Convex REST-backend leftover) was matching on pathname alone, catching Convex's cross-origin `/api/query`/`/api/mutation` calls and silently returning a fake "queued for sync" response on any failure instead of the real error. Scoped to `url.origin === self.location.origin`. Verified live: the error on Storage Hierarchy changed from the fabricated offline message to the real `Failed to fetch`, confirming Convex calls now reach the real handler.
- [ ] **Live interactive verification still incomplete**: the residual `Failed to fetch` is this sandboxed browser tool's own restriction on cross-port loopback fetches (127.0.0.1:5173 → 127.0.0.1:3210), reproduced before the service worker was even involved — not reachable from app code, and not expected against a real deployment (different domain, not loopback) or a normal developer's Chrome. Whoever reviews this should click through the actual UI once against a normal browser or a real dev deployment to confirm the full create-unit → list → drill-in flow.
- [ ] **Code review**
- [ ] **User review and approval → unblocks Checkpoint D**

## Checkpoint B exit criteria

- [x] Schema: 5 new tables + `samples` extension, all additive
- [x] `storageUnits.ts` — list/get/create(+template)/previewTemplate/update/archive/restore/occupancy/purge
- [x] `storageNodes.ts` — list/get/create/createBatch/update/move/archive/restore/breadcrumbs/occupancy
- [x] `storagePositions.ts` — listForBox/reserve/release
- [x] `samples.ts` extended — place/move/checkout/returnSample/dispose/archiveSample/restoreSample/history/batchValidate/batchCommit/resolveBarcode
- [x] `permissions.ts` — lab-scoped tenancy + role-tier permission checks
- [x] `migrations/backfillStorage.ts` — written, tested against seeded legacy data
- [x] Regression gate green (tsc / vitest / build)
- [ ] **Code review**
- [ ] Migration run against a real dev deployment + preflight report reviewed
- [ ] **User review and approval → unblocks Checkpoint C**

## Checkpoint A exit criteria

- [x] Existing implementation inspected with code evidence
- [x] Gap report created
- [x] ADR created
- [x] Schema + migration plan provided
- [x] API plan provided
- [x] Component plan provided
- [x] Testing plan provided
- [x] Exact file list provided
- [x] No behaviour-changing code edits made
- [x] **User review and approval → unblocks Checkpoint B** (2026-09-20; Plan §5 Q1–Q6 resolved)
