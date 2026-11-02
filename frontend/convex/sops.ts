import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
// Students only reach this module if their PI allowed this hub.
const { requireAuth, requireRole } = hubGuard("Lab Hub");

// ── List SOPs (paginated, with search and status filter) ──────────────────

export const list = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
    search: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);

    // Full-text search path
    if (args.search && args.search.trim().length > 0) {
      const results = await ctx.db
        .query("sops")
        .withSearchIndex("search_title", (q) => {
          let sq = q.search("title", args.search!.trim());
          if (args.status) sq = sq.eq("status", args.status);
          return sq;
        })
        .collect();

      const numItems = args.paginationOpts?.numItems ?? 50;
      const cursor = args.paginationOpts?.cursor;
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const page = results.slice(startIdx, startIdx + numItems);
      const nextCursor =
        startIdx + numItems < results.length
          ? String(startIdx + numItems)
          : null;

      return { page, isDone: nextCursor === null, continueCursor: nextCursor };
    }

    // Filter by status path
    if (args.status) {
      const results = await ctx.db
        .query("sops")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();

      const numItems = args.paginationOpts?.numItems ?? 50;
      const cursor = args.paginationOpts?.cursor;
      const startIdx = cursor ? parseInt(cursor, 10) : 0;
      const page = results.slice(startIdx, startIdx + numItems);
      const nextCursor =
        startIdx + numItems < results.length
          ? String(startIdx + numItems)
          : null;

      return { page, isDone: nextCursor === null, continueCursor: nextCursor };
    }

    // Default: all SOPs ordered by creation time desc
    const results = await ctx.db.query("sops").order("desc").collect();
    const numItems = args.paginationOpts?.numItems ?? 50;
    const cursor = args.paginationOpts?.cursor;
    const startIdx = cursor ? parseInt(cursor, 10) : 0;
    const page = results.slice(startIdx, startIdx + numItems);
    const nextCursor =
      startIdx + numItems < results.length
        ? String(startIdx + numItems)
        : null;

    return { page, isDone: nextCursor === null, continueCursor: nextCursor };
  },
});

// ── Get a single SOP ──────────────────────────────────────────────────────

export const get = query({
  args: { token: v.optional(v.string()), id: v.id("sops") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    return await ctx.db.get(id);
  },
});

// ── Create a SOP ──────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.string(),
    status: v.string(),
    author_id: v.id("users"),
    review_date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const now = Date.now();
    return await ctx.db.insert("sops", {
      title: args.title,
      content: args.content,
      category: args.category,
      version: args.version,
      status: args.status,
      author_id: args.author_id,
      review_date: args.review_date,
      created_at: now,
      updated_at: now,
    });
  },
});

// ── Update a SOP ──────────────────────────────────────────────────────────

export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("sops"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    version: v.optional(v.string()),
    status: v.optional(v.string()),
    review_date: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx, args.token);
    const { id, token: _token, ...fields } = args;
    const sop = await ctx.db.get(id);
    if (!sop) throw new ConvexError("SOP not found");

    const patch: Record<string, unknown> = { updated_at: Date.now() };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.content !== undefined) patch.content = fields.content;
    if (fields.category !== undefined) patch.category = fields.category;
    if (fields.version !== undefined) patch.version = fields.version;
    if (fields.status !== undefined) patch.status = fields.status;
    if (fields.review_date !== undefined) patch.review_date = fields.review_date;

    await ctx.db.patch(id, patch);
    return id;
  },
});

// ── Remove a SOP ──────────────────────────────────────────────────────────

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("sops") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const sop = await ctx.db.get(id);
    if (!sop) throw new ConvexError("SOP not found");
    const me = (await ctx.db.get(userId))!;
    if (sop.author_id !== userId && !["pi", "admin", "superadmin"].includes(me.role)) throw new ConvexError("Only the uploader or a PI can delete this SOP.");
    if (sop.storage_id) await ctx.storage.delete(sop.storage_id);
    await ctx.db.delete(id);
    return id;
  },
});

// ── Approve a SOP ─────────────────────────────────────────────────────────

export const approve = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("sops"),
    approved_by: v.optional(v.id("users")), // ignored; kept so older callers still type-check
  },
  handler: async (ctx, { token, id }) => {
    const pi = await requireRole(ctx, token, "pi"); // approver is the caller, never a client-supplied id
    const sop = await ctx.db.get(id);
    if (!sop) throw new ConvexError("SOP not found");

    await ctx.db.patch(id, {
      status: "approved",
      approved_by: pi._id,
      approved_at: Date.now(),
      updated_at: Date.now(),
    });
    return id;
  },
});

// ── Uploaded SOPs: anyone uploads, a PI approves ──────────────────────────

const MAX_FILE = 25 * 1024 * 1024;
const FILE_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"];

export const generateUploadUrl = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Save an uploaded file as a SOP. It waits for PI approval. */
export const upload = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    category: v.string(),
    version: v.string(),
    storage_id: v.id("_storage"),
    file_name: v.string(),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const meta = await ctx.db.system.get(a.storage_id);
    const bad = async (msg: string) => { await ctx.storage.delete(a.storage_id); throw new ConvexError(msg); };
    if (!meta) throw new ConvexError("The file did not upload. Try again.");
    if (meta.size > MAX_FILE) return await bad("File is too big (25 MB max).");
    if (!FILE_TYPES.includes(meta.contentType ?? "")) return await bad("Upload a PDF, Word or text file.");
    if (!a.title.trim() || !a.category.trim() || !a.version.trim()) return await bad("Title, category and version are required.");
    const now = Date.now();
    return await ctx.db.insert("sops", {
      title: a.title.trim().slice(0, 200),
      category: a.category.trim().slice(0, 60),
      version: a.version.trim().slice(0, 20),
      status: "pending",
      author_id: userId,
      storage_id: a.storage_id,
      file_name: a.file_name.slice(0, 200),
      file_type: meta.contentType,
      file_size: meta.size,
      created_at: now,
      updated_at: now,
    });
  },
});

/** Everything the SOP screen needs: rows with who uploaded/approved and a download link. */
export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const userId = await requireAuth(ctx, token);
    const me = (await ctx.db.get(userId))!;
    const rows = (await ctx.db.query("sops").order("desc").collect()).filter((s) => s.storage_id || s.status !== "draft");
    const names = new Map<string, string>();
    const name = async (id?: string) => {
      if (!id) return undefined;
      if (!names.has(id)) names.set(id, ((await ctx.db.get(id as any)) as any)?.full_name ?? "Unknown");
      return names.get(id);
    };
    const out = [];
    for (const s of rows) {
      out.push({
        ...s,
        uploaded_by: await name(s.author_id),
        approved_by_name: await name(s.approved_by),
        url: s.storage_id ? await ctx.storage.getUrl(s.storage_id) : null,
        can_delete: s.author_id === userId || ["pi", "admin", "superadmin"].includes(me.role),
      });
    }
    return { sops: out, can_approve: ["pi", "admin", "superadmin"].includes(me.role) };
  },
});

/** PI decision. Only a PI (or admin) can approve or reject. */
export const decide = mutation({
  args: { token: v.optional(v.string()), id: v.id("sops"), decision: v.union(v.literal("approve"), v.literal("reject")), note: v.optional(v.string()) },
  handler: async (ctx, { token, id, decision, note }) => {
    const pi = await requireRole(ctx, token, "pi");
    const sop = await ctx.db.get(id);
    if (!sop) throw new ConvexError("SOP not found");
    await ctx.db.patch(id, {
      status: decision === "approve" ? "approved" : "rejected",
      approved_by: pi._id,
      approved_at: Date.now(),
      decision_note: note?.trim().slice(0, 500) || undefined,
      updated_at: Date.now(),
    });
  },
});
