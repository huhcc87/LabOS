/**
 * Research AI Swarm — hypothesis feedback & learning loop.
 *
 * Users rate generated hypotheses (1-5 stars). Ratings are stored and surfaced
 * back into future synthesis runs as a learned-preference signal, so the swarm
 * adapts toward the kinds of hypotheses this user values and away from the ones
 * they down-rated.
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./authHelper";

export const rateHypothesis = mutation({
  args: {
    token: v.string(),
    topic: v.string(),
    disease: v.optional(v.string()),
    hypothesis: v.string(),
    rationale: v.optional(v.string()),
    rating: v.number(),
    novelty_score: v.optional(v.number()),
    unfunded: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user_id = await requireAuth(ctx, args.token);
    const rating = Math.max(1, Math.min(5, Math.round(args.rating)));

    // Upsert: one rating per (user, hypothesis text).
    const existing = await ctx.db
      .query("hypothesis_ratings")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .collect();
    const match = existing.find((r) => r.hypothesis === args.hypothesis);
    if (match) {
      await ctx.db.patch(match._id, { rating, created_at: Date.now() });
      return { id: match._id, updated: true };
    }
    const id = await ctx.db.insert("hypothesis_ratings", {
      user_id,
      topic: args.topic,
      disease: args.disease,
      hypothesis: args.hypothesis,
      rationale: args.rationale,
      rating,
      novelty_score: args.novelty_score,
      unfunded: args.unfunded,
      created_at: Date.now(),
    });
    return { id, updated: false };
  },
});

// Returns a compact preference signal to inject into the next synthesis prompt.
export const getPreferences = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user_id = await requireAuth(ctx, token);
    const ratings = await ctx.db
      .query("hypothesis_ratings")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(100);

    const liked = ratings.filter((r) => r.rating >= 4).slice(0, 8).map((r) => r.hypothesis);
    const disliked = ratings.filter((r) => r.rating <= 2).slice(0, 8).map((r) => r.hypothesis);
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length : 0;

    return {
      liked,
      disliked,
      total_rated: ratings.length,
      avg_rating: Math.round(avg * 10) / 10,
    };
  },
});

// Returns the user's own ratings keyed by hypothesis text (for UI hydration).
export const myRatings = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const user_id = await requireAuth(ctx, token);
    const ratings = await ctx.db
      .query("hypothesis_ratings")
      .withIndex("by_user", (q) => q.eq("user_id", user_id))
      .order("desc")
      .take(200);
    const map: Record<string, number> = {};
    for (const r of ratings) map[r.hypothesis] = r.rating;
    return { ratings: map, total: ratings.length };
  },
});
