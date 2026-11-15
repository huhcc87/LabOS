/**
 * Share a lab's SOP / newly developed or published protocol with a collaborator who also uses LabOS.
 * The collaborator's whole lab gets access, at the permission chosen (view, or view + download), and
 * always sees the citation the owner asked for. The owner can see who it's shared with and revoke it.
 *
 * `sop_shares` is cross-lab, so it is NOT in the lab-scoped table list: every function here checks
 * owner_lab_id / to_lab_id itself and reads the other lab's rows through `ctx.rawDb` only after that check.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { hubGuard, hasRole } from "./authHelper";
const { requireAuth } = hubGuard("Lab Hub");

const permission = v.union(v.literal("view"), v.literal("view_download"));

/** Only the SOP's author or a lab manager/PI/admin may share or revoke. */
async function ownSop(ctx: any, token: string | undefined, sopId: Id<"sops">) {
  const userId = await requireAuth(ctx, token);
  const me = (await ctx.db.get(userId))!;
  const sop = await ctx.db.get(sopId); // lab-scoped: another lab's SOP comes back null
  if (!sop || !ctx.labId) throw new ConvexError("SOP not found.");
  if (sop.author_id !== userId && !hasRole(me.role, "manager")) throw new ConvexError("Only the SOP's author or a lab manager can share it.");
  return { me, sop, labId: ctx.labId as Id<"labs"> };
}

/** Share with a collaborator (by their LabOS email). Re-sharing updates the permission and citation. */
export const share = mutation({
  args: { token: v.optional(v.string()), sop_id: v.id("sops"), email: v.string(), permission, citation: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { me, sop, labId } = await ownSop(ctx, a.token, a.sop_id);
    const citation = a.citation.trim().slice(0, 1000);
    if (!citation) throw new ConvexError("Add how this SOP should be cited.");
    const email = a.email.trim().toLowerCase();
    const them = await ctx.rawDb.query("users").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (!them || !them.is_active || !them.home_lab_id) throw new ConvexError("No LabOS user with that email. They need a LabOS account in their own lab first.");
    if (them.home_lab_id === labId) throw new ConvexError("That person is already in your lab, so they can already see this SOP.");

    const existing = (await ctx.rawDb.query("sop_shares").withIndex("by_sop", (q) => q.eq("sop_id", sop._id)).collect())
      .find((s) => s.to_lab_id === them.home_lab_id);
    const now = Date.now();
    const row = { permission: a.permission, citation, note: a.note?.trim().slice(0, 500) || undefined, status: "active" as const, shared_by: me._id, to_user_id: them._id };
    if (existing) await ctx.rawDb.patch(existing._id, row);
    else await ctx.rawDb.insert("sop_shares", { ...row, sop_id: sop._id, owner_lab_id: labId, to_lab_id: them.home_lab_id, created_at: now });

    const lab = await ctx.rawDb.get(labId);
    await ctx.rawDb.insert("notifications", {
      lab_id: them.home_lab_id, user_id: them._id, channel: "in_app", is_read: false, entity_type: "sop_share", entity_id: sop._id, created_at: now,
      title: `${lab?.name ?? "A lab"} shared an SOP with you: ${sop.title}`,
      message: `Open Lab Hub → SOPs → Shared with our lab. Please cite: ${citation}`,
    });
    return { to: them.full_name, lab: (await ctx.rawDb.get(them.home_lab_id))?.name ?? "their lab" };
  },
});

/** Who an SOP is shared with (owner's view). */
export const sharesOf = query({
  args: { token: v.optional(v.string()), sop_id: v.id("sops") },
  handler: async (ctx, { token, sop_id }) => {
    await requireAuth(ctx, token);
    const sop = await ctx.db.get(sop_id);
    if (!sop || !ctx.labId) return [];
    const rows = (await ctx.rawDb.query("sop_shares").withIndex("by_sop", (q) => q.eq("sop_id", sop_id)).collect())
      .filter((s) => s.owner_lab_id === ctx.labId && s.status === "active");
    return Promise.all(rows.map(async (s) => ({
      _id: s._id, permission: s.permission, citation: s.citation, created_at: s.created_at,
      to_name: (await ctx.rawDb.get(s.to_user_id))?.full_name ?? "Unknown",
      to_lab: (await ctx.rawDb.get(s.to_lab_id))?.name ?? "Unknown lab",
    })));
  },
});

/** Stop sharing. The collaborator's lab loses access straight away. */
export const revoke = mutation({
  args: { token: v.optional(v.string()), share_id: v.id("sop_shares") },
  handler: async (ctx, { token, share_id }) => {
    const share = await ctx.rawDb.get(share_id);
    if (!share || share.owner_lab_id !== ctx.labId) throw new ConvexError("Share not found.");
    await ownSop(ctx, token, share.sop_id);
    await ctx.rawDb.patch(share_id, { status: "revoked" });
  },
});

/** SOPs other labs shared with my lab, with the citation to use and a download link if allowed. */
export const sharedWithUs = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    if (!ctx.labId) return [];
    const rows = (await ctx.rawDb.query("sop_shares").withIndex("by_to_lab", (q) => q.eq("to_lab_id", ctx.labId!)).collect())
      .filter((s) => s.status === "active");
    const out = [];
    for (const s of rows) {
      const sop = await ctx.rawDb.get(s.sop_id);
      if (!sop) continue;
      out.push({
        _id: s._id, title: sop.title, version: sop.version, category: sop.category, content: sop.content,
        file_name: sop.file_name, permission: s.permission, citation: s.citation, note: s.note, shared_at: s.created_at,
        from_lab: (await ctx.rawDb.get(s.owner_lab_id))?.name ?? "Another lab",
        shared_by: (await ctx.rawDb.get(s.shared_by))?.full_name ?? "Unknown",
        url: s.permission === "view_download" && sop.storage_id ? await ctx.storage.getUrl(sop.storage_id) : null,
      });
    }
    return out.sort((a, b) => b.shared_at - a.shared_at);
  },
});
