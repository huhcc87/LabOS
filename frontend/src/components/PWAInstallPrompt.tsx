import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Dismissed before — don't show again for 7 days
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    if (ios) {
      // Show iOS guide after 3s on first visit
      setTimeout(() => setShow(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 2000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setShow(false); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  const install = async () => {
    if (isIOS) { setShowIOSGuide(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setInstalled(true); setShow(false); }
    else dismiss();
    setDeferredPrompt(null);
  };

  if (installed || !show) return null;

  return (
    <>
      {/* Install banner */}
      <div style={{
        position: 'fixed', bottom: 80, left: 12, right: 12, zIndex: 9998,
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        borderRadius: 16, padding: '14px 16px',
        boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        display: 'flex', alignItems: 'center', gap: 12,
        animation: 'slideUp 0.35s cubic-bezier(.16,1,.3,1)',
        maxWidth: 480, margin: '0 auto',
      }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>🧬</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Install LabOS</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
            {isIOS ? 'Add to Home Screen for the full app experience' : 'Install for offline access & faster loading'}
          </div>
        </div>
        <button onClick={install} style={{
          padding: '8px 16px', borderRadius: 10, border: 'none',
          background: '#fff', color: '#4f46e5', fontWeight: 700,
          fontSize: 13, cursor: 'pointer', flexShrink: 0,
        }}>
          {isIOS ? 'How?' : 'Install'}
        </button>
        <button onClick={dismiss} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)',
          fontSize: 20, cursor: 'pointer', padding: 4, flexShrink: 0, lineHeight: 1,
        }}>×</button>
      </div>

      {/* iOS step-by-step guide */}
      {showIOSGuide && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end',
        }} onClick={() => setShowIOSGuide(false)}>
          <div style={{
            background: 'var(--surface, #1a2940)', borderRadius: '20px 20px 0 0',
            padding: 24, width: '100%', maxWidth: 480, margin: '0 auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text, #fff)' }}>
              📱 Add LabOS to Home Screen
            </div>
            {[
              { icon: '1️⃣', text: 'Tap the Share button (□↑) in Safari\'s bottom toolbar' },
              { icon: '2️⃣', text: 'Scroll down and tap "Add to Home Screen"' },
              { icon: '3️⃣', text: 'Tap "Add" in the top-right corner' },
            ].map(s => (
              <div key={s.icon} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
                <span style={{ fontSize: 14, color: 'var(--text-muted, #8fa3b8)', lineHeight: 1.5 }}>{s.text}</span>
              </div>
            ))}
            <button onClick={() => setShowIOSGuide(false)} style={{
              width: '100%', padding: '12px', borderRadius: 12, border: 'none',
              background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              marginTop: 8,
            }}>Got it</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
