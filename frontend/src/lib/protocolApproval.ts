// Rules live in convex/protocolRules.ts so the server enforces exactly what the UI shows.
export { isApproved, canDecide, afterEdit } from '../../convex/protocolRules';
export type { ApprovalMode, ProtocolApproval } from '../../convex/protocolRules';
import type { ProtocolApproval } from '../../convex/protocolRules';

export function approvalBadge(a?: ProtocolApproval): { text: string; bg: string; color: string } | null {
  if (!a) return null;
  const who = a.mode === 'pi' ? 'PI' : (a.approver || 'user');
  if (a.state === 'approved') return { text: `✓ Approved by ${a.decidedBy || who}`, bg: 'var(--ok-bg)', color: 'var(--ok-text)' };
  if (a.state === 'rejected') return { text: `✗ Rejected by ${a.decidedBy || who}`, bg: 'var(--bad-bg)', color: 'var(--bad-text)' };
  return { text: `⏳ Awaiting ${who} approval`, bg: 'var(--warn-bg)', color: 'var(--warn-text)' };
}
