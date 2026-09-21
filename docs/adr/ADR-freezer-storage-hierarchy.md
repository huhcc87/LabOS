# ADR — Freezer / Storage Hierarchy Model

Status: **Proposed** (Checkpoint A — awaiting approval)
Date: 2026-09-20
Supersedes: nothing. Related: `docs/audits/FREEZER_SAMPLE_STORAGE_GAP_REPORT.md`

---

## Context

LabOS must represent `Facility → Unit → Shelf → Rack → Box → Position → Sample`.
Today it represents `freezer → rack:int → box:int → row/col` with no shelf, no
named rack/box entities, and no link between a position and a sample record.

The implementation prompt offers two options — a generalised `StorageNode`
adjacency model, or explicit tables per level — and requires the decision be
recorded here.

### Platform constraint that drives the decision

The system of record is **Convex**, not PostgreSQL (see Gap Report §0.1; the
FastAPI/Alembic path in the prompt is dead code). Convex differs from Postgres
in ways that matter here:

| Capability | Postgres | Convex | Consequence |
|---|---|---|---|
| Unique constraint | `UNIQUE` index | **none** | Uniqueness must be enforced inside mutations |
| Foreign keys | `REFERENCES` | `v.id("table")` type only, no cascade/FK enforcement | Referential integrity is application-level |
| `CHECK` constraints | yes | **none** | Type/parent validity enforced in mutations |
| Recursive query | `WITH RECURSIVE` | **none** | Tree traversal is N queries — must denormalise |
| Transaction isolation | configurable | **serializable, OCC with auto-retry** | Read-then-write inside one mutation *is* race-safe |

That last row is the important one. The prompt requires position uniqueness be
enforced "with a database constraint/transaction, not only UI checks". Convex
has no unique constraint, **but** a single mutation that reads a position and
then writes it executes serializably — a conflicting concurrent mutation is
retried or fails, it cannot interleave. So a check-then-write *inside one
mutation* satisfies the requirement. A check in the client does not.

---

## Decision

### 1. One `storage_nodes` adjacency table with a materialised path

Shelf, rack, and box become rows in a single `storage_nodes` table
discriminated by `kind`, rather than three explicit tables.

Rationale:
- The three levels share ~90% of their fields (name, ordinal, capacity, archive,
  audit, label). Three near-identical tables triples the function surface.
- The prompt requires arbitrary depth in places ("custom empty structure",
  liquid-nitrogen tanks that have no shelves). A fixed 3-table chain cannot
  express "rack directly in unit" without nullable-everything.
- Convex cannot do recursive queries, so **every node carries
  `path: Id<"storage_nodes">[]` and `unit_id`**. This buys:
  - breadcrumbs with **zero** traversal queries,
  - "everything under node X" via a single indexed `unit_id` query + path filter,
  - **O(1) cycle prevention**: a move is rejected if `target.path` contains the
    moved node's id. No recursive descent needed.

Cost accepted: `kind` validity and parent–child legality are enforced in
mutation code (an `ALLOWED_PARENT` map), not by the database. This is
unavoidable on Convex regardless of table layout, so it is not a point against
the adjacency model.

### 2. Positions are **sparse** — materialised only when non-empty

A box stores `rows`, `cols`, and a naming rule. An empty position has **no row**.
A `storage_positions` row is created only when a position becomes occupied,
reserved, quarantined, or unavailable, and is deleted back to empty on vacate
(with the event retained in `sample_events`).

Rationale:
- The prompt's own example template is `2 shelves × 5 racks × 4 boxes × 81
  positions` = **3,240 position rows per freezer**. Ten freezers = 32,400 rows
  that are almost entirely empty. Eager materialisation makes freezer creation
  slow, makes the "preview estimated record count" warning in §2.1 necessary,
  and bloats the database to store the absence of information.
- Occupancy maths stays cheap: `occupied = count(positions in box)`,
  `total = rows × cols`, `empty = total − occupied`. The grid UI renders from
  dimensions + a sparse occupied map.

Cost accepted: "reserve an empty position" must insert a row (fine — reserving
is exactly a state change), and per-position notes on an empty position are not
supported (acceptable; notes belong on the box).

### 3. Position occupancy is enforced in the mutation, not the client

`samples.place` / `samples.move` perform, inside one mutation:
1. load destination position → if a row exists and is not `empty`, **throw**;
2. load source position (move only);
3. write destination, clear source, append `sample_events` rows — all in the
   same transaction.

Serializable execution makes this atomic and race-safe. Satisfies prompt §3.3.

### 4. Sample ↔ position is single-sourced

`storage_positions.sample_id` becomes a real `v.id("samples")`. The free-text
`samples.location` is **derived**, written by the move mutation as a denormalised
display path (`"316 -80C / Top Shelf / Rack 5 / Box A / A1"`) and never edited
directly. Fixes gap C2/C3.

### 5. Convex schema evolution, not Alembic

There are no Alembic migrations in this plan. Convex migration = add new tables
and optional fields, run a backfill mutation, verify, then stop writing to the
old tables. **The legacy `freezers` / `freezer_slots` tables are not dropped** in
Checkpoint B — they are left read-only as the rollback path.

---

## Proposed schema

> **Correction, 2026-09-20:** the `workspace_id` field below is implemented as
> `lab_id: v.id("labs")`. `workspaces` has no membership table (Gap Report
> H2 — zero existing links from a user to a workspace), while
> `lab_memberships` (`user_id`, `lab_id`, `lab_role`) already exists and is
> populated, so it is the real tenancy boundary. Every `workspace_id` below
> reads as `lab_id` against `labs`.

```ts
storage_facilities: defineTable({
  workspace_id: v.id("workspaces"),
  name: v.string(), building: v.optional(v.string()), room: v.optional(v.string()),
  created_at: v.number(), created_by: v.id("users"),
  updated_at: v.number(), updated_by: v.optional(v.id("users")),
  version: v.number(),
  archived_at: v.optional(v.number()), archived_by: v.optional(v.id("users")),
}).index("by_workspace", ["workspace_id"]),

storage_units: defineTable({                    // the freezer itself
  workspace_id: v.id("workspaces"),
  facility_id: v.optional(v.id("storage_facilities")),
  name: v.string(),
  storage_type: v.string(),                     // -196|-150|-80|-20|4|rt|ln2|custom
  target_temp: v.optional(v.number()),
  temp_unit: v.optional(v.string()),
  manufacturer: v.optional(v.string()), model: v.optional(v.string()),
  serial_number: v.optional(v.string()), asset_number: v.optional(v.string()),
  owner_team: v.optional(v.string()),
  iot_sensor_id: v.optional(v.id("iot_sensors")),
  status: v.string(),                           // normal|warning|critical|offline|maintenance
  notes: v.optional(v.string()),
  legacy_freezer_id: v.optional(v.id("freezers")),   // migration provenance
  ...auditFields,
}).index("by_workspace", ["workspace_id"])
  .index("by_workspace_status", ["workspace_id", "status"])
  .searchIndex("search_name", { searchField: "name" }),

storage_nodes: defineTable({                    // shelf | rack | box
  workspace_id: v.id("workspaces"),
  unit_id: v.id("storage_units"),
  parent_id: v.optional(v.id("storage_nodes")), // null => child of the unit
  path: v.array(v.id("storage_nodes")),         // ancestors, root-first
  depth: v.number(),
  kind: v.string(),                             // "shelf" | "rack" | "box"
  name: v.string(),
  ordinal: v.optional(v.number()),
  rows: v.optional(v.number()),                 // box only
  cols: v.optional(v.number()),                 // box only
  position_naming: v.optional(v.string()),      // "alpha_row" | "numeric"
  capacity: v.optional(v.number()),             // shelf/rack: max children
  ...auditFields,
}).index("by_unit", ["unit_id"])
  .index("by_parent", ["parent_id"])
  .index("by_workspace", ["workspace_id"]),

storage_positions: defineTable({                // SPARSE — only non-empty
  workspace_id: v.id("workspaces"),
  box_id: v.id("storage_nodes"),
  row: v.number(), col: v.number(),
  label: v.string(),                            // "A1"
  state: v.string(),                            // occupied|reserved|quarantined|unavailable
  sample_id: v.optional(v.id("samples")),       // REAL reference
  reserved_by: v.optional(v.id("users")),
  reserved_until: v.optional(v.number()),
  ...auditFields,
}).index("by_box", ["box_id"])
  .index("by_box_pos", ["box_id", "row", "col"])
  .index("by_sample", ["sample_id"]),

storage_moves: defineTable({                    // append-only ledger
  workspace_id: v.id("workspaces"),
  sample_id: v.id("samples"),
  from_box_id: v.optional(v.id("storage_nodes")), from_label: v.optional(v.string()),
  to_box_id: v.optional(v.id("storage_nodes")),   to_label: v.optional(v.string()),
  reason: v.optional(v.string()),
  moved_by: v.id("users"), moved_at: v.number(),
  request_id: v.optional(v.string()),           // idempotency
}).index("by_sample", ["sample_id"]),

label_templates / print_jobs / export_jobs      // see Implementation Plan §3
```

`samples` gains: `workspace_id`, `container_type`, `parent_sample_id`,
`volume`/`volume_unit`, `concentration`/`concentration_unit`, `passage_number`,
`freeze_thaw_count`, `hazard_class`, `retention_date`, `owner_team`,
`checked_out_by`/`checked_out_at`/`expected_return`, `disposed_at`/`disposal_reason`,
`archived_at`, `version` — all optional, so existing rows stay valid.

---

## Migration plan (Convex, reversible)

| Step | Action | Reversible? |
|---|---|---|
| 1 | Add new tables + optional fields. No writes change. | Yes — additive only |
| 2 | `migrations.backfillStorage` (internal mutation, batched, idempotent): each `freezers` row → `storage_units` with `legacy_freezer_id`; synthesise one `shelf` node per distinct `rack`, a `rack` node, a `box` node per distinct `box`; each `freezer_slots` row with a non-empty `sample_id` → sparse `storage_positions`. | Yes — new tables can be cleared; legacy untouched |
| 3 | Resolve `freezer_slots.sample_id` (string) against `samples.sample_id`. Match → real `v.id("samples")`. No match → `state:"occupied"`, `sample_id: undefined`, `label` retained, and row listed in the preflight report as **unresolved**. | Yes |
| 4 | Emit `docs/status/STORAGE_MIGRATION_PREFLIGHT.md`: counts in/out, unresolved slots, duplicate barcodes, positions that exceed their box dimensions. **Review gate — no cutover until reviewed.** | n/a |
| 5 | Point reads at new tables behind a flag; legacy tables become read-only. | Yes — flip the flag back |
| 6 | Drop legacy tables. **Separate, later, explicitly approved step.** | No — hence separate |

Data-loss risk is confined to step 6, which is not part of Checkpoint B.

---

## Consequences

**Positive:** shelf level and named nodes become possible; breadcrumbs and
subtree queries are O(1)/single-query; cycles impossible by construction;
position races eliminated; sample↔location single-sourced; storage cost scales
with samples stored, not positions defined.

**Negative / accepted:** `path` must be rewritten for descendants when a node
moves (bounded: one indexed query + patch per descendant, and node moves are
rare); `kind` legality lives in code, so it needs unit tests to stay honest;
sparse positions mean "empty" is an absence, which every read path must handle.

**Rejected alternatives:**
- *Explicit tables per level* — triples the function surface for near-identical
  fields and cannot express variable-depth units.
- *Eager position materialisation* — 3,240 rows per freezer to record emptiness.
- *Keep `freezer_slots` and add a `shelf` column* — leaves C2/C3/C6 unfixed and
  still has no entity to name, label, or archive.
