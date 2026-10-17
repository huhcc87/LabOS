/**
 * Protocol AI helper: SOP drafts and AI Swarm chat answers from the local Ollama model.
 * Returns text: null when Ollama is off or fails, so the app falls back to its built-in drafts.
 */
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { callOllama, ollamaConfigured } from "./ollama";

const MAX_PROMPT = 8000;

const SYSTEMS = {
  protocol:
    "You are a careful molecular-biology protocol writer. Reply with ONE JSON object and nothing else (no markdown fences). " +
    'Keys: "summary" (string), "estimatedTime" (string), "reagents" (string[]), "equipment" (string[]), ' +
    '"safetyNotes" (string[]), "qcChecklist" (string[]), ' +
    '"steps" (array of {"title","instruction","duration"}, 5-10 steps), ' +
    '"troubleshooting" (array of {"problem","solution"}). ' +
    "Be specific but never invent citations. This is a draft for expert review.",
  chat:
    "You are LabOS AI Swarm, a panel of lab-protocol experts (biosafety, reviewer, troubleshooter, optimizer, reagent, trainer). " +
    "Answer the researcher's question about their protocol in under 180 words, practical and specific. " +
    "Say so when you are unsure and recommend checking the SDS and the biosafety officer for safety questions.",
} as const;

export const complete = action({
  args: {
    token: v.optional(v.string()),
    kind: v.union(v.literal("protocol"), v.literal("chat")),
    prompt: v.string(),
  },
  returns: v.object({ text: v.union(v.string(), v.null()), source: v.string() }),
  handler: async (ctx, { token, kind, prompt }) => {
    if (!token) throw new ConvexError("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new ConvexError("Unauthorized");
    if (!prompt.trim() || prompt.length > MAX_PROMPT) throw new ConvexError("Prompt is empty or too long");
    if (!ollamaConfigured()) return { text: null, source: "none" };
    const text = await callOllama([{ role: "user", content: prompt }], SYSTEMS[kind], kind === "protocol" ? 2048 : 600);
    return { text, source: text ? "ollama" : "none" };
  },
});
