/**
 * LabHuddle extras that belong to the whole lab: polls (one vote per person, changeable until the poll is closed)
 * and the knowledge base (short write-ups captured from meetings). Everyone in the lab can read and take part;
 * the person who made something, or a manager, can change or remove it.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import type { Id } from "./_generated/dataModel";

// Students only reach this module if their PI allowed this hub.
const { requireAuth } = hubGuard("Resources");

const MAX_OPTIONS = 10;

async function whoIs(ctx: { db: any }, userId: Id<"users">) {
  const u = (await ctx.db.get(userId)) as { full_name?: string; role: string } | null;
  return { name: u?.full_name ?? "Member", isManager: !!u && hasRole(u.role, "manager") };
}

// ── Polls ────────────────────────────────────────────────────────────────────

export const listPolls = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await requireAuth(ctx, token);
    const { isManager } = await whoIs(ctx, me);
    const polls = await ctx.db.query("meeting_polls").collect();
    const out = [];
    for (const p of polls) {
      const votes = await ctx.db.query("poll_votes").withIndex("by_poll", (q) => q.eq("poll_id", p._id)).collect();
      const counts = p.options.map((_: string, i: number) => votes.filter((x: { option_index: number }) => x.option_index === i).length);
      const mine = votes.find((x: { user_id: Id<"users"> }) => x.user_id === me);
      out.push({ ...p, counts, total: votes.length, my_vote: mine ? mine.option_index : null, can_manage: isManager || p.created_by === me });
    }
    return out.sort((a, b) => b.created_at - a.created_at);
  },
});

export const createPoll = mutation({
  args: { token: v.optional(v.string()), question: v.string(), options: v.array(v.string()), meeting_id: v.optional(v.id("meetings")) },
  handler: async (ctx, { token, question, options, meeting_id }) => {
    const me = await requireAuth(ctx, token);
    const q = question.trim();
    if (!q) throw new ConvexError("Write the question.");
    if (q.length > 300) throw new ConvexError("Keep the question under 300 characters.");
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) throw new ConvexError("Give at least two answers.");
    if (opts.length > MAX_OPTIONS) throw new ConvexError(`Use at most ${MAX_OPTIONS} answers.`);
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) throw new ConvexError("Each answer must be different.");
    if (opts.some((o) => o.length > 120)) throw new ConvexError("Keep each answer under 120 characters.");
    const { name } = await whoIs(ctx, me);
    return await ctx.db.insert("meeting_polls", {
      question: q, options: opts, status: "open", ...(meeting_id ? { meeting_id } : {}),
      created_by: me, created_by_name: name, created_at: Date.now(),
    });
  },
});

/** Cast or change your vote. */
export const vote = mutation({
  args: { token: v.optional(v.string()), poll_id: v.id("meeting_polls"), option_index: v.number() },
  handler: async (ctx, { token, poll_id, option_index }) => {
    const me = await requireAuth(ctx, token);
    const poll = await ctx.db.get(poll_id);
    if (!poll) throw new ConvexError("That poll no longer exists.");
    if (poll.status !== "open") throw new ConvexError("This poll is closed.");
    if (!Number.isInteger(option_index) || option_index < 0 || option_index >= poll.options.length) throw new ConvexError("Pick one of the answers.");
    const existing = (await ctx.db.query("poll_votes").withIndex("by_poll", (q) => q.eq("poll_id", poll_id)).collect())
      .find((x: { user_id: Id<"users"> }) => x.user_id === me);
    if (existing) await ctx.db.patch(existing._id, { option_index });
    else await ctx.db.insert("poll_votes", { poll_id, user_id: me, option_index, created_at: Date.now() });
  },
});

async function ownPollOrManager(ctx: { db: any }, me: Id<"users">, poll_id: Id<"meeting_polls">) {
  const poll = await ctx.db.get(poll_id);
  if (!poll) throw new ConvexError("That poll no longer exists.");
  const { isManager } = await whoIs(ctx, me);
  if (poll.created_by !== me && !isManager) throw new ConvexError("Only the person who made the poll, or a manager, can do that.");
  return poll;
}

export const setPollStatus = mutation({
  args: { token: v.optional(v.string()), poll_id: v.id("meeting_polls"), status: v.union(v.literal("open"), v.literal("closed")) },
  handler: async (ctx, { token, poll_id, status }) => {
    const me = await requireAuth(ctx, token);
    await ownPollOrManager(ctx, me, poll_id);
    await ctx.db.patch(poll_id, { status });
  },
});

export const deletePoll = mutation({
  args: { token: v.optional(v.string()), poll_id: v.id("meeting_polls") },
  handler: async (ctx, { token, poll_id }) => {
    const me = await requireAuth(ctx, token);
    await ownPollOrManager(ctx, me, poll_id);
    for (const x of await ctx.db.query("poll_votes").withIndex("by_poll", (q) => q.eq("poll_id", poll_id)).collect()) await ctx.db.delete(x._id);
    await ctx.db.delete(poll_id);
  },
});

// ── Knowledge base ───────────────────────────────────────────────────────────

const articleFields = {
  title: v.string(), category: v.string(), content: v.string(), tags: v.optional(v.string()), meeting_id: v.optional(v.id("meetings")),
};

function checkArticle(a: { title: string; category: string; content: string }) {
  if (!a.title.trim()) throw new ConvexError("Give the article a title.");
  if (a.title.length > 200) throw new ConvexError("Keep the title under 200 characters.");
  if (!a.category.trim()) throw new ConvexError("Pick a category.");
  if (!a.content.trim()) throw new ConvexError("Write something in the article.");
  if (a.content.length > 20_000) throw new ConvexError("Keep the article under 20,000 characters.");
}

export const listArticles = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    const me = await requireAuth(ctx, token);
    const { isManager } = await whoIs(ctx, me);
    const rows = await ctx.db.query("knowledge_articles").collect();
    return rows.map((a) => ({ ...a, can_manage: isManager || a.created_by === me })).sort((a, b) => b.updated_at - a.updated_at);
  },
});

export const createArticle = mutation({
  args: { token: v.optional(v.string()), ...articleFields },
  handler: async (ctx, { token, ...a }) => {
    const me = await requireAuth(ctx, token);
    checkArticle(a);
    const { name } = await whoIs(ctx, me);
    const now = Date.now();
    return await ctx.db.insert("knowledge_articles", {
      title: a.title.trim(), category: a.category.trim(), content: a.content.trim(), tags: (a.tags ?? "").trim(),
      ...(a.meeting_id ? { meeting_id: a.meeting_id } : {}), created_by: me, created_by_name: name, created_at: now, updated_at: now,
    });
  },
});

async function ownArticleOrManager(ctx: { db: any }, me: Id<"users">, id: Id<"knowledge_articles">) {
  const a = await ctx.db.get(id);
  if (!a) throw new ConvexError("That article no longer exists.");
  const { isManager } = await whoIs(ctx, me);
  if (a.created_by !== me && !isManager) throw new ConvexError("Only the author, or a manager, can change this article.");
}

export const updateArticle = mutation({
  args: { token: v.optional(v.string()), id: v.id("knowledge_articles"), ...articleFields },
  handler: async (ctx, { token, id, ...a }) => {
    const me = await requireAuth(ctx, token);
    await ownArticleOrManager(ctx, me, id);
    checkArticle(a);
    await ctx.db.patch(id, { title: a.title.trim(), category: a.category.trim(), content: a.content.trim(), tags: (a.tags ?? "").trim(), updated_at: Date.now() });
  },
});

export const deleteArticle = mutation({
  args: { token: v.optional(v.string()), id: v.id("knowledge_articles") },
  handler: async (ctx, { token, id }) => {
    const me = await requireAuth(ctx, token);
    await ownArticleOrManager(ctx, me, id);
    await ctx.db.delete(id);
  },
});
