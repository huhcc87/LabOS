import { useState, useEffect } from 'react';

const STORAGE_KEY = 'labos_cookie_consent';
const CONSENT_VERSION = '1.0';

interface ConsentChoices {
  essential: true;
  analytics: boolean;
  version: string;
  timestamp: string;
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) { setVisible(true); return; }
      const parsed: ConsentChoices = JSON.parse(saved);
      if (parsed.version !== CONSENT_VERSION) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const save = (choices: Omit<ConsentChoices, 'essential' | 'version' | 'timestamp'>) => {
    const record: ConsentChoices = {
      essential: true,
      analytics: choices.analytics,
      version: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9990,
      background: 'var(--surface, #1a2940)',
      borderTop: '1px solid var(--border, #2a3f5f)',
      padding: '16px 20px',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
      animation: 'slideUp 0.3s ease-out',
    }}>
      <style>{`@keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }`}</style>

      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {!showDetails ? (
          /* Compact banner */
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>🍪</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span style={{ fontSize: 14, color: 'var(--text, #e8eef4)' }}>
                LabOS uses essential session cookies for authentication and optional analytics
                to improve the system. See our{' '}
                <button
                  onClick={() => setShowDetails(true)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontSize: 14, textDecoration: 'underline' }}
                >
                  cookie preferences
                </button>
                .
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => save({ analytics: false })}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border, #2a3f5f)',
                  background: 'transparent', color: 'var(--text-muted, #8fa3b8)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                Essential only
              </button>
              <button
                onClick={() => save({ analytics: true })}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: '#6366f1', color: '#fff',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                }}
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          /* Detailed preferences */
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text, #e8eef4)' }}>
                🍪 Cookie Preferences
              </h3>
              <button onClick={() => setShowDetails(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20,
              }}>×</button>
            </div>

            {/* Essential cookies — always on */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '12px 14px', background: 'var(--surface2, #0d1b2a)', borderRadius: 10, marginBottom: 8,
            }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Essential Cookies</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8fa3b8)', lineHeight: 1.5 }}>
                  Required for authentication (JWT session token), CSRF protection, and security features.
                  Cannot be disabled.
                </div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.15)',
                color: '#4ade80', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>Always on</span>
            </div>

            {/* Analytics — toggleable */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              padding: '12px 14px', background: 'var(--surface2, #0d1b2a)', borderRadius: 10, marginBottom: 16,
            }}>
              <div style={{ flex: 1, paddingRight: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Analytics Cookies</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8fa3b8)', lineHeight: 1.5 }}>
                  Anonymised usage data (page visits, feature usage) to improve LabOS. No personal identifiers stored.
                </div>
              </div>
              <button
                onClick={() => setAnalytics(v => !v)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: analytics ? '#6366f1' : 'var(--border, #2a3f5f)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
                aria-label={analytics ? 'Disable analytics' : 'Enable analytics'}
              >
                <span style={{
                  position: 'absolute', top: 3, left: analytics ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => save({ analytics })}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none',
                  background: '#6366f1', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                Save preferences
              </button>
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted, #8fa3b8)', textAlign: 'center' }}>
              Your choices are stored locally and can be updated anytime in Settings → Privacy Center.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
