// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

type T = ReturnType<typeof convexTest>;

async function seedUser(t: T) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "searcher@lab.com", hashed_password: "x", full_name: "Searcher", role: "staff",
      is_active: true, totp_enabled: false, failed_login_attempts: 0,
      created_at: Date.now(), updated_at: Date.now(),
    });
    const token = "search-token";
    await ctx.db.insert("sessions", { user_id: userId, token, expires_at: Date.now() + 3600_000, created_at: Date.now() });
    return { userId, token };
  });
}

async function seedEntities(t: T) {
  const now = Date.now();
  await t.run(async (ctx) => {
    await ctx.db.insert("samples", {
      sample_id: "S-001", name: "Zebrafish Cortisol Panel", type: "blood", status: "stored",
      created_at: now, updated_at: now,
    });
    await ctx.db.insert("protocols", {
      title: "Cortisol ELISA Protocol", version: "2", status: "active",
      author_id: (await ctx.db.insert("users", {
        email: "author@lab.com", hashed_password: "x", full_name: "Author", role: "staff",
        is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: now, updated_at: now,
      })),
      created_at: now, updated_at: now,
    });
    await ctx.db.insert("inventory", {
      name: "Cortisol Assay Kit", quantity: 3, unit: "kits", location: "Shelf B",
      created_at: now, updated_at: now,
    });
    await ctx.db.insert("instruments", {
      name: "Cortisol Plate Reader", status: "operational", created_at: now, updated_at: now,
    });
    await ctx.db.insert("sops", {
      title: "Cortisol Sample Handling SOP", version: "1", status: "approved",
      author_id: (await ctx.db.insert("users", {
        email: "sopauthor@lab.com", hashed_password: "x", full_name: "SOP Author", role: "staff",
        is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: now, updated_at: now,
      })),
      created_at: now, updated_at: now,
    });
    await ctx.db.insert("suppliers", {
      name: "Cortisol Reagents Inc", approval_status: "approved", created_at: now, updated_at: now,
    });
    const taskOwner = await ctx.db.insert("users", {
      email: "taskowner@lab.com", hashed_password: "x", full_name: "Task Owner", role: "staff",
      is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: now, updated_at: now,
    });
    await ctx.db.insert("tasks", {
      title: "Order more cortisol reagents", status: "open", created_by: taskOwner,
      created_at: now, updated_at: now,
    });
    // Noise row that must never match "cortisol".
    await ctx.db.insert("samples", {
      sample_id: "S-002", name: "Unrelated Saline Blank", type: "control", status: "stored",
      created_at: now, updated_at: now,
    });
  });
}

describe("search.globalSearch", () => {
  it("requires auth", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    await expect(t.query(api.search.globalSearch, { q: "cortisol" })).rejects.toThrow(/Unauthorized/);
  });

  it("returns [] for a blank or too-short query instead of scanning every table", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { token } = await seedUser(t);
    await seedEntities(t);

    expect(await t.query(api.search.globalSearch, { token, q: "" })).toEqual([]);
    expect(await t.query(api.search.globalSearch, { token, q: "c" })).toEqual([]);
  });

  it("finds matches across every searchable entity type for one term", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { token } = await seedUser(t);
    await seedEntities(t);

    const results = await t.query(api.search.globalSearch, { token, q: "cortisol" });
    const types = new Set(results.map((r) => r.type));

    expect(types).toEqual(new Set(["Sample", "Protocol", "Inventory", "Instrument", "SOP", "Supplier", "Task"]));
    // The unrelated sample must not leak into results for an unrelated term.
    expect(results.some((r) => r.title === "Unrelated Saline Blank")).toBe(false);
  });

  it("every result carries a navigable page key and a stable id", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { token } = await seedUser(t);
    await seedEntities(t);

    const results = await t.query(api.search.globalSearch, { token, q: "cortisol" });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(typeof r.id).toBe("string");
      expect(typeof r.page).toBe("string");
      expect(r.page.length).toBeGreaterThan(0);
      expect(typeof r.title).toBe("string");
    }
  });

  it("a query with no matches returns an empty list rather than throwing", async () => {
    const t = convexTest(schema, import.meta.glob("./**/*.ts"));
    const { token } = await seedUser(t);
    await seedEntities(t);

    const results = await t.query(api.search.globalSearch, { token, q: "xenomorph-nonexistent" });
    expect(results).toEqual([]);
  });
});
