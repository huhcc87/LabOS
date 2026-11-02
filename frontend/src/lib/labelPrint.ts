import bwipjs from 'bwip-js';

/** Printed on a lot label; scanning it finds that exact lot (see convex/receiving.ts). */
export const LOT_PREFIX = 'LOT:';

export interface LabelSpec {
  title: string;
  sub?: string;
  /** What the barcode holds. */
  code: string;
  /** Code 128 line barcode, or a QR code. */
  kind?: 'barcode' | 'qrcode';
}

export const LABEL_SIZES = {
  '2x1': { label: '2" × 1" (standard)', css: '2in 1in' },
  '3x2': { label: '3" × 2" (large)', css: '3in 2in' },
  '1.5x1': { label: '1.5" × 1" (small)', css: '1.5in 1in' },
} as const;
export type LabelSize = keyof typeof LABEL_SIZES;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The printable page. Text is escaped; images are data URLs we generated ourselves. */
export function labelsHtml(labels: LabelSpec[], images: string[], size: LabelSize): string {
  const css = LABEL_SIZES[size].css;
  const body = labels.map((l, i) => `
    <div class="label">
      <div class="t">${esc(l.title.slice(0, 48))}</div>
      ${l.sub ? `<div class="s">${esc(l.sub.slice(0, 60))}</div>` : ''}
      <img src="${images[i]}" alt="${esc(l.code)}">
      <div class="c">${esc(l.code)}</div>
    </div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
    @page { size: ${css}; margin: 0 }
    body { margin: 0; font-family: Arial, sans-serif }
    .label { width: ${css.split(' ')[0]}; height: ${css.split(' ')[1]}; box-sizing: border-box; padding: 0.06in 0.08in;
      page-break-after: always; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center }
    .t { font-size: 9pt; font-weight: 700; line-height: 1.1 } .s { font-size: 7pt; color: #333 }
    img { max-width: 100%; max-height: 55%; margin: 2px 0 } .c { font-size: 7pt; font-family: monospace }
  </style></head><body>${body}</body></html>`;
}

function toImage(l: LabelSpec): string {
  const canvas = document.createElement('canvas');
  if (l.kind === 'qrcode') bwipjs.toCanvas(canvas, { bcid: 'qrcode', text: l.code, scale: 4 });
  else bwipjs.toCanvas(canvas, { bcid: 'code128', text: l.code, scale: 3, height: 12, includetext: false });
  return canvas.toDataURL('image/png');
}

/** Opens the browser print dialog for these labels, one per page. Returns false if the pop-up was blocked. */
export function printLabels(labels: LabelSpec[], size: LabelSize = '2x1'): boolean {
  if (labels.length === 0) return true;
  const html = labelsHtml(labels, labels.map(toImage), size);
  const w = window.open('', '_blank', 'width=600,height=500');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
  return true;
}
