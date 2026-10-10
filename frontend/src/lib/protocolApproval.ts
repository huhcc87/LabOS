// Rules live in convex/protocolRules.ts so the server enforces exactly what the UI shows.
export { isApproved, canDecide, afterEdit } from '../../convex/protocolRules';
export type { ApprovalMode, ProtocolApproval } from '../../convex/protocolRules';
import type { ProtocolApproval } from '../../convex/protocolRules';

export function approvalBadge(a?: ProtocolApproval): { text: string; bg: string; color: string } | null {
  if (!a) return null;
  const who = a.mode === 'pi' ? 'PI' : (a.approver || 'user');
  if (a.state === 'approved') return { text: `✓ Approved by ${a.decidedBy || who}`, bg: 'rgba(34,197,94,0.15)', color: '#4ade80' };
  if (a.state === 'rejected') return { text: `✗ Rejected by ${a.decidedBy || who}`, bg: 'rgba(239,68,68,0.15)', color: '#f87171' };
  return { text: `⏳ Awaiting ${who} approval`, bg: 'rgba(234,179,8,0.15)', color: '#fbbf24' };
}
