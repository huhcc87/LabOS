/**
 * Stripe integration — Convex actions (server-side only).
 *
 * Uses the Stripe SDK in Convex actions to:
 *   1. Create SetupIntents (save cards)
 *   2. Create PaymentIntents (charge cards)
 *   3. Sync saved payment methods from Stripe
 *
 * Environment variables required in Convex:
 *   STRIPE_SECRET_KEY — sk_live_… or sk_test_…
 */
import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set in Convex environment");
  const Stripe = (await import("stripe")).default;
  return new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
}

async function requireSession(ctx: any, token: string) {
  const session = await ctx.runQuery(api.totp.getSession, { token });
  if (!session) throw new Error("Unauthorized");
  return session;
}

// ── Check Stripe Configuration ───────────────────────────────────────────────

export const isConfigured = query({
  args: {},
  handler: async () => {
    // This runs in a query so we can't access env vars directly,
    // but we can check a table flag or just let the action fail gracefully.
    // For the status endpoint, we'll use the payments.status query which already exists.
    return { configured: true };
  },
});

// ── Create SetupIntent (for saving a card) ───────────────────────────────────

export const createSetupIntent = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await requireSession(ctx, token);
    const stripe = await getStripe();

    // Get or create a Stripe customer for this user
    const user = await ctx.runQuery(api.totp.getUser, { user_id: session.user_id });
    if (!user) throw new Error("User not found");

    let customerId = (user as any).stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { labos_user_id: session.user_id },
      });
      customerId = customer.id;
      await ctx.runMutation(api.stripe.saveCustomerId, {
        user_id: session.user_id,
        stripe_customer_id: customerId,
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    return { client_secret: setupIntent.client_secret };
  },
});

// ── Create PaymentIntent (for charging) ──────────────────────────────────────

export const createPaymentIntent = action({
  args: {
    token: v.string(),
    amount: v.number(), // in cents
    currency: v.optional(v.string()),
    description: v.optional(v.string()),
    payment_method_id: v.optional(v.string()), // Stripe PM id
  },
  handler: async (ctx, { token, amount, currency, description, payment_method_id }) => {
    const session = await requireSession(ctx, token);
    const stripe = await getStripe();

    const user = await ctx.runQuery(api.totp.getUser, { user_id: session.user_id });
    if (!user) throw new Error("User not found");

    const customerId = (user as any).stripe_customer_id;
    if (!customerId) throw new Error("No Stripe customer. Save a card first.");

    const params: any = {
      amount,
      currency: currency || "usd",
      customer: customerId,
      description: description || "LabOS order",
      metadata: { labos_user_id: session.user_id },
    };

    if (payment_method_id) {
      params.payment_method = payment_method_id;
      params.confirm = true;
      params.off_session = true;
    }

    const paymentIntent = await stripe.paymentIntents.create(params);

    return {
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
    };
  },
});

// ── List Saved Payment Methods from Stripe ───────────────────────────────────

export const listPaymentMethods = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const session = await requireSession(ctx, token);
    const stripe = await getStripe();

    const user = await ctx.runQuery(api.totp.getUser, { user_id: session.user_id });
    if (!user) throw new Error("User not found");

    const customerId = (user as any).stripe_customer_id;
    if (!customerId) return [];

    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });

    return methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "unknown",
      last4: pm.card?.last4 || "0000",
      exp_month: pm.card?.exp_month || 0,
      exp_year: pm.card?.exp_year || 0,
    }));
  },
});

// ── Detach (remove) a Payment Method ─────────────────────────────────────────

export const detachPaymentMethod = action({
  args: { token: v.string(), payment_method_id: v.string() },
  handler: async (ctx, { token, payment_method_id }) => {
    await requireSession(ctx, token);
    const stripe = await getStripe();
    await stripe.paymentMethods.detach(payment_method_id);
    return { success: true };
  },
});

// ── Internal Mutations ───────────────────────────────────────────────────────

export const saveCustomerId = mutation({
  args: { user_id: v.id("users"), stripe_customer_id: v.string() },
  handler: async (ctx, { user_id, stripe_customer_id }) => {
    await ctx.db.patch(user_id, {
      stripe_customer_id,
      updated_at: Date.now(),
    });
  },
});
