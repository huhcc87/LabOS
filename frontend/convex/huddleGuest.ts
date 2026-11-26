/**
 * LabHuddle guest links: the only two functions that work without signing in.
 *
 * A member makes a link for one call (createGuestLink in huddleCall.ts). Anyone holding it can ask to join that one call:
 * guestJoin gives them a secret that works only for that room, and they wait until the host lets them in.
 * These functions are deliberately not lab-scoped wrappers: they set lab_id themselves from the link.
 */
import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { sha256Hex } from "./cryptoSecrets";

const MAX_GUESTS_PER_LINK = 40;
const GUEST_SESSION_MS = 12 * 3_600_000;

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** What a link is for, so the page can show the call's name (and let a signed-in member go straight in). */
export const linkInfo = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const link = code.length >= 16 ? await ctx.db.query("huddle_guest_links").withIndex("by_code", (q) => q.eq("code", code)).first() : null;
    if (!link || link.revoked || link.expires_at < Date.now()) return { valid: false as const };
    return { valid: true as const, title: link.title, room_id: link.room_id };
  },
});

export const guestJoin = mutation({
  args: { code: v.string(), name: v.string() },
  handler: async (ctx, { code, name }) => {
    const now = Date.now();
    const link = code.length >= 16 ? await ctx.db.query("huddle_guest_links").withIndex("by_code", (q) => q.eq("code", code)).first() : null;
    if (!link || link.revoked || link.expires_at < now) throw new ConvexError("This guest link has expired or was cancelled. Ask for a new one.");
    const clean = name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (clean.length < 2) throw new ConvexError("Please type your name so the host knows who you are.");
    const taken = await ctx.db.query("huddle_guests").withIndex("by_link", (q) => q.eq("link_id", link._id)).collect();
    if (taken.length >= MAX_GUESTS_PER_LINK) throw new ConvexError("Too many people have used this link. Ask for a new one.");
    const secret = randomHex(32); // the guest keeps this; only its hash is stored
    await ctx.db.insert("huddle_guests", {
      lab_id: link.lab_id, room_id: link.room_id, link_id: link._id, token_hash: await sha256Hex(secret),
      name: `${clean} (guest)`, created_at: now, expires_at: Math.min(link.expires_at, now + GUEST_SESSION_MS),
    });
    return { guest: secret, room_id: link.room_id, title: link.title };
  },
});
