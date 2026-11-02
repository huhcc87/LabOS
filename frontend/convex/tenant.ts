/**
 * Lab separation. Import `query` and `mutation` from here instead of "./_generated/server".
 *
 * Inside a handler, `ctx.db` only shows the caller's own lab:
 *  - reads of lab tables come back filtered to the caller's lab (using the by_lab index),
 *  - get / patch / replace / delete on another lab's row act as "not found",
 *  - inserts are stamped with the caller's lab.
 * Users are scoped the same way by `home_lab_id`. A super admin works inside one lab at a time
 * (`active_lab_id`, defaulting to their own). A signed-in person with no lab can't touch lab data.
 *
 * Internal functions and HTTP handlers are NOT wrapped: they must set `lab_id` themselves.
 */
import { query as rawQuery, mutation as rawMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { ConvexError } from "convex/values";
import type { ObjectType, PropertyValidators } from "convex/values";
import { isLabTable } from "./tenantTables";
import { sha256Hex } from "./cryptoSecrets";

type LabId = Id<"labs">;
const fieldOf = (table: string): string | null => (table === "users" ? "home_lab_id" : isLabTable(table) ? "lab_id" : null);
const indexOf = (table: string) => (table === "users" ? "by_home_lab" : "by_lab");
const NO_LAB = "Your account isn't part of a lab yet. Ask your PI to add you, or sign up for a lab.";

/** A query over one lab-scoped table that always adds the lab condition before it runs. */
class ScopedQuery {
  private indexed = false;
  private scoped = false;
  constructor(private q: any, private field: string, private index: string, private lab: LabId) {}
  withIndex(name: string, f?: any) { this.q = this.q.withIndex(name, f); this.indexed = true; return this; }
  withSearchIndex(name: string, f: any) { this.q = this.q.withSearchIndex(name, f); this.indexed = true; return this; }
  private scope() {
    if (this.scoped) return;
    if (!this.indexed) this.q = this.q.withIndex(this.index, (x: any) => x.eq(this.field, this.lab));
    else this.q = this.q.filter((x: any) => x.eq(x.field(this.field), this.lab));
    this.scoped = true;
  }
  filter(f: any) { this.scope(); this.q = this.q.filter(f); return this; }
  order(o: "asc" | "desc") { this.scope(); this.q = this.q.order(o); return this; }
  take(n: number) { this.scope(); return this.q.take(n); }
  collect() { this.scope(); return this.q.collect(); }
  first() { this.scope(); return this.q.first(); }
  unique() { this.scope(); return this.q.unique(); }
  paginate(opts: any) { this.scope(); return this.q.paginate(opts); }
  [Symbol.asyncIterator]() { this.scope(); return this.q[Symbol.asyncIterator](); }
}

/** The lab a document belongs to, if it says. Rows in tables without a lab marker (sessions, labs…) say nothing. */
const labOfDoc = (doc: any): LabId | undefined | "none" =>
  "lab_id" in doc ? doc.lab_id : "home_lab_id" in doc ? doc.home_lab_id : "none";

export function scopeDb(db: any, lab: LabId | null, selfId: string | null) {
  const mine = (doc: any) => !doc || doc._id === selfId || labOfDoc(doc) === "none" || labOfDoc(doc) === lab;
  const need = (): LabId => { if (!lab) throw new ConvexError(NO_LAB); return lab; };
  const visibleOrThrow = async (...ref: any[]) => {
    const doc = await db.get(...ref);
    if (!doc || !mine(doc)) throw new ConvexError("Not found");
    return doc;
  };
  return new Proxy(db, {
    get(target, prop) {
      if (prop === "query") {
        return (table: string) => {
          const f = fieldOf(table);
          return f ? new ScopedQuery(target.query(table), f, indexOf(table), need()) : target.query(table);
        };
      }
      if (prop === "get") return async (...args: any[]) => { const d = await target.get(...args); return mine(d) ? d : null; };
      if (prop === "insert") {
        return (table: string, value: any) => {
          const f = fieldOf(table);
          if (!f) return target.insert(table, value);
          const l = need();
          if (value[f] !== undefined && value[f] !== l) throw new ConvexError("That belongs to a different lab");
          return target.insert(table, { ...value, [f]: l });
        };
      }
      if (prop === "patch" || prop === "replace") {
        // Which lab a row belongs to is never changed through ordinary writes.
        return async (...args: any[]) => {
          const value = { ...args[args.length - 1] };
          const ref = args.slice(0, -1);
          await visibleOrThrow(...ref);
          delete value.lab_id; delete value.home_lab_id;
          return (target as any)[prop](...ref, prop === "replace" ? { ...value, ...(await keepLab(target, ref)) } : value);
        };
      }
      if (prop === "delete") return async (...args: any[]) => { await visibleOrThrow(...args); return target.delete(...args); };
      const v = (target as any)[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

/** replace() overwrites the whole row, so carry the lab marker across. */
async function keepLab(db: any, ref: any[]) {
  const doc = await db.get(...ref);
  const out: Record<string, unknown> = {};
  if (doc && "lab_id" in doc) out.lab_id = doc.lab_id;
  if (doc && "home_lab_id" in doc) out.home_lab_id = doc.home_lab_id;
  return out;
}

/** Who is calling, and which lab they are working in. */
export async function whoIs(db: any, token: string | undefined | null) {
  if (!token) return { lab: null as LabId | null, self: null as string | null };
  const hashed = await sha256Hex(token); // sessions store only the hash of the token
  const session = await db.query("sessions").withIndex("by_token", (q: any) => q.eq("token", hashed)).first();
  if (!session || session.expires_at < Date.now()) return { lab: null, self: null };
  const user = await db.get(session.user_id);
  if (!user || !user.is_active) return { lab: null, self: null };
  const lab = (user.role === "superadmin" ? user.active_lab_id ?? user.home_lab_id : user.home_lab_id) ?? null;
  return { lab: lab as LabId | null, self: user._id as string };
}

export type TenantQueryCtx = QueryCtx & { labId: LabId | null; rawDb: QueryCtx["db"] };
export type TenantMutationCtx = MutationCtx & { labId: LabId | null; rawDb: MutationCtx["db"] };

export function query<A extends PropertyValidators = Record<string, never>, R = unknown>(def: {
  args?: A;
  handler: (ctx: TenantQueryCtx, args: ObjectType<A>) => R | Promise<R>;
}) {
  return rawQuery({
    args: (def.args ?? {}) as A,
    handler: async (ctx, args: any) => {
      const { lab, self } = await whoIs(ctx.db, (args as { token?: string }).token);
      return def.handler({ ...ctx, db: scopeDb(ctx.db, lab, self), rawDb: ctx.db, labId: lab } as TenantQueryCtx, args as ObjectType<A>);
    },
  });
}

export function mutation<A extends PropertyValidators = Record<string, never>, R = unknown>(def: {
  args?: A;
  handler: (ctx: TenantMutationCtx, args: ObjectType<A>) => R | Promise<R>;
}) {
  return rawMutation({
    args: (def.args ?? {}) as A,
    handler: async (ctx, args: any) => {
      const { lab, self } = await whoIs(ctx.db, (args as { token?: string }).token);
      return def.handler({ ...ctx, db: scopeDb(ctx.db, lab, self), rawDb: ctx.db, labId: lab } as TenantMutationCtx, args as ObjectType<A>);
    },
  });
}
