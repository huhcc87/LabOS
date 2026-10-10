import type { UserRole } from './types';

export type ApprovalMode = 'user' | 'pi';

export interface ProtocolApproval {
  mode: ApprovalMode;
  /** Named approver. Required for 'user' mode; optional label for 'pi' mode. */
  approver?: string;
  state: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: string;
}

interface Approver { full_name?: string; email?: string; role?: UserRole }

/** No approval configured counts as approved. */
export const isApproved = (a?: ProtocolApproval): boolean => !a || a.state === 'approved';

/**
 * Only PI accounts approve — admins and super admins do not.
 * PI mode: any PI. User mode: the named PI only.
 */
export function canDecide(a: ProtocolApproval | undefined, user: Approver | null): boolean {
  if (!a || !user || user.role !== 'pi') return false;
  if (a.mode === 'pi') return true;
  const want = (a.approver ?? '').trim().toLowerCase();
  return !!want && [user.full_name, user.email].some(v => v?.trim().toLowerCase() === want);
}

export function approvalBadge(a?: ProtocolApproval): { text: string; bg: string; color: string } | null {
  if (!a) return null;
  const who = a.mode === 'pi' ? 'PI' : (a.approver || 'user');
  if (a.state === 'approved') return { text: `✓ Approved by ${a.decidedBy || who}`, bg: 'rgba(34,197,94,0.15)', color: '#4ade80' };
  if (a.state === 'rejected') return { text: `✗ Rejected by ${a.decidedBy || who}`, bg: 'rgba(239,68,68,0.15)', color: '#f87171' };
  return { text: `⏳ Awaiting ${who} approval`, bg: 'rgba(234,179,8,0.15)', color: '#fbbf24' };
}
