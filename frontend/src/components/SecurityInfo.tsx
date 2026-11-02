import { useEffect } from 'react';

const POINTS: Array<[string, string]> = [
  ['Encrypted connection', 'Everything between your browser and LabOS uses HTTPS. The site tells browsers to refuse plain HTTP.'],
  ['Passwords', 'Stored as bcrypt hashes, never in readable form. New passwords need 12+ characters.'],
  ['Two-factor sign-in', 'Authenticator-app codes, with one-time recovery codes. Labs can require it for managers, PIs and admins.'],
  ['Guessing is slowed', 'Sign-in attempts are rate-limited, and five wrong passwords or codes lock the account for 30 minutes.'],
  ['Sessions', 'Sign-ins last 8 hours. You can see and end every signed-in device from Security & Privacy.'],
  ['Separate labs', 'Each lab’s records are kept apart on the server, and your role is checked on every request.'],
  ['Payments', 'LabOS never stores card numbers. Cards are handled by Stripe.'],
  ['Your choices', 'Once signed in you can download your data, withdraw consent and ask for erasure.'],
];

/** Plain-language security summary, shown from the sign-in page. Same facts as Security & Privacy → How we protect data. */
export function SecurityInfo({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label="How your data is protected" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', color: '#15192d', borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>How your data is protected</h2>
        {POINTS.map(([t, d]) => <p key={t} style={{ margin: '0 0 10px', fontSize: 14, lineHeight: 1.5 }}><strong>{t}.</strong> {d}</p>)}
        <p style={{ margin: '12px 0', fontSize: 12, color: '#5b6176' }}>LabOS is not independently certified (for example SOC 2 or HIPAA). Your institution stays responsible for how it uses the system.</p>
        <button type="button" className="auth-btn" onClick={onClose} autoFocus>Close</button>
      </div>
    </div>
  );
}
