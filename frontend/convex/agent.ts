import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Real tool-calling lab assistant (Genemod-style): the model decides which
// read-only lookups it needs, we execute them against the existing Convex
// query functions, and feed results back until it has a final answer.
// ponytail: read-only tools only for now — write tools (create/update) come
// in a follow-up once there's a confirm-before-mutate UX in the chat panel.

type ToolResult = unknown;

type ToolDef = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  run: (ctx: any, token: string | undefined, input: any) => Promise<ToolResult>;
};

// A tool-proposed mutation. The model only ever returns one of these — it never
// calls a mutation directly. The chat UI renders it as a Confirm/Cancel card,
// and only agentActions.confirmAction (a separate endpoint, run after the user
// clicks Confirm) calls the real, permission-checked Convex mutation.
type Proposal = {
  id: string;
  actionType: string;
  summary: string;
  destructive: boolean;
  payload: Record<string, unknown>;
};

// Bounds how many pending proposals / search hits one chat turn can surface —
// a natural-language request can never fan out into a silent bulk mutation:
// ambiguous matches come back as a `note` asking the user to narrow it down
// instead of a proposal.
const MAX_CANDIDATES = 5;
const MAX_PROPOSALS_PER_TURN = 5;
const MAX_SEARCH_RESULTS_PER_TURN = 12;

/**
 * Only samples.ts's storage-hierarchy siblings (sampleStorage.ts, storageUnits.ts)
 * gate their mutations with requirePermission() — samples.ts's own original
 * create/update/remove, plus inventory/tasks/instruments/protocols, only check
 * requireAuth. Per the safety requirement, the chatbot's create/update/delete
 * tools are scoped to what's actually permission-gated: sample disposal/checkout
 * (sampleStorage.ts) and storage units (storageUnits.ts). See PR description for
 * the full list of excluded entity types and why.
 */
async function findSampleCandidates(ctx: any, token: string | undefined, labId: any, queryStr: string): Promise<any[]> {
  const term = queryStr.trim();
  if (!term) return [];
  // Try an exact sample_id/barcode match first (samples.resolveBarcode, lab-scoped)
  // — the common "dispose SAM-042" case names the sample_id, not its display name,
  // and search.globalSearch's search index below only matches the `name` field.
  const exact = (await ctx.runQuery(api.samples.resolveBarcode, { token, labId, barcode: term })) as any;
  if (exact?.sample) return [exact.sample];

  const hits = ((await ctx.runQuery(api.search.globalSearch, { token, q: term })) ?? []) as any[];
  const sampleIds = hits
    .filter((h) => h.type === "Sample")
    .map((h) => String(h.id).replace(/^samples-/, ""))
    .slice(0, MAX_CANDIDATES);
  const samples = await Promise.all(sampleIds.map((id) => ctx.runQuery(api.samples.get, { token, id })));
  return samples.filter(Boolean) as any[];
}

/**
 * The chatbot only acts within the caller's single lab — same rule the
 * regular storage-hierarchy UI follows (useCurrentLab.ts). Returns null with
 * an explanatory note instead of guessing when the user belongs to zero or
 * multiple labs.
 */
async function resolveSingleLab(
  ctx: any,
  token: string | undefined,
): Promise<{ labId: any; labName: string } | { note: string }> {
  const memberships = ((await ctx.runQuery(api.labMembers.listMy, { token })) ?? []) as any[];
  const activeLabs = memberships.filter((m) => m.status === "active" && m.lab);
  if (activeLabs.length === 0) return { note: "The user has no active lab membership." };
  if (activeLabs.length > 1) {
    return { note: "The user belongs to multiple labs — ask which lab this action applies to." };
  }
  return { labId: activeLabs[0].lab_id, labName: activeLabs[0].lab?.name };
}

async function findStorageUnitCandidates(ctx: any, token: string | undefined, labId: any, queryStr: string): Promise<any[]> {
  const units = ((await ctx.runQuery(api.storageUnits.list, { token, labId })) ?? []) as any[];
  const term = queryStr.trim().toLowerCase();
  if (!term) return units.slice(0, MAX_CANDIDATES);
  return units.filter((u) => u.name.toLowerCase().includes(term)).slice(0, MAX_CANDIDATES);
}

const TOOLS: ToolDef[] = [
  {
    name: "list_inventory",
    description:
      "List lab inventory items (reagents, consumables, chemicals). Use for stock levels, low/out-of-stock questions.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "optional name/category search term" } },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.inventory.list, {
        token,
        search: input?.search,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        minimum_quantity: i.minimum_quantity,
        unit: i.unit,
        category: i.category,
      }));
    },
  },
  {
    name: "list_samples",
    description: "List tracked lab samples/specimens, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: {
        search: { type: "string" },
        status: { type: "string", description: "e.g. stored, in_use, disposed" },
      },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.samples.list, {
        token,
        search: input?.search,
        status: input?.status,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((s: any) => ({
        name: s.name ?? s.sample_id,
        status: s.status,
        location: s.location,
      }));
    },
  },
  {
    name: "list_tasks",
    description: "List lab tasks/to-dos, optionally filtered by status (pending, in_progress, completed, cancelled).",
    input_schema: {
      type: "object",
      properties: { status: { type: "string" } },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.tasks.list, {
        token,
        status: input?.status,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((t: any) => ({
        title: t.title,
        status: t.status,
        due_date: t.due_date,
        priority: t.priority,
      }));
    },
  },
  {
    name: "list_protocols",
    description: "List lab protocols/SOPs, optionally filtered by status (draft, approved, archived) or search term.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string" }, status: { type: "string" } },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.protocols.list, {
        token,
        search: input?.search,
        status: input?.status,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((p: any) => ({
        title: p.title,
        status: p.status,
        version: p.version,
        category: p.category,
      }));
    },
  },
  {
    name: "list_instruments",
    description: "List lab instruments/equipment, optionally filtered by status (available, in_use, maintenance).",
    input_schema: {
      type: "object",
      properties: { search: { type: "string" }, status: { type: "string" } },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.instruments.list, {
        token,
        search: input?.search,
        status: input?.status,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((i: any) => ({
        name: i.name,
        status: i.status,
        location: i.location,
      }));
    },
  },
  {
    name: "list_incidents",
    description: "List safety incidents, optionally filtered by severity or status (open, investigating, resolved).",
    input_schema: {
      type: "object",
      properties: { severity: { type: "string" }, status: { type: "string" } },
    },
    run: async (ctx, token, input) => {
      const result = await ctx.runQuery(api.incidents.list, {
        token,
        severity: input?.severity,
        status: input?.status,
        paginationOpts: { numItems: 50, cursor: null },
      });
      return (result?.page ?? []).map((i: any) => ({
        title: i.title,
        severity: i.severity,
        status: i.status,
      }));
    },
  },
  {
    name: "search_app",
    description:
      "Search across the whole app (samples, protocols, instruments, inventory, tasks) by name, ID, or " +
      "barcode. Call this whenever the user refers to something by name so you know exactly what it is " +
      "before answering or proposing an action on it.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    run: async (ctx, token, input) => {
      return await ctx.runQuery(api.search.globalSearch, { token, q: String(input?.query ?? "") });
    },
  },
  // ── Propose-only write tools ────────────────────────────────────────────
  // None of these touch the database. Each looks up the target with a
  // read-only query and returns a `proposal` the chat UI renders as a
  // Confirm/Cancel card. The mutation only runs from agentActions.confirmAction,
  // after the user clicks Confirm, and goes through the exact same
  // permission-checked mutation the regular UI uses.
  {
    name: "propose_dispose_sample",
    description:
      "Propose disposing a sample — ends its active life-cycle (status becomes disposed, its storage slot " +
      "is freed) and is NOT undoable. This tool never disposes anything itself: it only finds the sample and " +
      "returns a proposal the user must explicitly confirm in the chat UI. Use for delete/dispose/discard/" +
      "throw out/remove requests about a sample. A disposal reason is required — ask the user for one if " +
      "they haven't given it.",
    input_schema: {
      type: "object",
      properties: {
        sample_query: { type: "string", description: "name, sample_id, or barcode identifying the sample" },
        reason: { type: "string", description: "why the sample is being disposed (required)" },
      },
      required: ["sample_query", "reason"],
    },
    run: async (ctx, token, input) => {
      const reason = String(input?.reason ?? "").trim();
      if (!reason) return { proposal: null, note: "A disposal reason is required — ask the user for one." };
      const lab = await resolveSingleLab(ctx, token);
      if ("note" in lab) return { proposal: null, note: lab.note };
      const candidates = (
        await findSampleCandidates(ctx, token, lab.labId, String(input?.sample_query ?? ""))
      ).filter((s: any) => !s.disposed_at);
      if (candidates.length === 0) return { proposal: null, note: "No matching active sample found." };
      if (candidates.length > 1) {
        return {
          proposal: null,
          note: `${candidates.length} samples match "${input?.sample_query}" — ask the user which one they mean.`,
          candidates: candidates.map((s: any) => ({ sample_id: s.sample_id, name: s.name })),
        };
      }
      const s = candidates[0];
      const proposal: Proposal = {
        id: `dispose_sample:${s._id}:${Date.now()}`,
        actionType: "dispose_sample",
        summary: `Dispose sample ${s.sample_id} ("${s.name}")? This cannot be undone.`,
        destructive: true,
        payload: { labId: lab.labId, sampleId: s._id, disposalReason: reason },
      };
      return { proposal };
    },
  },
  {
    name: "propose_checkout_sample",
    description:
      "Propose checking a sample out of storage for bench use — temporary; its slot is reserved, not freed, " +
      "and it can be returned later. Never executes itself: returns a proposal the user must confirm.",
    input_schema: {
      type: "object",
      properties: {
        sample_query: { type: "string", description: "name, sample_id, or barcode identifying the sample" },
        purpose: { type: "string" },
      },
      required: ["sample_query"],
    },
    run: async (ctx, token, input) => {
      const lab = await resolveSingleLab(ctx, token);
      if ("note" in lab) return { proposal: null, note: lab.note };
      const candidates = (
        await findSampleCandidates(ctx, token, lab.labId, String(input?.sample_query ?? ""))
      ).filter((s: any) => !s.disposed_at && !s.checked_out_at);
      if (candidates.length === 0) {
        return { proposal: null, note: "No matching sample available to check out (not found, already out, or disposed)." };
      }
      if (candidates.length > 1) {
        return {
          proposal: null,
          note: `${candidates.length} samples match "${input?.sample_query}" — ask the user which one they mean.`,
          candidates: candidates.map((s: any) => ({ sample_id: s.sample_id, name: s.name })),
        };
      }
      const s = candidates[0];
      const purpose = typeof input?.purpose === "string" ? input.purpose : undefined;
      const proposal: Proposal = {
        id: `checkout_sample:${s._id}:${Date.now()}`,
        actionType: "checkout_sample",
        summary: `Check out sample ${s.sample_id} ("${s.name}")${purpose ? ` for "${purpose}"` : ""}?`,
        destructive: false,
        payload: { labId: lab.labId, sampleId: s._id, reason: purpose },
      };
      return { proposal };
    },
  },
  {
    name: "propose_create_storage_unit",
    description:
      "Propose creating a new storage unit (freezer/fridge/cabinet) in the user's lab. Never executes " +
      "itself: returns a proposal the user must confirm.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        storage_type: { type: "string", description: "e.g. -80 freezer, -20 freezer, fridge, cabinet" },
        target_temp: { type: "number" },
      },
      required: ["name", "storage_type"],
    },
    run: async (ctx, token, input) => {
      const lab = await resolveSingleLab(ctx, token);
      if ("note" in lab) return { proposal: null, note: lab.note };
      const name = String(input?.name ?? "").trim();
      const storageType = String(input?.storage_type ?? "").trim();
      if (!name || !storageType) return { proposal: null, note: "Both a name and a storage type are required." };
      const proposal: Proposal = {
        id: `create_storage_unit:${Date.now()}`,
        actionType: "create_storage_unit",
        summary: `Create a new storage unit "${name}" (${storageType}) in lab "${lab.labName}"?`,
        destructive: false,
        payload: {
          labId: lab.labId,
          name,
          storage_type: storageType,
          status: "normal",
          target_temp: typeof input?.target_temp === "number" ? input.target_temp : undefined,
        },
      };
      return { proposal };
    },
  },
  {
    name: "propose_update_storage_unit",
    description:
      "Propose editing a storage unit's name, status, target temperature, owner team, or notes. Never " +
      "executes itself: returns a proposal the user must confirm.",
    input_schema: {
      type: "object",
      properties: {
        unit_query: { type: "string", description: "name identifying the storage unit" },
        name: { type: "string" },
        status: { type: "string" },
        target_temp: { type: "number" },
        owner_team: { type: "string" },
        notes: { type: "string" },
      },
      required: ["unit_query"],
    },
    run: async (ctx, token, input) => {
      const lab = await resolveSingleLab(ctx, token);
      if ("note" in lab) return { proposal: null, note: lab.note };
      const candidates = await findStorageUnitCandidates(ctx, token, lab.labId, String(input?.unit_query ?? ""));
      if (candidates.length === 0) return { proposal: null, note: "No matching storage unit found." };
      if (candidates.length > 1) {
        return {
          proposal: null,
          note: `${candidates.length} storage units match "${input?.unit_query}" — ask the user which one they mean.`,
          candidates: candidates.map((u: any) => ({ id: u._id, name: u.name })),
        };
      }
      const u = candidates[0];
      const changes: Record<string, unknown> = {};
      if (typeof input?.name === "string") changes.name = input.name;
      if (typeof input?.status === "string") changes.status = input.status;
      if (typeof input?.target_temp === "number") changes.target_temp = input.target_temp;
      if (typeof input?.owner_team === "string") changes.owner_team = input.owner_team;
      if (typeof input?.notes === "string") changes.notes = input.notes;
      if (Object.keys(changes).length === 0) return { proposal: null, note: "No fields to update were given." };
      const proposal: Proposal = {
        id: `update_storage_unit:${u._id}:${Date.now()}`,
        actionType: "update_storage_unit",
        summary: `Update storage unit "${u.name}": ${Object.entries(changes)
          .map(([k, v]) => `${k} → ${v}`)
          .join(", ")}?`,
        destructive: false,
        payload: { labId: lab.labId, id: u._id, version: u.version, ...changes },
      };
      return { proposal };
    },
  },
  {
    name: "propose_archive_storage_unit",
    description:
      "Propose archiving a storage unit — the delete-equivalent for storage units; removes it from active " +
      "use. Blocked server-side while anything is still stored inside it. Never executes itself: returns a " +
      "proposal the user must confirm.",
    input_schema: {
      type: "object",
      properties: {
        unit_query: { type: "string", description: "name identifying the storage unit" },
        reason: { type: "string" },
      },
      required: ["unit_query"],
    },
    run: async (ctx, token, input) => {
      const lab = await resolveSingleLab(ctx, token);
      if ("note" in lab) return { proposal: null, note: lab.note };
      const candidates = await findStorageUnitCandidates(ctx, token, lab.labId, String(input?.unit_query ?? ""));
      if (candidates.length === 0) return { proposal: null, note: "No matching storage unit found." };
      if (candidates.length > 1) {
        return {
          proposal: null,
          note: `${candidates.length} storage units match "${input?.unit_query}" — ask the user which one they mean.`,
          candidates: candidates.map((u: any) => ({ id: u._id, name: u.name })),
        };
      }
      const u = candidates[0];
      const proposal: Proposal = {
        id: `archive_storage_unit:${u._id}:${Date.now()}`,
        actionType: "archive_storage_unit",
        summary: `Archive storage unit "${u.name}"? This removes it from active use (blocked if anything is still stored inside).`,
        destructive: true,
        payload: { labId: lab.labId, id: u._id, version: u.version },
      };
      return { proposal };
    },
  },
];

const SYSTEM_PROMPT =
  "You are LabOS AI, a lab operations assistant with live access to this lab's data via tools. Always call " +
  "a tool to look up real data before answering questions about inventory, samples, tasks, protocols, " +
  "instruments, or incidents — never guess or make up numbers. Use search_app when the user names something " +
  "by name so you resolve it to a real record first. " +
  "You can also propose creating, updating, disposing of, or checking out samples, and creating, updating, " +
  "or archiving storage units — using the propose_* tools. Those tools NEVER make the change themselves: " +
  "each one only returns a proposal card that the user must explicitly confirm in the chat UI before " +
  "anything happens. Never claim an action is done just because you called a propose_* tool — tell the user " +
  "you've drafted it and they need to confirm. If a propose_* tool comes back with `note` instead of a " +
  "`proposal` (e.g. multiple matches, or a required field like a disposal reason is missing), ask the user " +
  "for what's needed instead of guessing or picking one for them. " +
  "Be concise and practical. After answering, if it makes sense, suggest 1-3 relevant follow-up questions.";

export const chat = action({
  args: { token: v.optional(v.string()), question: v.string() },
  returns: v.object({
    answer: v.string(),
    suggestions: v.array(v.string()),
    source: v.string(),
    proposedActions: v.array(
      v.object({
        id: v.string(),
        actionType: v.string(),
        summary: v.string(),
        destructive: v.boolean(),
        payload: v.any(),
      })
    ),
    searchResults: v.array(
      v.object({
        id: v.string(),
        type: v.string(),
        title: v.string(),
        subtitle: v.string(),
        icon: v.string(),
        page: v.string(),
      })
    ),
  }),
  handler: async (ctx, { token, question }) => {
    if (!token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new Error("Unauthorized");

    if (!process.env.ANTHROPIC_API_KEY) {
      // No model configured — fall back to the old rule-based responder. It has
      // no tools at all, so it can never propose a mutation either.
      const fallback: any = await ctx.runMutation(api.aiChat.chat, { token, question });
      return {
        answer: fallback.answer,
        suggestions: fallback.suggestions ?? [],
        source: "rule-based",
        proposedActions: [],
        searchResults: [],
      };
    }

    const conversation: any[] = [{ role: "user", content: question }];
    const toolsUsed: string[] = [];
    const proposedActions: Proposal[] = [];
    const searchResults: any[] = [];

    for (let i = 0; i < 5; i++) {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
          messages: conversation,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const content: any[] = data.content ?? [];
      const toolUseBlocks = content.filter((c) => c.type === "tool_use");

      if (data.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
        const text = content.find((c) => c.type === "text")?.text ?? "I couldn't find an answer.";
        return { answer: text, suggestions: suggestionsFor(toolsUsed), source: "anthropic", proposedActions, searchResults };
      }

      conversation.push({ role: "assistant", content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const tool = TOOLS.find((t) => t.name === block.name);
          toolsUsed.push(block.name);
          let result: ToolResult;
          try {
            result = tool ? await tool.run(ctx, token, block.input) : { error: "unknown tool" };
          } catch (e) {
            result = { error: e instanceof Error ? e.message : "tool failed" };
          }
          // Surface structured proposals / search hits to the UI. Capped so one
          // chat turn can never queue more than a handful of pending mutations —
          // an ambiguous or broad request comes back as a `note` (see the
          // propose_* tools above) asking the model to narrow it down instead.
          const r: any = result;
          if (r?.proposal && proposedActions.length < MAX_PROPOSALS_PER_TURN) {
            proposedActions.push(r.proposal as Proposal);
          }
          if (block.name === "search_app" && Array.isArray(r)) {
            for (const hit of r) {
              if (searchResults.length >= MAX_SEARCH_RESULTS_PER_TURN) break;
              searchResults.push(hit);
            }
          }
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
        })
      );

      conversation.push({ role: "user", content: toolResults });
    }

    return {
      answer: "That took more digging than expected — try narrowing your question.",
      suggestions: suggestionsFor(toolsUsed),
      source: "anthropic",
      proposedActions,
      searchResults,
    };
  },
});

function suggestionsFor(toolsUsed: string[]): string[] {
  const map: Record<string, string> = {
    list_inventory: "Show low stock items",
    list_samples: "View all samples",
    list_tasks: "Show overdue tasks",
    list_protocols: "View draft protocols",
    list_instruments: "Show instruments in maintenance",
    list_incidents: "View open incidents",
  };
  const last = toolsUsed[toolsUsed.length - 1];
  const primary = last ? map[last] : undefined;
  return [primary, "What can you help with?"].filter((s): s is string => !!s);
}
