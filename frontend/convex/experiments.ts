/**
 * Experiments Hub: experiments with steps, results, files and a timeline, saved for the whole lab.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard, hasRole } from "./authHelper";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
const { requireAuth } = hubGuard("Lab Hub");

const STATUSES = ["draft", "active", "paused", "completed", "archived"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const STEP_STATUSES = ["pending", "in-progress", "completed", "failed"];
const RESULT_TYPES = ["observation", "measurement", "analysis", "conclusion"];
const MAX_FILE = 50 * 1024 * 1024;
const day = () => new Date().toISOString().split("T")[0];
const clean = (s: string, n: number) => s.trim().slice(0, n);

async function who(ctx: MutationCtx, userId: Id<"users">) {
  return (await ctx.db.get(userId))!;
}

async function log(ctx: MutationCtx, exp: { _id?: Id<"experiments">; title: string }, name: string, type: string, description: string) {
  await ctx.db.insert("experiment_events", { experiment_id: exp._id, experiment_title: exp.title, type, description, user: name, at: Date.now() });
}

async function nextCode(ctx: MutationCtx, table: "experiments" | "experiment_results", prefix: string) {
  const rows = await ctx.db.query(table).collect();
  let n = rows.length + 1;
  const taken = new Set(rows.map((r) => r.code));
  while (taken.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

export const overview = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const experiments = await ctx.db.query("experiments").order("asc").collect();
    const titles = new Map(experiments.map((e) => [e._id as string, e.title]));
    const results = (await ctx.db.query("experiment_results").order("asc").collect()).map((r) => ({ ...r, experiment_title: titles.get(r.experiment_id) ?? "" }));
    const files = [];
    for (const f of await ctx.db.query("experiment_files").order("asc").collect()) {
      files.push({ ...f, experiment_title: titles.get(f.experiment_id) ?? "", url: await ctx.storage.getUrl(f.storage_id) });
    }
    const events = await ctx.db.query("experiment_events").order("desc").take(300);
    return { experiments, results, files, events };
  },
});

export const save = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.optional(v.id("experiments")),
    title: v.string(),
    description: v.string(),
    protocol: v.string(),
    status: v.string(),
    priority: v.string(),
    start_date: v.string(),
    lead_researcher: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const me = await who(ctx, userId);
    if (!a.title.trim()) throw new ConvexError("Enter a title.");
    if (!a.lead_researcher.trim()) throw new ConvexError("Enter the lead researcher.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.start_date)) throw new ConvexError("Choose a start date.");
    if (!STATUSES.includes(a.status) || !PRIORITIES.includes(a.priority)) throw new ConvexError("Check status and priority.");
    const fields = {
      title: clean(a.title, 200), description: clean(a.description, 4000), protocol: clean(a.protocol, 100),
      status: a.status, priority: a.priority, start_date: a.start_date, lead_researcher: clean(a.lead_researcher, 100),
      tags: a.tags.map((t) => clean(t, 40)).filter(Boolean).slice(0, 20),
    };
    const now = Date.now();
    if (a.id) {
      const e = await ctx.db.get(a.id);
      if (!e) throw new ConvexError("Experiment not found.");
      const team = e.team.map((m, i) => (i === 0 ? { ...m, name: fields.lead_researcher } : m));
      await ctx.db.patch(a.id, { ...fields, team, updated_at: now });
      await log(ctx, { _id: a.id, title: fields.title }, me.full_name, "note_added", "Experiment updated");
      return a.id;
    }
    const id = await ctx.db.insert("experiments", {
      ...fields, code: await nextCode(ctx, "experiments", "EXP"),
      team: [{ id: "1", name: fields.lead_researcher, role: "Lead" }], steps: [], samples: [],
      created_by: userId, created_at: now, updated_at: now,
    });
    await log(ctx, { _id: id, title: fields.title }, me.full_name, "created", "Experiment created");
    return id;
  },
});

export const remove = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiments") },
  handler: async (ctx, { token, id }) => {
    const userId = await requireAuth(ctx, token);
    const me = await who(ctx, userId);
    const e = await ctx.db.get(id);
    if (!e) throw new ConvexError("Experiment not found.");
    if (e.created_by !== userId && !hasRole(me.role, "manager")) throw new ConvexError("Only the person who created it, or a manager, can delete an experiment.");
    for (const r of await ctx.db.query("experiment_results").withIndex("by_experiment", (q) => q.eq("experiment_id", id)).collect()) await ctx.db.delete(r._id);
    for (const f of await ctx.db.query("experiment_files").withIndex("by_experiment", (q) => q.eq("experiment_id", id)).collect()) { await ctx.storage.delete(f.storage_id); await ctx.db.delete(f._id); }
    await ctx.db.delete(id);
    await log(ctx, { title: e.title }, me.full_name, "note_added", "Experiment deleted");
  },
});

/** Start, pause, resume, complete, archive. */
export const setStatus = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiments"), status: v.string() },
  handler: async (ctx, { token, id, status }) => {
    const userId = await requireAuth(ctx, token);
    const me = await who(ctx, userId);
    if (!STATUSES.includes(status)) throw new ConvexError("Unknown status.");
    const e = await ctx.db.get(id);
    if (!e) throw new ConvexError("Experiment not found.");
    await ctx.db.patch(id, { status, updated_at: Date.now(), ...(status === "completed" ? { end_date: day() } : {}) });
    const kind = status === "active" ? (e.status === "paused" ? "resumed" : "started") : status === "completed" ? "completed" : status === "paused" ? "paused" : "note_added";
    await log(ctx, e, me.full_name, kind, status === "completed" ? "Experiment completed" : `Status changed to ${status}`);
  },
});

export const addStep = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiments"), name: v.string(), description: v.string() },
  handler: async (ctx, { token, id, name, description }) => {
    await requireAuth(ctx, token);
    const e = await ctx.db.get(id);
    if (!e) throw new ConvexError("Experiment not found.");
    if (!name.trim()) throw new ConvexError("Enter the step name.");
    const step = { id: `s${Date.now()}${Math.random().toString(36).slice(2, 5)}`, name: clean(name, 200), description: clean(description, 2000), status: "pending" };
    await ctx.db.patch(id, { steps: [...e.steps, step], updated_at: Date.now() });
  },
});

export const setStepStatus = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiments"), step_id: v.string(), status: v.string() },
  handler: async (ctx, { token, id, step_id, status }) => {
    const userId = await requireAuth(ctx, token);
    const me = await who(ctx, userId);
    if (!STEP_STATUSES.includes(status)) throw new ConvexError("Unknown step status.");
    const e = await ctx.db.get(id);
    if (!e) throw new ConvexError("Experiment not found.");
    const step = e.steps.find((s) => s.id === step_id);
    if (!step) throw new ConvexError("Step not found.");
    const steps = e.steps.map((s) => (s.id !== step_id ? s : {
      ...s, status,
      startedAt: status === "in-progress" ? day() : s.startedAt,
      completedAt: status === "completed" ? day() : s.completedAt,
    }));
    await ctx.db.patch(id, { steps, updated_at: Date.now() });
    await log(ctx, e, me.full_name, "step_completed", `Step "${step.name}" status changed to ${status}`);
  },
});

export const saveResult = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.optional(v.id("experiment_results")),
    experiment_id: v.id("experiments"),
    title: v.string(), type: v.string(), value: v.string(), unit: v.optional(v.string()), notes: v.string(),
  },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const me = await who(ctx, userId);
    const e = await ctx.db.get(a.experiment_id);
    if (!e) throw new ConvexError("Experiment not found.");
    if (!a.title.trim() || !a.value.trim()) throw new ConvexError("Enter a title and a value.");
    if (!RESULT_TYPES.includes(a.type)) throw new ConvexError("Unknown result type.");
    const fields = { experiment_id: a.experiment_id, title: clean(a.title, 200), type: a.type, value: clean(a.value, 500), unit: a.unit?.trim().slice(0, 30) || undefined, notes: clean(a.notes, 4000) };
    if (a.id) { await ctx.db.patch(a.id, fields); return a.id; }
    const id = await ctx.db.insert("experiment_results", { ...fields, code: await nextCode(ctx, "experiment_results", "RES"), recorded_by: me.full_name, recorded_at: Date.now() });
    await log(ctx, e, me.full_name, "result_added", `New result recorded: ${fields.title}`);
    return id;
  },
});

export const removeResult = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiment_results") },
  handler: async (ctx, { token, id }) => { await requireAuth(ctx, token); await ctx.db.delete(id); },
});

export const generateUploadUrl = mutation({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => { await requireAuth(ctx, token); return await ctx.storage.generateUploadUrl(); },
});

export const addFile = mutation({
  args: { token: v.optional(v.string()), experiment_id: v.id("experiments"), name: v.string(), category: v.string(), storage_id: v.id("_storage") },
  handler: async (ctx, a) => {
    const userId = await requireAuth(ctx, a.token);
    const me = await who(ctx, userId);
    const meta = await ctx.db.system.get(a.storage_id);
    if (!meta) throw new ConvexError("The file did not upload. Try again.");
    if (meta.size > MAX_FILE) { await ctx.storage.delete(a.storage_id); throw new ConvexError("File is too big (50 MB max)."); }
    const e = await ctx.db.get(a.experiment_id);
    if (!e) { await ctx.storage.delete(a.storage_id); throw new ConvexError("Experiment not found."); }
    const name = clean(a.name, 200);
    return await ctx.db.insert("experiment_files", {
      experiment_id: a.experiment_id, name, type: (name.split(".").pop() || "file").toLowerCase().slice(0, 10), size: meta.size,
      category: a.category, storage_id: a.storage_id, uploaded_by: me.full_name, uploaded_at: Date.now(),
    });
  },
});

export const removeFile = mutation({
  args: { token: v.optional(v.string()), id: v.id("experiment_files") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const f = await ctx.db.get(id);
    if (!f) return;
    await ctx.storage.delete(f.storage_id);
    await ctx.db.delete(id);
  },
});
