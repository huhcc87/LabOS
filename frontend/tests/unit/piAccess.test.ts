import { describe, it, expect } from 'vitest';
import { hasRole } from '../../src/lib/utils';
import { hasRole as serverHasRole } from '../../convex/authHelper';
import { DEFAULT_HUBS, HUBS, isHub } from '../../convex/hubs';

describe('PI full access', () => {
  it('PI passes every role check except super admin (client and server agree)', () => {
    for (const check of [hasRole, serverHasRole]) {
      expect(check('pi', 'admin')).toBe(true);
      expect(check('pi', 'staff')).toBe(true);
      expect(check('pi', 'superadmin')).toBe(false);
    }
  });
  it('other roles are unchanged', () => {
    expect(hasRole('admin', 'pi')).toBe(true);
    expect(hasRole('staff', 'admin')).toBe(false);
    expect(hasRole('manager', 'pi')).toBe(false);
  });
});

describe('hubs', () => {
  it('defaults are a subset of hubs and isHub rejects unknown names', () => {
    expect(DEFAULT_HUBS.every(isHub)).toBe(true);
    expect(HUBS.length).toBe(5);
    expect(isHub('Admin')).toBe(false);
    expect(isHub('Home')).toBe(false);
  });
});
