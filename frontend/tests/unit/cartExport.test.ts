import { describe, expect, it } from 'vitest';
import { cartCsv, csvCell, poHtml } from '../../src/features/cart/cartExport';

const row = { name: 'Tris', vendor: 'Sigma', catalog: 'T1503', size: '1 kg', quantity: 2, unit_price: 10.5, status: 'ordered' };

describe('cart export', () => {
  it('neutralises spreadsheet formulas and quotes commas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell(null)).toBe('');
  });

  it('writes a header and one line per request with the line total', () => {
    const lines = cartCsv([row]).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('21.00');
  });

  it('escapes item names on the purchase order', () => {
    const html = poHtml('PO-1', 'Sigma', [{ ...row, name: '<script>alert(1)</script>' }]);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('Total: $21.00');
  });
});
