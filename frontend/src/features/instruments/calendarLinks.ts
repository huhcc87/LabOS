/** "Add to calendar" helpers: a Google Calendar link and a downloadable .ics (Outlook / Apple / any calendar). */
interface Ev { title: string; details: string; location?: string; start: number; end: number }

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export const googleCalendarUrl = (e: Ev) =>
  `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: e.title, details: e.details, location: e.location ?? '', dates: `${stamp(e.start)}/${stamp(e.end)}` })}`;

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function downloadIcs(e: Ev) {
  const alarm = (t: string) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(e.title)}`, `TRIGGER:${t}`, 'END:VALARM'];
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LabOS//Instrument Booking//EN', 'BEGIN:VEVENT', `UID:${e.start}-${Math.random().toString(36).slice(2)}@labos`,
    `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc(e.details)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []), ...alarm('-P1D'), ...alarm('-PT1H'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'booking.ics' });
  a.click();
  URL.revokeObjectURL(url);
}
