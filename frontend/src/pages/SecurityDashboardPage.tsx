import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL as API } from '../lib/api';


function authHeaders() {
  const token = localStorage.getItem('lab_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Badges ──────────────────────────────────────────────────────────────────

const CLEARANCE_LABELS: Record<string, { label: string; color: string }> = {
  level_1: { label: 'L1 · General', color: '#6b7280' },
  level_2: { label: 'L2 · Researcher', color: '#3b82f6' },
  level_3: { label: 'L3 · Senior', color: '#8b5cf6' },
  level_4: { label: 'L4 · Lead/PI', color: '#f59e0b' },
  level_5: { label: 'L5 · Admin', color: '#ef4444' },
};

const CLASSIFICATION_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: 'Public', color: '#10b981' },
  internal: { label: 'Internal', color: '#3b82f6' },
  confidential: { label: 'Confidential', color: '#f59e0b' },
  restricted: { label: 'Restricted', color: '#ef4444' },
  phi: { label: 'PHI', color: '#dc2626' },
};

export function SecurityLevelBadge({ level }: { level: string }) {
  const meta = CLEARANCE_LABELS[level] ?? { label: level, color: '#6b7280' };
  return (
    <span style={{
      background: meta.color + '22',
      color: meta.color,
      border: `1px solid ${meta.color}55`,
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

export function ClassificationBadge({ level }: { level: string }) {
  const meta = CLASSIFICATION_LABELS[level] ?? { label: level, color: '#6b7280' };
  return (
    <span style={{
      background: meta.color + '22',
      color: meta.color,
      border: `1px solid ${meta.color}55`,
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.03em',
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

// ─── MFA Setup wizard ─────────────────────────────────────────────────────────

function MFASetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'backup'>('idle');
  const [uri, setUri] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const startSetup = async () => {
    setError('');
    try {
      const res = await axios.post(`${API}/security/mfa/setup`, {}, { headers: authHeaders() });
      setSecret(res.data.secret);
      setUri(res.data.uri);
      setQrUrl(`${API}/security/mfa/qr`);
      setStep('setup');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Setup failed');
    }
  };

  const confirmCode = async () => {
    setError('');
    try {
      const res = await axios.post(`${API}/security/mfa/confirm`, { code }, { headers: authHeaders() });
      setBackupCodes(res.data.backup_codes);
      setStep('backup');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Invalid code');
    }
  };

  if (step === 'idle') {
    return (
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Two-Factor Authentication (TOTP)</h3>
        <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 16px' }}>
          Add an extra layer of security. Use Google Authenticator, Authy, or any TOTP app.
        </p>
        <button style={styles.btnPrimary} onClick={startSetup}>Enable MFA</button>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Scan QR Code</h3>
        <img
          src={`${qrUrl}?t=${Date.now()}`}
          alt="TOTP QR"
          style={{ width: 200, height: 200, border: '1px solid #e2e8f0', borderRadius: 8, display: 'block', marginBottom: 12 }}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 8px' }}>
          Or enter this key manually:
        </p>
        <code style={{ background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, fontSize: 13, letterSpacing: 2 }}>
          {secret}
        </code>
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 14, margin: '0 0 8px' }}>Enter the 6-digit code from your app:</p>
          <input
            style={styles.input}
            placeholder="000000"
            value={code}
            maxLength={6}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && confirmCode()}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btnPrimary} onClick={confirmCode}>Verify & Enable</button>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div style={styles.card}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#10b981' }}>MFA Enabled!</h3>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 12px' }}>
          Save these backup codes in a secure place. Each can only be used once.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {backupCodes.map((c, i) => (
            <code key={i} style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: 4, fontSize: 13, letterSpacing: 2 }}>
              {c}
            </code>
          ))}
        </div>
        <button style={styles.btnPrimary} onClick={onDone}>Done</button>
      </div>
    );
  }

  return null;
}

// ─── Disable MFA panel ────────────────────────────────────────────────────────

function DisableMFA({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const disable = async () => {
    setError('');
    setLoading(true);
    try {
      await axios.delete(`${API}/security/mfa`, {
        headers: authHeaders(),
        data: { password },
      });
      onDone();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Disable MFA</h3>
      <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 12px' }}>
        Confirm your password to disable two-factor authentication.
      </p>
      <input
        style={styles.input}
        type="password"
        placeholder="Current password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {error && <p style={styles.error}>{error}</p>}
      <button style={{ ...styles.btnDanger, marginTop: 8 }} onClick={disable} disabled={loading || !password}>
        {loading ? 'Disabling…' : 'Disable MFA'}
      </button>
    </div>
  );
}

// ─── Sessions panel ───────────────────────────────────────────────────────────

function SessionsPanel() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/security/sessions`, { headers: authHeaders() });
      setSessions(res.data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = async (id: number) => {
    try {
      await axios.delete(`${API}/security/sessions/${id}`, { headers: authHeaders() });
      load();
    } catch {/* ignore */}
  };

  const revokeAll = async () => {
    try {
      await axios.delete(`${API}/security/sessions`, { headers: authHeaders() });
      load();
    } catch {/* ignore */}
  };

  if (loading) return <div style={styles.card}><p style={{ color: '#94a3b8' }}>Loading sessions…</p></div>;

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>Active Sessions</h3>
        {sessions.length > 1 && (
          <button style={styles.btnDanger} onClick={revokeAll}>Revoke All Others</button>
        )}
      </div>
      {sessions.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>No active sessions found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.map((s, i) => (
            <div key={s.id} style={{ ...styles.row, background: i === 0 ? '#f0fdf4' : '#f8fafc' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.device_hint || 'Unknown Device'}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {s.ip_address} · Last active {new Date(s.last_active_at).toLocaleString()}
                </div>
                {i === 0 && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Current session</span>}
              </div>
              {i !== 0 && (
                <button style={styles.btnSmallDanger} onClick={() => revoke(s.id)}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Security Events log ──────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  info: '#3b82f6',
  warning: '#f59e0b',
  critical: '#ef4444',
};

function SecurityEventsPanel({ isAdmin }: { isAdmin: boolean }) {
  const [events, setEvents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      axios.get(`${API}/security/events`, { headers: authHeaders() }),
      axios.get(`${API}/security/events/summary`, { headers: authHeaders() }),
    ]).then(([evtRes, sumRes]) => {
      setEvents(evtRes.data.items || []);
      setSummary(sumRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div style={styles.card}>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Security event log requires manager access or above.</p>
      </div>
    );
  }

  if (loading) return <div style={styles.card}><p style={{ color: '#94a3b8' }}>Loading events…</p></div>;

  return (
    <div>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Events (24h)', value: summary.counts.total, color: '#3b82f6' },
            { label: 'Warnings', value: summary.counts.warning, color: '#f59e0b' },
            { label: 'Critical', value: summary.counts.critical, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{ ...styles.card, textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {summary?.alerts?.map((alert: any, i: number) => (
        <div key={i} style={{
          background: alert.level === 'critical' ? '#fef2f2' : '#fffbeb',
          border: `1px solid ${alert.level === 'critical' ? '#fca5a5' : '#fcd34d'}`,
          borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 14,
          color: alert.level === 'critical' ? '#b91c1c' : '#92400e',
        }}>
          {alert.level === 'critical' ? '🔴' : '⚠️'} {alert.message}
        </div>
      ))}

      <div style={styles.card}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Recent Security Events</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {['Time', 'Event', 'Severity', 'User', 'IP'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>No events recorded yet.</td></tr>
              ) : events.slice(0, 50).map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '8px 10px', fontWeight: 500 }}>
                    {e.event_type.replace(/_/g, ' ')}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{
                      color: SEVERITY_COLORS[e.severity] ?? '#6b7280',
                      fontWeight: 600,
                      fontSize: 12,
                    }}>
                      {e.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: '#374151' }}>{e.user_email || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b', fontFamily: 'monospace' }}>{e.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Clearance Management (admin) ─────────────────────────────────────────────

function ClearancePanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/security/clearance/users`, { headers: authHeaders() });
      setUsers(res.data);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setClearance = async (userId: number, level: string) => {
    setSaving(userId);
    try {
      await axios.put(`${API}/security/clearance/${userId}`, { security_clearance: level }, { headers: authHeaders() });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, security_clearance: level } : u));
    } catch {/* ignore */} finally {
      setSaving(null);
    }
  };

  if (loading) return <div style={styles.card}><p style={{ color: '#94a3b8' }}>Loading users…</p></div>;

  return (
    <div style={styles.card}>
      <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Security Clearance Management</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              {['Name', 'Role', 'Clearance', 'MFA', 'Change Level'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{u.email}</div>
                </td>
                <td style={{ padding: '8px 10px', color: '#374151', textTransform: 'capitalize' }}>{u.role}</td>
                <td style={{ padding: '8px 10px' }}><SecurityLevelBadge level={u.security_clearance} /></td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: u.mfa_enabled ? '#10b981' : '#94a3b8', fontWeight: 600, fontSize: 13 }}>
                    {u.mfa_enabled ? 'Enabled' : 'Off'}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <select
                    value={u.security_clearance}
                    disabled={saving === u.id}
                    onChange={e => setClearance(u.id, e.target.value)}
                    style={{ ...styles.input, padding: '4px 8px', margin: 0 }}
                  >
                    {Object.entries(CLEARANCE_LABELS).map(([val, meta]) => (
                      <option key={val} value={val}>{meta.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'sessions' | 'mfa' | 'events' | 'clearance';

export default function SecurityDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [myClearance, setMyClearance] = useState<any>(null);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [role, setRole] = useState('');

  const loadClearance = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/security/clearance`, { headers: authHeaders() });
      setMyClearance(res.data);
      setMfaEnabled(res.data.mfa_enabled);
      setRole(res.data.role);
    } catch {/* ignore */}
  }, []);

  useEffect(() => { loadClearance(); }, [loadClearance]);

  const isAdmin = ['admin', 'superadmin'].includes(role);
  const isManager = ['admin', 'superadmin', 'manager', 'pi'].includes(role);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'mfa', label: 'MFA' },
    ...(isManager ? [{ key: 'events' as Tab, label: 'Security Events' }] : []),
    ...(isAdmin ? [{ key: 'clearance' as Tab, label: 'Clearance' }] : []),
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 700 }}>Security Dashboard</h1>
      <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 15 }}>
        Manage MFA, active sessions, security clearance levels, and monitor security events.
      </p>

      {/* Tab Bar */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 18px',
              border: 'none',
              background: 'transparent',
              borderBottom: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#3b82f6' : '#64748b',
              fontSize: 14,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div style={styles.card}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Security Clearance</div>
              {myClearance ? <SecurityLevelBadge level={myClearance.security_clearance} /> : '—'}
            </div>
            <div style={styles.card}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Two-Factor Auth</div>
              <span style={{ fontWeight: 700, color: mfaEnabled ? '#10b981' : '#ef4444' }}>
                {mfaEnabled ? 'Enabled' : 'Not Enabled'}
              </span>
            </div>
            <div style={styles.card}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Role</div>
              <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{role || '—'}</span>
            </div>
          </div>

          <div style={{ ...styles.card, background: mfaEnabled ? '#f0fdf4' : '#fffbeb', borderColor: mfaEnabled ? '#86efac' : '#fcd34d' }}>
            <h3 style={{ margin: '0 0 8px', color: mfaEnabled ? '#15803d' : '#92400e', fontSize: 15 }}>
              {mfaEnabled ? '✅ Account is protected with MFA' : '⚠️ MFA is not enabled'}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#64748b' }}>
              {mfaEnabled
                ? 'Your account requires a TOTP code at login. You can manage your MFA settings in the MFA tab.'
                : 'Protect your account with an authenticator app. Required for Level 3+ clearance.'}
            </p>
            {!mfaEnabled && (
              <button style={styles.btnPrimary} onClick={() => setTab('mfa')}>Enable MFA →</button>
            )}
          </div>

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Data Classification Levels</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CLASSIFICATION_LABELS).map(([key, meta]) => (
                <div key={key} style={{ ...styles.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClassificationBadge level={key} />
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    {key === 'public' && 'Freely sharable'}
                    {key === 'internal' && 'Lab staff only'}
                    {key === 'confidential' && 'Named personnel only'}
                    {key === 'restricted' && 'L4+ clearance required'}
                    {key === 'phi' && 'Protected Health Info (HIPAA)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions */}
      {tab === 'sessions' && <SessionsPanel />}

      {/* MFA */}
      {tab === 'mfa' && (
        <div>
          {mfaEnabled
            ? <DisableMFA onDone={() => { setMfaEnabled(false); loadClearance(); }} />
            : <MFASetup onDone={() => { setMfaEnabled(true); loadClearance(); }} />
          }
        </div>
      )}

      {/* Security Events */}
      {tab === 'events' && <SecurityEventsPanel isAdmin={isManager} />}

      {/* Clearance Management */}
      {tab === 'clearance' && isAdmin && <ClearancePanel />}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 0,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    boxSizing: 'border-box',
    marginBottom: 8,
    outline: 'none',
  } as React.CSSProperties,
  btnPrimary: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
  btnDanger: {
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '8px 16px',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  } as React.CSSProperties,
  btnSmallDanger: {
    background: '#fee2e2',
    color: '#b91c1c',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    padding: '4px 10px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  } as React.CSSProperties,
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
  } as React.CSSProperties,
  error: {
    color: '#ef4444',
    fontSize: 13,
    margin: '4px 0 8px',
  } as React.CSSProperties,
};
