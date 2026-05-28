import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

// ── Grant Versions ────────────────────────────────────────────────────────────

export const listVersions = query({
  args: { grant_id: v.string() },
  handler: async (ctx, { grant_id }) => {
    return await ctx.db
      .query("grant_versions")
      .withIndex("by_grant", (q) => q.eq("grant_id", grant_id))
      .order("desc")
      .collect();
  },
});

export const createVersion = mutation({
  args: {
    token: v.optional(v.string()),
    grant_id: v.string(),
    title: v.string(),
    section: v.string(),
    content: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { token, grant_id, title, section, content, version }) => {
    const userId = await requireAuth(ctx, token);

    return await ctx.db.insert("grant_versions", {
      grant_id: grant_id,
      title: title,
      section: section,
      content: content,
      version: version,
      created_by: userId,
      created_at: Date.now(),
    });
  },
});

export const deleteVersion = mutation({
  args: { token: v.optional(v.string()), id: v.id("grant_versions") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    await ctx.db.delete(id);
  },
});

// ── Grant Submissions ─────────────────────────────────────────────────────────

export const listSubmissions = query({
  args: {
    paginationOpts: v.optional(
      v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })
    ),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { paginationOpts, status }) => {
    const numItems = paginationOpts?.numItems ?? 50;

    let allDocs = status
      ? await ctx.db
          .query("grant_submissions")
          .filter((q) => q.eq(q.field("status"), status))
          .order("desc")
          .collect()
      : await ctx.db.query("grant_submissions").order("desc").collect();

    // Manual cursor pagination
    const cursor = paginationOpts?.cursor ?? null;
    let startIndex = 0;
    if (cursor) {
      const idx = allDocs.findIndex((d) => d._id === cursor);
      if (idx !== -1) startIndex = idx + 1;
    }

    const page = allDocs.slice(startIndex, startIndex + numItems);
    const nextCursor =
      startIndex + numItems < allDocs.length
        ? page[page.length - 1]?._id ?? null
        : null;

    return { page, nextCursor, isDone: nextCursor === null };
  },
});

export const createSubmission = mutation({
  args: {
    token: v.optional(v.string()),
    title: v.string(),
    agency: v.optional(v.string()),
    grant_type: v.optional(v.string()),
    status: v.string(),
    submission_date: v.optional(v.number()),
    amount_requested: v.optional(v.number()),
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, ...args }) => {
    const userId = await requireAuth(ctx, token);

    const now = Date.now();
    return await ctx.db.insert("grant_submissions", {
      ...args,
      submitted_by: userId,
      created_at: now,
      updated_at: now,
    });
  },
});

export const updateSubmission = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id("grant_submissions"),
    title: v.optional(v.string()),
    agency: v.optional(v.string()),
    grant_type: v.optional(v.string()),
    status: v.optional(v.string()),
    submission_date: v.optional(v.number()),
    amount_requested: v.optional(v.number()),
    outcome: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    await requireAuth(ctx, token);

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Submission not found");

    // Strip undefined values
    const updates = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    await ctx.db.patch(id, { ...updates, updated_at: Date.now() });
  },
});

export const deleteSubmission = mutation({
  args: { token: v.optional(v.string()), id: v.id("grant_submissions") },
  handler: async (ctx, { token, id }) => {
    await requireAuth(ctx, token);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Submission not found");
    await ctx.db.delete(id);
  },
});

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analytics = query({
  args: {},
  handler: async (ctx) => {
    const submissions = await ctx.db
      .query("grant_submissions")
      .collect();

    const total = submissions.length;
    const awarded = submissions.filter((s) => s.outcome === "awarded");
    const successRate = total > 0 ? (awarded.length / total) * 100 : 0;

    const totalFunding = awarded.reduce(
      (sum, s) => sum + (s.amount_requested ?? 0),
      0
    );

    // Break down by agency
    const byAgency: Record<
      string,
      { total: number; awarded: number; total_funding: number }
    > = {};
    for (const s of submissions) {
      const agency = s.agency ?? "Unknown";
      if (!byAgency[agency]) {
        byAgency[agency] = { total: 0, awarded: 0, total_funding: 0 };
      }
      byAgency[agency].total += 1;
      if (s.outcome === "awarded") {
        byAgency[agency].awarded += 1;
        byAgency[agency].total_funding += s.amount_requested ?? 0;
      }
    }

    // Break down by status
    const byStatus: Record<string, number> = {};
    for (const s of submissions) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    }

    return {
      total_submissions: total,
      success_rate: Math.round(successRate * 10) / 10,
      total_funding_awarded: totalFunding,
      by_agency: byAgency,
      by_status: byStatus,
    };
  },
});

// ── AI Draft ──────────────────────────────────────────────────────────────────

export const aiDraft = action({
  args: {
    grant_type: v.string(),
    title: v.string(),
    section: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({ content: v.string(), source: v.string() }),
  handler: async (_ctx, { grant_type, title, section, context }) => {
    const systemPrompt =
      "You are an expert scientific grant writer with extensive experience in NIH, NSF, " +
      "DOD, and private foundation grant applications. Generate well-structured, compelling, " +
      "and scientifically rigorous content for the requested grant section. " +
      "Follow standard grant writing conventions. Be specific and avoid vague language.";

    const userContent = [
      `Grant Type: ${grant_type}`,
      `Project Title: ${title}`,
      `Section to Draft: ${section}`,
      context ? `Additional Context:\n${context}` : "",
      "",
      `Please write a detailed draft for the "${section}" section of this ${grant_type} grant proposal.`,
    ]
      .filter(Boolean)
      .join("\n");

    // Try Anthropic first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          }),
        });
        if (response.ok) {
          const data = await response.json();
          const content = data.content?.[0]?.text ?? "";
          if (content) return { content, source: "anthropic" };
        }
      } catch {
        // fall through
      }
    }

    // Try DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      try {
        const response = await fetch(
          "https://api.deepseek.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              max_tokens: 2048,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
              ],
            }),
          }
        );
        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content ?? "";
          if (content) return { content, source: "deepseek" };
        }
      } catch {
        // fall through
      }
    }

    // Rule-based fallback
    const fallbackContent = generateFallbackGrantContent(grant_type, title, section);
    return { content: fallbackContent, source: "rule-based" };
  },
});

function generateFallbackGrantContent(
  grant_type: string,
  title: string,
  section: string
): string {
  const sectionLower = section.toLowerCase();

  if (sectionLower.includes("specific aims") || sectionLower.includes("aims")) {
    return (
      `[Specific Aims — ${title}]\n\n` +
      `The overarching goal of this ${grant_type} proposal is to [state goal]. ` +
      `We hypothesize that [hypothesis]. To test this hypothesis, we propose the following specific aims:\n\n` +
      `Aim 1: [Characterize / Determine / Establish] [objective 1].\n` +
      `Aim 2: [Develop / Evaluate / Investigate] [objective 2].\n` +
      `Aim 3: [Validate / Apply / Translate] [objective 3].\n\n` +
      `Completion of these aims will [state expected impact and significance].`
    );
  }
  if (sectionLower.includes("significance") || sectionLower.includes("background")) {
    return (
      `[Significance — ${title}]\n\n` +
      `[Describe the scientific problem and its importance]. ` +
      `Current approaches are limited because [describe gap]. ` +
      `This research addresses a critical need by [describe how it fills the gap]. ` +
      `The proposed work is innovative because [novelty statement].`
    );
  }
  if (sectionLower.includes("innovation")) {
    return (
      `[Innovation — ${title}]\n\n` +
      `This proposal is innovative in the following ways:\n\n` +
      `1. Methodological Innovation: [describe novel methods or tools].\n` +
      `2. Conceptual Innovation: [describe new hypothesis or framework].\n` +
      `3. Translational Innovation: [describe pathway to application].\n\n` +
      `Taken together, these innovations position this work to advance the field of [field].`
    );
  }
  if (sectionLower.includes("approach") || sectionLower.includes("methodology")) {
    return (
      `[Approach — ${title}]\n\n` +
      `Overall Strategy: [Describe the general experimental or analytical strategy].\n\n` +
      `Aim 1 Approach:\n` +
      `  - Experimental Design: [detail]\n  - Expected Outcomes: [detail]\n  - Potential Pitfalls: [detail]\n\n` +
      `Aim 2 Approach:\n` +
      `  - Experimental Design: [detail]\n  - Expected Outcomes: [detail]\n  - Potential Pitfalls: [detail]\n\n` +
      `Timeline: Year 1 — [milestones]; Year 2 — [milestones]; Year 3 — [milestones].`
    );
  }
  if (sectionLower.includes("budget")) {
    return (
      `[Budget Justification — ${title}]\n\n` +
      `Personnel: [List key personnel, effort percentages, and roles].\n` +
      `Equipment: [List major equipment items and justification].\n` +
      `Supplies: [Describe consumables and reagents needed].\n` +
      `Travel: [Justify domestic and international travel].\n` +
      `Indirect Costs: Calculated at the negotiated rate of [X]%.`
    );
  }

  return (
    `[${section} — ${title}]\n\n` +
    `[This section should describe ${section} for the ${grant_type} proposal titled "${title}". ` +
    `Please replace this placeholder with your specific content addressing the key points ` +
    `required for this section by the funding agency.]`
  );
}
