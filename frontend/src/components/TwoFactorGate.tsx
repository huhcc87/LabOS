import { Component, type ReactNode } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { TwoFactorSetup } from './TwoFactorSetup';

/** Shown instead of the app when the lab requires two-factor and this person has not set it up yet. */
function Setup({ onLogout }: { onLogout: () => void }) {
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

function Check({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  // Skipped until signed in. security.status answers null (never throws) for a dead session.
  const security = useQuery(api.security.status, user && token ? { token } : 'skip');
  return security?.must_setup_2fa ? <Setup onLogout={logout} /> : <>{children}</>;
}

/** If the check itself fails (for example the server is a version behind), the app carries on without it. */
class Isolate extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/** Wrap the signed-in app. The server still refuses requests from someone who must set up two-factor. */
export function TwoFactorGate({ children }: { children: ReactNode }) {
  return <Isolate><Check>{children}</Check></Isolate>;
}
