import { describe, expect, it } from 'vitest';
import { labelsHtml } from '../../src/lib/labelPrint';

describe('labelsHtml', () => {
  it('escapes text so a hostile item name cannot inject markup', () => {
    const html = labelsHtml([{ title: '<img src=x onerror=alert(1)>', sub: 'a"b', code: 'LOT:abc' }], ['data:image/png;base64,AAAA'], '2x1');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).toContain('a&quot;b');
  });

  it('makes one label per entry at the requested size', () => {
    const html = labelsHtml([{ title: 'A', code: '1' }, { title: 'B', code: '2' }], ['d1', 'd2'], '3x2');
    expect(html.match(/class="label"/g)).toHaveLength(2);
    expect(html).toContain('size: 3in 2in');
  });
});
