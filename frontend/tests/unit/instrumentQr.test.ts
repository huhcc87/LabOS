import { describe, expect, it } from 'vitest';
import { instrumentIdFrom, qrValueFor } from '../../src/features/instruments/instrumentQr';

describe('instrument QR codes', () => {
  it('puts a link to the instrument in the QR, and leaves other codes as they are', () => {
    expect(qrValueFor('INST-abc123')).toBe(`${window.location.origin}/?instrument=abc123`);
    expect(qrValueFor('SMP-450617')).toBe('SMP-450617');
  });
  it('reads the instrument from a USB-scanner code or a phone link', () => {
    expect(instrumentIdFrom('INST-abc123')).toBe('abc123');
    expect(instrumentIdFrom('https://labos.example/?instrument=abc123')).toBe('abc123');
    expect(instrumentIdFrom('SMP-450617')).toBeNull();
    expect(instrumentIdFrom('https://labos.example/?label=SMP-1')).toBeNull();
  });
});
