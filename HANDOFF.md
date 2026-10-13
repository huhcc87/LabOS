# LabOS — handoff (read this first when you resume)

Last updated: 2026-10-11. Branch `claude/lab-protocol-revisions-91680c`, PR https://github.com/huhcc87/LabOS/pull/32.
Production backend: Convex `tame-ladybug-197` (deployed from `frontend/`). Frontend: `frontend/` (React + Vite + TS).

## The product plan (owner's words, in order)
1. Make it a **fully functional** app.
2. Give it away **free for 15 days**, then **subscription per lab**.
3. The **PI has full control of their lab and controls their students**. The owner (Super Admin) stays above all labs.

## Phases and status
| Phase | What | Status |
|---|---|---|
| 1 | One lab = one workspace (data separation, PI controls own lab) | **Backend done and deployed. UI half left (see "Phase 1: left to do").** |
| 2 | Self-service "Create your lab" signup + 15-day trial (banner, read-only after trial) | Not started |
| 3 | Stripe subscriptions per lab (plans, seats, webhook, billing page, customer portal) | Not started. Only card-saving exists (`convex/stripe.ts`, `payments.ts`) |
| 4 | Make everything fully functional + production hardening | In progress (see "Module audit") |

Recommended order: finish Phase 1 UI → Phase 2 → Phase 3, Phase 4 alongside.

## Phase 1: how lab separation works (done)
- `convex/tenant.ts`: every backend module imports `query`/`mutation` from here, not from `_generated/server`. Inside a handler `ctx.db` is lab-scoped:
  reads only return the caller's lab (via the `by_lab` index), get/patch/delete of another lab's row act as "not found", inserts are stamped with the caller's lab. `ctx.rawDb` is the unscoped escape hatch (use rarely, e.g. global email-unique check). `ctx.labId` is the caller's lab.
- `convex/tenantTables.ts`: the list of lab-data tables (59). Users are scoped by `users.home_lab_id`. A Super Admin works in one lab at a time (`users.active_lab_id`, default = home lab).
- Everything not wrapped must set `lab_id` itself: internal functions, HTTP handlers, cron (see `iot.ts` ingest/checkOffline, audit_logs inserts in `customAuth.ts`/`totp.ts`). Modules left on plain builders on purpose: `customAuth`, `invites`, `totp`, `labsAdmin`, `http`, `crons`, `seedProdAdmin`.
- `convex/labsAdmin.ts`: `current` (header), `list` + `create` (new lab + PI invite) + `switchTo` (Super Admin), `rename` (PI of that lab or Super Admin).
- `convex/org.ts` (organizations/sites/labs) is now Super Admin only.
- Tests: `tests/unit/tenant.test.ts` (9 isolation tests, run with convex-test), `tests/unit/tenantSchema.test.ts` (fails if a table has `lab_id` but isn't scoped). I checked the isolation tests fail when isolation is switched off. **Run `npx vitest run` after any backend change.** Currently 67 passing.
- Migration was run in production: first lab "My Lab" (id `n17dbn7xy89ertf2akh9hkdvhx8g23kx`), owner huhcc87@gmail.com; all 59 tables backfilled; `migrate:audit` says "all rows belong to a lab". `convex/migrate.ts` is internal-only and can be deleted once nothing else needs it.
- Adding a NEW lab table: add `lab_id: v.optional(v.id("labs"))` + `.index("by_lab", ["lab_id"])` to the schema AND add its name to `LAB_TABLES`. The schema test enforces this.

### Phase 1: left to do
1. **Frontend**: show the lab name in the header (`api.labsAdmin.current`); Super Admin lab switcher; a "Labs" page under Admin (Super Admin: list labs, create lab + PI invite link, switch). PI: rename own lab.
2. PI "My Students" flow should keep working inside the lab (check `piAccess` end to end in the browser as a PI and as a student of a second lab).
3. Legacy `convex/labMembers.ts` + the "Lab Members (PI)" page use the old `labs`/`lab_memberships` model; decide to remove or fold into the new model.
4. Public `customAuth.register` creates an account with **no lab** (it can't see anything). Phase 2 replaces it with "Create your lab". Until then consider disabling it.
5. Performance note: `ScopedQuery` uses the `by_lab` index only when the caller doesn't pick its own index; otherwise it filters after the caller's index (fine now, review before many labs).
6. Browser-test two labs with two real PIs (create a second lab via `labsAdmin.create`, sign in as its PI, confirm nothing from the first lab shows).

## Accounts and security (current state)
- Only account: **huhcc87@gmail.com, Super Admin**. All demo accounts (`*@lab.local`, `admin@labos.app`, verify-test, checmirumi) were deleted. The seed script with public demo passwords is deleted.
- `seedProdAdmin.ts` still falls back to a public default password if none is passed. Always pass a strong password, or remove the fallback.
- Video calls use public Jitsi (no patient data). Set `VITE_JITSI_URL` for your own server.
- Convex env (set in the dashboard, not in git): `BREVO_API_KEY`, `INVITE_FROM_EMAIL`, `APP_URL` for invite/reset emails; later `STRIPE_*`.

## Module audit (Phase 4)
Real, saved in Convex and verified: Samples (+chain of custody), Freezer/Biobank (shelf→rack→box→position, Excel export), Labels (scan any QR/barcode → store), Lab Hub protocols (+approvals), Users/Invites/PI student access, Sensors (device HTTP endpoint, alerts, offline detection, ESP32/Pi guide), Reports & Analytics (live data + saved Excel reports), Video (Jitsi link), Admin.
Not yet real / known gaps:
- Protocols page (`src/features/protocols`) starts empty and is **not persisted** (Lab Hub → Protocols is the persistent one).
- ELN "swarm" (`src/features/eln-swarm`) generates random scores; literature section is empty on purpose.
- Many Grant Hub pages, Experiments, IRB/Clinical hubs, Documents, Vendor Intelligence etc. are local-state shells (arrays are empty, nothing saved). Audit each: wire to Convex or hide.
- Safety/Compliance pages, Inventory, Procurement, Reagent Cart: check persistence.
- Meetings knowledge base / polls are local-only and empty.
- `tests/e2e/*` and `backend/` (old FastAPI) are legacy and reference deleted demo accounts. Not used by the app.
- Email invites need Brevo env vars.

## How to work
```bash
cd frontend
npm install && npm run dev                 # app at http://localhost:5173 (uses the production Convex URL in .env)
npx tsc --noEmit && npx tsc --noEmit -p convex
npx vitest run
npx convex deploy --dry-run -y             # then: npx convex deploy -y   (production!)
npx convex run --prod <module>:<fn> '{...}' # run internal functions
graphify update .                          # refresh the code graph after code changes
```
- Graph for fast orientation: `graphify query "<question>"`, `graphify-out/GRAPH_REPORT.md`.
- Project rules: read before editing, minimal changes, no destructive git, never commit secrets. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Tooling quirks seen: `node -e`/`python3 -` heredocs are blocked, use script files; Convex dev changes `.env.local`, keep `VITE_CONVEX_URL` in `.env`.

## Commit history of this session (newest first)
Tenancy backend (commits "feat: lab separation") · header controls · AI Manager via header · Video under Resources · Jitsi video + fake data removal · Sensors module · Reports rewire · edit-save fix · label/freezer event logging · Samples/Events on Convex · Labels scan-and-store · freezer storage · PI approvals and student access.
