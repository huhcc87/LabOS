import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { hubGuard, hasRole } from "./authHelper";
import { afterEdit, approvalValidator, canDecide } from "./protocolRules";
// Students only reach this module if their PI allowed this hub.
const { requireAuth } = hubGuard("Lab Hub");

const STATUSES = ["active", "draft", "archived"];

const editableFields = {
  title: v.optional(v.string()),
  description: v.optional(v.string()),
  category: v.optional(v.string()),
  version: v.optional(v.string()),
  /** "" clears the status. */
  status: v.optional(v.string()),
  content: v.optional(v.string()),
  steps: v.optional(v.string()),
  materials: v.optional(v.string()),
  safety: v.optional(v.string()),
  duration: v.optional(v.string()),
  tags: v.optional(v.string()),
  estimated_duration: v.optional(v.number()),
};

async function me(ctx: MutationCtx, token: string | undefined): Promise<Doc<"users">> {
  const user = await ctx.db.get(await requireAuth(ctx, token));
  if (!user || !user.is_active) throw new ConvexError("Unauthorized");
  return user;
}

function checkStatus(status: string | undefined) {
  if (status && !STATUSES.includes(status)) throw new ConvexError(`Unknown status: ${status}`);
}

/** Approval settings from the form: changing mode or approver restarts the approval. */
function configureApproval(
  current: Doc<"protocols">["approval"],
  next: { mode: "user" | "pi"; approver?: string } | null | undefined
): Doc<"protocols">["approval"] {
  if (next === undefined) return current;
  if (next === null) return undefined;
  if (next.mode === "user" && !next.approver?.trim()) throw new ConvexError("Name the PI who must approve");
  const same = current && current.mode === next.mode && (current.approver ?? "") === (next.approver ?? "");
  return same ? current : { mode: next.mode, approver: next.approver?.trim() || undefined, state: "pending" };
}

const approvalConfig = v.optional(v.union(
  v.null(),
  v.object({ mode: v.union(v.literal("user"), v.literal("pi")), approver: v.optional(v.string()) })
));

/** Everything the Lab Hub protocols tab needs, newest first. */
export const listAll = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.db.query("protocols").order("desc").collect();
  },
});

export const list = query({
  args: {
    token: v.optional(v.string()),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const numItems = args.paginationOpts?.numItems ?? 20;
    const cursor = args.paginationOpts?.cursor ?? null;

    if (args.search && !args.status) {
      const results = await ctx.db
        .query("protocols")
        .withSearchIndex("search_title", (q) => q.search("title", args.search!))
        .take(numItems);
      return { page: results, isDone: true, continueCursor: null };
    }

    const dbQuery = args.status
      ? ctx.db.query("protocols").withIndex("by_status", (q) => q.eq("status", args.status!))
      : ctx.db.query("protocols");
    const result = await dbQuery.paginate({ numItems, cursor });

    if (args.search) {
      const term = args.search.toLowerCase();
      result.page = result.page.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term) ||
          (p.category ?? "").toLowerCase().includes(term)
      );
    }
    return result;
  },
});

export const get = query({
  args: { token: v.optional(v.string()), id: v.id("protocols") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    ...editableFields,
    title: v.string(),
    approval: approvalConfig,
    /** Ignored: the author is always the signed-in user. Kept for older callers. */
    author_id: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await me(ctx, args.token);
    const { token: _t, author_id: _a, approval, status, ...fields } = args;
    if (!fields.title.trim()) throw new ConvexError("Protocol name is required");
    checkStatus(status);
    const now = Date.now();
    return await ctx.db.insert("protocols", {
      ...fields,
      title: fields.title.trim(),
      version: fields.version || "1.0",
      status: status || undefined,
      approval: configureApproval(undefined, approval ?? undefined),
      author_id: user._id,
      created_at: now,
      updated_at: now,
    });
  },
});

export const update = mutation({
  args: { token: v.optional(v.string()), id: v.id("protocols"), ...editableFields, approval: approvalConfig },
  handler: async (ctx, args) => {
    const user = await me(ctx, args.token);
    const current = await ctx.db.get(args.id);
    if (!current) throw new ConvexError("Protocol not found");
    const { id, token: _t, approval, status, ...fields } = args;
    // Older records may carry other statuses; only validate when it actually changes.
    if (status !== current.status) checkStatus(status);

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value;
    }
    if (status !== undefined) patch.status = status || undefined;

    // New approval settings restart it; otherwise a content edit by a non-approver resets it.
    const configured = configureApproval(current.approval, approval);
    const contentChanged = Object.keys(patch).some((k) => k !== "updated_at" && k !== "status");
    patch.approval = configured !== current.approval || !contentChanged ? configured : afterEdit(current.approval, user);

    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

/** Only an eligible PI can approve or reject (enforced here, not just in the UI). */
export const decide = mutation({
  args: { token: v.optional(v.string()), id: v.id("protocols"), state: v.union(v.literal("approved"), v.literal("rejected")) },
  handler: async (ctx, { token, id, state }) => {
    const user = await me(ctx, token);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("Protocol not found");
    if (!p.approval) throw new ConvexError("This protocol doesn't need approval");
    if (!canDecide(p.approval, user)) throw new ConvexError("Only the assigned PI can approve this protocol");
    await ctx.db.patch(id, {
      approval: { ...p.approval, state, decidedBy: user.full_name || user.email, decidedAt: new Date().toISOString() },
      updated_at: Date.now(),
    });
  },
});

export const setStatusMany = mutation({
  args: { token: v.optional(v.string()), ids: v.array(v.id("protocols")), status: v.string() },
  handler: async (ctx, { token, ids, status }) => {
    await me(ctx, token);
    checkStatus(status);
    const now = Date.now();
    await Promise.all(ids.map((id) => ctx.db.patch(id, { status: status || undefined, updated_at: now })));
  },
});

export const markUsed = mutation({
  args: { token: v.optional(v.string()), id: v.id("protocols") },
  handler: async (ctx, { token, id }) => {
    await me(ctx, token);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("Protocol not found");
    await ctx.db.patch(id, { use_count: (p.use_count ?? 0) + 1 });
  },
});

/** Author, or PI/admin, may delete. Also removes saved versions. */
async function removeOne(ctx: MutationCtx, user: Doc<"users">, id: Id<"protocols">) {
  const p = await ctx.db.get(id);
  if (!p) return;
  if (p.author_id !== user._id && !hasRole(user.role, "admin")) {
    throw new ConvexError(`Only the author or a PI/admin can delete “${p.title}”`);
  }
  const versions = await ctx.db.query("protocol_versions").withIndex("by_protocol", (q) => q.eq("protocol_id", id)).collect();
  await Promise.all(versions.map((ver) => ctx.db.delete(ver._id)));
  await ctx.db.delete(id);
}

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("protocols") },
  handler: async (ctx, { token, id }) => {
    await removeOne(ctx, await me(ctx, token), id);
    return { success: true };
  },
});

export const removeMany = mutation({
  args: { token: v.optional(v.string()), ids: v.array(v.id("protocols")) },
  handler: async (ctx, { token, ids }) => {
    const user = await me(ctx, token);
    for (const id of ids) await removeOne(ctx, user, id);
  },
});

export const listVersions = query({
  args: { token: v.optional(v.string()), protocolId: v.id("protocols") },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    return await ctx.db
      .query("protocol_versions")
      .withIndex("by_protocol", (q) => q.eq("protocol_id", args.protocolId))
      .order("desc")
      .collect();
  },
});

export const createVersion = mutation({
  args: {
    token: v.optional(v.string()),
    protocol_id: v.id("protocols"),
    version: v.string(),
    content: v.optional(v.string()),
    change_summary: v.optional(v.string()),
    /** Ignored: the author is always the signed-in user. */
    created_by: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await me(ctx, args.token);
    const id = await ctx.db.insert("protocol_versions", {
      protocol_id: args.protocol_id,
      version: args.version,
      content: args.content,
      change_summary: args.change_summary,
      created_by: user._id,
      created_at: Date.now(),
    });
    await ctx.db.patch(args.protocol_id, { version: args.version, updated_at: Date.now() });
    return id;
  },
});
