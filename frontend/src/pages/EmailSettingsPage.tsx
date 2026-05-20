import { useState, useEffect } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

interface SmtpStatus {
  configured: boolean;
  host: string;
  port: number;
  user: string;
  from_address: string;
  tls: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  subject: string;
  body: string;
  variables: string[];
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome',
    name: 'Welcome / New User',
    icon: '🙋',
    description: 'Sent when an admin creates a new user account',
    subject: 'Welcome to {{lab_name}} on LabOS',
    body: `Hi {{user_name}},

Your LabOS account has been created. You can sign in at {{app_url}} using:

  Email:     {{user_email}}
  Password:  {{temp_password}}

Please change your password after your first login.

— The {{lab_name}} team`,
    variables: ['user_name', 'user_email', 'temp_password', 'lab_name', 'app_url'],
  },
  {
    id: 'task_reminder',
    name: 'Task Reminder',
    icon: '📅',
    description: 'Sent before a task is due',
    subject: 'Reminder: "{{task_title}}" is due {{due_date}}',
    body: `Hi {{user_name}},

This is a reminder that the following task is due on {{due_date}}:

  • {{task_title}}
    {{task_description}}

Open it in LabOS: {{task_url}}

— LabOS`,
    variables: ['user_name', 'task_title', 'task_description', 'due_date', 'task_url'],
  },
  {
    id: 'reagent_expiry',
    name: 'Reagent Expiry Alert',
    icon: '⏰',
    description: 'Daily digest — reagents expiring within 30 days',
    subject: '{{count}} reagent(s) expiring soon',
    body: `Hi team,

The following reagents will expire within the next 30 days:

{{reagent_list}}

Please review and reorder or dispose of expired items.

Open the inventory: {{inventory_url}}

— LabOS`,
    variables: ['count', 'reagent_list', 'inventory_url'],
  },
  {
    id: 'capa_assigned',
    name: 'CAPA Assigned',
    icon: '🔧',
    description: 'Sent when a CAPA record is assigned',
    subject: 'CAPA #{{capa_id}} assigned to you: {{capa_title}}',
    body: `Hi {{user_name}},

A Corrective & Preventive Action has been assigned to you:

  CAPA #{{capa_id}}: {{capa_title}}
  Severity:  {{severity}}
  Due:       {{due_date}}

Description:
{{capa_description}}

Open it: {{capa_url}}

— LabOS`,
    variables: ['user_name', 'capa_id', 'capa_title', 'severity', 'due_date', 'capa_description', 'capa_url'],
  },
  {
    id: 'iot_alert',
    name: 'IoT Sensor Alert',
    icon: '🌡️',
    description: 'Real-time alert when a sensor crosses a threshold',
    subject: '⚠ Sensor alert: {{sensor_name}}',
    body: `Sensor {{sensor_name}} ({{sensor_type}}) breached its threshold at {{timestamp}}.

  Current value:  {{value}} {{unit}}
  Threshold:      {{threshold}} {{unit}}
  Location:       {{location}}

Open the IoT dashboard: {{dashboard_url}}

— LabOS`,
    variables: ['sensor_name', 'sensor_type', 'timestamp', 'value', 'unit', 'threshold', 'location', 'dashboard_url'],
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    icon: '🔑',
    description: 'Sent when a user requests a password reset',
    subject: 'Reset your LabOS password',
    body: `Hi {{user_name}},

We received a request to reset your password. Click the link below within {{expires_in}} to set a new one:

  {{reset_url}}

If you didn't request this, you can ignore this email.

— LabOS`,
    variables: ['user_name', 'reset_url', 'expires_in'],
  },
];

const TEMPLATES_STORAGE_KEY = 'labos_email_templates';
function loadTemplates(): EmailTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const saved = JSON.parse(raw) as EmailTemplate[];
    return DEFAULT_TEMPLATES.map(d => saved.find(s => s.id === d.id) ?? d);
  } catch { return DEFAULT_TEMPLATES; }
}
function saveTemplates(t: EmailTemplate[]) {
  try { localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(t)); } catch {}
}

const SAMPLE_VALUES: Record<string, string> = {
  user_name: 'Dr. Jane Smith',
  user_email: 'jane.smith@labos.app',
  temp_password: 'A8x!K2pQ',
  lab_name: 'Smith Research Lab',
  app_url: 'https://labos.app',
  task_title: 'Quarterly cell culture audit',
  task_description: 'Review and document all active cultures in BSL-2.',
  due_date: 'Mon, May 20',
  task_url: 'https://labos.app/tasks/142',
  count: '4',
  reagent_list: '  • Tris-HCl 1M — expires May 22\n  • DMEM — expires May 28\n  • FBS lot #482 — expires Jun 03\n  • Penicillin/Streptomycin — expires Jun 10',
  inventory_url: 'https://labos.app/inventory',
  capa_id: '0042',
  capa_title: 'Centrifuge calibration drift',
  severity: 'High',
  capa_description: 'Calibration check exceeded 5% drift on rotor B. Replace rotor and re-verify before next use.',
  capa_url: 'https://labos.app/capa/42',
  sensor_name: 'Freezer-3 Temperature',
  sensor_type: 'Temperature',
  timestamp: '2026-05-16 22:14',
  value: '-65.2',
  unit: '°C',
  threshold: '-70.0',
  location: 'Cold room B',
  dashboard_url: 'https://labos.app/iot',
  reset_url: 'https://labos.app/reset?token=…',
  expires_in: '60 minutes',
};

const renderPreview = (template: string, variables: string[]): string => {
  return variables.reduce((acc, v) => {
    const value = SAMPLE_VALUES[v] ?? `[${v}]`;
    return acc.split(`{{${v}}}`).join(value);
  }, template);
};

export default function EmailSettingsPage() {
  const [status, setStatus] = useState<SmtpStatus | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState('This is a test email from LabOS.');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>(() => loadTemplates());
  const [selectedTplId, setSelectedTplId] = useState<string>(DEFAULT_TEMPLATES[0].id);
  const [tplSaved, setTplSaved] = useState(false);

  const selectedTpl = templates.find(t => t.id === selectedTplId) ?? templates[0];
  const updateTpl = (patch: Partial<EmailTemplate>) => {
    const next = templates.map(t => t.id === selectedTplId ? { ...t, ...patch } : t);
    setTemplates(next);
    saveTemplates(next);
    setTplSaved(true);
    window.clearTimeout((updateTpl as any)._t);
    (updateTpl as any)._t = window.setTimeout(() => setTplSaved(false), 1200);
  };
  const resetTpl = () => {
    const def = DEFAULT_TEMPLATES.find(t => t.id === selectedTplId);
    if (def) updateTpl({ subject: def.subject, body: def.body });
  };

  useEffect(() => {
    fetch(`${API}/email/smtp-status`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStatus(d));
  }, []);

  const sendTest = async () => {
    if (!testTo) return;
    setSending(true);
    setResult(null);
    const res = await fetch(`${API}/email/test`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ to: testTo, message: testMsg }),
    });
    if (res.ok) {
      setResult({ ok: true, msg: `Test email sent to ${testTo}` });
    } else {
      const err = await res.json().catch(() => ({}));
      setResult({ ok: false, msg: err.detail ?? 'Failed to send' });
    }
    setSending(false);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Email & Notifications</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
          SMTP configuration and notification delivery
        </p>
      </div>

      {/* SMTP Status card */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>SMTP Status</h3>
        {status ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: status.configured ? '#22c55e22' : '#ef444422',
                color: status.configured ? '#22c55e' : '#ef4444',
                border: `1px solid ${status.configured ? '#22c55e44' : '#ef444444'}`,
              }}>
                {status.configured ? '● Configured' : '○ Not configured'}
              </span>
              {!status.configured && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in your .env file
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Host', val: status.host || '—' },
                { label: 'Port', val: status.port },
                { label: 'Username', val: status.user || '—' },
                { label: 'From Address', val: status.from_address },
                { label: 'TLS', val: status.tls ? 'Enabled' : 'Disabled' },
              ].map(({ label, val }) => (
                <div key={label} style={{ padding: '10px 14px', background: 'var(--bg-surface, rgba(0,0,0,.04))', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{String(val)}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, padding: 14, background: 'rgba(99,102,241,.06)', borderRadius: 8, fontSize: 13 }}>
              <strong>To configure SMTP</strong>, add these to your <code>backend/.env</code>:
              <pre style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)', overflow: 'auto' }}>{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@yourdomain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=labos@yourdomain.com
SMTP_TLS=true`}</pre>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
        )}
      </div>

      {/* Test email */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Send Test Email</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Recipient address</label>
            <input
              type="email"
              value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Message</label>
            <textarea
              value={testMsg}
              onChange={e => setTestMsg(e.target.value)}
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={sendTest} disabled={sending || !testTo}
              style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: sending || !testTo ? 0.6 : 1 }}>
              {sending ? 'Sending…' : 'Send Test Email'}
            </button>
            {result && (
              <span style={{ fontSize: 13, color: result.ok ? '#22c55e' : '#ef4444' }}>
                {result.ok ? '✓' : '✕'} {result.msg}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <NotificationPreferencesCard />

      {/* Email Templates */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Email Templates</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Use <code style={{ background: 'rgba(99,102,241,.12)', padding: '1px 5px', borderRadius: 4 }}>{'{{variable}}'}</code> placeholders
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: 16 }}>
          {/* Template list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTplId(t.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid ' + (selectedTplId === t.id ? '#6366f1' : 'var(--border)'),
                  background: selectedTplId === t.id ? 'rgba(99,102,241,.08)' : 'transparent',
                  color: 'var(--text)',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, marginTop: 2 }}>{t.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Editor */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Subject</label>
              <input
                type="text"
                value={selectedTpl.subject}
                onChange={e => updateTpl({ subject: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Body</label>
              <textarea
                value={selectedTpl.body}
                onChange={e => updateTpl({ body: e.target.value })}
                rows={12}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.55, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedTpl.variables.map(v => (
                  <button
                    key={v}
                    onClick={() => {
                      const ta = document.activeElement as HTMLTextAreaElement | HTMLInputElement | null;
                      const token = `{{${v}}}`;
                      if (ta && (ta.tagName === 'TEXTAREA' || ta.tagName === 'INPUT')) {
                        const start = ta.selectionStart ?? ta.value.length;
                        const end = ta.selectionEnd ?? ta.value.length;
                        const newVal = ta.value.slice(0, start) + token + ta.value.slice(end);
                        if (ta.tagName === 'TEXTAREA') updateTpl({ body: newVal });
                        else updateTpl({ subject: newVal });
                      } else {
                        updateTpl({ body: selectedTpl.body + token });
                      }
                    }}
                    style={{
                      fontSize: 11, padding: '3px 8px', borderRadius: 12,
                      border: '1px solid var(--border)', background: 'rgba(99,102,241,.08)',
                      color: 'var(--text)', cursor: 'pointer', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    }}
                    title={`Insert {{${v}}}`}
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {tplSaved && <span style={{ fontSize: 12, color: '#22c55e' }}>✓ Saved</span>}
                <button
                  onClick={resetTpl}
                  style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                >
                  Reset to default
                </button>
              </div>
            </div>

            {/* Preview */}
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}>Preview with sample values</summary>
              <div style={{ marginTop: 10, padding: 14, background: 'rgba(99,102,241,.05)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{renderPreview(selectedTpl.subject, selectedTpl.variables)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Body</div>
                <pre style={{ margin: 0, fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {renderPreview(selectedTpl.body, selectedTpl.variables)}
                </pre>
              </div>
            </details>

            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
              Templates are saved in your browser. Backend will use these once the email-templates API is wired (changes persist locally for now).
            </p>
          </div>
        </div>
      </div>

      {/* Automated notifications */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Automated Notifications</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { icon: '⏰', title: 'Reagent Expiry Alerts', desc: 'Daily 08:00 — emails lab staff when reagents expire within 30 days', status: 'active' },
            { icon: '🔧', title: 'CAPA Assignment', desc: 'Triggered — emails assignee when a new CAPA record is created', status: 'active' },
            { icon: '🌡️', title: 'IoT Sensor Alerts', desc: 'Real-time — emails when sensors breach thresholds', status: 'active' },
            { icon: '📅', title: 'Task Reminders', desc: 'Scheduled — emails users before task due dates', status: 'active' },
            { icon: '🙋', title: 'Welcome Emails', desc: 'Triggered — sent when admins create new user accounts', status: 'active' },
          ].map(({ icon, title, desc, status: s }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44',
              }}>Active</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
          When SMTP is not configured, notifications are logged to the server console instead of delivered.
        </p>
      </div>
    </div>
  );
}

// ─── Notification Preferences ────────────────────────────────────────────────
interface ChannelPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
}
interface EventPrefs {
  reagentExpiry: ChannelPrefs;
  taskReminder: ChannelPrefs;
  iotAlert: ChannelPrefs;
  experimentDue: ChannelPrefs;
  inventoryLow: ChannelPrefs;
  capaAssigned: ChannelPrefs;
}

const PREFS_KEY = 'labos_notification_prefs';
const PHONE_KEY = 'labos_notification_phone';

const DEFAULT_EVENT_PREFS: EventPrefs = {
  reagentExpiry: { email: true,  sms: false, push: true,  inApp: true },
  taskReminder:  { email: true,  sms: false, push: true,  inApp: true },
  iotAlert:      { email: true,  sms: true,  push: true,  inApp: true },
  experimentDue: { email: true,  sms: false, push: false, inApp: true },
  inventoryLow:  { email: true,  sms: false, push: false, inApp: true },
  capaAssigned:  { email: true,  sms: false, push: true,  inApp: true },
};

const EVENT_META: Record<keyof EventPrefs, { label: string; icon: string; description: string }> = {
  reagentExpiry: { label: 'Reagent expiry',   icon: '⏰', description: 'Reagents expiring within 30 days' },
  taskReminder:  { label: 'Task reminders',   icon: '✓', description: 'Before a task is due' },
  iotAlert:      { label: 'IoT sensor alert', icon: '🌡️', description: 'Critical / warning thresholds (SMS recommended)' },
  experimentDue: { label: 'Experiment due',   icon: '🧪', description: 'Scheduled experiment checkpoints' },
  inventoryLow:  { label: 'Low inventory',    icon: '📦', description: 'Items below reorder threshold' },
  capaAssigned:  { label: 'CAPA assigned',    icon: '🔧', description: 'New corrective action assigned to you' },
};

function NotificationPreferencesCard() {
  const [prefs, setPrefs] = useState<EventPrefs>(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) return { ...DEFAULT_EVENT_PREFS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_EVENT_PREFS;
  });
  const [phone, setPhone] = useState<string>(() => localStorage.getItem(PHONE_KEY) || '');
  const [saved, setSaved] = useState(false);
  const [smsConfigured] = useState(false); // Backend env-driven; defaults to false until Twilio creds set

  const updateChannel = (event: keyof EventPrefs, channel: keyof ChannelPrefs, value: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, [event]: { ...prev[event], [channel]: value } };
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
      return next;
    });
  };

  const savePhone = (val: string) => {
    setPhone(val);
    try { localStorage.setItem(PHONE_KEY, val); } catch {}
  };

  return (
    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16 }}>Notification Preferences</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Choose how you want to be alerted for each event type — email, SMS, push, or in-app
          </p>
        </div>
        {saved && <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* Phone number */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Phone number (for SMS alerts)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={e => savePhone(e.target.value)}
            placeholder="+1 555 123 4567"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text)', fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>SMS gateway</label>
          <div style={{
            padding: '8px 12px', borderRadius: 6,
            background: smsConfigured ? 'rgba(34,197,94,0.08)' : 'rgba(234,179,8,0.08)',
            border: '1px solid ' + (smsConfigured ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'),
            fontSize: 12, color: smsConfigured ? '#22c55e' : '#fbbf24', fontWeight: 600,
          }}>
            {smsConfigured ? '● Twilio connected' : '○ Not configured — set TWILIO_SID / TWILIO_TOKEN in backend/.env'}
          </div>
        </div>
      </div>

      {/* Event matrix */}
      <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2, rgba(0,0,0,0.04))' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Event</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📧 Email</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>📱 SMS</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔔 Push</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>🛎️ In-app</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(EVENT_META) as Array<keyof EventPrefs>).map((evt, i) => {
              const meta = EVENT_META[evt];
              const p = prefs[evt];
              return (
                <tr key={evt} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{meta.description}</div>
                      </div>
                    </div>
                  </td>
                  {(['email', 'sms', 'push', 'inApp'] as Array<keyof ChannelPrefs>).map(channel => (
                    <td key={channel} style={{ textAlign: 'center', padding: '12px 8px' }}>
                      <input
                        type="checkbox"
                        checked={p[channel]}
                        onChange={e => updateChannel(evt, channel, e.target.checked)}
                        disabled={channel === 'sms' && (!phone || !smsConfigured)}
                        style={{ cursor: channel === 'sms' && (!phone || !smsConfigured) ? 'not-allowed' : 'pointer', width: 18, height: 18 }}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, padding: 12, background: 'rgba(99,102,241,0.06)', borderRadius: 8, fontSize: 12, lineHeight: 1.55 }}>
        <strong>Recommended setup</strong> — turn on SMS for <em>IoT sensor alerts</em> only. Email for everything else.
        That way you'll get woken up for a freezer failure, but not for a routine task reminder.
      </div>
    </div>
  );
}
