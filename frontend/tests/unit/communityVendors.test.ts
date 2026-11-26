import { describe, it, expect } from 'vitest';
import { hostOf } from '../../convex/communityVendors';

describe('hostOf', () => {
  it('returns the site without www, lower case', () => {
    expect(hostOf('https://www.CaymanChem.com/product/70010')).toBe('caymanchem.com');
    expect(hostOf('http://shop.example.org/a?b=1')).toBe('shop.example.org');
  });
  it('rejects anything that is not a normal public web address', () => {
    expect(hostOf(undefined)).toBeNull();
    expect(hostOf('')).toBeNull();
    expect(hostOf('not a url')).toBeNull();
    expect(hostOf('javascript:alert(1)')).toBeNull();
    expect(hostOf('ftp://example.com/x')).toBeNull();
    expect(hostOf('http://localhost:5173/x')).toBeNull();
    expect(hostOf('http://192.168.1.5/x')).toBeNull();
    expect(hostOf('https://printer.local/x')).toBeNull();
  });
});
