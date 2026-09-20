# Freezer / Sample Storage — Status

Last updated: 2026-09-20 · Current checkpoint: **A (audit & design) — complete, awaiting review**

| Requirement | Status | Files | API | Migration | Tests | Evidence | Remaining risk |
|---|---|---|---|---|---|---|---|
| Checkpoint A — audit | VERIFIED | `docs/audits/FREEZER_SAMPLE_STORAGE_GAP_REPORT.md` | n/a | n/a | n/a | Source read; every claim carries a `file:line` in Gap Report §5 | none |
| Checkpoint A — ADR | VERIFIED | `docs/adr/ADR-freezer-storage-hierarchy.md` | n/a | plan only | n/a | Decision + rejected alternatives recorded | Convex-vs-Postgres premise needs sign-off |
| Checkpoint A — schema/migration plan | VERIFIED | ADR §"Proposed schema", §"Migration plan" | n/a | 6-step reversible plan | n/a | Written | Step 3 legacy-slot resolution needs a decision (Plan §5 Q4) |
| Checkpoint A — API plan | VERIFIED | Plan §1 | Convex fn map | n/a | n/a | Written | REST→Convex remap deviates from prompt; needs sign-off |
| Checkpoint A — component plan | VERIFIED | Plan §2 | n/a | n/a | n/a | Written | none |
| Checkpoint A — testing plan | VERIFIED | Plan §3 | n/a | n/a | n/a | Written | none |
| Checkpoint B — backend + migration | NOT_STARTED | — | — | — | — | — | blocked on Plan §5 Q1–Q4 |
| Checkpoint C — hierarchy UI | NOT_STARTED | — | — | — | — | — | blocked on B |
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
- [ ] **User review and approval → unblocks Checkpoint B**
