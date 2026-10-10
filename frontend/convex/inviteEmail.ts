/**
 * Sends invite links by email through Brevo's free tier (300 emails/day).
 * Configure in the Convex dashboard → Settings → Environment Variables:
 *   BREVO_API_KEY      — Brevo → SMTP & API → API keys
 *   INVITE_FROM_EMAIL  — a sender address verified in Brevo (Senders & IP)
 *   APP_URL            — where LabOS runs, e.g. https://labos.example.org
 * Without all three, nothing is sent and the PI shares the link by hand.
 */
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const emailConfigured = (): boolean =>
  !!(process.env.BREVO_API_KEY && process.env.INVITE_FROM_EMAIL && process.env.APP_URL);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const sendInvite = internalAction({
  args: {
    to: v.string(), name: v.string(), token: v.string(), invitedBy: v.string(),
    kind: v.optional(v.union(v.literal("invite"), v.literal("reset"))),
  },
  handler: async (_ctx, { to, name, token, invitedBy, kind = "invite" }) => {
    if (!emailConfigured()) return;
    const link = `${process.env.APP_URL!.replace(/\/+$/, "")}/?invite=${encodeURIComponent(token)}`;
    const isReset = kind === "reset";
    const intro = isReset
      ? "Someone (hopefully you) asked to reset your LabOS password. If it wasn't you, ignore this email."
      : `${invitedBy} added you to LabOS. Choose your password to sign in with ${to}.`;
    const expiry = isReset ? "1 hour" : "7 days";
    const subject = isReset ? "Reset your LabOS password" : "You're invited to LabOS";
    const button = isReset ? "Choose a new password" : "Set my password";
    const text = `Hi ${name},\n\n${intro}\n\n${link}\n\nThe link works once and expires in ${expiry}.`;
    const html =
      `<div style="font-family:Lato,Arial,sans-serif;color:#15192D;max-width:480px">` +
      `<p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(intro)}</p>` +
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#005CC5;color:#fff;border-radius:6px;text-decoration:none">${button}</a></p>` +
      `<p style="color:#6b7085;font-size:13px">Or paste this link: ${escapeHtml(link)}<br>It works once and expires in ${expiry}.</p></div>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.INVITE_FROM_EMAIL, name: "LabOS" },
        to: [{ email: to, name }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });
    // ponytail: failures only reach the Convex logs; the PI can still copy the link from the Users page.
    if (!res.ok) console.error(`Invite email to ${to} failed: ${res.status} ${await res.text()}`);
  },
});
