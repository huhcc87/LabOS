import { useCallback, useState } from 'react';

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export const DATE_FORMATS: DateFormat[] = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'];

export interface DatePrefs { tz: string; format: DateFormat; auto: boolean }

const KEY = 'labos.datePrefs';

/** The time zone the browser (and so the person's location) reports. */
export const detectTimeZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

export const allTimeZones = (): string[] => {
  const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
  const list = fn ? fn('timeZone') : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
  return list.includes('UTC') ? list : ['UTC', ...list];
};

const load = (): DatePrefs => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<DatePrefs> | null;
    if (p) {
      const auto = p.auto !== false;
      return { auto, tz: auto ? detectTimeZone() : p.tz || detectTimeZone(), format: DATE_FORMATS.includes(p.format as DateFormat) ? (p.format as DateFormat) : 'MM/DD/YYYY' };
    }
  } catch { /* ignore */ }
  return { auto: true, tz: detectTimeZone(), format: 'MM/DD/YYYY' };
};

/** Date format + time zone choice, remembered on this device. Auto = follow the browser's detected zone. */
export function useDatePrefs(): [DatePrefs, (p: Partial<DatePrefs>) => void] {
  const [prefs, setPrefs] = useState<DatePrefs>(load);
  const update = useCallback((p: Partial<DatePrefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      if (next.auto) next.tz = detectTimeZone();
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return [prefs, update];
}

interface Parts { y: number; mo: number; d: number; h: number; mi: number }
const pad = (n: number) => String(n).padStart(2, '0');

export function partsIn(ms: number, tz: string): Parts {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, mo: o.month, d: o.day, h: o.hour % 24, mi: o.minute };
}

/** "2026-11-24" in the given zone. */
export const dayIn = (ms: number, tz: string): string => { const p = partsIn(ms, tz); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; };
export const timeIn = (ms: number, tz: string): string => { const p = partsIn(ms, tz); return `${pad(p.h)}:${pad(p.mi)}`; };

/** Wall-clock date ("YYYY-MM-DD") + time ("HH:mm") in `tz` -> UTC milliseconds. */
export function zonedToUtc(date: string, time: string, tz: string): number {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall;
  for (let i = 0; i < 2; i++) { // second pass settles DST edges
    const p = partsIn(guess, tz);
    guess += wall - Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  }
  return guess;
}

/** Format a stored "YYYY-MM-DD" day in the chosen date format. */
export const fmtDay = (iso: string, format: DateFormat): string => {
  const [y, m, d] = iso.split('-');
  return format === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : format === 'YYYY-MM-DD' ? `${y}-${m}-${d}` : `${m}/${d}/${y}`;
};

export const fmtClock = (ms: number, tz: string): string =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });

/** "Tue, 11/24/2026, 9:00 AM" in the chosen zone and date format. */
export const fmtWhen = (ms: number, p: DatePrefs): string =>
  `${new Date(ms).toLocaleDateString([], { weekday: 'short', timeZone: p.tz })}, ${fmtDay(dayIn(ms, p.tz), p.format)}, ${fmtClock(ms, p.tz)}`;

export const tzLabel = (tz: string): string => {
  try {
    const n = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName')?.value;
    return `${tz.replace(/_/g, ' ')}${n ? ` (${n})` : ''}`;
  } catch { return tz; }
};
