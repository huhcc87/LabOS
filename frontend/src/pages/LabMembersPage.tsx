import { useState, useEffect, useCallback } from 'react';
import { labMembersApi } from '../lib/api';
import client from '../lib/api';

interface Membership {
  id: number;
  user_id: number | null;
  lab_id: number;
  lab_name: string;
  lab_role: string;
  status: 'pending' | 'approved' | 'revoked' | 'invited';
  invite_email: string;
  invited_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  revoked_at: string | null;
  user_email: string;
  user_name: string;
  notes: string;
  created_at: string;
}

interface LabUnit {
  id: number;
  name: string;
  code: string;
  pi_user_id: number | null;
}

const STATUS_META: Record<Membership['status'], { color: string; bg: string; label: string }> = {
  pending:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Pending PI approval' },
  approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',  label: 'Approved' },
  revoked:  { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  label: 'Revoked' },
  invited:  { color: '#6366f1', bg: 'rgba(99,102,241,0.15)', label: 'Invited' },
};

const ROLE_OPTIONS = [
  { value: 'member',   label: 'Member' },
  { value: 'manager',  label: 'Manager' },
  { value: 'observer', label: 'Observer' },
];

const INP: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
};

export default function LabMembersPage() {
  const [labs, setLabs] = useState<LabUnit[]>([]);
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Membership[]>([]);
  const [myMemberships, setMyMemberships] = useState<Membership[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [isPI, setIsPI] = useState(false);
  const [loading, setLoading] = useState(false);

  // Invite form
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', lab_role: 'member', notes: '' });

  const loadLabs = useCallback(async () => {
    try {
      const res = await client.get<{ items: LabUnit[] }>('/lab-units?per_page=100');
      const items = ((res.data as any).items || []) as LabUnit[];
      setLabs(items);
      if (items.length && selectedLabId == null) setSelectedLabId(items[0].id);
    } catch { /* graceful */ }
  }, [selectedLabId]);

  const loadMembers = useCallback(async (labId: number) => {
    setLoading(true);
    try {
      const [m, perms] = await Promise.all([
        labMembersApi.listForLab(labId),
        labMembersApi.canIManage(labId),
      ]);
      setMembers((m.data as any) || []);
      setCanManage(!!perms.data.can_manage);
      setIsPI(!!perms.data.is_pi);
    } catch { setMembers([]); }
    setLoading(false);
  }, []);

  const loadMyData = useCallback(async () => {
    try {
      const [pa, my] = await Promise.all([
        labMembersApi.pendingApprovals(),
        labMembersApi.listMy(),
      ]);
      setPendingApprovals((pa.data as any) || []);
      setMyMemberships((my.data as any) || []);
    } catch { /* graceful */ }
  }, []);

  useEffect(() => { loadLabs(); loadMyData(); }, [loadLabs, loadMyData]);
  useEffect(() => { if (selectedLabId) loadMembers(selectedLabId); }, [selectedLabId, loadMembers]);

  const handleInvite = async () => {
    if (!selectedLabId || !inviteForm.email) return;
    try {
      await labMembersApi.invite({
        lab_id: selectedLabId,
        email: inviteForm.email,
        lab_role: inviteForm.lab_role,
        notes: inviteForm.notes,
      });
      setShowInviteModal(false);
      setInviteForm({ email: '', lab_role: 'member', notes: '' });
      loadMembers(selectedLabId);
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Failed to invite');
    }
  };

  const handleApprove = async (id: number) => {
    await labMembersApi.approve(id);
    if (selectedLabId) loadMembers(selectedLabId);
    loadMyData();
  };

  const handleRevoke = async (id: number) => {
    const reason = prompt('Revoke reason (optional)') || '';
    if (reason === null) return;
    await labMembersApi.revoke(id, reason);
    if (selectedLabId) loadMembers(selectedLabId);
    loadMyData();
  };

  const handleRoleChange = async (id: number, role: string) => {
    await labMembersApi.updateRole(id, role);
    if (selectedLabId) loadMembers(selectedLabId);
  };

  const handleAcceptInvite = async (id: number) => {
    await labMembersApi.acceptInvite(id);
    loadMyData();
    if (selectedLabId) loadMembers(selectedLabId);
  };

  const selectedLab = labs.find(l => l.id === selectedLabId);

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>👥 Lab Members</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            PI-controlled lab access. Only the PI (or an admin) can approve new members or revoke access.
          </p>
        </div>
        {canManage && selectedLabId && (
          <button onClick={() => setShowInviteModal(true)}
            style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 700, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer' }}>
            + Invite member
          </button>
        )}
      </div>

      {/* Pending approvals banner (for PIs) */}
      {pendingApprovals.length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 16, background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.35)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>⏰</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {pendingApprovals.length} member{pendingApprovals.length > 1 ? 's' : ''} waiting on your approval
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Approve or reject join requests for the labs you manage.
              </div>
              {pendingApprovals.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{p.user_name || p.user_email}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Wants to join <strong>{p.lab_name}</strong>{p.notes && ` · "${p.notes}"`}
                    </div>
                  </div>
                  <button onClick={() => handleApprove(p.id)}
                    style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    ✓ Approve
                  </button>
                  <button onClick={() => handleRevoke(p.id)}
                    style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My invitations banner */}
      {myMemberships.filter(m => m.status === 'invited').length > 0 && (
        <div className="card" style={{ marginBottom: 20, padding: 16, background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.35)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 22 }}>📨</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>You have pending lab invitations</div>
              {myMemberships.filter(m => m.status === 'invited').map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <strong>{inv.lab_name}</strong> · invited as <em>{inv.lab_role}</em>
                  </div>
                  <button onClick={() => handleAcceptInvite(inv.id)}
                    style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                    Accept
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lab selector */}
      <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Selected lab:</label>
        <select value={selectedLabId ?? ''} onChange={e => setSelectedLabId(Number(e.target.value) || null)}
          style={{ ...INP, minWidth: 240 }}>
          <option value="">— pick a lab —</option>
          {labs.map(l => <option key={l.id} value={l.id}>{l.name}{l.code && ` (${l.code})`}</option>)}
        </select>
        {selectedLab && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {canManage ? (
              <span style={{ padding: '4px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontWeight: 700 }}>
                {isPI ? '🔑 You are the PI of this lab' : '🛡 You manage this lab (admin)'}
              </span>
            ) : (
              <span style={{ padding: '4px 12px', borderRadius: 12, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                View-only — request access via the lab's PI
              </span>
            )}
          </span>
        )}
      </div>

      {/* Members table */}
      {!selectedLabId ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Pick a lab above to see its members.
        </div>
      ) : loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : members.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No members yet for this lab. {canManage && 'Click "+ Invite member" to add one.'}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2, rgba(0,0,0,0.04))' }}>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Member</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role in lab</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Since</th>
                {canManage && <th style={{ width: 200, padding: '12px 14px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => {
                const sm = STATUS_META[m.status];
                return (
                  <tr key={m.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{m.user_name || m.user_email || '(pending user)'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.user_email}</div>
                      {m.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>"{m.notes}"</div>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {canManage && m.status === 'approved' ? (
                        <select value={m.lab_role} onChange={e => handleRoleChange(m.id, e.target.value)}
                          style={{ ...INP, padding: '4px 8px', fontSize: 12, width: 110 }}>
                          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ fontSize: 13 }}>{m.lab_role}</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>
                        {sm.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.approved_at ? new Date(m.approved_at).toLocaleDateString() : new Date(m.created_at).toLocaleDateString()}
                    </td>
                    {canManage && (
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {m.status === 'pending' && (
                            <button onClick={() => handleApprove(m.id)}
                              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                              ✓ Approve
                            </button>
                          )}
                          {(m.status === 'approved' || m.status === 'pending' || m.status === 'invited') && (
                            <button onClick={() => handleRevoke(m.id)}
                              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Info card */}
      <div style={{ marginTop: 20, padding: 14, background: 'rgba(99,102,241,0.05)', borderRadius: 10, fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)' }}>
        <strong>🔐 How lab access works:</strong><br/>
        <strong>PI</strong> (you, if listed as <code>pi_user_id</code> on the lab) can invite, approve, and revoke members.<br/>
        <strong>Admin / Superadmin</strong> can manage any lab regardless of PI status.<br/>
        <strong>Member</strong>, <strong>Manager</strong>, and <strong>Observer</strong> are per-lab roles, independent of the global User.role.<br/>
        Non-members can request to join — the PI sees the request in this dashboard.
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: 480, maxWidth: '90vw', padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Invite member to {selectedLab?.name}</h3>
              <button onClick={() => setShowInviteModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Email *</label>
            <input style={{ ...INP, width: '100%', marginBottom: 12 }} type="email" value={inviteForm.email}
              onChange={e => setInviteForm(s => ({ ...s, email: e.target.value }))} placeholder="someone@yourlab.org" />
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Role in this lab</label>
            <select style={{ ...INP, width: '100%', marginBottom: 12 }} value={inviteForm.lab_role}
              onChange={e => setInviteForm(s => ({ ...s, lab_role: e.target.value }))}>
              {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Notes (optional)</label>
            <input style={{ ...INP, width: '100%', marginBottom: 16 }} value={inviteForm.notes}
              onChange={e => setInviteForm(s => ({ ...s, notes: e.target.value }))} placeholder="e.g. Joining for Aim 2 sequencing work" />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInviteModal(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleInvite} disabled={!inviteForm.email}
                style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                Send invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
