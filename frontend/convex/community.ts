/**
 * The LabOS community reagent catalog. Every time someone in any lab captures a product with the browser extension,
 * the product's public facts are added here, so the next lab can find it and add it to their cart in one click.
 *
 * Shared across labs on purpose, so it never stores who captured it, which lab, quantities or prices
 * (a price seen while signed in to a vendor can be a lab's negotiated price). Ordering still happens in each lab's own cart.
 */
import { query, mutation } from "./tenant";
import { v, ConvexError } from "convex/values";
import { hubGuard } from "./authHelper";
import { insertRequest } from "./reagentCart";

const { requireAuth } = hubGuard("Resources");

export interface CommunityFacts { name: string; supplier?: string; catalog_number?: string; size?: string; cas?: string; url?: string; image_url?: string }

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The same product from the same vendor is one row, matched on catalog number when there is one, otherwise on name. */
export const communityKey = (f: CommunityFacts): string => `${norm(f.supplier)}|${f.catalog_number ? norm(f.catalog_number) : norm(f.name)}`;

/** Add or refresh a product in the community catalog. Called with the raw database (the table belongs to no lab). */
export async function recordCommunityProduct(db: any, f: CommunityFacts): Promise<void> {
  const name = f.name.trim().slice(0, 300);
  if (!name) return;
  const image = f.image_url && /^https:\/\//i.test(f.image_url) ? f.image_url.slice(0, 1000) : undefined; // https images only
  const key = communityKey(f);
  const now = Date.now();
  const facts = {
    name, vendor: f.supplier, catalog_number: f.catalog_number, size: f.size, cas: f.cas, url: f.url, image_url: image,
    search_text: [name, f.supplier, f.catalog_number, f.cas, f.size].filter(Boolean).join(" ").slice(0, 1000),
  };
  const clean = Object.fromEntries(Object.entries(facts).filter(([, val]) => val !== undefined)) as typeof facts;
  const existing = await db.query("community_reagents").withIndex("by_key", (q: any) => q.eq("key", key)).first();
  if (existing) await db.patch(existing._id, { ...clean, times_added: existing.times_added + 1, updated_at: now });
  else await db.insert("community_reagents", { key, ...clean, times_added: 1, created_at: now, updated_at: now });
}

const shape = (r: any) => ({
  id: r._id as string, name: r.name as string, vendor: (r.vendor ?? "") as string, catalog_number: (r.catalog_number ?? "") as string,
  size: (r.size ?? "") as string, cas: (r.cas ?? "") as string, url: (r.url ?? "") as string, image_url: (r.image_url ?? "") as string,
  times_added: r.times_added as number, updated_at: r.updated_at as number,
});

/** Search the community catalog (newest first when there is no search text). */
export const search = query({
  args: { token: v.optional(v.string()), q: v.string() },
  handler: async (ctx, { token, q }) => {
    await requireAuth(ctx, token);
    const text = q.trim().slice(0, 200);
    const rows = text
      ? await ctx.db.query("community_reagents").withSearchIndex("by_text", (s: any) => s.search("search_text", text)).take(30)
      : await ctx.db.query("community_reagents").withIndex("by_updated").order("desc").take(30);
    return rows.map(shape);
  },
});

/** Put a community product into my lab's reagent cart as a request (my lab's approval rules apply as usual). */
export const addToCart = mutation({
  args: { token: v.optional(v.string()), id: v.id("community_reagents"), quantity: v.number() },
  handler: async (ctx, { token, id, quantity }) => {
    const me = await requireAuth(ctx, token);
    const p = await ctx.db.get(id);
    if (!p) throw new ConvexError("That product is no longer in the catalog.");
    const fields = {
      name: p.name, quantity, notes: "Added from the LabOS community catalog",
      ...(p.vendor ? { supplier: p.vendor } : {}), ...(p.catalog_number ? { catalog_number: p.catalog_number } : {}),
      ...(p.size ? { size: p.size } : {}), ...(p.cas ? { cas: p.cas } : {}), ...(p.url ? { url: p.url } : {}),
    };
    return await insertRequest(ctx, me, fields);
  },
});
