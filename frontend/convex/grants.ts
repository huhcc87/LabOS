import { query, mutation, action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAuth, requireRole } from "./authHelper";
import { internal } from "./_generated/api";

// ── Grant Versions ────────────────────────────────────────────────────────────

export const listVersions = query({
  args: { token: v.optional(v.string()), grant_id: v.string() },
  handler: async (ctx, { token, grant_id }) => {
    await requireAuth(ctx, token);
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
    await requireRole(ctx, token, "manager");
    await ctx.db.delete(id);
  },
});

// ── Grant Submissions ─────────────────────────────────────────────────────────

export const listSubmissions = query({
  args: {
    token: v.optional(v.string()),
    paginationOpts: v.optional(
      v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })
    ),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { token, paginationOpts, status }) => {
    await requireAuth(ctx, token);
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
    if (!existing) throw new ConvexError("Submission not found");

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
    await requireRole(ctx, token, "manager");
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Submission not found");
    await ctx.db.delete(id);
  },
});

// ── Analytics ─────────────────────────────────────────────────────────────────

export const analytics = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
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
    token: v.optional(v.string()),
    grant_type: v.string(),
    title: v.string(),
    section: v.string(),
    context: v.optional(v.string()),
  },
  returns: v.object({ content: v.string(), source: v.string() }),
  handler: async (ctx, { token, grant_type, title, section, context }) => {
    const session = token
      ? await ctx.runQuery(internal.customAuth.getSessionByToken, { token })
      : null;
    if (!session || session.expires_at < Date.now()) {
      throw new ConvexError("Unauthorized");
    }

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

// ── Research AI Swarm — multi-model synthesis ────────────────────────────────
//
// Real AI synthesis engine. Takes ingested literature (texts) and produces a
// structured research package: per-paper summaries, field overview, research
// gaps, novel hypotheses, NIH-style specific aims, objectives and drafted grant
// sections. Tries multiple LLM providers in a configurable order, then falls
// back to a structured template so the UI never receives an empty result.

type SwarmModel = "claude-sonnet" | "claude-haiku" | "gpt-4o" | "deepseek" | "auto";

const MODEL_LABELS: Record<string, string> = {
  "claude-sonnet": "Claude 3.5 Sonnet",
  "claude-haiku": "Claude 3.5 Haiku",
  "gpt-4o": "GPT-4o",
  "deepseek": "DeepSeek V3",
  "template": "Template Engine",
};

function extractJson(raw: string): any | null {
  if (!raw) return null;
  // Strip ```json fences if present
  let s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // Grab the outermost { … } block
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    // Best-effort: remove trailing commas
    try {
      return JSON.parse(s.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      return null;
    }
  }
}

async function callAnthropic(model: string, system: string, user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.content?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

async function callOpenAI(system: string, user: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

async function callDeepSeek(system: string, user: string): Promise<string | null> {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  try {
    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 4096,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// Run a provider by key. Returns { raw, source } or null.
async function runProvider(
  key: string,
  system: string,
  user: string
): Promise<{ raw: string; source: string } | null> {
  let raw: string | null = null;
  if (key === "claude-sonnet") raw = await callAnthropic("claude-3-5-sonnet-20241022", system, user);
  else if (key === "claude-haiku") raw = await callAnthropic("claude-3-5-haiku-20241022", system, user);
  else if (key === "gpt-4o") raw = await callOpenAI(system, user);
  else if (key === "deepseek") raw = await callDeepSeek(system, user);
  return raw ? { raw, source: key } : null;
}

function buildSynthesisFallback(
  topic: string,
  disease: string,
  grant_type: string,
  texts: { filename: string; content: string }[]
) {
  const paper_summaries = texts.slice(0, 25).map((t) => {
    const c = t.content || "";

    // Split structured header from abstract body
    const abstractStart = c.indexOf("Abstract:\n");
    const abstract = abstractStart >= 0 ? c.slice(abstractStart + 10).trim() : c;
    const sentences = abstract.split(/(?<=[.!?])\s+/).filter((s) => s.length > 10);

    // Identifiers
    const pmid = /PMID:\s*([0-9]{1,9})/i.exec(c)?.[1];
    const doi = /DOI:\s*(10\.\d{4,9}\/[^\s.,;)}\]]+)/i.exec(c)?.[1];

    // Sample size — multiple patterns: N=120, n = 1,200, 120 patients, cohort of 500
    const nMatch =
      /\bN\s*=\s*([0-9][0-9,]*)/i.exec(abstract)?.[1] ||
      /\b(\d[0-9,]*)\s*(?:patients|participants|subjects|individuals|cases|samples|children|adults|women|men|persons|enrollees|volunteers)/i.exec(abstract)?.[1] ||
      /\bcohort\s+of\s+(\d[0-9,]*)/i.exec(abstract)?.[1] ||
      /\b(?:enrolled|recruited|included|analyzed|screened)\s+(\d[0-9,]*)/i.exec(abstract)?.[1];

    // Methodology — look for sentences with method-related keywords
    const methodKeywords = /\b(randomized|cohort|cross-sectional|longitudinal|retrospective|prospective|meta-analysis|systematic review|double-blind|placebo-controlled|case-control|rct|in vitro|in vivo|single-cell|RNA-seq|CRISPR|immunohistochemistry|flow cytometry|western blot|ELISA|PCR|qPCR|mass spectrometry|whole[- ]?exome|whole[- ]?genome|survey|questionnaire|interview|observational)\b/i;
    const methodSentences = sentences
      .filter((s) => methodKeywords.test(s))
      .slice(0, 2);
    const methodology = methodSentences.length
      ? methodSentences.join(" ").slice(0, 400)
      : "Not auto-extracted — add an AI key for full analysis.";

    // Results — look for sentences with quantitative language
    const resultKeywords = /\b(p\s*[<=]\s*0\.\d|CI\s|odds ratio|hazard ratio|risk ratio|OR\s*=|HR\s*=|RR\s*=|fold[- ]change|significantly|increased|decreased|reduced|improved|higher|lower|correlated|associated with|compared to|versus|median|mean\b.*\bwas\b|\d+(\.\d+)?%)/i;
    const resultSentences = sentences
      .filter((s) => resultKeywords.test(s) && !methodKeywords.test(s))
      .slice(0, 2);
    const results = resultSentences.length
      ? resultSentences.join(" ").slice(0, 400)
      : "Not auto-extracted — add an AI key for full analysis.";

    // Key findings — first two abstract sentences (or result sentences if available)
    const keyFindings =
      (resultSentences.length ? resultSentences : sentences.slice(0, 2))
        .join(". ")
        .slice(0, 280) ||
      "Key findings could not be auto-extracted — review the source.";

    // Conclusion — look for concluding sentences at the end of the abstract
    const conclusionKeywords = /\b(conclude|conclusion|suggest|in summary|taken together|overall|these (?:results|findings|data)|our (?:results|findings|data|study)|this study|implications)\b/i;
    const conclusionSentences = sentences
      .filter((s) => conclusionKeywords.test(s))
      .slice(0, 2);
    const mainConclusion = conclusionSentences.length
      ? conclusionSentences.join(" ").slice(0, 400)
      : sentences.slice(-2).join(" ").slice(0, 400) || "See source document.";

    // Race / ethnicity
    const raceKeywords = /\b(African[- ]?American|Black|White|Caucasian|Hispanic|Latino|Latina|Asian|Native American|Indigenous|Pacific Islander|Maori|Aboriginal|mixed[- ]?race|multi[- ]?ethnic|ethnicity|race|racial)\b/i;
    const raceSentence = sentences.find((s) => raceKeywords.test(s));
    const raceEthnicity = raceSentence
      ? raceSentence.slice(0, 200)
      : "Not reported";

    // Country / setting
    const countries = /\b(United States|USA|U\.S\.|UK|United Kingdom|China|Japan|India|Germany|France|Canada|Australia|Brazil|South Korea|Italy|Spain|Netherlands|Sweden|Switzerland|Norway|Denmark|Finland|Israel|Taiwan|Singapore|Mexico|Thailand|Iran|Turkey|Egypt|Nigeria|South Africa|Kenya|Colombia|Argentina|Chile|Peru|Saudi Arabia|Pakistan|Bangladesh|Indonesia|Vietnam|Philippines|Malaysia|Poland|Belgium|Austria|Ireland|Scotland|Wales|New Zealand|Portugal|Greece|Czech Republic|Hungary|Romania|Russia|Ukraine)\b/i;
    const countryMatch = countries.exec(abstract);
    const country = countryMatch ? countryMatch[1] : "Not reported";

    return {
      filename: t.filename,
      identifier: pmid ? `PMID ${pmid}` : doi ? `DOI ${doi}` : "",
      key_findings: keyFindings,
      methodology,
      results,
      main_conclusion: mainConclusion,
      sample_size: nMatch ? `N=${nMatch.replace(/,/g, ",")}` : "Not reported",
      race_ethnicity: raceEthnicity,
      country,
      relevance: `Relevant to "${topic}".`,
    };
  });
  const dz = disease || topic;
  return {
    paper_summaries,
    field_overview:
      `Template synthesis for "${topic}"${disease ? ` in the context of ${disease}` : ""}. ` +
      `${texts.length} source(s) ingested. Configure an ANTHROPIC_API_KEY, OPENAI_API_KEY, or ` +
      `DEEPSEEK_API_KEY in Convex to unlock full multi-agent AI synthesis with deep paper analysis, ` +
      `gap mapping and novel hypothesis generation.`,
    research_gaps: [
      `Mechanistic drivers of ${dz} remain incompletely defined.`,
      `Translation of ${topic} findings into validated clinical endpoints is limited.`,
      `Predictive biomarkers for patient stratification in ${dz} are lacking.`,
    ],
    web_context: "",
    novel_hypotheses: [
      {
        hypothesis: `Targeting a key pathway implicated in ${topic} will modulate disease progression in ${dz}.`,
        rationale: "Derived from convergent themes across the ingested literature.",
        novelty_score: 6,
        supporting_evidence: `${texts.length} ingested source(s) point to this direction.`,
        testability: "Testable via in vitro and in vivo models with defined readouts.",
      },
    ],
    specific_aims: [
      `Aim 1: Characterize the molecular basis of ${topic} in ${dz}.`,
      `Aim 2: Develop and validate a targeted intervention informed by Aim 1.`,
      `Aim 3: Evaluate translational potential and candidate biomarkers.`,
    ],
    objectives: [
      `Define the mechanism linking ${topic} to ${dz}.`,
      `Establish proof-of-concept for intervention.`,
      `Identify biomarkers for stratification.`,
    ],
    grant_sections: {
      "Specific Aims": generateFallbackGrantContent(grant_type, topic, "specific aims"),
      "Significance": generateFallbackGrantContent(grant_type, topic, "significance"),
    },
    source: "template",
    model_label: MODEL_LABELS["template"],
  };
}

export const researchSynthesis = action({
  args: {
    texts: v.array(v.object({ filename: v.string(), content: v.string() })),
    topic: v.string(),
    disease: v.optional(v.string()),
    grant_type: v.optional(v.string()),
    extra_context: v.optional(v.string()),
    model: v.optional(v.string()),
    feedback: v.optional(
      v.object({
        liked: v.array(v.string()),
        disliked: v.array(v.string()),
      })
    ),
  },
  handler: async (_ctx, { texts, topic, disease, grant_type, extra_context, model, feedback }) => {
    const gt = grant_type || "NIH R01";
    const dz = disease || "";
    const chosen = (model || "auto") as SwarmModel;

    const system =
      "You are a multi-agent scientific research swarm composed of seven specialist agents: " +
      "(1) a literature analyst, (2) a gap-mapper, (3) a field-intelligence synthesizer, " +
      "(4) a hypothesis generator, (5) an NIH study-section reviewer, (6) a specific-aims architect, " +
      "and (7) an expert grant writer. You analyze biomedical literature with rigor and produce " +
      "novel, testable, fundable research directions. You ALWAYS respond with a single valid JSON " +
      "object and nothing else — no prose, no markdown fences.";

    const corpus = texts
      .slice(0, 30)
      .map((t, i) => `[Paper ${i + 1}: ${t.filename}]\n${(t.content || "").slice(0, 6000)}`)
      .join("\n\n");

    const feedbackBlock =
      feedback && (feedback.liked.length || feedback.disliked.length)
        ? `\nLEARNED INVESTIGATOR PREFERENCES (from prior hypothesis ratings — weight these heavily):\n` +
          (feedback.liked.length
            ? `HIGHLY RATED (generate hypotheses in this style/direction):\n- ${feedback.liked.join("\n- ")}\n`
            : "") +
          (feedback.disliked.length
            ? `LOW RATED (avoid this style/direction):\n- ${feedback.disliked.join("\n- ")}\n`
            : "")
        : "";

    const literatureBlock = texts.length
      ? `\nINGESTED LITERATURE (${texts.length} sources):\n${corpus}\n\n` +
        `TASK: Synthesize the literature and return a JSON object with EXACTLY these keys:\n`
      : `\nNO PAPERS WERE SUPPLIED. Draw on your own up-to-date expert knowledge of this field ` +
        `to map the state of the art, identify genuine open gaps, and generate novel directions. ` +
        `Leave "paper_summaries" as an empty array.\n\n` +
        `TASK: Synthesize the field and return a JSON object with EXACTLY these keys:\n`;

    const user =
      `RESEARCH TOPIC: ${topic}\n` +
      `DISEASE / CONDITION: ${dz || "(not specified)"}\n` +
      `TARGET GRANT MECHANISM: ${gt}\n` +
      (extra_context ? `INVESTIGATOR CONTEXT: ${extra_context}\n` : "") +
      feedbackBlock +
      literatureBlock +
      `{\n` +
      `  "paper_summaries": [{"filename","identifier","key_findings","methodology","results","main_conclusion","sample_size","race_ethnicity","country","relevance"}],\n` +
      `     // For each paper: "identifier" = its PMID or DOI exactly as given in the source text. ` +
      `"results" = a brief statement of the quantitative findings. ` +
      `"sample_size" = the cohort size as "N=<number>" (or "Not reported"). ` +
      `"race_ethnicity" = the cohort race/ethnicity composition (or "Not reported"). ` +
      `"country" = the study country/setting (or "Not reported"). ` +
      `NEVER invent these values — if a field is not stated in the paper text, write "Not reported".\n` +
      `  "field_overview": "3-5 sentence state-of-the-field synthesis",\n` +
      `  "research_gaps": ["specific, addressable gaps"],\n` +
      `  "web_context": "what the broader field is converging on",\n` +
      `  "novel_hypotheses": [{"hypothesis","rationale","novelty_score (1-10 integer)","supporting_evidence","testability"}],\n` +
      `  "specific_aims": ["NIH-style aim statements"],\n` +
      `  "objectives": ["concrete measurable objectives"],\n` +
      `  "grant_sections": {"Specific Aims": "full drafted text", "Significance": "full drafted text", "Innovation": "full drafted text"}\n` +
      `}\n` +
      `Generate 3-5 novel_hypotheses ranked by novelty. Be specific to ${dz || topic}. ` +
      `Tailor grant_sections to ${gt} conventions.`;

    // Provider order: honor explicit choice first, then fall back across all available.
    let order: string[];
    if (chosen === "auto") {
      order = ["claude-sonnet", "gpt-4o", "deepseek", "claude-haiku"];
    } else {
      order = [chosen, "claude-sonnet", "gpt-4o", "deepseek", "claude-haiku"].filter(
        (v, i, a) => a.indexOf(v) === i
      );
    }

    for (const key of order) {
      const res = await runProvider(key, system, user);
      if (!res) continue;
      const parsed = extractJson(res.raw);
      if (parsed && (parsed.novel_hypotheses || parsed.specific_aims || parsed.field_overview)) {
        return {
          paper_summaries: parsed.paper_summaries ?? [],
          field_overview: parsed.field_overview ?? "",
          research_gaps: parsed.research_gaps ?? [],
          web_context: parsed.web_context ?? "",
          novel_hypotheses: (parsed.novel_hypotheses ?? []).map((h: any) => ({
            hypothesis: h.hypothesis ?? "",
            rationale: h.rationale ?? "",
            novelty_score: Number(h.novelty_score) || 5,
            supporting_evidence: h.supporting_evidence ?? "",
            testability: h.testability ?? "",
          })),
          specific_aims: parsed.specific_aims ?? [],
          objectives: parsed.objectives ?? [],
          grant_sections: parsed.grant_sections ?? {},
          source: res.source,
          model_label: MODEL_LABELS[res.source] ?? res.source,
        };
      }
    }

    // All providers unavailable or failed → structured template (never empty).
    return buildSynthesisFallback(topic, dz, gt, texts);
  },
});
