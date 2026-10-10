import { describe, it, expect } from 'vitest';
import { canDecide, isApproved, type ProtocolApproval } from '../../src/lib/protocolApproval';

const pending = (mode: 'user' | 'pi', approver?: string): ProtocolApproval => ({ mode, approver, state: 'pending' });

describe('isApproved', () => {
  it('treats no approval as approved, pending/rejected as not', () => {
    expect(isApproved(undefined)).toBe(true);
    expect(isApproved({ ...pending('pi'), state: 'approved' })).toBe(true);
    expect(isApproved(pending('pi'))).toBe(false);
    expect(isApproved({ ...pending('pi'), state: 'rejected' })).toBe(false);
  });
});

describe('canDecide', () => {
  it('only PI accounts approve — not admin or super admin', () => {
    expect(canDecide(pending('pi'), { full_name: 'A', role: 'pi' })).toBe(true);
    expect(canDecide(pending('pi'), { full_name: 'A', role: 'admin' })).toBe(false);
    expect(canDecide(pending('pi'), { full_name: 'A', role: 'superadmin' })).toBe(false);
    expect(canDecide(pending('pi'), { full_name: 'A', role: 'staff' })).toBe(false);
  });
  it('specific-PI mode: only the named PI (name or email)', () => {
    const a = pending('user', 'Jane Doe');
    expect(canDecide(a, { full_name: 'jane doe', role: 'pi' })).toBe(true);
    expect(canDecide(a, { email: 'Jane Doe', role: 'pi' })).toBe(true);
    expect(canDecide(a, { full_name: 'Bob', role: 'pi' })).toBe(false);
    expect(canDecide(a, { full_name: 'Jane Doe', role: 'staff' })).toBe(false);
  });
  it('no approval or no user: false', () => {
    expect(canDecide(undefined, { full_name: 'A', role: 'pi' })).toBe(false);
    expect(canDecide(pending('pi'), null)).toBe(false);
  });
});
