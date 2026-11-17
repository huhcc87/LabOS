import { describe, expect, it } from 'vitest';
import { labelsToZpl } from '../../src/lib/zebraUsb';

const base = { widthMm: 50, heightMm: 25, dpi: 300 as const, qr: true, barcode: false };

describe('labelsToZpl', () => {
  it('makes one label per entry sized in dots', () => {
    const zpl = labelsToZpl([{ code: 'A1', lines: ['Name: X'] }, { code: 'A2', lines: ['Name: Y'] }], base);
    expect(zpl.match(/\^XA/g)).toHaveLength(2);
    expect(zpl).toContain('^PW591');          // 50 mm at 300 dpi
    expect(zpl).toContain('^LL295');          // 25 mm
    expect(zpl).toContain('^BQN');            // QR
    expect(zpl).toContain('^FDQA,A1^FS');
  });
  it('strips ZPL command characters from text', () => {
    const zpl = labelsToZpl([{ code: 'A1', lines: ['Bad ^FO~DG text'] }], base);
    expect(zpl).toContain('^FDBad FO DG text^FS');
  });
  it('adds a Code 128 barcode only when asked, and drops lines that cannot fit', () => {
    const lines = Array.from({ length: 30 }, (_, i) => `Line ${i}`);
    const z = labelsToZpl([{ code: 'A1', lines }], { ...base, heightMm: 13, widthMm: 19, barcode: true });
    expect(z).toContain('^BCN');
    expect(z.match(/\^A0N/g)!.length).toBeLessThan(30);
    expect(labelsToZpl([{ code: 'A1', lines: ['x'] }], base)).not.toContain('^BCN');
  });
});
