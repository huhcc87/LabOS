/**
 * Pure helpers for the browser-extension HTTP endpoints (http.ts, extensionKeys.ts).
 * No database or Convex imports, so they are easy to unit test.
 */

export const EXTENSION_KEY_PREFIX = "lbx_";

/** Extension pages call from chrome-extension:// or moz-extension:// origins. Anything else gets no CORS access. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const base = { Vary: "Origin" };
  if (!origin || !/^(chrome|moz|safari-web)-extension:\/\/[a-z0-9-]+$/i.test(origin)) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

/** The key from `Authorization: Bearer <key>` or `X-Api-Key`. */
export function keyFromHeaders(get: (name: string) => string | null): string {
  const auth = get("authorization") ?? "";
  return (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : get("x-api-key") ?? "").trim();
}

export const looksLikeExtensionKey = (k: string): boolean => /^lbx_[0-9a-f]{48}$/.test(k);

const clip = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};

export type CaptureFields = {
  name: string;
  quantity: number;
  supplier?: string;
  catalog_number?: string;
  size?: string;
  cas?: string;
  unit_price?: number;
  url?: string;
  notes: string;
};

/** Turns what the extension captured into a reagent-cart request, or says what is wrong with it. */
export function parseCapture(body: unknown): { ok: true; fields: CaptureFields } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;
  const name = clip(b.name, 300);
  if (!name) return { ok: false, error: "Item name is required" };

  let quantity = 1;
  if (b.quantity !== undefined && b.quantity !== null) {
    quantity = Number(b.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return { ok: false, error: "Quantity must be more than 0" };
  }

  let unit_price: number | undefined;
  if (b.unit_price !== undefined && b.unit_price !== null && b.unit_price !== "") {
    const p = typeof b.unit_price === "string" ? Number(b.unit_price.replace(/[^0-9.]/g, "")) : Number(b.unit_price);
    if (!Number.isFinite(p) || p < 0) return { ok: false, error: "Price cannot be negative" };
    unit_price = p;
  }

  let url = clip(b.url, 2000);
  if (url && !/^https?:\/\//i.test(url)) url = undefined; // never store javascript: or data: links

  const currency = clip(b.currency, 8);
  const note = [
    "Captured with the LabOS browser extension",
    clip(b.purity, 100) && `purity ${clip(b.purity, 100)}`,
    unit_price !== undefined && currency && currency.toUpperCase() !== "USD" ? `price in ${currency.toUpperCase()}` : undefined,
    clip(b.notes, 1000),
  ].filter(Boolean).join(" · ");

  return {
    ok: true,
    fields: {
      name, quantity, unit_price, url, notes: note,
      supplier: clip(b.vendor, 200),
      catalog_number: clip(b.catalog, 100),
      size: clip(b.size, 100),
      cas: clip(b.cas, 50),
    },
  };
}
