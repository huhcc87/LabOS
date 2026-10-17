import { useState } from 'react';
import { useAction, useMutation, useQuery, useConvex } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { errText } from '../lib/errors';
import { TwoFactorSetup } from '../components/TwoFactorSetup';
import { passwordChecks } from '../lib/passwordRules';

type Tab = 'overview' | 'twofactor' | 'sessions' | 'password' | 'privacy' | 'admin' | 'how';

const when = (ms: number) => new Date(ms).toLocaleString();
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 14 };
const h2: React.CSSProperties = { fontSize: 16, margin: '0 0 10px' };
const muted: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 13 };
const ACTION_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: 'Signed in', LOGIN_FAILED: 'Wrong password', LOGIN_FAILED_2FA: 'Wrong two-factor code', LOGIN_BLOCKED_LOCKED: 'Blocked: account locked',
  ACCOUNT_LOCKED_BRUTE_FORCE: 'Account locked after repeated failures', PASSWORD_CHANGED: 'Password changed', TOTP_ENABLED: 'Two-factor turned on',
  TOTP_DISABLED: 'Two-factor turned off', RECOVERY_CODES_CREATED: 'Recovery codes created', RECOVERY_CODE_USED: 'Recovery code used to sign in',
  SESSION_REVOKED: 'A session was ended', SESSIONS_REVOKED_ALL: 'Other sessions signed out', CONSENT_GRANTED: 'Consent given', CONSENT_REVOKED: 'Consent withdrawn',
  ERASURE_REQUESTED: 'Erasure requested', POLICY_2FA_REQUIRED: 'Two-factor made required', POLICY_2FA_OPTIONAL: 'Two-factor made optional',
};

export default function SecurityCenterPage() {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const status = useQuery(api.security.status, token ? { token } : 'skip');
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const tabs: Array<[Tab, string]> = [['overview', '🛡️ Overview'], ['twofactor', '🔐 Two-factor'], ['sessions', '💻 Sessions & activity'], ['password', '🔑 Password'], ['privacy', '📋 My data & consent'], ...(isAdmin ? [['admin', '⚙️ Lab policy'] as [Tab, string]] : []), ['how', 'ℹ️ How we protect data']];

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Security & Privacy</h1>
      <p style={{ ...muted, margin: '4px 0 16px' }}>Protect your account, see who signed in, and control your data. Everything on this page is live.</p>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn btn-sm ${tab === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {status === undefined ? <p style={muted}>Loading…</p> : status === null ? <p style={muted}>Your session ended. Please sign in again.</p> : (
        <>
          {tab === 'overview' && <Overview status={status} go={setTab} />}
          {tab === 'twofactor' && <TwoFactor status={status} />}
          {tab === 'sessions' && <Sessions status={status} onEnded={logout} />}
          {tab === 'password' && <Password />}
          {tab === 'privacy' && <Privacy />}
          {tab === 'admin' && isAdmin && <AdminPolicy />}
          {tab === 'how' && <How status={status} />}
        </>
      )}
    </div>
  );
}

type Status = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.security.status>>>>;

function Check({ ok, label, hint, onClick }: { ok: boolean; label: string; hint?: string; onClick?: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>{ok ? '✅' : '⚠️'}</span>
      <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>{hint && <div style={muted}>{hint}</div>}</div>
      {!ok && onClick && <button className="btn btn-sm btn-primary" onClick={onClick}>Fix</button>}
    </div>
  );
}

function Overview({ status, go }: { status: Status; go: (t: Tab) => void }) {
  const secure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  const checks = [
    { ok: secure, label: 'Connection is encrypted (HTTPS)', hint: secure ? 'Everything between this browser and LabOS is encrypted in transit.' : 'This page is not on HTTPS. Do not enter passwords here.' },
    { ok: status.totp_enabled, label: 'Two-factor sign-in is on for your account', hint: 'A password alone is the most common way accounts are broken into.', fix: () => go('twofactor') },
    { ok: status.totp_enabled && status.recovery_left > 0, label: 'You have recovery codes saved', hint: status.totp_enabled ? `${status.recovery_left} unused. They let you in if you lose your phone.` : 'Turn on two-factor first.', fix: () => go('twofactor') },
    { ok: status.sessions.length <= 2, label: 'Few devices are signed in', hint: `${status.sessions.length} active session${status.sessions.length === 1 ? '' : 's'}. End any you do not recognise.`, fix: () => go('sessions') },
  ];
  const score = checks.filter((c) => c.ok).length;
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: score === checks.length ? 'var(--ok-text, #16a34a)' : 'var(--warn-text, #d97706)' }}>{score}/{checks.length}</span>
          <span style={muted}>account protections in place</span>
        </div>
        {checks.map((c) => <Check key={c.label} ok={c.ok} label={c.label} hint={c.hint} onClick={c.fix} />)}
      </div>
      <div style={card}>
        <h2 style={h2}>What protects you without any action</h2>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
          <li>Passwords are stored as bcrypt hashes, never in readable form.</li>
          <li>Five wrong passwords or two-factor codes lock the account for 30 minutes.</li>
          <li>Sign-ins last 8 hours, then you must sign in again.</li>
          <li>Your lab's data is kept separate from other labs on the server.</li>
        </ul>
      </div>
    </>
  );
}

function TwoFactor({ status }: { status: Status }) {
  const { token } = useAuth();
  const createCodes = useAction(api.security.createRecoveryCodes);
  const [pw, setPw] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    if (!token) return;
    setBusy(true);
    try { setCodes((await createCodes({ token, password: pw })).codes); setPw(''); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const text = codes?.join('\n') ?? '';
  return (
    <>
      <div style={card}>
        <h2 style={h2}>Authenticator app</h2>
        <p style={muted}>After your password, LabOS asks for a 6-digit code from an app such as Google Authenticator, Microsoft Authenticator or 1Password.</p>
        <TwoFactorSetup />
      </div>
      <div style={card}>
        <h2 style={h2}>Recovery codes</h2>
        {!status.totp_enabled ? <p style={muted}>Turn on the authenticator app first.</p> : (
          <>
            <p style={muted}>Each code works once if you lose your phone. {status.recovery_left} unused now. Making new codes cancels the old ones.</p>
            {codes ? (
              <>
                <pre style={{ background: 'var(--surface2)', padding: 12, borderRadius: 8, fontSize: 15, letterSpacing: 1 }}>{text}</pre>
                <p style={{ ...muted, color: 'var(--bad-text, #dc2626)' }}>Save these now. They are not shown again.</p>
                <button className="btn btn-sm btn-secondary" onClick={() => navigator.clipboard.writeText(text).then(() => toast.success('Copied'))}>Copy</button>{' '}
                <button className="btn btn-sm btn-secondary" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([`LabOS recovery codes\n${text}\n`], { type: 'text/plain' })); a.download = 'labos-recovery-codes.txt'; a.click(); }}>Download</button>{' '}
                <button className="btn btn-sm btn-primary" onClick={() => setCodes(null)}>I saved them</button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="form-input" type="password" autoComplete="current-password" placeholder="Your password" aria-label="Your password" value={pw} onChange={(e) => setPw(e.target.value)} />
                <button className="btn btn-primary" onClick={make} disabled={!pw || busy}>{busy ? 'Creating…' : 'Create new recovery codes'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Sessions({ status, onEnded }: { status: Status; onEnded: () => Promise<void> }) {
  const { token } = useAuth();
  const revoke = useMutation(api.security.revokeSession);
  const revokeOthers = useMutation(api.security.revokeOthers);
  const end = async (id: string, current: boolean) => {
    try { await revoke({ token: token ?? undefined, session_id: id as Id<'sessions'> }); toast.success('Session ended'); if (current) await onEnded(); } catch (e) { toast.error(errText(e)); }
  };
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <h2 style={{ ...h2, margin: 0 }}>Where you are signed in</h2>
          <button className="btn btn-sm btn-secondary" disabled={status.sessions.length < 2} onClick={async () => { try { const r = await revokeOthers({ token: token ?? undefined }); toast.success(`Signed out ${r.ended} other session${r.ended === 1 ? '' : 's'}`); } catch (e) { toast.error(errText(e)); } }}>Sign out everywhere else</button>
        </div>
        {status.sessions.map((s) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14, alignItems: 'center' }}>
            <span>{s.current ? <strong>This device</strong> : 'Another device'} <span style={muted}>· signed in {when(s.created_at)} · expires {when(s.expires_at)}</span></span>
            <button className="btn btn-sm btn-secondary" onClick={() => end(s.id, s.current)}>{s.current ? 'Sign out' : 'End'}</button>
          </div>
        ))}
      </div>
      <div style={card}>
        <h2 style={h2}>Recent security activity</h2>
        {status.history.length === 0 ? <p style={muted}>Nothing yet.</p> : status.history.map((h, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
            <span>{ACTION_LABEL[h.action] ?? h.action}</span><span style={muted}>{when(h.at)}</span>
          </div>
        ))}
        <p style={{ ...muted, marginTop: 8 }}>See something you did not do? Change your password now, then sign out everywhere else.</p>
      </div>
    </>
  );
}

function Password() {
  const { token } = useAuth();
  const change = useAction(api.security.changePassword);
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [again, setAgain] = useState(''); const [busy, setBusy] = useState(false);
  const rules = passwordChecks(next);
  const ok = rules.every((r) => r.ok) && next === again && cur !== '';
  const submit = async () => {
    if (!token) return;
    setBusy(true);
    try { await change({ token, current_password: cur, new_password: next }); toast.success('Password changed. Other devices were signed out.'); setCur(''); setNext(''); setAgain(''); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div style={card}>
      <h2 style={h2}>Change password</h2>
      <div style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
        <input className="form-input" type="password" autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input className="form-input" type="password" autoComplete="new-password" placeholder="New password" aria-label="New password" value={next} onChange={(e) => setNext(e.target.value)} />
        <input className="form-input" type="password" autoComplete="new-password" placeholder="Repeat new password" aria-label="Repeat new password" value={again} onChange={(e) => setAgain(e.target.value)} />
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {rules.map((r) => <li key={r.label} style={{ color: r.ok ? 'var(--ok-text, #16a34a)' : 'var(--text-muted)' }}>{r.ok ? '✓' : '○'} {r.label}</li>)}
          <li style={{ color: next && next === again ? 'var(--ok-text, #16a34a)' : 'var(--text-muted)' }}>{next && next === again ? '✓' : '○'} Both entries match</li>
        </ul>
        <button className="btn btn-primary" disabled={!ok || busy} onClick={submit}>{busy ? 'Saving…' : 'Change password'}</button>
      </div>
    </div>
  );
}

function Privacy() {
  const { token } = useAuth();
  const convex = useConvex();
  const consents = useQuery(api.security.myConsents, token ? { token } : 'skip');
  const requests = useQuery(api.security.myErasureRequests, token ? { token } : 'skip');
  const setConsent = useMutation(api.security.setConsent);
  const requestErasure = useMutation(api.security.requestErasure);
  const [reason, setReason] = useState('');

  const download = async () => {
    try {
      const data = await convex.query(api.security.exportMyData, { token: token ?? undefined });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      a.download = `labos-my-data-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    } catch (e) { toast.error(errText(e)); }
  };
  return (
    <>
      <div style={card}>
        <h2 style={h2}>Consent</h2>
        {consents?.map((c) => (
          <label key={c.type} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={c.granted} disabled={!!(c as { required?: boolean }).required}
              onChange={async (e) => { try { await setConsent({ token: token ?? undefined, consent_type: c.type, granted: e.target.checked }); } catch (er) { toast.error(errText(er)); } }} />
            <span><strong>{c.label}</strong><br /><span style={muted}>{c.description}</span></span>
          </label>
        ))}
      </div>
      <div style={card}>
        <h2 style={h2}>Download my data</h2>
        <p style={muted}>A JSON file with your profile, consents, security history, requests and notifications. Passwords and two-factor secrets are never included.</p>
        <button className="btn btn-secondary" onClick={download}>⬇ Download</button>
      </div>
      <div style={card}>
        <h2 style={h2}>Ask for my personal data to be erased</h2>
        <p style={muted}>An admin reviews the request. Records the lab must keep (for example signed notebook entries and audit logs) may be kept or anonymised. Approval is recorded here; the admin then removes the data.</p>
        <textarea className="form-input" rows={2} style={{ width: '100%' }} placeholder="Reason (optional)" aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={async () => { try { await requestErasure({ token: token ?? undefined, reason }); setReason(''); toast.success('Request sent'); } catch (e) { toast.error(errText(e)); } }}>Send request</button>
        {requests?.map((r) => <div key={r._id} style={{ ...muted, padding: '6px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>{when(r.created_at)} · <strong>{r.status}</strong>{r.rejection_reason ? ` · ${r.rejection_reason}` : ''}</div>)}
      </div>
    </>
  );
}

function AdminPolicy() {
  const { token } = useAuth();
  const policy = useQuery(api.security.getPolicy, token ? { token } : 'skip');
  const erasures = useQuery(api.security.listErasureRequests, token ? { token } : 'skip');
  const setReq = useMutation(api.security.setRequire2fa);
  const review = useMutation(api.security.reviewErasureRequest);
  if (!policy) return <p style={muted}>Loading…</p>;
  return (
    <>
      <div style={card}>
        <h2 style={h2}>Require two-factor</h2>
        <p style={muted}>When on, managers, PIs and admins cannot use LabOS until they set up two-factor, and cannot switch it off.</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
          <input type="checkbox" checked={policy.require_2fa} disabled={!policy.can_edit}
            onChange={async (e) => { try { await setReq({ token: token ?? undefined, required: e.target.checked }); toast.success(e.target.checked ? 'Two-factor is now required' : 'Two-factor is now optional'); } catch (er) { toast.error(errText(er)); } }} />
          Require two-factor for managers, PIs and admins
        </label>
        <p style={{ ...muted, marginTop: 10 }}>{policy.privileged_without_2fa.length} of {policy.privileged_total} of those accounts have no two-factor yet{policy.privileged_without_2fa.length ? ':' : '.'}</p>
        {policy.privileged_without_2fa.map((p) => <div key={p.id} style={{ fontSize: 14 }}>• {p.name} ({p.role})</div>)}
        {policy.require_2fa && policy.privileged_without_2fa.length > 0 && <p style={{ ...muted, color: 'var(--warn-text, #d97706)' }}>They are asked to set it up the next time they use LabOS.</p>}
      </div>
      <div style={card}>
        <h2 style={h2}>Erasure requests</h2>
        {!erasures?.length ? <p style={muted}>No requests.</p> : erasures.map((r) => (
          <div key={r._id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
            <strong>{r.person}</strong> · {when(r.created_at)} · {r.status}{r.reason ? ` · “${r.reason}”` : ''}
            {r.status === 'pending' && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                <button className="btn btn-sm btn-primary" onClick={() => review({ token: token ?? undefined, id: r._id, status: 'approved' }).catch((e) => toast.error(errText(e)))}>Approve</button>
                <button className="btn btn-sm btn-secondary" onClick={() => { const why = prompt('Why is it rejected?'); if (why) review({ token: token ?? undefined, id: r._id, status: 'rejected', rejection_reason: why }).catch((e) => toast.error(errText(e))); }}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function How({ status }: { status: Status }) {
  const rows: Array<[string, string]> = [
    ['In transit', 'HTTPS only, with HSTS. Strict browser rules (Content-Security-Policy, no framing, no content sniffing) limit what a page can load or do.'],
    ['Passwords', 'bcrypt hashes (cost 12). New passwords need 12+ characters and are checked against easy guesses and your own name and email.'],
    ['Sign-in', 'Attempts are rate-limited per email and the account locks for 30 minutes after 5 wrong passwords or codes. Sessions last 8 hours and can be ended from the Sessions tab.'],
    ['Two-factor', `Authenticator-app codes plus one-time recovery codes. ${status.secrets_encrypted ? 'Two-factor secrets are encrypted before they are stored.' : 'Two-factor secrets are stored without an extra encryption layer until the admin sets TOTP_ENCRYPTION_KEY.'}`],
    ['Your lab’s data', 'Hosted on Convex (database) and Vercel (website). Every lab’s records are kept apart, and the server checks your role on every request.'],
    ['Payments', 'LabOS stores only a label and the last four digits of a card. Card numbers are handled by Stripe, not by LabOS.'],
    ['Records', 'Sign-ins, password and two-factor changes, consent and policy changes are written to the audit log.'],
    ['Analytics', 'Vercel Web Analytics counts page views. No lab records are sent to it.'],
  ];
  const gaps = ['No SOC 2, ISO 27001 or HIPAA certification for LabOS itself.', 'No single sign-on (SAML) or IP allow-list yet.', 'Sessions are kept in your browser storage, so keep devices locked and use a trusted browser.', 'Data is encrypted at rest by the hosting provider; the lab does not hold its own keys.'];
  return (
    <>
      <div style={card}>{rows.map(([k, v]) => <div key={k} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}><strong>{k}.</strong> <span style={{ color: 'var(--text-muted)' }}>{v}</span></div>)}</div>
      <div style={card}><h2 style={h2}>What is not there yet</h2><ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>{gaps.map((g) => <li key={g}>{g}</li>)}</ul></div>
    </>
  );
}
