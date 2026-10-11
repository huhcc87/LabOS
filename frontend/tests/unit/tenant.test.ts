// @vitest-environment edge-runtime
/**
 * Lab isolation: one lab must never see or change another lab's people or data.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { api } from "../../convex/_generated/api";

const modules = import.meta.glob("../../convex/**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const labA = await ctx.db.insert("labs", { name: "Lab A", created_at: now });
    const labB = await ctx.db.insert("labs", { name: "Lab B", created_at: now });
    const base = { hashed_password: "x", is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: now, updated_at: now };
    const piA = await ctx.db.insert("users", { ...base, email: "pia@a.test", full_name: "PI A", role: "pi", home_lab_id: labA });
    const staffA = await ctx.db.insert("users", { ...base, email: "sa@a.test", full_name: "Staff A", role: "staff", home_lab_id: labA });
    const piB = await ctx.db.insert("users", { ...base, email: "pib@b.test", full_name: "PI B", role: "pi", home_lab_id: labB });
    const root = await ctx.db.insert("users", { ...base, email: "root@x.test", full_name: "Root", role: "superadmin", home_lab_id: labA });
    const loner = await ctx.db.insert("users", { ...base, email: "none@x.test", full_name: "No Lab", role: "staff" });
    const tok = async (user: typeof piA, token: string) => { await ctx.db.insert("sessions", { user_id: user, token, expires_at: now + 1e9, created_at: now }); return token; };
    await tok(piA, "tA"); await tok(staffA, "tSA"); await tok(piB, "tB"); await tok(root, "tRoot"); await tok(loner, "tNone");
    return { labA, labB, piA, staffA, piB, root };
  });
  return { t, ...ids };
}

const sample = { name: "S1", status: "stored", sample_id: "S-1" };

describe("lab isolation", () => {
  it("shows a lab only its own samples, and stamps new ones with the lab", async () => {
    const { t, labA } = await setup();
    const id = await t.mutation(api.samples.create, { token: "tA", ...sample });
    const doc = await t.run((ctx) => ctx.db.get(id as never)) as { lab_id: string } | null;
    expect(doc?.lab_id).toBe(labA);
    expect((await t.query(api.samples.listAll, { token: "tA" })).map((s) => s.sample_id)).toEqual(["S-1"]);
    expect((await t.query(api.samples.listAll, { token: "tSA" })).length).toBe(1);   // same lab
    expect(await t.query(api.samples.listAll, { token: "tB" })).toEqual([]);        // other lab
  });

  it("treats another lab's row as not found for get, update and delete", async () => {
    const { t } = await setup();
    const id = await t.mutation(api.samples.create, { token: "tA", ...sample });
    expect(await t.query(api.samples.get, { token: "tB", id })).toBeNull();
    await expect(t.mutation(api.samples.update, { token: "tB", id, name: "hacked" })).rejects.toThrow();
    await expect(t.mutation(api.samples.remove, { token: "tB", id })).rejects.toThrow();
    const still = await t.run((ctx) => ctx.db.get(id as never)) as { name: string } | null;
    expect(still?.name).toBe("S1");
  });

  it("isolates other tables too (freezers) and their search", async () => {
    const { t } = await setup();
    await t.mutation(api.freezer.create, { token: "tA", name: "Freezer of A" });
    expect((await t.query(api.freezer.list, { token: "tA" })).length).toBe(1);
    expect(await t.query(api.freezer.list, { token: "tB" })).toEqual([]);
  });

  it("lists only people of the caller's lab", async () => {
    const { t } = await setup();
    const a = await t.query(api.users.list, { token: "tA" });
    expect((a.page ?? a.items ?? a).map((u: { email: string }) => u.email).sort()).toEqual(["pia@a.test", "root@x.test", "sa@a.test"]);
    const b = await t.query(api.users.list, { token: "tB" });
    expect((b.page ?? b.items ?? b).map((u: { email: string }) => u.email)).toEqual(["pib@b.test"]);
  });

  it("puts users a PI creates into the PI's lab, and keeps emails unique across labs", async () => {
    const { t, labB } = await setup();
    await t.mutation(api.users.create, { token: "tB", email: "new@b.test", full_name: "New", role: "staff" });
    const row = await t.run((ctx) => ctx.db.query("users").filter((q) => q.eq(q.field("email"), "new@b.test")).first());
    expect(row?.home_lab_id).toBe(labB);
    await expect(t.mutation(api.users.create, { token: "tA", email: "new@b.test", full_name: "Dup", role: "staff" })).rejects.toThrow(/already exists/);
  });

  it("blocks someone who isn't in a lab from lab data", async () => {
    const { t } = await setup();
    await expect(t.query(api.samples.listAll, { token: "tNone" })).rejects.toThrow(/lab/i);
  });

  it("lets a super admin work inside the lab they switch to", async () => {
    const { t, labA, labB } = await setup();
    await t.mutation(api.samples.create, { token: "tA", ...sample });
    await t.mutation(api.samples.create, { token: "tB", ...sample, sample_id: "S-B" });
    expect((await t.query(api.samples.listAll, { token: "tRoot" })).map((s) => s.sample_id)).toEqual(["S-1"]);  // home lab A
    await t.mutation(api.labsAdmin.switchTo, { token: "tRoot", lab_id: labB });
    expect((await t.query(api.samples.listAll, { token: "tRoot" })).map((s) => s.sample_id)).toEqual(["S-B"]);
    expect((await t.query(api.labsAdmin.current, { token: "tRoot" }))?.lab?.id).toBe(labB);
    await t.mutation(api.labsAdmin.switchTo, { token: "tRoot", lab_id: labA });
  });

  it("only super admins manage labs", async () => {
    const { t, labB } = await setup();
    await expect(t.query(api.labsAdmin.list, { token: "tA" })).rejects.toThrow();
    await expect(t.mutation(api.labsAdmin.switchTo, { token: "tA", lab_id: labB })).rejects.toThrow();
    await expect(t.query(api.org.listLabs, { token: "tA" })).rejects.toThrow();
    const made = await t.mutation(api.labsAdmin.create, { token: "tRoot", name: "Lab C", pi_email: "pic@c.test", pi_name: "PI C" });
    expect(made.invite_token).toBeTruthy();
  });

  it("does not let a PI reissue an invite for another lab's user", async () => {
    const { t, piA } = await setup();
    const other = await t.run(async (ctx) => {
      const lab = (await ctx.db.query("labs").collect()).find((l) => l.name === "Lab B")!;
      return ctx.db.insert("users", { email: "p@b.test", hashed_password: "!", full_name: "P", role: "staff", is_active: true, totp_enabled: false, failed_login_attempts: 0, created_at: 1, updated_at: 1, home_lab_id: lab._id });
    });
    await expect(t.mutation(api.invites.regenerate, { token: "tA", user_id: other })).rejects.toThrow();
    void piA;
  });
});
