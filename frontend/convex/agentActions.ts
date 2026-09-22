/**
 * The explicit "confirm and execute" endpoint for chatbot-proposed mutations
 * (see agent.ts's propose_* tools). The chatbot never calls a mutation from its
 * own tool-call — it only returns a structured `proposal` for the chat UI to
 * render as a Confirm/Cancel card. This action is the ONLY place that actually
 * executes one, and only after the user clicks Confirm.
 *
 * Every case below calls the exact same permission-checked Convex mutation the
 * regular UI uses (requireAuth + requirePermission + requireLabAccess, plus
 * whatever entity-specific guards the mutation already has — occupancy checks,
 * optimistic-locking, "already disposed", etc). Nothing here re-implements or
 * bypasses those checks, and each underlying mutation already writes its own
 * audit_logs row via writeAudit (see frontend/convex/lib/audit.ts) — so a
 * confirmed chatbot action is indistinguishable in the audit trail from the
 * same action taken through the regular UI.
 *
 * ponytail: scoped to the entity types that actually have a requirePermission()
 * gate — sampleStorage.ts and storageUnits.ts. samples.ts's own original
 * create/update/remove, plus inventory/tasks/instruments/protocols, only check
 * requireAuth with no role/permission tier, so the chatbot does not get a
 * create/update/delete tool for those — see agent.ts's findSampleCandidates
 * comment and the PR description for the full list.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

export const confirmAction = action({
  args: {
    token: v.optional(v.string()),
    actionType: v.union(
      v.literal("dispose_sample"),
      v.literal("checkout_sample"),
      v.literal("create_storage_unit"),
      v.literal("update_storage_unit"),
      v.literal("archive_storage_unit")
    ),
    payload: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, { token, actionType, payload }): Promise<unknown> => {
    if (!token) throw new Error("Unauthorized");
    const session = await ctx.runQuery(internal.customAuth.getSessionByToken, { token });
    if (!session || session.expires_at < Date.now()) throw new Error("Unauthorized");

    const p = (payload ?? {}) as Record<string, any>;

    switch (actionType) {
      case "dispose_sample":
        return await ctx.runMutation(api.samples.dispose, {
          token,
          labId: p.labId,
          sampleId: p.sampleId,
          disposalReason: p.disposalReason,
        });

      case "checkout_sample":
        return await ctx.runMutation(api.samples.checkout, {
          token,
          labId: p.labId,
          sampleId: p.sampleId,
          reason: p.reason,
        });

      case "create_storage_unit":
        return await ctx.runMutation(api.storageUnits.create, {
          token,
          labId: p.labId,
          name: p.name,
          storage_type: p.storage_type,
          status: p.status ?? "normal",
          target_temp: p.target_temp,
        });

      case "update_storage_unit": {
        const { labId, id, version, ...fields } = p;
        return await ctx.runMutation(api.storageUnits.update, { token, labId, id, version, ...fields });
      }

      case "archive_storage_unit":
        return await ctx.runMutation(api.storageUnits.archive, {
          token,
          labId: p.labId,
          id: p.id,
          version: p.version,
        });

      default:
        // Exhaustiveness guard — the v.union above already rejects anything else.
        throw new Error(`UNSUPPORTED_ACTION: ${actionType}`);
    }
  },
});
