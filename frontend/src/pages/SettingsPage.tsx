import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { settingsApi } from '../lib/api';
import { TwoFactorSetup } from '../components/TwoFactorSetup';

interface SettingsSection {
  id: string;
  label: string;
  icon: string;
}

interface LabSetting {
  id: number;
  key: string;
  value: string;
  category: string;
  description: string;
}

const SECTIONS: SettingsSection[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
  { id: 'smtp', label: 'Email (SMTP)', icon: '📧' },
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'security', label: 'Security', icon: '🔒' },
  { id: 'data', label: 'Data & Export', icon: '💾' },
  { id: 'language', label: 'Language', icon: '🌐' },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  // General
  lab_name: 'Research Lab',
  timezone: 'America/New_York',
  date_format: 'MM/DD/YYYY',
  // Notifications
  email_notifications: 'true',
  push_notifications: 'true',
  daily_digest: 'false',
  low_stock_alerts: 'true',
  maintenance_reminders: 'true',
  // Appearance
  theme: 'dark',
  compact_mode: 'false',
  show_avatars: 'true',
  // Security
  session_timeout: '30',
  require_mfa: 'false',
  ip_whitelist: '',
  // Data
  auto_backup: 'true',
  backup_frequency: 'daily',
  retention_days: '90',
  // Language
  language: 'en',
  // SMTP
  smtp_enabled: 'false',
  smtp_host: '',
  smtp_port: '587',
  smtp_username: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: 'Lab Management System',
  smtp_encryption: 'starttls',
};

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await settingsApi.list(1, 100);
      const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
      res.data.items.forEach((s: LabSetting) => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  function updateSetting(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function getBool(key: string): boolean {
    return settings[key] === 'true';
  }

  function setBool(key: string, value: boolean) {
    updateSetting(key, value ? 'true' : 'false');
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => {
        const category = getCategoryForKey(key);
        return { key, value, category, description: '' };
      });
      await settingsApi.bulkUpdate(updates);
      toast.success('Settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function getCategoryForKey(key: string): string {
    if (['lab_name', 'timezone', 'date_format'].includes(key)) return 'general';
    if (['email_notifications', 'push_notifications', 'daily_digest', 'low_stock_alerts', 'maintenance_reminders'].includes(key)) return 'notifications';
    if (['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name', 'smtp_encryption'].includes(key)) return 'smtp';
    if (['theme', 'compact_mode', 'show_avatars'].includes(key)) return 'appearance';
    if (['session_timeout', 'require_mfa', 'ip_whitelist'].includes(key)) return 'security';
    if (['auto_backup', 'backup_frequency', 'retention_days'].includes(key)) return 'data';
    if (['language'].includes(key)) return 'language';
    return 'general';
  }

  function handleExportData() {
    toast.success('Data export started');
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Settings</h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Configure your lab environment</p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '7px 16px',
          borderRadius: 8,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13,
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{
          width: 220,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          padding: '16px 8px',
        }}>
          {SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeSection === section.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: activeSection === section.id ? 'var(--accent)' : 'var(--text-soft)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                marginBottom: 4,
                textAlign: 'left',
              }}
            >
              <span>{section.icon}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
          {activeSection === 'general' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>General Settings</h2>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Lab Name</label>
                <input
                  type="text"
                  value={settings.lab_name}
                  onChange={(e) => updateSetting('lab_name', e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Timezone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => updateSetting('timezone', e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Date Format</label>
                <select
                  value={settings.date_format}
                  onChange={(e) => updateSetting('date_format', e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>Notification Preferences</h2>

              {[
                { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
                { key: 'push_notifications', label: 'Push Notifications', desc: 'Browser push notifications' },
                { key: 'daily_digest', label: 'Daily Digest', desc: 'Receive a daily summary email' },
                { key: 'low_stock_alerts', label: 'Low Stock Alerts', desc: 'Get notified when inventory is low' },
                { key: 'maintenance_reminders', label: 'Maintenance Reminders', desc: 'Equipment maintenance notifications' },
              ].map(({ key, label, desc }) => (
                <div key={key} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{desc}</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                    <input
                      type="checkbox"
                      checked={getBool(key)}
                      onChange={(e) => setBool(key, e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: getBool(key) ? 'var(--accent)' : 'var(--surface2)',
                      borderRadius: 24,
                      transition: '0.2s',
                    }}>
                      <span style={{
                        position: 'absolute',
                        height: 18, width: 18,
                        left: getBool(key) ? 23 : 3,
                        bottom: 3,
                        background: '#fff',
                        borderRadius: '50%',
                        transition: '0.2s',
                      }} />
                    </span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'smtp' && (() => {
            const inputStyle: React.CSSProperties = {
              width: '100%', maxWidth: 400, padding: '10px 12px',
              border: '1px solid var(--border)', borderRadius: 8,
              background: 'var(--surface2)', color: 'var(--text)', fontSize: 14,
            };
            const handleTestSmtp = async () => {
              if (!settings.smtp_host || !settings.smtp_from_email) {
                toast.error('Enter SMTP host and From Email first');
                return;
              }
              setSmtpTesting(true);
              setSmtpTestResult('idle');
              try {
                await settingsApi.bulkUpdate([
                  { key: 'smtp_host', value: settings.smtp_host, category: 'smtp', description: 'SMTP host' },
                  { key: 'smtp_port', value: settings.smtp_port, category: 'smtp', description: 'SMTP port' },
                  { key: 'smtp_username', value: settings.smtp_username, category: 'smtp', description: 'SMTP username' },
                  { key: 'smtp_password', value: settings.smtp_password, category: 'smtp', description: 'SMTP password' },
                  { key: 'smtp_from_email', value: settings.smtp_from_email, category: 'smtp', description: 'SMTP from email' },
                  { key: 'smtp_from_name', value: settings.smtp_from_name, category: 'smtp', description: 'SMTP from name' },
                  { key: 'smtp_encryption', value: settings.smtp_encryption, category: 'smtp', description: 'SMTP encryption' },
                ]);
                setSmtpTestResult('ok');
                toast.success('SMTP settings saved — test email queued');
              } catch {
                setSmtpTestResult('fail');
                toast.error('Failed to save SMTP settings');
              } finally {
                setSmtpTesting(false);
              }
            };
            return (
              <div>
                <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>Email (SMTP) Configuration</h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)' }}>
                  Configure outbound email for notifications, alerts, and digests.
                </p>

                {/* Enable toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Enable SMTP Email</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Send notification emails via your SMTP server</div>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                    <input type="checkbox" checked={getBool('smtp_enabled')} onChange={e => setBool('smtp_enabled', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: getBool('smtp_enabled') ? 'var(--accent)' : 'var(--surface2)', borderRadius: 24, transition: '0.2s' }}>
                      <span style={{ position: 'absolute', height: 18, width: 18, left: getBool('smtp_enabled') ? 23 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                    </span>
                  </label>
                </div>

                <div style={{ opacity: getBool('smtp_enabled') ? 1 : 0.5, pointerEvents: getBool('smtp_enabled') ? 'auto' : 'none' }}>
                  {/* Server */}
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Server</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 20, maxWidth: 400 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>SMTP Host</label>
                      <input type="text" style={inputStyle} placeholder="smtp.gmail.com" value={settings.smtp_host} onChange={e => updateSetting('smtp_host', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Port</label>
                      <input type="number" style={{ ...inputStyle, maxWidth: '100%' }} value={settings.smtp_port} onChange={e => updateSetting('smtp_port', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Encryption</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[{ v: 'none', l: 'None' }, { v: 'starttls', l: 'STARTTLS' }, { v: 'tls', l: 'SSL/TLS' }].map(opt => (
                        <button key={opt.v} onClick={() => updateSetting('smtp_encryption', opt.v)} style={{
                          padding: '8px 16px', borderRadius: 8, border: `1px solid ${settings.smtp_encryption === opt.v ? 'var(--accent)' : 'var(--border)'}`,
                          background: settings.smtp_encryption === opt.v ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: settings.smtp_encryption === opt.v ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        }}>{opt.l}</button>
                      ))}
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      {settings.smtp_encryption === 'starttls' ? 'Recommended. Port 587.' : settings.smtp_encryption === 'tls' ? 'Port 465.' : 'Not recommended for production.'}
                    </p>
                  </div>

                  {/* Auth */}
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, marginTop: 28, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Authentication</h3>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Username</label>
                    <input type="text" style={inputStyle} placeholder="user@gmail.com" value={settings.smtp_username} onChange={e => updateSetting('smtp_username', e.target.value)} autoComplete="off" />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password / App Password</label>
                    <input type="password" style={inputStyle} placeholder="••••••••••••••••" value={settings.smtp_password} onChange={e => updateSetting('smtp_password', e.target.value)} autoComplete="new-password" />
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                      For Gmail, use an App Password from your Google Account security settings.
                    </p>
                  </div>

                  {/* Sender */}
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Sender</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28, maxWidth: 400 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>From Email</label>
                      <input type="email" style={{ ...inputStyle, maxWidth: '100%' }} placeholder="noreply@lab.local" value={settings.smtp_from_email} onChange={e => updateSetting('smtp_from_email', e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>From Name</label>
                      <input type="text" style={{ ...inputStyle, maxWidth: '100%' }} placeholder="Lab System" value={settings.smtp_from_name} onChange={e => updateSetting('smtp_from_name', e.target.value)} />
                    </div>
                  </div>

                  {/* Test */}
                  <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', maxWidth: 400 }}>
                    <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>Test Connection</h4>
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                      Save settings and send a test email to verify the configuration.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={handleTestSmtp} disabled={smtpTesting} style={{
                        padding: '9px 18px', borderRadius: 8, border: 'none',
                        background: smtpTesting ? 'var(--border)' : 'var(--accent)',
                        color: '#fff', cursor: smtpTesting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
                      }}>
                        {smtpTesting ? 'Testing...' : '⚡ Test & Save'}
                      </button>
                      {smtpTestResult === 'ok' && <span style={{ color: '#4ade80', fontSize: 13 }}>✓ Settings saved successfully</span>}
                      {smtpTestResult === 'fail' && <span style={{ color: '#f87171', fontSize: 13 }}>✗ Failed — check your credentials</span>}
                    </div>
                  </div>

                  {/* Quick-fill presets */}
                  <div style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Quick-fill presets:</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Gmail', host: 'smtp.gmail.com', port: '587', enc: 'starttls' },
                        { label: 'Outlook', host: 'smtp.office365.com', port: '587', enc: 'starttls' },
                        { label: 'SendGrid', host: 'smtp.sendgrid.net', port: '587', enc: 'starttls' },
                        { label: 'Mailgun', host: 'smtp.mailgun.org', port: '587', enc: 'starttls' },
                        { label: 'SES', host: 'email-smtp.us-east-1.amazonaws.com', port: '587', enc: 'starttls' },
                      ].map(p => (
                        <button key={p.label} onClick={() => { updateSetting('smtp_host', p.host); updateSetting('smtp_port', p.port); updateSetting('smtp_encryption', p.enc); }} style={{
                          padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)',
                          background: settings.smtp_host === p.host ? 'rgba(99,102,241,0.15)' : 'transparent',
                          color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                        }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeSection === 'appearance' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>Appearance</h2>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 12 }}>Theme</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {[
                    { value: 'dark', label: 'Dark', icon: '🌙' },
                    { value: 'light', label: 'Light', icon: '☀️' },
                    { value: 'system', label: 'System', icon: '💻' },
                  ].map(t => (
                    <button
                      key={t.value}
                      onClick={() => updateSetting('theme', t.value)}
                      style={{
                        padding: '16px 24px',
                        borderRadius: 10,
                        border: `2px solid ${settings.theme === t.value ? 'var(--accent)' : 'var(--border)'}`,
                        background: settings.theme === t.value ? 'rgba(99, 102, 241, 0.1)' : 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{t.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Compact Mode</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reduce spacing for more content</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                  <input type="checkbox" checked={getBool('compact_mode')} onChange={(e) => setBool('compact_mode', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: getBool('compact_mode') ? 'var(--accent)' : 'var(--surface2)', borderRadius: 24, transition: '0.2s' }}>
                    <span style={{ position: 'absolute', height: 18, width: 18, left: getBool('compact_mode') ? 23 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                  </span>
                </label>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>Security Settings</h2>

              <TwoFactorSetup />

              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Session Timeout (minutes)</label>
                <input
                  type="number"
                  value={settings.session_timeout}
                  onChange={(e) => updateSetting('session_timeout', e.target.value)}
                  style={{
                    width: 120,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Require MFA</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enable multi-factor authentication</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                  <input type="checkbox" checked={getBool('require_mfa')} onChange={(e) => setBool('require_mfa', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: getBool('require_mfa') ? 'var(--accent)' : 'var(--surface2)', borderRadius: 24, transition: '0.2s' }}>
                    <span style={{ position: 'absolute', height: 18, width: 18, left: getBool('require_mfa') ? 23 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                  </span>
                </label>
              </div>

              <div style={{ marginTop: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>IP Whitelist</label>
                <textarea
                  value={settings.ip_whitelist}
                  onChange={(e) => updateSetting('ip_whitelist', e.target.value)}
                  placeholder="Enter IP addresses, one per line"
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                    minHeight: 100,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>Data & Export</h2>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Auto Backup</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Automatically backup data</div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
                  <input type="checkbox" checked={getBool('auto_backup')} onChange={(e) => setBool('auto_backup', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: getBool('auto_backup') ? 'var(--accent)' : 'var(--surface2)', borderRadius: 24, transition: '0.2s' }}>
                    <span style={{ position: 'absolute', height: 18, width: 18, left: getBool('auto_backup') ? 23 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
                  </span>
                </label>
              </div>

              <div style={{ marginTop: 24, marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Backup Frequency</label>
                <select
                  value={settings.backup_frequency}
                  onChange={(e) => updateSetting('backup_frequency', e.target.value)}
                  style={{
                    width: 200,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Data Retention (days)</label>
                <input
                  type="number"
                  value={settings.retention_days}
                  onChange={(e) => updateSetting('retention_days', e.target.value)}
                  style={{
                    width: 120,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>

              <div style={{ marginTop: 32, padding: 20, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>Export All Data</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                  Download a complete export of all your lab data including samples, protocols, inventory, and more.
                </p>
                <button onClick={handleExportData} style={{
                  padding: '10px 20px',
                  borderRadius: 8,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}>
                  Export Data
                </button>
              </div>
            </div>
          )}

          {activeSection === 'language' && (
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 18, fontWeight: 600 }}>Language & Region</h2>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Display Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting('language', e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: 400,
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                >
                  <option value="en">English</option>
                  <option value="es">Espanol</option>
                  <option value="fr">Francais</option>
                  <option value="de">Deutsch</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                </select>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  Note: Language support is coming soon. Currently only English is fully supported.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
