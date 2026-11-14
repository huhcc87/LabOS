/**
 * Instrument QR labels. The QR holds a link (https://<app>/?instrument=<id>) so any phone camera opens the app
 * straight on that instrument's booking page. The barcode / short code is `INST-<id>` for USB scanners.
 */
export const INST_PREFIX = 'INST-';
/** sessionStorage key: the instrument the booking page should open with. */
export const PICK_KEY = 'labos_pick_instrument';
const PARAM = 'instrument';

/** Where phones should open the app. Set VITE_PUBLIC_APP_URL when printing from a local copy (localhost can't be reached by a phone). */
const appBase = (): string => (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/+$/, '') || window.location.origin;

/** The link a printed instrument QR opens. */
export const instrumentUrl = (id: string): string => `${appBase()}/?${PARAM}=${encodeURIComponent(id)}`;

/** What a label's QR should hold: a link for instrument labels, the code itself for everything else. */
export const qrValueFor = (code: string): string => (code.startsWith(INST_PREFIX) ? instrumentUrl(code.slice(INST_PREFIX.length)) : code);

/** The instrument id in a scan (INST-<id> or an instrument link), or null if it isn't an instrument label. */
export function instrumentIdFrom(text: string): string | null {
  const raw = text.trim();
  if (raw.startsWith(INST_PREFIX)) return raw.slice(INST_PREFIX.length) || null;
  try { return new URL(raw).searchParams.get(PARAM); } catch { return null; }
}

/** If a scan is an instrument label, remember it for the booking page and say so. */
export function takeInstrumentScan(text: string): boolean {
  const id = instrumentIdFrom(text);
  if (!id) return false;
  try { sessionStorage.setItem(PICK_KEY, id); } catch { /* opens without a pick */ }
  return true;
}
