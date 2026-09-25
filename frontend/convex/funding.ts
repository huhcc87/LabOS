/**
 * Funding Intelligence — Research AI Swarm.
 *
 * Cross-references AI-detected research gaps against real grant-agency award
 * databases to determine which gaps are TRULY UNFUNDED (i.e. genuine white-space
 * for a new proposal) vs. already crowded.
 *
 * Agencies (all queried server-side, no CORS limits):
 *   • NIH RePORTER  — public JSON API (POST search)               [live]
 *   • NSF Awards    — research.gov public awards JSON API          [live]
 *   • UKRI GtR      — Gateway to Research JSON API                 [live]
 *   • ERC / CORDIS  — EU Horizon projects (best-effort)           [best-effort]
 *
 * Each agency is isolated with its own try/catch + timeout so one slow or
 * broken endpoint never stalls the whole analysis. Unavailable agencies are
 * reported as `available: false` rather than failing the request.
 */
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";

// ── Fetch with timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url: string, init: any = {}, ms = 9000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function cleanQuery(s: string): string {
  // Keep it API-friendly: strip punctuation, collapse whitespace, cap length.
  return s.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

// ── NIH RePORTER ─────────────────────────────────────────────────────────────
async function nihSearch(text: string): Promise<{ total: number; titles: string[] }> {
  const r = await fetchWithTimeout("https://api.reporter.nih.gov/v2/projects/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      criteria: {
        advanced_text_search: {
          operator: "and",
          search_field: "projecttitle,terms,abstracttext",
          search_text: cleanQuery(text),
        },
      },
      limit: 15,
      offset: 0,
    }),
  });
  if (!r.ok) throw new ConvexError(`NIH ${r.status}`);
  const j = await r.json();
  return {
    total: j.meta?.total ?? (j.results?.length ?? 0),
    titles: (j.results ?? []).slice(0, 6).map((p: any) => p.project_title).filter(Boolean),
  };
}

// ── NSF Awards ───────────────────────────────────────────────────────────────
async function nsfSearch(text: string): Promise<{ total: number; titles: string[] }> {
  const url =
    "https://www.research.gov/awardapi-service/v1/awards.json?keyword=" +
    encodeURIComponent(cleanQuery(text)) +
    "&printFields=title,startDate,awardeeName&rpp=15";
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new ConvexError(`NSF ${r.status}`);
  const j = await r.json();
  const awards = j.response?.award ?? [];
  return { total: awards.length, titles: awards.slice(0, 6).map((a: any) => a.title).filter(Boolean) };
}

// ── UKRI — Gateway to Research ───────────────────────────────────────────────
async function ukriSearch(text: string): Promise<{ total: number; titles: string[] }> {
  const url = "https://gtr.ukri.org/gtr/api/projects?q=" + encodeURIComponent(cleanQuery(text)) + "&s=15";
  const r = await fetchWithTimeout(url, { headers: { Accept: "application/vnd.rcuk.gtr.json-v7" } });
  if (!r.ok) throw new ConvexError(`UKRI ${r.status}`);
  const j = await r.json();
  const projects = j.project ?? [];
  return {
    total: j.totalSize ?? projects.length,
    titles: projects.slice(0, 6).map((p: any) => p.title).filter(Boolean),
  };
}

// ── ERC / CORDIS (best-effort) ───────────────────────────────────────────────
async function ercSearch(text: string): Promise<{ total: number; titles: string[] }> {
  // CORDIS exposes a search-results JSON endpoint; it is rate-limited and the
  // shape can change, so this is best-effort and degrades gracefully.
  const url =
    "https://cordis.europa.eu/search/result_en?q=" +
    encodeURIComponent(`'${cleanQuery(text)}'`) +
    "&p=1&num=15&srt=Relevance:decreasing&format=json";
  const r = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, 9000);
  if (!r.ok) throw new ConvexError(`ERC ${r.status}`);
  const j = await r.json();
  const hits = j.payload?.results?.hits?.hit ?? j.hits ?? [];
  const titles = (Array.isArray(hits) ? hits : [])
    .slice(0, 6)
    .map((h: any) => h?.title || h?.project?.title || h?.fields?.title)
    .filter(Boolean);
  const total = j.payload?.totalHits ?? j.totalHits ?? titles.length;
  return { total: Number(total) || titles.length, titles };
}

const AGENCY_DEFS: Record<string, { label: string; fn: (t: string) => Promise<{ total: number; titles: string[] }> }> = {
  nih: { label: "NIH RePORTER", fn: nihSearch },
  nsf: { label: "NSF Awards", fn: nsfSearch },
  ukri: { label: "UKRI / Wellcome", fn: ukriSearch },
  erc: { label: "ERC / CORDIS (EU)", fn: ercSearch },
};

function classify(totalFunded: number): "unfunded" | "underfunded" | "funded" {
  if (totalFunded <= 0) return "unfunded";
  if (totalFunded <= 10) return "underfunded";
  return "funded";
}

export const analyzeFunding = action({
  args: {
    token: v.string(),
    topic: v.string(),
    gaps: v.array(v.string()),
    agencies: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { token, topic, gaps, agencies }) => {
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) {
      throw new ConvexError("Unauthorized");
    }

    const selected = (agencies && agencies.length ? agencies : ["nih", "nsf", "ukri", "erc"]).filter(
      (a) => AGENCY_DEFS[a]
    );
    const gapList = gaps.slice(0, 6);

    // 1) Topic-level overview per agency (also tells us which agencies are live).
    const overview = await Promise.all(
      selected.map(async (id) => {
        try {
          const res = await AGENCY_DEFS[id].fn(topic);
          return { id, label: AGENCY_DEFS[id].label, available: true, total: res.total, sampleTitles: res.titles };
        } catch {
          return { id, label: AGENCY_DEFS[id].label, available: false, total: 0, sampleTitles: [] as string[] };
        }
      })
    );
    const liveAgencies = overview.filter((a) => a.available).map((a) => a.id);

    // 2) Per-gap funded counts across the live agencies.
    const gap_analysis = await Promise.all(
      gapList.map(async (gap) => {
        const counts: Record<string, number | null> = {};
        await Promise.all(
          liveAgencies.map(async (id) => {
            try {
              const res = await AGENCY_DEFS[id].fn(gap);
              counts[id] = res.total;
            } catch {
              counts[id] = null; // query failed for this gap/agency
            }
          })
        );
        const total_funded = Object.values(counts).reduce<number>((s, c) => s + (c || 0), 0);
        return { gap, counts, total_funded, status: classify(total_funded) };
      })
    );

    const unfundedCount = gap_analysis.filter((g) => g.status === "unfunded").length;
    const underfundedCount = gap_analysis.filter((g) => g.status === "underfunded").length;

    return {
      agencies: overview,
      gap_analysis,
      summary: {
        agencies_live: liveAgencies.length,
        agencies_total: selected.length,
        gaps_analyzed: gap_analysis.length,
        unfunded: unfundedCount,
        underfunded: underfundedCount,
      },
      generated_at: Date.now(),
    };
  },
});
