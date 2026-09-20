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
];

const SYSTEM_PROMPT =
  "You are LabOS AI, a lab operations assistant with live, read-only access to this lab's data " +
  "via tools. Always call a tool to look up real data before answering questions about inventory, " +
  "samples, tasks, protocols, instruments, or incidents — never guess or make up numbers. " +
  "Be concise and practical. After answering, if it makes sense, suggest 1-3 relevant follow-up " +
  "questions the user might ask next.";

export const chat = action({
  args: { token: v.optional(v.string()), question: v.string() },
  returns: v.object({ answer: v.string(), suggestions: v.array(v.string()), source: v.string() }),
  handler: async (ctx, { token, question }) => {
    if (!token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new Error("Unauthorized");

    if (!process.env.ANTHROPIC_API_KEY) {
      // No model configured — fall back to the old rule-based responder.
      const fallback: any = await ctx.runMutation(api.aiChat.chat, { token, question });
      return { answer: fallback.answer, suggestions: fallback.suggestions ?? [], source: "rule-based" };
    }

    const conversation: any[] = [{ role: "user", content: question }];
    const toolsUsed: string[] = [];

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
        return { answer: text, suggestions: suggestionsFor(toolsUsed), source: "anthropic" };
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
          return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) };
        })
      );

      conversation.push({ role: "user", content: toolResults });
    }

    return {
      answer: "That took more digging than expected — try narrowing your question.",
      suggestions: suggestionsFor(toolsUsed),
      source: "anthropic",
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
