/**
 * Vendors that LabOS users added to the Shop & Vendors page.
 *
 * Two ways in: automatically, whenever a product is captured with the browser extension or requested with a
 * product link from a vendor that is not listed yet; or by hand with "Add vendor". Like the community reagent
 * catalog, this is shared by every lab on purpose, so it holds only public facts about the vendor (name, website,
 * category), never who added it or which lab.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
import { hitRateLimit } from "./security";

const { requireAuth } = hubGuard("Resources");

export const AUTO_CATEGORY = "Added by labs";
const MAX_VENDORS = 500;

/** The vendor's site as `host` (no www), or null for anything that is not a normal public https/http address. */
export function hostOf(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return null;
    return host;
  } catch { return null; }
}

const niceName = (supplier: string | undefined, host: string) => {
  const s = (supplier ?? "").trim();
  return (s && s.toLowerCase() !== host ? s : host).slice(0, 80);
};

/** Add the vendor behind a product link if no lab has added it yet. Called with the raw database (the table belongs to no lab). */
export async function recordCommunityVendor(db: any, f: { supplier?: string; url?: string }): Promise<void> {
  const host = hostOf(f.url);
  if (!host) return;
  const existing = await db.query("community_vendors").withIndex("by_key", (q: any) => q.eq("key", host)).first();
  const now = Date.now();
  if (existing) { await db.patch(existing._id, { times_added: existing.times_added + 1, updated_at: now }); return; }
  await db.insert("community_vendors", {
    key: host, name: niceName(f.supplier, host), website: `https://${host}`, category: AUTO_CATEGORY,
    source: "auto", times_added: 1, created_at: now, updated_at: now,
  });
}

/** Everything added so far (the app drops the ones that are already in its built-in directory). */
export const list = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, { token }) => {
    await requireAuth(ctx, token);
    const rows = await ctx.db.query("community_vendors").withIndex("by_updated").order("desc").take(MAX_VENDORS);
    return rows.map((r: any) => ({
      id: r._id as string, key: r.key as string, name: r.name as string, website: r.website as string,
      category: r.category as string, source: r.source as string, notes: (r.notes ?? "") as string,
    }));
  },
});

/** "Add vendor": a custom vendor, shared with every lab. */
export const add = mutation({
  args: { token: v.optional(v.string()), name: v.string(), website: v.string(), category: v.string(), notes: v.optional(v.string()) },
  handler: async (ctx, { token, name, website, category, notes }) => {
    const me = await requireAuth(ctx, token);
    const cleanName = name.trim().slice(0, 80);
    if (!cleanName) throw new ConvexError("Vendor name is required.");
    const host = hostOf(website.trim().startsWith("http") ? website : `https://${website.trim()}`);
    if (!host) throw new ConvexError("Enter the vendor's website, for example https://www.example.com");
    const cat = category.trim().slice(0, 60) || AUTO_CATEGORY;
    try { await hitRateLimit(ctx.db, `vendor:${me}`, 10, 60 * 60_000); }
    catch { throw new ConvexError("You added several vendors just now. Try again in a little while."); }
    const now = Date.now();
    const existing = await ctx.db.query("community_vendors").withIndex("by_key", (q: any) => q.eq("key", host)).first();
    if (existing) {
      // Same website: a person's category and name beat the automatic ones.
      await ctx.db.patch(existing._id, { name: cleanName, category: cat, source: "custom", updated_at: now, ...(notes ? { notes: notes.trim().slice(0, 300) } : {}) });
      return existing._id;
    }
    return await ctx.db.insert("community_vendors", {
      key: host, name: cleanName, website: `https://${host}`, category: cat, source: "custom",
      ...(notes?.trim() ? { notes: notes.trim().slice(0, 300) } : {}), times_added: 1, created_at: now, updated_at: now,
    });
  },
});
