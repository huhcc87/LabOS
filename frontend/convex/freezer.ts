/**
 * Freezer storage: Freezer → Shelf (top to bottom) → Rack → Box → positions.
 * Everyone with Sample Hub access can see and log samples; changing the structure
 * (adding or deleting freezers, shelves, racks, boxes) needs the staff role or higher.
 */
import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { hubGuard } from "./authHelper";
// Students only reach this module if their PI allowed this hub.
const { requireAuth, requireRole } = hubGuard("Sample Hub");

const MAX_DIM = 26; // rows A–Z, up to 26 columns
const cleanName = (s: string, what: string) => {
  const name = s.trim();
  if (!name) throw new ConvexError(`${what} needs a name`);
  if (name.length > 60) throw new ConvexError(`${what} name is too long (60 characters max)`);
  return name;
};
const dim = (n: number, what: string) => {
  if (!Number.isInteger(n) || n < 1 || n > MAX_DIM) throw new ConvexError(`${what} must be between 1 and ${MAX_DIM}`);
  return n;
};

// ── Freezers ──────────────────────────────────────────────────────────────

export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("freezers").collect();
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    location: v.optional(v.string()),
    temperature: v.optional(v.number()),
    capacity_racks: v.optional(v.number()),
    capacity_boxes: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, args.token, "staff");
    const { token: _t, name, ...rest } = args;
    return await ctx.db.insert("freezers", { ...rest, name: cleanName(name, "Freezer"), created_at: Date.now() });
  },
});

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("freezers"),
    name: v.optional(v.string()),
    location: v.optional(v.string()),
    temperature: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, name, ...rest }) => {
    await requireRole(ctx, token, "staff");
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = cleanName(name, "Freezer");
    for (const [k, val] of Object.entries(rest)) if (val !== undefined) patch[k] = val;
    await ctx.db.patch(id, patch);
  },
});

// ── Cascading deletes ─────────────────────────────────────────────────────

async function deleteBox(ctx: MutationCtx, boxId: Id<"freezer_boxes">) {
  const slots = await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", boxId)).collect();
  await Promise.all(slots.map((s) => ctx.db.delete(s._id)));
  await ctx.db.delete(boxId);
}
async function deleteRack(ctx: MutationCtx, rackId: Id<"freezer_racks">) {
  const boxes = await ctx.db.query("freezer_boxes").withIndex("by_rack", (q) => q.eq("rack_id", rackId)).collect();
  for (const b of boxes) await deleteBox(ctx, b._id);
  await ctx.db.delete(rackId);
}
async function deleteShelf(ctx: MutationCtx, shelfId: Id<"freezer_shelves">) {
  const racks = await ctx.db.query("freezer_racks").withIndex("by_shelf", (q) => q.eq("shelf_id", shelfId)).collect();
  for (const r of racks) await deleteRack(ctx, r._id);
  await ctx.db.delete(shelfId);
}

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezers") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    if (!(await ctx.db.get(id))) throw new ConvexError("Freezer not found");
    const shelves = await ctx.db.query("freezer_shelves").withIndex("by_freezer", (q) => q.eq("freezer_id", id)).collect();
    for (const s of shelves) await deleteShelf(ctx, s._id);
    // Anything left (older numbered slots)
    const rest = await ctx.db.query("freezer_slots").withIndex("by_freezer", (q) => q.eq("freezer_id", id)).collect();
    await Promise.all(rest.map((s) => ctx.db.delete(s._id)));
    await ctx.db.delete(id);
    return id;
  },
});

/** What a delete would remove — shown in the confirmation so nothing disappears by surprise. */
export const impact = query({
  args: {
    token: v.optional(v.string()),
    kind: v.union(v.literal("freezer"), v.literal("shelf"), v.literal("rack"), v.literal("box")),
    id: v.string(),
  },
  handler: async (ctx, { token, kind, id }) => {
    await requireAuth(ctx, token);
    let racks = 0, boxes = 0, samples = 0;
    const countBox = async (boxId: Id<"freezer_boxes">) => {
      boxes++;
      const slots = await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", boxId)).collect();
      samples += slots.filter((s) => s.sample_id || s.label).length;
    };
    const countRack = async (rackId: Id<"freezer_racks">) => {
      racks++;
      const bs = await ctx.db.query("freezer_boxes").withIndex("by_rack", (q) => q.eq("rack_id", rackId)).collect();
      for (const b of bs) await countBox(b._id);
    };
    const countShelf = async (shelfId: Id<"freezer_shelves">) => {
      const rs = await ctx.db.query("freezer_racks").withIndex("by_shelf", (q) => q.eq("shelf_id", shelfId)).collect();
      for (const r of rs) await countRack(r._id);
    };
    if (kind === "box") await countBox(id as Id<"freezer_boxes">);
    else if (kind === "rack") await countRack(id as Id<"freezer_racks">);
    else if (kind === "shelf") await countShelf(id as Id<"freezer_shelves">);
    else {
      const shelves = await ctx.db.query("freezer_shelves").withIndex("by_freezer", (q) => q.eq("freezer_id", id as Id<"freezers">)).collect();
      for (const s of shelves) await countShelf(s._id);
    }
    return { racks, boxes, samples };
  },
});

// ── Structure ─────────────────────────────────────────────────────────────

/** Whole layout of one freezer in a single call, with how full each box is. */
export const structure = query({
  args: { token: v.optional(v.string()), freezer_id: v.id("freezers") },
  handler: async (ctx, { token, freezer_id }) => {
    await requireAuth(ctx, token);
    const [shelves, racks, boxes, slots] = await Promise.all([
      ctx.db.query("freezer_shelves").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_racks").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_boxes").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_slots").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
    ]);
    const filled = new Map<string, number>();
    for (const s of slots) if (s.box_id && (s.sample_id || s.label)) filled.set(s.box_id, (filled.get(s.box_id) ?? 0) + 1);
    const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;
    return {
      shelves: shelves.sort(byPos),
      racks: racks.sort(byPos),
      boxes: boxes.sort(byPos).map((b) => ({ ...b, filled: filled.get(b._id) ?? 0 })),
    };
  },
});

/** Make room at `index` (0-based) by moving later items down one place; returns the index to use. */
async function openSlot<T extends { _id: Id<any>; position: number }>(ctx: MutationCtx, items: T[], wanted: number | undefined): Promise<number> {
  const index = wanted === undefined ? items.length : Math.max(0, Math.min(items.length, Math.floor(wanted)));
  await Promise.all(items.filter((i) => i.position >= index).map((i) => ctx.db.patch(i._id, { position: i.position + 1 })));
  return index;
}

export const addShelf = mutation({
  args: { token: v.optional(v.string()), freezer_id: v.id("freezers"), name: v.string(), position: v.optional(v.number()) },
  handler: async (ctx, { token, freezer_id, name, position }) => {
    await requireRole(ctx, token, "staff");
    const existing = await ctx.db.query("freezer_shelves").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect();
    const index = await openSlot(ctx, existing, position);
    return await ctx.db.insert("freezer_shelves", { freezer_id, name: cleanName(name, "Shelf"), position: index, created_at: Date.now() });
  },
});

export const renameShelf = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_shelves"), name: v.string() },
  handler: async (ctx, { token, id, name }) => {
    await requireRole(ctx, token, "staff");
    await ctx.db.patch(id, { name: cleanName(name, "Shelf") });
  },
});

export const removeShelf = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_shelves") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    await deleteShelf(ctx, id);
  },
});

export const addRack = mutation({
  args: { token: v.optional(v.string()), shelf_id: v.id("freezer_shelves"), name: v.optional(v.string()), position: v.optional(v.number()) },
  handler: async (ctx, { token, shelf_id, name, position }) => {
    await requireRole(ctx, token, "staff");
    const shelf = await ctx.db.get(shelf_id);
    if (!shelf) throw new ConvexError("Shelf not found");
    const existing = await ctx.db.query("freezer_racks").withIndex("by_shelf", (q) => q.eq("shelf_id", shelf_id)).collect();
    const index = await openSlot(ctx, existing, position);
    return await ctx.db.insert("freezer_racks", {
      freezer_id: shelf.freezer_id, shelf_id,
      name: name?.trim() ? cleanName(name, "Rack") : `Rack #${index + 1}`,
      position: index, created_at: Date.now(),
    });
  },
});

export const renameRack = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_racks"), name: v.string() },
  handler: async (ctx, { token, id, name }) => {
    await requireRole(ctx, token, "staff");
    await ctx.db.patch(id, { name: cleanName(name, "Rack") });
  },
});

export const removeRack = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_racks") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    await deleteRack(ctx, id);
  },
});

export const addBox = mutation({
  args: {
    token: v.optional(v.string()),
    rack_id: v.id("freezer_racks"),
    name: v.string(),
    rows: v.number(),
    cols: v.number(),
  },
  handler: async (ctx, { token, rack_id, name, rows, cols }) => {
    await requireRole(ctx, token, "staff");
    const rack = await ctx.db.get(rack_id);
    if (!rack) throw new ConvexError("Rack not found");
    const existing = await ctx.db.query("freezer_boxes").withIndex("by_rack", (q) => q.eq("rack_id", rack_id)).collect();
    return await ctx.db.insert("freezer_boxes", {
      freezer_id: rack.freezer_id, rack_id, name: cleanName(name, "Box"),
      rows: dim(rows, "Rows"), cols: dim(cols, "Columns"), position: existing.length, created_at: Date.now(),
    });
  },
});

export const renameBox = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_boxes"), name: v.string() },
  handler: async (ctx, { token, id, name }) => {
    await requireRole(ctx, token, "staff");
    await ctx.db.patch(id, { name: cleanName(name, "Box") });
  },
});

export const removeBox = mutation({
  args: { token: v.optional(v.string()), id: v.id("freezer_boxes") },
  handler: async (ctx, { token, id }) => {
    await requireRole(ctx, token, "staff");
    await deleteBox(ctx, id);
  },
});

// ── Samples in a box ──────────────────────────────────────────────────────

export const boxSlots = query({
  args: { token: v.optional(v.string()), box_id: v.id("freezer_boxes") },
  handler: async (ctx, { token, box_id }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", box_id)).collect();
  },
});

const slotFields = {
  sample_id: v.optional(v.string()),
  label: v.optional(v.string()),
  sample_type: v.optional(v.string()),
  owner: v.optional(v.string()),
  volume: v.optional(v.string()),
  barcode: v.optional(v.string()),
  expiry_date: v.optional(v.number()),
  notes: v.optional(v.string()),
};

/** Add or change the sample at one position. */
export const setSlot = mutation({
  args: { token: v.optional(v.string()), box_id: v.id("freezer_boxes"), row: v.number(), col: v.number(), ...slotFields },
  handler: async (ctx, { token, box_id, row, col, ...fields }) => {
    const userId = await requireAuth(ctx, token);
    const box = await ctx.db.get(box_id);
    if (!box) throw new ConvexError("Box not found");
    if (row < 0 || row >= box.rows || col < 0 || col >= box.cols) throw new ConvexError("That position isn't in this box");
    if (!fields.sample_id?.trim() && !fields.label?.trim()) throw new ConvexError("Enter a sample ID or a label");
    const existing = await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", box_id).eq("row", row).eq("col", col)).first();
    const data = { ...fields, updated_at: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    const slotId = await ctx.db.insert("freezer_slots", { freezer_id: box.freezer_id, box_id, row, col, ...data });
    const slot = await ctx.db.get(slotId);
    if (slot) { const path = await describe(ctx, slot); await logMove(ctx, userId, fields.sample_id, "Stored", `Stored at ${path}`, path); }
    return slotId;
  },
});

/** Empty one position (delete the sample record there). */
export const clearSlot = mutation({
  args: { token: v.optional(v.string()), box_id: v.id("freezer_boxes"), row: v.number(), col: v.number() },
  handler: async (ctx, { token, box_id, row, col }) => {
    const userId = await requireAuth(ctx, token);
    const existing = await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", box_id).eq("row", row).eq("col", col)).first();
    if (existing) {
      const path = await describe(ctx, existing);
      await ctx.db.delete(existing._id);
      await logMove(ctx, userId, existing.sample_id, "Retrieved", `Removed from ${path}`);
    }
  },
});

// ── Expiry and search (with where each sample is) ─────────────────────────

/** Add a chain-of-custody event (and keep the location in step) when a stored sample has a matching Samples record. */
export async function logMove(ctx: MutationCtx, userId: Id<"users">, sampleCode: string | undefined, event: string, details: string, location?: string) {
  const code = sampleCode?.trim();
  if (!code) return;
  const sample = await ctx.db.query("samples").withIndex("by_sample_id", (q) => q.eq("sample_id", code)).first();
  if (!sample) return;
  await ctx.db.insert("sample_events", { sample_id: sample._id, event_type: event, description: details, performed_by: userId, performed_at: Date.now() });
  if (location !== undefined) await ctx.db.patch(sample._id, { location });
}

const rowLetter = (n: number) => String.fromCharCode(65 + n);

/** "ULT Freezer › Top Shelf › Rack #1 › Box A › B3" for a slot. */
export async function describe(ctx: QueryCtx, slot: Doc<"freezer_slots">): Promise<string> {
  const freezer = await ctx.db.get(slot.freezer_id);
  if (!slot.box_id) return freezer?.name ?? "Unknown freezer";
  const box = await ctx.db.get(slot.box_id);
  const rack = box ? await ctx.db.get(box.rack_id) : null;
  const shelf = rack ? await ctx.db.get(rack.shelf_id) : null;
  return [freezer?.name, shelf?.name, rack?.name, box?.name, `${rowLetter(slot.row)}${slot.col + 1}`].filter(Boolean).join(" › ");
}

export const getExpiring = query({
  args: { token: v.optional(v.string()), days: v.number(), freezer_id: v.optional(v.id("freezers")) },
  handler: async (ctx, { token, days, freezer_id }) => {
    await requireAuth(ctx, token);
    const now = Date.now();
    const cutoff = now + days * 86400000;
    const slots = freezer_id
      ? await ctx.db.query("freezer_slots").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect()
      : await ctx.db.query("freezer_slots").collect();
    const due = slots.filter((s) => s.expiry_date !== undefined && s.expiry_date <= cutoff);
    due.sort((a, b) => (a.expiry_date ?? 0) - (b.expiry_date ?? 0));
    return await Promise.all(due.slice(0, 200).map(async (s) => ({ ...s, path: await describe(ctx, s), expired: (s.expiry_date ?? 0) < now })));
  },
});

export const search = query({
  args: { token: v.optional(v.string()), query: v.string(), freezer_id: v.optional(v.id("freezers")) },
  handler: async (ctx, { token, query: queryStr, freezer_id }) => {
    await requireAuth(ctx, token);
    const term = queryStr.toLowerCase().trim();
    if (!term) return [];
    const slots = freezer_id
      ? await ctx.db.query("freezer_slots").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect()
      : await ctx.db.query("freezer_slots").collect();
    const hits = slots.filter((s) =>
      [s.label, s.barcode, s.sample_id, s.sample_type, s.owner].some((f) => f?.toLowerCase().includes(term)));
    return await Promise.all(hits.slice(0, 100).map(async (s) => ({ ...s, path: await describe(ctx, s) })));
  },
});

// ── Excel export ──────────────────────────────────────────────────────────

/** Everything in one freezer as flat rows (the page turns these into an .xlsx file). */
export const exportRows = query({
  args: { token: v.optional(v.string()), freezer_id: v.id("freezers") },
  handler: async (ctx, { token, freezer_id }) => {
    await requireAuth(ctx, token);
    const freezer = await ctx.db.get(freezer_id);
    if (!freezer) throw new ConvexError("Freezer not found");
    const [shelves, racks, boxes, slots] = await Promise.all([
      ctx.db.query("freezer_shelves").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_racks").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_boxes").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
      ctx.db.query("freezer_slots").withIndex("by_freezer", (q) => q.eq("freezer_id", freezer_id)).collect(),
    ]);
    const shelfById = new Map(shelves.map((s) => [s._id, s]));
    const rackById = new Map(racks.map((r) => [r._id, r]));
    const boxById = new Map(boxes.map((b) => [b._id, b]));
    const used = new Map<string, number>();
    for (const s of slots) if (s.box_id) used.set(s.box_id, (used.get(s.box_id) ?? 0) + 1);

    const layout = boxes.map((b) => {
      const rack = rackById.get(b.rack_id);
      const shelf = rack ? shelfById.get(rack.shelf_id) : undefined;
      return {
        shelfPos: shelf?.position ?? 0, rackPos: rack?.position ?? 0, boxPos: b.position,
        Shelf: shelf?.name ?? "", Rack: rack?.name ?? "", Box: b.name, Size: `${b.rows} × ${b.cols}`,
        "Positions used": used.get(b._id) ?? 0, "Positions total": b.rows * b.cols,
      };
    }).sort((a, b) => a.shelfPos - b.shelfPos || a.rackPos - b.rackPos || a.boxPos - b.boxPos)
      .map(({ shelfPos: _s, rackPos: _r, boxPos: _b, ...row }) => row);

    const samples = slots.filter((s) => s.box_id && boxById.has(s.box_id)).map((s) => {
      const box = boxById.get(s.box_id!)!;
      const rack = rackById.get(box.rack_id);
      const shelf = rack ? shelfById.get(rack.shelf_id) : undefined;
      return {
        sort: [shelf?.position ?? 0, rack?.position ?? 0, box.position, s.row, s.col],
        row: {
          Shelf: shelf?.name ?? "", Rack: rack?.name ?? "", Box: box.name, Position: `${rowLetter(s.row)}${s.col + 1}`,
          "Sample ID": s.sample_id ?? "", Name: s.label ?? "", Type: s.sample_type ?? "", Owner: s.owner ?? "", Volume: s.volume ?? "",
          Expiry: s.expiry_date ? new Date(s.expiry_date).toISOString().slice(0, 10) : "", Barcode: s.barcode ?? "",
          "Label code": s.label_code ?? "", Notes: s.notes ?? "",
          ...Object.fromEntries(Object.entries(s.details ?? {}).map(([k, val]) => [k.charAt(0).toUpperCase() + k.slice(1), val])),
        } as Record<string, string>,
      };
    }).sort((a, b) => { for (let i = 0; i < 5; i++) if (a.sort[i] !== b.sort[i]) return a.sort[i] - b.sort[i]; return 0; })
      .map((x) => x.row);

    return { freezer: { name: freezer.name, location: freezer.location ?? "", temperature: freezer.temperature }, samples, layout };
  },
});
