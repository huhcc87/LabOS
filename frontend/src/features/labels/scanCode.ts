/** What a printed label's QR code contains, and how to read a scan back. */
const MAX_CODE = 300;

/** QR content: opens LabOS straight at "store this sample" when scanned with a phone camera. */
export const scanUrl = (code: string): string => `${window.location.origin}/?label=${encodeURIComponent(code)}`;

/**
 * Turn a scan into a code. LabOS label links give their code; anything else
 * (supplier tubes, other systems' QR codes, plain barcodes) is used exactly as scanned.
 */
export function parseScan(text: string): string | null {
  const raw = text.trim();
  if (!raw || raw.length > MAX_CODE) return null;
  try {
    const fromUrl = new URL(raw).searchParams.get('label');
    if (fromUrl) return fromUrl.trim().slice(0, MAX_CODE) || null;
  } catch { /* not a URL */ }
  return raw;
}
