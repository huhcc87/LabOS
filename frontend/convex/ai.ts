import { action } from "./_generated/server";
import { v } from "convex/values";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function callAnthropic(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  maxTokens = 1024
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

async function callDeepSeek(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  maxTokens = 1024
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const response = await fetch(
    "https://api.deepseek.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/** Try Anthropic first, fall back to DeepSeek, fall back to rule-based. */
async function callAI(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  maxTokens = 1024
): Promise<{ text: string; source: string }> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const text = await callAnthropic(messages, systemPrompt, maxTokens);
      return { text, source: "anthropic" };
    } catch (_e) {
      // fall through to DeepSeek
    }
  }

  if (process.env.DEEPSEEK_API_KEY) {
    try {
      const text = await callDeepSeek(messages, systemPrompt, maxTokens);
      return { text, source: "deepseek" };
    } catch (_e) {
      // fall through to rule-based
    }
  }

  return { text: "", source: "rule-based" };
}

// ── Rule-based fallback responses ────────────────────────────────────────────

function ruleBasedChatResponse(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("inventory") || q.includes("stock") || q.includes("reagent")) {
    return (
      "To manage your inventory effectively: regularly check stock levels against " +
      "minimum thresholds, set up automated alerts for low-stock items, and maintain " +
      "accurate records of usage rates to improve reorder timing."
    );
  }
  if (q.includes("protocol") || q.includes("procedure") || q.includes("sop")) {
    return (
      "When working with protocols and SOPs: ensure all versions are documented, " +
      "obtain proper approval before implementation, train all relevant staff, and " +
      "schedule periodic reviews to keep documents current."
    );
  }
  if (q.includes("instrument") || q.includes("equipment") || q.includes("calibrat")) {
    return (
      "Equipment management best practices include: logging all calibration dates, " +
      "scheduling preventive maintenance, reporting malfunctions immediately, and " +
      "keeping usage records for cost allocation."
    );
  }
  if (q.includes("safety") || q.includes("incident") || q.includes("hazard")) {
    return (
      "Lab safety guidelines: always wear appropriate PPE, dispose of chemicals " +
      "according to SDS instructions, report incidents immediately, and ensure " +
      "all staff complete required safety training."
    );
  }
  if (q.includes("grant") || q.includes("funding") || q.includes("proposal")) {
    return (
      "Grant management tips: track all submission deadlines carefully, maintain " +
      "detailed budget records, document all expenses properly, and keep your " +
      "biosketch up to date for quick proposal assembly."
    );
  }
  if (q.includes("sample") || q.includes("specimen") || q.includes("biobank")) {
    return (
      "Sample management best practices: use unique identifiers with barcodes, " +
      "log every chain-of-custody event, store samples at correct temperatures, " +
      "and audit your biobank inventory periodically."
    );
  }

  return (
    "I can assist with lab management topics including inventory control, " +
    "instrument scheduling, protocol compliance, safety incidents, grant " +
    "submissions, and sample tracking. Please provide more details about " +
    "your question so I can give a more specific answer."
  );
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * General-purpose lab assistant chat action.
 * Tries Anthropic → DeepSeek → rule-based fallback.
 */
export const chat = action({
  args: { question: v.string() },
  returns: v.object({ answer: v.string(), source: v.string() }),
  handler: async (_ctx, { question }) => {
    const systemPrompt =
      "You are LabOS AI, an expert assistant for scientific laboratory management. " +
      "You help researchers and lab managers with inventory, equipment, protocols, " +
      "safety compliance, grant management, sample tracking, and general lab operations. " +
      "Be concise, accurate, and practical. When unsure, acknowledge uncertainty and " +
      "recommend consulting domain experts or official guidelines.";

    const { text, source } = await callAI(
      [{ role: "user", content: question }],
      systemPrompt,
      512
    );

    const answer =
      source === "rule-based" ? ruleBasedChatResponse(question) : text;

    return { answer, source };
  },
});

/**
 * Inventory prediction action.
 * Accepts a snapshot of current inventory and returns AI-generated reorder predictions.
 */
export const inventoryPredictions = action({
  args: {
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        minimum_quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
        category: v.optional(v.string()),
        usage_rate_per_day: v.optional(v.number()),
        expiry_date: v.optional(v.number()),
      })
    ),
  },
  returns: v.array(
    v.object({
      item_name: v.string(),
      risk_level: v.string(),
      reason: v.string(),
      recommended_action: v.string(),
      days_until_stockout: v.optional(v.number()),
    })
  ),
  handler: async (_ctx, { items }) => {
    const now = Date.now();

    // Build a concise inventory snapshot for the prompt
    const snapshot = items
      .map((it) => {
        const minQ = it.minimum_quantity ?? 0;
        const daysLeft =
          it.usage_rate_per_day && it.usage_rate_per_day > 0
            ? Math.floor(it.quantity / it.usage_rate_per_day)
            : null;
        const expiryDays = it.expiry_date
          ? Math.floor((it.expiry_date - now) / 86400000)
          : null;
        return (
          `- ${it.name} (${it.category ?? "general"}): qty=${it.quantity}${it.unit ? " " + it.unit : ""}, ` +
          `min=${minQ}, ` +
          (daysLeft !== null ? `days_until_stockout=${daysLeft}, ` : "") +
          (expiryDays !== null ? `expiry_in_days=${expiryDays}` : "")
        );
      })
      .join("\n");

    const systemPrompt =
      "You are a laboratory inventory analyst. Analyze the provided inventory snapshot " +
      "and return a JSON array of predictions for items that may run low, expire soon, " +
      "or require attention. Each entry must have: item_name, risk_level (high/medium/low), " +
      "reason, recommended_action, and optionally days_until_stockout (integer). " +
      "Only include items that genuinely need attention. Respond ONLY with valid JSON.";

    const userContent = `Inventory snapshot (today's date epoch: ${now}):\n${snapshot}\n\nReturn predictions as a JSON array.`;

    const { text, source } = await callAI(
      [{ role: "user", content: userContent }],
      systemPrompt,
      1024
    );

    if (source === "rule-based" || !text) {
      // Rule-based fallback: flag items below or near minimum
      return items
        .filter((it) => {
          const minQ = it.minimum_quantity ?? 0;
          const expiryDays = it.expiry_date
            ? Math.floor((it.expiry_date - now) / 86400000)
            : null;
          return it.quantity <= minQ * 1.2 || (expiryDays !== null && expiryDays <= 30);
        })
        .map((it) => {
          const minQ = it.minimum_quantity ?? 0;
          const expiryDays = it.expiry_date
            ? Math.floor((it.expiry_date - now) / 86400000)
            : null;
          const isLow = it.quantity <= minQ;
          const isNearExpiry = expiryDays !== null && expiryDays <= 30;
          const daysLeft =
            it.usage_rate_per_day && it.usage_rate_per_day > 0
              ? Math.floor(it.quantity / it.usage_rate_per_day)
              : undefined;
          return {
            item_name: it.name,
            risk_level: isLow || (isNearExpiry && expiryDays! <= 7) ? "high" : "medium",
            reason: [
              isLow ? `Quantity (${it.quantity}) is at or below minimum (${minQ})` : "",
              isNearExpiry ? `Expires in ${expiryDays} days` : "",
            ]
              .filter(Boolean)
              .join("; "),
            recommended_action: isLow ? "Reorder immediately" : "Schedule reorder or use before expiry",
            days_until_stockout: daysLeft,
          };
        });
    }

    // Parse AI JSON response
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        item_name: string;
        risk_level: string;
        reason: string;
        recommended_action: string;
        days_until_stockout?: number;
      }>;
      return parsed.map((p) => ({
        item_name: p.item_name ?? "",
        risk_level: p.risk_level ?? "medium",
        reason: p.reason ?? "",
        recommended_action: p.recommended_action ?? "",
        days_until_stockout:
          typeof p.days_until_stockout === "number"
            ? p.days_until_stockout
            : undefined,
      }));
    } catch {
      return [];
    }
  },
});
