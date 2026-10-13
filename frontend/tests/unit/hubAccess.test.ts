import { describe, it, expect } from 'vitest';
import { assertHub } from '../../convex/authHelper';
import { afterEdit } from '../../convex/protocolRules';
import type { Id } from '../../convex/_generated/dataModel';

const pi = 'pi1' as Id<'users'>;

describe('server-side hub access', () => {
  it('blocks a student from hubs their PI has not allowed', () => {
    const student = { pi_id: pi, role: 'trainee' as const, allowed_hubs: ['Lab Hub'] };
    expect(() => assertHub(student, 'Lab Hub')).not.toThrow();
    expect(() => assertHub(student, 'Grant Hub')).toThrow(/Grant Hub/);
  });
  it('new students get the default hubs (Lab + Sample)', () => {
    const student = { pi_id: pi, role: 'staff' as const, allowed_hubs: undefined };
    expect(() => assertHub(student, 'Sample Hub')).not.toThrow();
    expect(() => assertHub(student, 'Resources')).toThrow();
  });
  it('users without a PI, and PIs/admins, are never restricted', () => {
    expect(() => assertHub({ pi_id: undefined, role: 'staff', allowed_hubs: [] }, 'Resources')).not.toThrow();
    expect(() => assertHub({ pi_id: pi, role: 'pi', allowed_hubs: [] }, 'Resources')).not.toThrow();
  });
});

describe('protocol approval after an edit', () => {
  const approved = { mode: 'pi' as const, state: 'approved' as const, decidedBy: 'Dr P' };
  it('a non-PI edit sends an approved protocol back to pending', () => {
    expect(afterEdit(approved, { role: 'staff' })?.state).toBe('pending');
  });
  it('the approving PI can edit without losing approval', () => {
    expect(afterEdit(approved, { role: 'pi' })?.state).toBe('approved');
  });
});
