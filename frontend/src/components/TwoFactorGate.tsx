import { TwoFactorSetup } from './TwoFactorSetup';

/** Shown instead of the app when the lab requires two-factor and this person has not set it up yet. */
export function TwoFactorGate({ onLogout }: { onLogout: () => void }) {
  return (
    <main style={{ maxWidth: 520, margin: '8vh auto', padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>Set up two-factor sign-in</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 }}>
        Your lab requires two-factor sign-in for your role. Scan the code with an authenticator app, enter the 6-digit code, and you can carry on.
        Afterwards, open Security &amp; Privacy to create recovery codes in case you lose your phone.
      </p>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}><TwoFactorSetup /></div>
      <button type="button" className="btn btn-secondary" onClick={onLogout}>Sign out</button>
    </main>
  );
}
