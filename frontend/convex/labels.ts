/**
 * Printed sample labels. A label is saved when it's printed (code + what's written on it).
 * Scanning its QR/barcode later finds it, and "store" puts the sample into a freezer position
 * with the same details.
 */
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
import { describe } from "./freezer";
// Students only reach this module if their PI allowed this hub.
const { requireAuth } = hubGuard("Sample Hub");

// Any QR code or barcode is accepted (LabOS labels, supplier tubes, other systems): a code is just text.
const MAX_CODE = 300;
const normalize = (code: string) => code.trim();
const cleanDetails = (d: Record<string, string>) =>
  Object.fromEntries(Object.entries(d).map(([k, val]) => [k, val.trim()]).filter(([, val]) => val)) as Record<string, string>;

function checkCode(raw: string): string {
  const code = normalize(raw);
  if (!code || code.length > MAX_CODE) throw new ConvexError("That code is empty or too long");
  return code;
}

/** Save labels at print time so the QR code can be matched to its details later. */
export const registerMany = mutation({
  args: {
    token: v.optional(v.string()),
    labels: v.array(v.object({ code: v.string(), details: v.record(v.string(), v.string()) })),
  },
  handler: async (ctx, { token, labels }) => {
    const userId = await requireAuth(ctx, token);
    if (labels.length > 500) throw new ConvexError("Print at most 500 labels at a time");
    for (const l of labels) {
      const code = checkCode(l.code);
      const details = cleanDetails(l.details);
      const existing = await ctx.db.query("sample_labels").withIndex("by_code", (q) => q.eq("code", code)).first();
      if (!existing) await ctx.db.insert("sample_labels", { code, details, created_by: userId, created_at: Date.now() });
      else if (!existing.slot_id) await ctx.db.patch(existing._id, { details }); // reprint before storing: keep the latest text
    }
    return labels.length;
  },
});

/** Find a label by code and say where it is stored (if anywhere). */
export const lookup = query({
  args: { token: v.optional(v.string()), code: v.string() },
  handler: async (ctx, { token, code: raw }) => {
    await requireAuth(ctx, token);
    const code = normalize(raw);
    const label = await ctx.db.query("sample_labels").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (!label) return { code, known: false as const };
    const slot = label.slot_id ? await ctx.db.get(label.slot_id) : null;
    return {
      code, known: true as const, details: label.details,
      stored: slot ? { path: await describe(ctx, slot), slot } : null,
    };
  },
});

async function freeUp(ctx: MutationCtx, code: string) {
  const old = await ctx.db.query("freezer_slots").withIndex("by_label", (q) => q.eq("label_code", code)).collect();
  await Promise.all(old.map((s) => ctx.db.delete(s._id)));
}

/** Put the labelled sample into a freezer position (moves it if it was stored elsewhere). */
export const store = mutation({
  args: {
    token: v.optional(v.string()),
    code: v.string(),
    box_id: v.id("freezer_boxes"),
    row: v.number(),
    col: v.number(),
    sample: v.object({
      sample_id: v.optional(v.string()), label: v.optional(v.string()), sample_type: v.optional(v.string()),
      owner: v.optional(v.string()), volume: v.optional(v.string()), expiry_date: v.optional(v.number()),
      notes: v.optional(v.string()), details: v.optional(v.record(v.string(), v.string())),
    }),
  },
  handler: async (ctx, { token, code: raw, box_id, row, col, sample }) => {
    const userId = await requireAuth(ctx, token);
    const code = checkCode(raw);
    const box = await ctx.db.get(box_id);
    if (!box) throw new ConvexError("Box not found");
    if (row < 0 || row >= box.rows || col < 0 || col >= box.cols) throw new ConvexError("That position isn't in this box");
    if (!sample.sample_id?.trim() && !sample.label?.trim()) throw new ConvexError("Enter a sample ID or a name");

    const taken = await ctx.db.query("freezer_slots").withIndex("by_box", (q) => q.eq("box_id", box_id).eq("row", row).eq("col", col)).first();
    if (taken && taken.label_code !== code) throw new ConvexError("That position is already used by another sample");

    await freeUp(ctx, code); // moving: remove from the old position first
    const details = cleanDetails(sample.details ?? {});
    const slotId = await ctx.db.insert("freezer_slots", {
      freezer_id: box.freezer_id, box_id, row, col, label_code: code, barcode: code,
      sample_id: sample.sample_id?.trim() || undefined, label: sample.label?.trim() || undefined,
      sample_type: sample.sample_type?.trim() || undefined, owner: sample.owner?.trim() || undefined,
      volume: sample.volume?.trim() || undefined, expiry_date: sample.expiry_date, notes: sample.notes?.trim() || undefined,
      details: Object.keys(details).length ? details : undefined, updated_at: Date.now(),
    });
    const label = await ctx.db.query("sample_labels").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (label) await ctx.db.patch(label._id, { slot_id: slotId });
    else await ctx.db.insert("sample_labels", { code, details, slot_id: slotId, created_by: userId, created_at: Date.now() });
    return slotId;
  },
});

/** Take the sample out of storage (the label stays, so it can be stored again). */
export const unstore = mutation({
  args: { token: v.optional(v.string()), code: v.string() },
  handler: async (ctx, { token, code: raw }) => {
    await requireAuth(ctx, token);
    const code = checkCode(raw);
    await freeUp(ctx, code);
    const label = await ctx.db.query("sample_labels").withIndex("by_code", (q) => q.eq("code", code)).first();
    if (label?.slot_id) await ctx.db.patch(label._id, { slot_id: undefined });
  },
});
