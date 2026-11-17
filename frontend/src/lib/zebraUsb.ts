/**
 * Print straight to a Zebra label printer (GX430t, GX420t, ZD420/620, ZT230...) over USB, with no print dialog.
 * The browser talks to the printer with WebUSB (Chrome / Edge, on https or localhost) and sends ZPL, Zebra's own language.
 * ponytail: Windows/macOS may claim the USB interface with the Zebra driver; if "claim" fails, unplug-replug or remove the
 * driver for this printer, or use the normal print dialog.
 */
export const ZEBRA_VENDOR_ID = 0x0a5f;
export type Dpi = 203 | 300;

export interface ZplLabel {
  code: string;                              // what the QR / barcode holds (the label's ID)
  lines: string[];                           // text lines, already "Label: value"
}
export interface ZplOptions {
  widthMm: number; heightMm: number; dpi: Dpi;
  qr: boolean; barcode: boolean; brand?: string;
}

const dots = (mm: number, dpi: Dpi) => Math.round((mm / 25.4) * dpi);
/** ZPL treats ^ and ~ as commands, so they can't appear in text. */
const clean = (s: string) => s.replace(/[\^~\\\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/** One ^XA...^XZ label per entry: QR on the left, text lines beside it, optional Code 128 along the bottom. */
export function labelsToZpl(labels: ZplLabel[], o: ZplOptions): string {
  const W = dots(o.widthMm, o.dpi), H = dots(o.heightMm, o.dpi), pad = Math.round(o.dpi / 25);
  const barH = o.barcode ? Math.round(H * 0.28) : 0;
  const bodyH = H - 2 * pad - barH;
  // QR: about 29 modules for a short code; scale it to fit the body height.
  const mag = Math.max(2, Math.min(10, Math.floor(bodyH / 29)));
  const qrSide = o.qr ? 29 * mag : 0;
  const textX = pad + (o.qr ? qrSide + pad : 0);
  const textW = Math.max(40, W - textX - pad);
  const lineH = Math.max(Math.round(o.dpi / 11), 18);          // ~2.3 mm minimum so it stays readable
  const maxLines = Math.max(1, Math.floor(bodyH / (lineH + 2)));

  return labels.map((l) => {
    const text = [...(o.brand ? [o.brand] : []), ...l.lines].map(clean).filter(Boolean).slice(0, maxLines);
    return [
      '^XA', '^CI28', `^PW${W}`, `^LL${H}`, '^LH0,0',
      ...(o.qr ? [`^FO${pad},${pad}^BQN,2,${mag}^FDQA,${clean(l.code)}^FS`] : []),
      ...text.map((t, i) => `^FO${textX},${pad + i * (lineH + 2)}^A0N,${lineH},${lineH}^FB${textW},1,0,L,0^FD${t}^FS`),
      ...(o.barcode ? [`^BY2,3,${barH}`, `^FO${pad},${H - pad - barH}^BCN,${barH},N,N,N^FD${clean(l.code)}^FS`] : []),
      '^PQ1', '^XZ',
    ].join('\n');
  }).join('\n');
}

// WebUSB is not in TypeScript's DOM types.
type Usb = { getDevices(): Promise<any[]>; requestDevice(o: unknown): Promise<any> };
const usbApi = (): Usb | undefined => (navigator as unknown as { usb?: Usb }).usb;
export const usbSupported = () => !!usbApi();

/** A Zebra printer the browser already has permission for (null if none). */
export async function findZebra(): Promise<any | null> {
  const usb = usbApi();
  if (!usb) return null;
  return (await usb.getDevices()).find((d) => d.vendorId === ZEBRA_VENDOR_ID) ?? null;
}

/** Shows the browser's "pick a USB device" prompt, limited to Zebra printers. Must run from a click. */
export async function requestZebra(): Promise<any> {
  const usb = usbApi();
  if (!usb) throw new Error('USB printing needs Chrome or Edge.');
  return usb.requestDevice({ filters: [{ vendorId: ZEBRA_VENDOR_ID }] });
}

/** Sends ZPL to the printer's bulk-out endpoint. */
export async function sendZpl(device: any, zpl: string): Promise<void> {
  if (!device.opened) await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);
  const iface = device.configuration.interfaces.find((i: any) => i.alternates.some((a: any) => a.interfaceClass === 7))
    ?? device.configuration.interfaces[0];
  const alt = iface.alternates.find((a: any) => a.interfaceClass === 7) ?? iface.alternates[0];
  const out = alt.endpoints.find((e: any) => e.direction === 'out' && e.type === 'bulk');
  if (!out) throw new Error('This printer has no USB output channel.');
  try { await device.claimInterface(iface.interfaceNumber); }
  catch { throw new Error('Another program or driver is using the printer. Close it (or unplug and replug the USB cable) and try again.'); }
  try {
    const bytes = new TextEncoder().encode(zpl);
    for (let i = 0; i < bytes.length; i += 16384) await device.transferOut(out.endpointNumber, bytes.slice(i, i + 16384));
  } finally {
    await device.releaseInterface(iface.interfaceNumber).catch(() => undefined);
  }
}
