import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('lab_token');
  if (token) cfg.headers!['Authorization'] = `Bearer ${token}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsentRecord {
  id: number;
  purpose: string;
  label: string;
  description: string;
  required: boolean;
  status: 'granted' | 'revoked' | 'pending';
  granted_at: string | null;
  revoked_at: string | null;
  version: string;
}

interface ErasureRequest {
  id: number;
  status: string;
  reason: string;
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
}

interface PolicyInfo {
  version: string;
  effective_date: string;
  summary: string;
  content: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  granted: '#22c55e',
  revoked:  '#ef4444',
  pending:  '#f59e0b',
  completed:'#22c55e',
  rejected: '#ef4444',
  in_review:'#6366f1',
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

// ─── Password Strength ────────────────────────────────────────────────────────

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    { label: '8+ chars', ok: password.length >= 8 },
    { label: 'Uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase', ok: /[a-z]/.test(password) },
    { label: 'Number',    ok: /\d/.test(password) },
    { label: 'Special',   ok: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'];
  const labels = ['','Weak','Fair','Good','Strong','Very Strong'];
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? colors[score - 1] : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {checks.map(c => (
            <span key={c.label} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: c.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.1)',
              color: c.ok ? '#4ade80' : '#f87171',
            }}>{c.ok ? '✓' : '✗'} {c.label}</span>
          ))}
        </div>
        <span style={{ fontSize: 11, color: score > 0 ? colors[score - 1] : 'var(--text-muted)', fontWeight: 600 }}>
          {labels[score]}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PrivacyCenterPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'consent'|'rights'|'password'|'policy'|'admin'>('consent');
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [policy, setPolicy] = useState<PolicyInfo | null>(null);
  const [erasureRequests, setErasureRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Password change state
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Erasure form
  const [erasureReason, setErasureReason] = useState('');
  const [erasureLoading, setErasureLoading] = useState(false);

  // Export loading
  const [exportLoading, setExportLoading] = useState(false);

  // Policy display
  const [showFullPolicy, setShowFullPolicy] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const loadConsents = useCallback(async () => {
    try {
      const res = await api.get('/consent/my');
      setConsents(res.data.consents);
    } catch { /* ignore */ }
  }, []);

  const loadPolicy = useCallback(async () => {
    try {
      const res = await api.get('/consent/policy');
      setPolicy(res.data);
    } catch { /* ignore */ }
  }, []);

  const loadErasureRequests = useCallback(async () => {
    try {
      const res = await api.get('/gdpr/erasure-request/my');
      setErasureRequests(res.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadConsents();
    loadPolicy();
    loadErasureRequests();
  }, [loadConsents, loadPolicy, loadErasureRequests]);

  // ── Consent toggle ─────────────────────────────────────────────────────────
  const toggleConsent = async (record: ConsentRecord) => {
    if (record.required) {
      toast.error(`"${record.label}" is required for system operation and cannot be revoked.`);
      return;
    }
    const willGrant = record.status !== 'granted';
    setLoading(true);
    try {
      await api.put('/consent/my', { purpose: record.purpose, granted: willGrant });
      toast.success(willGrant ? 'Consent granted' : 'Consent revoked');
      loadConsents();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to update consent');
    } finally {
      setLoading(false);
    }
  };

  // ── Password change ────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (pwNew !== pwConfirm) { toast.error('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', { current_password: pwCurrent, new_password: pwNew });
      toast.success('Password changed successfully');
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Data export ────────────────────────────────────────────────────────────
  const exportData = async () => {
    setExportLoading(true);
    try {
      const res = await api.post('/gdpr/export');
      const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labos-my-data-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your data has been exported');
    } catch {
      toast.error('Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  // ── Erasure request ────────────────────────────────────────────────────────
  const submitErasure = async () => {
    setErasureLoading(true);
    try {
      await api.post('/gdpr/erasure-request', { reason: erasureReason });
      toast.success('Erasure request submitted — admin will review within 30 days');
      setErasureReason('');
      loadErasureRequests();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed to submit request');
    } finally {
      setErasureLoading(false);
    }
  };

  const hasPendingErasure = erasureRequests.some(r => ['pending','in_review'].includes(r.status));

  // ── Render ─────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',  label: '🏠 Overview',         show: true },
    { id: 'security',  label: '🔐 Security',          show: true },
    { id: 'onpremise', label: '🖥️ On-Premise & Data', show: true },
    { id: 'standards', label: '📜 Standards',         show: true },
    { id: 'consent',   label: '🔒 Consent',           show: true },
    { id: 'rights',    label: '📋 My Rights',          show: true },
    { id: 'password',  label: '🔑 Password',           show: true },
    { id: 'policy',    label: '📄 Policy',             show: true },
    { id: 'admin',     label: '⚙️ Admin',              show: isAdmin },
  ].filter(t => t.show);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #1a2940 100%)',
        borderRadius: 16, padding: '28px 32px', marginBottom: 24,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(99,102,241,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, flexShrink: 0,
        }}>🛡️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Privacy & Security Center</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Your data stays on your servers. Always. Zero vendor access, zero telemetry.
          </p>
          {policy && (
            <span style={{
              display: 'inline-block', marginTop: 8, fontSize: 11, fontWeight: 600,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8',
              padding: '3px 10px', borderRadius: 6,
            }}>
              Policy v{policy.version} · Effective {fmtDate(policy.effective_date)}
            </span>
          )}
        </div>
      </div>

      {/* Honest standards badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {[
          { label: 'GLP Workflows', color: '#22c55e' },
          { label: '21 CFR Part 11 Ready', color: '#6366f1' },
          { label: 'HIPAA-Ready', color: '#06b6d4' },
          { label: 'GDPR Tools Built-in', color: '#f59e0b' },
          { label: 'Zero Telemetry', color: '#ec4899' },
          { label: 'On-Premise Only', color: '#8b5cf6' },
        ].map(b => (
          <span key={b.label} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: `${b.color}18`, color: b.color,
            border: `1px solid ${b.color}33`,
          }}>✓ {b.label}</span>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
        These badges indicate features and workflow support, not vendor certifications. Regulatory compliance is achieved through your institution's practices.
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'var(--accent)' : 'var(--surface2)',
            color: tab === t.id ? '#fff' : 'var(--text-muted)',
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13,
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB: Overview ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Core promise */}
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 14, padding: '20px 24px' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', marginBottom: 10 }}>Your Data. Your Servers. Always.</div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              LabOS is installed entirely on your institution's own hardware. The vendor has <strong style={{ color: 'var(--text)' }}>zero access</strong> to any data you enter.
              No data is transmitted to vendor servers. No telemetry. No analytics. No cloud sync.
              If you disconnect LabOS from the internet entirely, it works exactly the same.
            </p>
          </div>

          {/* 6 key facts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            {[
              { icon: '🖥️', title: 'Fully On-Premise', body: 'Installed on your servers. All data stored locally in your database and filesystem.', color: '#6366f1' },
              { icon: '📵', title: 'Zero Telemetry', body: 'No usage analytics, crash reports, or any data is ever sent to the vendor.', color: '#22c55e' },
              { icon: '🔐', title: 'bcrypt Passwords', body: 'Passwords hashed with bcrypt cost-12. Never stored in plaintext. Industry best practice.', color: '#06b6d4' },
              { icon: '🔒', title: 'TLS Encryption', body: 'All network traffic encrypted with HTTPS/TLS 1.2+. HTTP connections rejected.', color: '#f59e0b' },
              { icon: '📋', title: 'Full Audit Trail', body: 'Every action logged: who did what, when, from where. Tamper-evident, append-only.', color: '#ec4899' },
              { icon: '👥', title: 'Role-Based Access', body: '6 roles from Trainee to Superadmin. Least-privilege principle enforced throughout.', color: '#8b5cf6' },
            ].map(c => (
              <div key={c.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 14 }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>{c.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: c.color, marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Quick Navigation</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {[
                { tab: 'security', label: '🔐 Security Levels & Controls' },
                { tab: 'onpremise', label: '🖥️ What Data Is Stored & Where' },
                { tab: 'standards', label: '📜 Regulatory Standards Supported' },
                { tab: 'consent', label: '🔒 Manage My Consent' },
                { tab: 'rights', label: '📋 Exercise My Privacy Rights' },
                { tab: 'password', label: '🔑 Change My Password' },
              ].map(l => (
                <button key={l.tab} onClick={() => setTab(l.tab as any)} style={{
                  padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--surface2)', color: 'var(--text)', fontSize: 12,
                  fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                }}>{l.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Security ──────────────────────────────────────────────────── */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Security Architecture & Controls</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>How LabOS protects your data at every layer.</p>
          </div>

          {/* Security levels */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>Security Layers</div>
            {[
              { level: 'L1 — Network', icon: '🌐', color: '#6366f1', controls: ['HTTPS/TLS 1.2+ enforced on all connections', 'HTTP → HTTPS redirect', 'WSS (encrypted WebSockets) for IoT sensors', 'Recommended: deploy behind VPN for remote access'] },
              { level: 'L2 — Authentication', icon: '🔑', color: '#06b6d4', controls: ['bcrypt password hashing (cost factor 12)', '5-attempt lockout with 15-min cooldown', 'JWT session tokens with 2-hour inactivity expiry', 'All auth events logged to audit trail'] },
              { level: 'L3 — Authorisation', icon: '👥', color: '#22c55e', controls: ['Role-Based Access Control (RBAC) — 6 roles', 'Least-privilege: users see only what their role permits', 'Admin-only endpoints protected server-side', 'All permission checks enforced on the backend API'] },
              { level: 'L4 — Application', icon: '🛡️', color: '#f59e0b', controls: ['ORM-based queries prevent SQL injection', 'React DOM rendering prevents XSS', 'All API inputs validated server-side (Pydantic)', 'CSRF not applicable — JWT tokens, not cookies'] },
              { level: 'L5 — Data', icon: '💾', color: '#ec4899', controls: ['No plaintext passwords — bcrypt only', 'Audit trail is append-only in database', 'File uploads stored outside web root', 'At-rest encryption: your OS responsibility (LUKS/BitLocker)'] },
            ].map(layer => (
              <div key={layer.level} style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{layer.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: layer.color }}>{layer.level}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6 }}>
                  {layer.controls.map(c => (
                    <div key={c} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', alignItems: 'flex-start' }}>
                      <span style={{ color: layer.color, flexShrink: 0, marginTop: 1 }}>✓</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Password policy */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🔑 Password Policy</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {[
                { label: 'Minimum length', value: '8 characters' },
                { label: 'Requires uppercase', value: 'Yes (A–Z)' },
                { label: 'Requires lowercase', value: 'Yes (a–z)' },
                { label: 'Requires number', value: 'Yes (0–9)' },
                { label: 'Requires special char', value: 'Yes (!@#$…)' },
                { label: 'Hash algorithm', value: 'bcrypt cost-12' },
                { label: 'Failed attempts lockout', value: '5 attempts' },
                { label: 'Lockout duration', value: '15 minutes' },
                { label: 'Session timeout', value: '2 hours idle' },
                { label: 'Recommended rotation', value: 'Every 90 days' },
              ].map(r => (
                <div key={r.label} style={{ padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit trail */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📋 Audit Trail — What Is Logged</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {[
                'User login / logout', 'Failed login attempts', 'Password changes',
                'Data record creation', 'Data record modification', 'Data record deletion',
                'Protocol approvals', 'Electronic signatures', 'User permission changes',
                'Data export requests', 'Erasure requests', 'File uploads / downloads',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', alignItems: 'center' }}>
                  <span style={{ color: '#22c55e' }}>●</span> {item}
                </div>
              ))}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Each audit entry captures: <strong>timestamp · user ID · email · IP address · action type · record affected · before/after values</strong>
            </p>
          </div>

          {/* Vulnerability disclosure */}
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🐛 Vulnerability Disclosure</div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Found a security issue? Email <strong>security@labos.app</strong> — we respond within 48 business hours.
              Critical patches are released within 14 days of a verified report.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🕐 Response: 48 business hours</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔧 Critical patch: within 14 days</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📧 security@labos.app</span>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: On-Premise & Data ──────────────────────────────────────────── */}
      {tab === 'onpremise' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>On-Premise Architecture & Data Storage</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>Exactly where your data lives and who controls it.</p>
          </div>

          {/* Architecture diagram */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>🏗️ Data Flow Architecture</div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '20px', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-muted)', lineHeight: 2 }}>
              <div>┌──────────────────── YOUR INSTITUTION'S NETWORK ──────────────────┐</div>
              <div>│                                                                   │</div>
              <div>│  Browser ──HTTPS──▶ LabOS Server ──▶ Database (your server)      │</div>
              <div>│                          │                                        │</div>
              <div>│                          └──▶ File Storage (your filesystem)      │</div>
              <div>│                                                                   │</div>
              <div>│  ✗ No data ever crosses this boundary to the vendor               │</div>
              <div>└───────────────────────────────────────────────────────────────────┘</div>
              <div style={{ marginTop: 8, color: '#ef4444' }}>  Vendor: ZERO access to your data at any time</div>
            </div>
          </div>

          {/* What is stored */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>📦 What LabOS Stores (On Your Servers)</div>
            {[
              { category: 'User Accounts', icon: '👤', color: '#6366f1', items: ['Name and email address', 'bcrypt password hash (not the password)', 'Role and department', 'Login timestamps', 'Session tokens (server memory only)'] },
              { category: 'Laboratory Records', icon: '🧪', color: '#22c55e', items: ['Samples, reagents, plasmids, equipment', 'Experiments and results', 'Protocols and SOPs', 'Safety incidents and reports', 'Inventory and freezer records'] },
              { category: 'System Records', icon: '📋', color: '#f59e0b', items: ['Full audit trail of all user actions', 'Electronic signature records', 'Consent records', 'Training certifications'] },
              { category: 'Files & Attachments', icon: '📁', color: '#06b6d4', items: ['Uploaded SOPs and protocol documents', 'Experiment attachments and images', 'Stored in /backend/uploads/ on your filesystem'] },
            ].map(cat => (
              <div key={cat.category} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span>{cat.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: cat.color }}>{cat.category}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cat.items.map(item => (
                    <span key={item} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: `${cat.color}12`, color: 'var(--text-muted)', border: `1px solid ${cat.color}22` }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* What is NOT collected */}
          <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f87171', marginBottom: 12 }}>🚫 What LabOS NEVER Collects or Transmits</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {[
                'Usage analytics or page views', 'Feature adoption statistics', 'Error or crash reports',
                'Performance metrics', 'User behaviour tracking', 'IP addresses (to vendor)',
                'Search queries', 'Export contents', 'Any telemetry of any kind',
              ].map(item => (
                <div key={item} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)', alignItems: 'center' }}>
                  <span style={{ color: '#f87171', flexShrink: 0 }}>✗</span> {item}
                </div>
              ))}
            </div>
          </div>

          {/* No DPA required */}
          <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#22c55e', marginBottom: 8 }}>✅ No Data Processing Agreement Required</div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              Under GDPR, a Data Processing Agreement (DPA) is required when a vendor processes personal data on your behalf.
              Because LabOS is on-premise and the vendor <strong style={{ color: 'var(--text)' }}>never accesses, stores, or processes your data</strong>,
              the vendor is not a Data Processor. No DPA or BAA is required with the LabOS vendor.
              Your institution is the sole Data Controller.
            </p>
          </div>

          {/* Institution responsibilities */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>🏛️ Your Institution's Responsibilities</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { item: 'Server security', detail: 'Patch OS, apply security updates, configure firewall' },
                { item: 'Database backups', detail: 'Daily automated backups, tested restore procedures' },
                { item: 'At-rest encryption', detail: 'Enable LUKS (Linux) or BitLocker (Windows) on the server' },
                { item: 'Access control', detail: 'Manage who gets accounts; review user access quarterly' },
                { item: 'Network security', detail: 'Deploy behind VPN for remote access; restrict port exposure' },
                { item: 'Incident response', detail: 'Maintain your own breach notification and incident response plan' },
                { item: 'Regulatory compliance', detail: 'HIPAA, FERPA, GDPR compliance as Data Controller is your responsibility' },
              ].map(r => (
                <div key={r.item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: '#f59e0b', fontSize: 14, flexShrink: 0, marginTop: 1 }}>▶</span>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{r.item}: </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Standards ─────────────────────────────────────────────────── */}
      {tab === 'standards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Regulatory Standards Supported</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              LabOS provides features designed to support these workflows. Compliance is achieved through your institution's practices and policies — not vendor certification.
            </p>
          </div>

          {/* Important disclaimer */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#fbbf24', marginBottom: 6 }}>⚠️ Important Distinction</div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              The terms "GLP-compliant software" or "HIPAA-certified" would mean the vendor has been audited and certified. <strong style={{ color: 'var(--text)' }}>LabOS does not hold these certifications.</strong>
              Instead, LabOS is <strong style={{ color: 'var(--text)' }}>designed to support</strong> these workflows — the features you need are present.
              Your institution's validation, practices, and policies determine actual compliance.
            </p>
          </div>

          {[
            {
              standard: 'GLP — Good Laboratory Practice',
              icon: '🔬', color: '#22c55e',
              what: 'Framework for non-clinical lab studies submitted to regulatory agencies (FDA, EPA). Ensures data integrity and traceability.',
              supported: ['Sample and specimen traceability with full chain of custody', 'Instrument calibration and maintenance tracking', 'Reagent lot tracking with expiry management', 'Electronic audit trail for all data changes', 'Protocol version control and approval workflows', 'Personnel training records'],
              yourJob: 'GLP is a practice standard — your lab must follow GLP procedures. LabOS provides the tools; your SOPs and practices achieve compliance.',
            },
            {
              standard: '21 CFR Part 11 — Electronic Records & Signatures',
              icon: '📝', color: '#6366f1',
              what: 'FDA regulation requiring electronic records and signatures to be trustworthy, reliable, and equivalent to paper records.',
              supported: ['Electronic signature capture with identity verification', 'Audit trail for all electronic records (required under 11.10(e))', 'Access controls limiting record access (required under 11.10(d))', 'Record integrity — changes logged with reason', 'Unique user IDs for all signatories', 'System documentation available for validation'],
              yourJob: 'You must complete IQ/OQ/PQ validation for your specific deployment. LabOS provides validation support documentation on request.',
            },
            {
              standard: 'HIPAA — Health Insurance Portability and Accountability Act',
              icon: '🏥', color: '#06b6d4',
              what: 'US law protecting patient health information (PHI). Applies if your lab handles clinical or patient-linked data.',
              supported: ['Role-based access control limits PHI exposure', 'Audit logs for all PHI access (required under HIPAA Security Rule)', 'Encrypted transmission via HTTPS/TLS', 'Session timeout after inactivity', 'Unique user identification and authentication', 'Emergency access procedures via admin account'],
              yourJob: 'Your institution is the HIPAA Covered Entity. No BAA required with LabOS vendor (we never access your data). You must implement technical and administrative safeguards at the infrastructure level.',
            },
            {
              standard: 'GDPR — General Data Protection Regulation',
              icon: '🇪🇺', color: '#ec4899',
              what: 'EU regulation for personal data protection. Applies to personal data of EU residents regardless of where you are based.',
              supported: ['Consent management with granular purpose control', 'Right to erasure request workflow', 'Data portability — self-service JSON export', 'Data minimisation — only necessary data collected', 'Audit trail supports accountability principle', 'Privacy policy versioning and user acknowledgement'],
              yourJob: 'Your institution is the Data Controller. No DPA required with vendor (we never process your data). You are responsible for establishing legal basis for processing and responding to data subject requests.',
            },
          ].map(s => (
            <div key={s.standard} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.color }}>{s.standard}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{s.what}</div>
                </div>
              </div>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Features LabOS Provides</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6 }}>
                  {s.supported.map(f => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span style={{ color: s.color, flexShrink: 0 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: '12px 20px', background: `${s.color}08` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Responsibility</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.yourJob}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Consent ───────────────────────────────────────────────────── */}
      {tab === 'consent' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Consent Preferences</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
              Control how your data is used. Required purposes cannot be revoked as they are
              necessary for system operation.
            </p>
          </div>
          {consents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {consents.map(c => (
                <div key={c.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  opacity: loading ? 0.7 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</span>
                      {c.required && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                          background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                        }}>REQUIRED</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: `${STATUS_COLORS[c.status]}20`,
                        color: STATUS_COLORS[c.status],
                      }}>{c.status.toUpperCase()}</span>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {c.description}
                    </p>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {c.granted_at && <span>Granted: {fmtDate(c.granted_at)} · </span>}
                      {c.revoked_at && <span>Revoked: {fmtDate(c.revoked_at)} · </span>}
                      <span>Policy v{c.version}</span>
                    </div>
                  </div>
                  <button
                    disabled={c.required || loading}
                    onClick={() => toggleConsent(c)}
                    style={{
                      padding: '8px 18px', borderRadius: 8, border: 'none', cursor: c.required ? 'not-allowed' : 'pointer',
                      background: c.status === 'granted'
                        ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                      color: c.status === 'granted' ? '#f87171' : '#4ade80',
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                      opacity: c.required ? 0.5 : 1,
                    }}
                  >
                    {c.status === 'granted' ? 'Revoke' : 'Grant'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Rights ────────────────────────────────────────────────────── */}
      {tab === 'rights' && (
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Your Privacy Rights</h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            Under GDPR, CCPA, and HIPAA you have the following rights regarding your personal data.
          </p>

          {/* Data Export */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>📦 Right to Data Portability (Art. 20)</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                  Download a complete copy of all personal data stored about you in machine-readable JSON format.
                </p>
              </div>
              <button
                onClick={exportData}
                disabled={exportLoading}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 13,
                  opacity: exportLoading ? 0.7 : 1, flexShrink: 0,
                }}
              >
                {exportLoading ? 'Exporting…' : '⬇ Export My Data'}
              </button>
            </div>
          </div>

          {/* Erasure Request */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>🗑 Right to Erasure (Art. 17)</h3>
            <p style={{ margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 13 }}>
              Request deletion of your personal data. Note: data required for legal, regulatory, or
              research integrity purposes may be retained in anonymised form per our retention policy.
            </p>

            {erasureRequests.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>Previous Requests</div>
                {erasureRequests.map(r => (
                  <div key={r.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6,
                  }}>
                    <div>
                      <span style={{ fontSize: 13, color: STATUS_COLORS[r.status] || 'var(--text)', fontWeight: 600 }}>
                        {r.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        Submitted {fmtDate(r.requested_at)}
                      </span>
                    </div>
                    {r.rejection_reason && (
                      <span style={{ fontSize: 11, color: '#f87171' }}>Reason: {r.rejection_reason}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!hasPendingErasure ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input
                  value={erasureReason}
                  onChange={e => setErasureReason(e.target.value)}
                  placeholder="Reason for erasure request (optional)"
                  style={{
                    flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface2)',
                    color: 'var(--text)', fontSize: 13,
                  }}
                />
                <button
                  onClick={submitErasure}
                  disabled={erasureLoading}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: '1px solid #ef4444',
                    background: 'rgba(239,68,68,0.1)', color: '#f87171',
                    fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    opacity: erasureLoading ? 0.7 : 1,
                  }}
                >
                  {erasureLoading ? 'Submitting…' : '⚠ Request Erasure'}
                </button>
              </div>
            ) : (
              <div style={{
                padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', fontSize: 13,
              }}>
                An erasure request is pending review. You will be notified when it is processed.
              </div>
            )}
          </div>

          {/* Other rights info cards */}
          {[
            { icon: '👁', title: 'Right of Access (Art. 15)', text: 'You can export all your data using the "Export My Data" button above.' },
            { icon: '✏️', title: 'Right to Rectification (Art. 16)', text: 'Contact your system administrator to correct inaccurate personal data.' },
            { icon: '⛔', title: 'Right to Restrict Processing (Art. 18)', text: 'Contact your Data Protection Officer to request restriction of processing.' },
            { icon: '🚫', title: 'Right to Object (Art. 21)', text: 'Revoke optional consents in the Consent tab. For legitimate interest processing, contact your DPO.' },
            { icon: '🏥', title: 'HIPAA Privacy Rights', text: 'For PHI requests, contact your institutional HIPAA Privacy Officer. PHI access logs are available in the Audit Trail.' },
          ].map(item => (
            <div key={item.title} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px', marginBottom: 10,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.text}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TAB: Password ──────────────────────────────────────────────────── */}
      {tab === 'password' && (
        <div style={{ maxWidth: 480 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Change Password</h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            Use a strong, unique password. Requirements: 8+ chars, uppercase, lowercase, number, special character.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Current Password
              </label>
              <input
                type="password"
                value={pwCurrent}
                onChange={e => setPwCurrent(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                New Password
              </label>
              <input
                type="password"
                value={pwNew}
                onChange={e => setPwNew(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface2)',
                  color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                }}
              />
              <PasswordStrengthBar password={pwNew} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Confirm New Password
              </label>
              <input
                type="password"
                value={pwConfirm}
                onChange={e => setPwConfirm(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${pwConfirm && pwNew !== pwConfirm ? '#ef4444' : 'var(--border)'}`,
                  background: 'var(--surface2)', color: 'var(--text)',
                  fontSize: 14, boxSizing: 'border-box',
                }}
              />
              {pwConfirm && pwNew !== pwConfirm && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>
            <button
              onClick={changePassword}
              disabled={pwLoading || !pwCurrent || !pwNew || pwNew !== pwConfirm}
              style={{
                padding: '11px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14,
                opacity: (pwLoading || !pwCurrent || !pwNew || pwNew !== pwConfirm) ? 0.5 : 1,
              }}
            >
              {pwLoading ? 'Changing…' : 'Change Password'}
            </button>
          </div>

          <div style={{
            marginTop: 24, padding: 16, borderRadius: 10,
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>🔒 Account Security Info</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
              • Sessions expire after 2 hours of inactivity<br />
              • Account locks after 5 failed login attempts (15-minute lockout)<br />
              • All password changes are logged in the audit trail<br />
              • We recommend changing your password every 90 days
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Policy ────────────────────────────────────────────────────── */}
      {tab === 'policy' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Privacy Policy</h2>
              {policy && (
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>
                  Version {policy.version} · Effective {fmtDate(policy.effective_date)}
                </p>
              )}
            </div>
          </div>
          {policy && (
            <>
              <div style={{
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 10, padding: '14px 18px', marginBottom: 16,
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Summary</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{policy.summary}</div>
              </div>
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{
                  maxHeight: showFullPolicy ? 'none' : 320,
                  overflow: 'hidden', padding: 24,
                  maskImage: showFullPolicy ? 'none' : 'linear-gradient(to bottom, black 60%, transparent 100%)',
                  WebkitMaskImage: showFullPolicy ? 'none' : 'linear-gradient(to bottom, black 60%, transparent 100%)',
                }}>
                  <pre style={{
                    margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    fontSize: 13, lineHeight: 1.7, color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}>{policy.content}</pre>
                </div>
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                  <button onClick={() => setShowFullPolicy(v => !v)} style={{
                    background: 'none', border: 'none', color: 'var(--accent)',
                    cursor: 'pointer', fontWeight: 600, fontSize: 13,
                  }}>
                    {showFullPolicy ? '▲ Show less' : '▼ Read full policy'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: Admin ─────────────────────────────────────────────────────── */}
      {tab === 'admin' && isAdmin && (
        <AdminPrivacyPanel />
      )}
    </div>
  );
}


// ─── Admin panel (erasure review + retention report) ──────────────────────────

function AdminPrivacyPanel() {
  const [erasureRequests, setErasureRequests] = useState<any[]>([]);
  const [retention, setRetention] = useState<any | null>(null);
  const [adminView, setAdminView] = useState<'erasure'|'retention'>('erasure');

  const load = useCallback(async () => {
    try {
      const [er, ret] = await Promise.all([
        api.get('/gdpr/erasure-requests'),
        api.get('/gdpr/retention-report'),
      ]);
      setErasureRequests(er.data);
      setRetention(ret.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reviewErasure = async (id: number, status: string, reason = '') => {
    try {
      await api.put(`/gdpr/erasure-requests/${id}`, { status, rejection_reason: reason });
      toast.success(`Request ${status}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Failed');
    }
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Admin Privacy Controls</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['erasure', 'retention'] as const).map(v => (
          <button key={v} onClick={() => setAdminView(v)} style={{
            padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: adminView === v ? 'var(--accent)' : 'var(--surface2)',
            color: adminView === v ? '#fff' : 'var(--text-muted)',
            fontWeight: adminView === v ? 700 : 500, fontSize: 13,
          }}>{v === 'erasure' ? '🗑 Erasure Requests' : '📊 Retention Report'}</button>
        ))}
      </div>

      {adminView === 'erasure' && (
        <div>
          {erasureRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No erasure requests</div>
          ) : (
            erasureRequests.map(r => (
              <div key={r.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px', marginBottom: 10,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.user_email}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Submitted: {fmtDate(r.requested_at)} · Reason: {r.reason || 'No reason given'}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6,
                    background: `${STATUS_COLORS[r.status] || '#6366f1'}20`,
                    color: STATUS_COLORS[r.status] || '#6366f1',
                  }}>{r.status.toUpperCase()}</span>
                </div>
                {['pending', 'in_review'].includes(r.status) && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => reviewErasure(r.id, 'completed')} style={{
                      padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 700, fontSize: 12,
                    }}>✓ Approve & Anonymise</button>
                    <button onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason !== null) reviewErasure(r.id, 'rejected', reason);
                    }} style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'none', color: 'var(--text-muted)', fontSize: 12,
                    }}>✗ Reject</button>
                    <button onClick={() => reviewErasure(r.id, 'in_review')} style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                      cursor: 'pointer', background: 'none', color: 'var(--text-muted)', fontSize: 12,
                    }}>Mark In Review</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {adminView === 'retention' && retention && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Users', value: retention.total_users, color: '#6366f1' },
              { label: 'Active Users', value: retention.active_users, color: '#22c55e' },
              { label: 'Consent Records', value: retention.consent_records, color: '#f59e0b' },
              { label: 'Pending Erasures', value: retention.action_required.pending_erasure_requests, color: '#ef4444' },
            ].map(m => (
              <div key={m.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Retention Policy</div>
            {Object.entries(retention.retention_policy).map(([k, v]) => (
              <div key={k} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid var(--border)',
                fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{k.replace(/_/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{v as string}</span>
              </div>
            ))}
          </div>
          {Object.values(retention.action_required).some((v: any) => v > 0) && (
            <div style={{
              marginTop: 12, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#fbbf24', marginBottom: 8 }}>⚠ Actions Required</div>
              {Object.entries(retention.action_required).filter(([,v]) => (v as number) > 0).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, color: '#fbbf24', marginBottom: 3 }}>
                  • {(v as number)} {k.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

