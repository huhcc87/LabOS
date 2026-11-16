/**
 * Emails a booking confirmation with a calendar invite (.ics) attached, so Google Calendar / Outlook / Apple
 * Calendar add it and fire their own reminders. Uses the same Brevo settings as invite emails (see inviteEmail.ts);
 * without them nothing is sent and the in-app notification is the only alert.
 */
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { emailConfigured } from "./inviteEmail";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** One-event iCalendar file with an alarm 1 day and 1 hour before the booking. */
export function buildIcs(e: { uid: string; title: string; description: string; location?: string; start: number; end: number }): string {
  const alarm = (trigger: string) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.title)}`, `TRIGGER:${trigger}`, "END:VALARM"];
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LabOS//Instrument Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${e.uid}@labos`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`,
    `SUMMARY:${icsText(e.title)}`, `DESCRIPTION:${icsText(e.description)}`, ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...alarm("-P1D"), ...alarm("-PT1H"), "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export const sendBookingEmail = internalAction({
  args: {
    to: v.string(), name: v.string(), subject: v.string(), body: v.string(),
    uid: v.string(), title: v.string(), location: v.optional(v.string()), start: v.number(), end: v.number(),
  },
  handler: async (_ctx, a) => {
    if (!emailConfigured()) return;
    const ics = buildIcs({ uid: a.uid, title: a.title, description: a.body, location: a.location, start: a.start, end: a.end });
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: process.env.INVITE_FROM_EMAIL, name: "LabOS" },
        to: [{ email: a.to, name: a.name }],
        subject: a.subject,
        textContent: `Hi ${a.name},\n\n${a.body}\n\nOpen the attached invite to add it to Google Calendar, Outlook or Apple Calendar; you'll get a reminder 1 day and 1 hour before.`,
        htmlContent: `<div style="font-family:Lato,Arial,sans-serif;color:#15192D;max-width:480px"><p>Hi ${esc(a.name)},</p><p>${esc(a.body)}</p>` +
          `<p style="color:#6b7085;font-size:13px">Open the attached invite to add it to Google Calendar, Outlook or Apple Calendar; you'll get a reminder 1 day and 1 hour before.</p></div>`,
        attachment: [{ name: "booking.ics", content: btoa(unescape(encodeURIComponent(ics))) }],
      }),
    });
    if (!res.ok) console.error(`Booking email to ${a.to} failed: ${res.status} ${await res.text()}`);
  },
});
