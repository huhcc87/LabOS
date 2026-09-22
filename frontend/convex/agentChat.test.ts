// @vitest-environment edge-runtime
/**
 * Chatbot safety guardrails (agent.ts propose_* tools + agentActions.confirmAction).
 *
 * The core contract under test: the LLM tool-calling loop in agent.chat never
 * mutates anything by itself — it can only return a `proposedActions` entry.
 * Only agentActions.confirmAction, called after the user clicks Confirm in the
 * UI, executes the real (permission-checked) mutation.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "./_generated/api";
import { makeTest, seedUserInLab } from "./testHelpers";

async function createSample(
  t: ReturnType<typeof makeTest>,
  token: string,
  overrides: { sample_id?: string; name?: string } = {}
) {
  return await t.mutation(api.samples.create, {
    token,
    sample_id: overrides.sample_id ?? `S-${Math.random().toString(36).slice(2)}`,
    name: overrides.name ?? "Mouse liver biopsy",
    status: "stored",
  });
}

/** Simulates Claude: first turn calls `toolName`, second turn returns final text. */
function mockAnthropicToolCall(toolName: string, input: Record<string, unknown>, finalText: string) {
  let call = 0;
  return vi.fn(async () => {
    call++;
    if (call === 1) {
      return {
        ok: true,
        json: async () => ({
          stop_reason: "tool_use",
          content: [{ type: "tool_use", id: "toolu_1", name: toolName, input }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: finalText }] }),
    };
  });
}

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_FETCH = global.fetch;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
  global.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("confirm-required guardrail: a delete never executes without the explicit confirm step", () => {
  it("agent.chat returns a dispose proposal but never disposes the sample", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token } = await seedUserInLab(t, "manager"); // manager has sample.dispose
    const sampleId = await createSample(t, token, { sample_id: "SAM-042", name: "Mouse liver biopsy" });

    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = mockAnthropicToolCall(
      "propose_dispose_sample",
      { sample_query: "SAM-042", reason: "contaminated" },
      "I've drafted a proposal to dispose SAM-042. Please confirm."
    ) as any;

    const chatResult: any = await t.action(api.agent.chat, {
      token,
      question: "please dispose sample SAM-042, it's contaminated",
    });

    expect(chatResult.proposedActions).toHaveLength(1);
    const proposal = chatResult.proposedActions[0];
    expect(proposal.actionType).toBe("dispose_sample");
    expect(proposal.destructive).toBe(true);
    expect(proposal.payload.sampleId).toBe(sampleId);
    expect(proposal.summary).toContain("SAM-042");

    // The chat call alone must never touch the database.
    const stillActive: any = await t.run((ctx) => ctx.db.get(sampleId));
    expect(stillActive?.disposed_at).toBeUndefined();
    expect(stillActive?.status).not.toBe("disposed");

    // Only the explicit confirm step — a separate endpoint — executes the mutation.
    await t.action(api.agentActions.confirmAction, {
      token,
      actionType: proposal.actionType,
      payload: proposal.payload,
    });

    const disposed: any = await t.run((ctx) => ctx.db.get(sampleId));
    expect(disposed?.status).toBe("disposed");
    expect(typeof disposed?.disposed_at).toBe("number");

    // Reuses the entity mutation's own writeAudit call — no separate audit path.
    const audit = await t.run((ctx) =>
      ctx.db
        .query("audit_logs")
        .withIndex("by_entity", (q) => q.eq("entity_type", "samples"))
        .collect()
    );
    expect(audit.some((a) => a.action === "samples.dispose" && a.entity_id === sampleId)).toBe(true);
  });

  it("an ambiguous match never picks a sample for the user — returns a note instead of a proposal", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token } = await seedUserInLab(t, "manager");
    await createSample(t, token, { sample_id: "DUP-1", name: "Duplicate Sample" });
    await createSample(t, token, { sample_id: "DUP-2", name: "Duplicate Sample" });

    process.env.ANTHROPIC_API_KEY = "test-key";
    global.fetch = mockAnthropicToolCall(
      "propose_dispose_sample",
      { sample_query: "Duplicate Sample", reason: "cleanup" },
      "There are two samples matching that name — which one did you mean?"
    ) as any;

    const chatResult: any = await t.action(api.agent.chat, {
      token,
      question: "dispose the duplicate sample",
    });

    // No proposal was surfaced, so there is nothing a stray click could confirm.
    expect(chatResult.proposedActions).toHaveLength(0);
  });
});

describe("permission scoping", () => {
  it("confirmAction rejects dispose_sample for a role without sample.dispose", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    // trainee is rank 0 in permissions.ts; dispose needs rank>=1 (staff/manager+ — staff itself CAN dispose)
    const { token, labId } = await seedUserInLab(t, "trainee");
    const sampleId = await createSample(t, token, { sample_id: "SAM-100" });

    await expect(
      t.action(api.agentActions.confirmAction, {
        token,
        actionType: "dispose_sample",
        payload: { labId, sampleId, disposalReason: "test" },
      })
    ).rejects.toThrow(/Forbidden/i);

    const sample: any = await t.run((ctx) => ctx.db.get(sampleId));
    expect(sample?.status).not.toBe("disposed");
  });

  it("confirmAction rejects create_storage_unit for a role without storage.create", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token, labId } = await seedUserInLab(t, "trainee");
    await expect(
      t.action(api.agentActions.confirmAction, {
        token,
        actionType: "create_storage_unit",
        payload: { labId, name: "Sneaky Freezer", storage_type: "-80" },
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  it("rejects an actionType for an entity type the chatbot has no write access to (unpermissioned mutation)", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token } = await seedUserInLab(t, "superadmin");
    // inventory/tasks/instruments/protocols only check requireAuth (no permission
    // tier) so they were deliberately never added to the confirmAction union —
    // this proves the surface area is closed, not just permission-denied.
    await expect(
      t.action(api.agentActions.confirmAction, {
        token,
        actionType: "delete_inventory_item" as any,
        payload: {},
      })
    ).rejects.toThrow();
  });
});

describe("search / create / dispose happy paths", () => {
  it("search_app's backing query finds a sample by name", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token } = await seedUserInLab(t, "staff");
    await createSample(t, token, { name: "Zebrafish Fin Clip" });

    const results: any = await t.query(api.search.globalSearch, { token, q: "zebrafish" });
    expect(results.some((r: any) => r.type === "Sample" && r.title === "Zebrafish Fin Clip")).toBe(true);
  });

  it("confirmAction creates a storage unit for a manager (create happy path)", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token, labId } = await seedUserInLab(t, "manager");

    const result: any = await t.action(api.agentActions.confirmAction, {
      token,
      actionType: "create_storage_unit",
      payload: { labId, name: "New Freezer", storage_type: "-80" },
    });

    const unit: any = await t.run((ctx) => ctx.db.get(result._id));
    expect(unit?.name).toBe("New Freezer");
    expect(unit?.lab_id).toBe(labId);
  });

  it("confirmAction disposes a sample for a manager (delete happy path)", async () => {
    const t = makeTest(import.meta.glob("./**/*.ts"));
    const { token, labId } = await seedUserInLab(t, "manager");
    const sampleId = await createSample(t, token, { sample_id: "SAM-200" });

    await t.action(api.agentActions.confirmAction, {
      token,
      actionType: "dispose_sample",
      payload: { labId, sampleId, disposalReason: "expired" },
    });

    const sample: any = await t.run((ctx) => ctx.db.get(sampleId));
    expect(sample?.status).toBe("disposed");
  });
});
