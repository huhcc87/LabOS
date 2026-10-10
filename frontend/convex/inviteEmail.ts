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
  args: { to: v.string(), name: v.string(), token: v.string(), invitedBy: v.string() },
  handler: async (_ctx, { to, name, token, invitedBy }) => {
    if (!emailConfigured()) return;
    const link = `${process.env.APP_URL!.replace(/\/+$/, "")}/?invite=${encodeURIComponent(token)}`;
    const text =
      `Hi ${name},\n\n${invitedBy} added you to LabOS. Open this link to choose your password and sign in with ${to}:\n\n` +
      `${link}\n\nThe link works once and expires in 7 days.`;
    const html =
      `<p>Hi ${escapeHtml(name)},</p>` +
      `<p>${escapeHtml(invitedBy)} added you to <strong>LabOS</strong>. Click below to choose your password and sign in with ${escapeHtml(to)}.</p>` +
      `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none">Set my password</a></p>` +
      `<p style="color:#666;font-size:13px">Or paste this link: ${escapeHtml(link)}<br>It works once and expires in 7 days.</p>`;

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.INVITE_FROM_EMAIL, name: "LabOS" },
        to: [{ email: to, name }],
        subject: "You're invited to LabOS",
        htmlContent: html,
        textContent: text,
      }),
    });
    // ponytail: failures only reach the Convex logs; the PI can still copy the link from the Users page.
    if (!res.ok) console.error(`Invite email to ${to} failed: ${res.status} ${await res.text()}`);
  },
});
