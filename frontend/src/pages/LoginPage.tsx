import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ConvexError } from 'convex/values';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { AuthBrand } from '../components/AuthBrand';
import { SecurityInfo } from '../components/SecurityInfo';
import '../styles/auth.css';

function errorMessage(err: unknown): string {
  if (err instanceof ConvexError && typeof err.data === 'string') return err.data;
  return err instanceof Error ? err.message : '';
}

interface LoginForm {
  email: string;
  password: string;
  remember: boolean;
}

interface Props {
  onCreateAccount: () => void;
}

export default function LoginPage({ onCreateAccount }: Props) {
  const { login, totpRequired, clearTotpRequired } = useAuth();
  const requestReset = useAction(api.invites.requestReset);
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [showSecurity, setShowSecurity] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetResult, setResetResult] = useState<'sent' | 'no-email' | null>(null);
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: '', password: '', remember: true },
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      await login(data.email.trim(), data.password, undefined, data.remember);
    } catch (err) {
      const msg = errorMessage(err);
      if (msg.includes('Invalid email') || msg.includes('password')) toast.error('Invalid email or password.');
      else if (msg.includes('disabled')) toast.error('This account has been disabled. Contact your PI or administrator.');
      else toast.error(msg || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onTotpSubmit() {
    if (!totpRequired || totpCode.trim().length < 6) return;
    setLoading(true);
    try {
      await login(totpRequired.email, totpRequired.password, totpCode, totpRequired.remember);
    } catch (err) {
      const msg = errorMessage(err);
      toast.error(msg.includes('two-factor') ? 'Invalid verification code. Please try again.' : msg || 'Sign in failed.');
    } finally {
      setLoading(false);
      setTotpCode('');
    }
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setLoading(true);
    try {
      const { emailEnabled } = await requestReset({ email: resetEmail });
      setResetResult(emailEnabled ? 'sent' : 'no-email');
    } catch (err) {
      toast.error(errorMessage(err) || 'Could not send the reset link. Try again shortly.');
    } finally {
      setLoading(false);
    }
  }

  const openForgot = () => {
    setResetEmail(getValues('email'));
    setResetResult(null);
    setView('forgot');
  };

  return (
    <main className="auth">
      <AuthBrand />
      <div className="auth-card">
        {totpRequired ? (
          <>
            <h1 className="auth-title">Verification code</h1>
            <p className="auth-sub">Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
            <div className="auth-field">
              <label className="auth-label" htmlFor="totp">Code</label>
              <input
                id="totp" className="auth-input code" value={totpCode} autoFocus maxLength={12}
                autoComplete="one-time-code" placeholder="000000" autoCapitalize="characters" spellCheck={false}
                onChange={e => setTotpCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 12))}
                onKeyDown={e => { if (e.key === 'Enter') onTotpSubmit(); }}
              />
            </div>
            <button type="button" className="auth-btn" disabled={loading || totpCode.trim().length < 6} onClick={onTotpSubmit}>
              {loading ? <><span className="auth-spinner" />Verifying…</> : 'Verify and sign in'}
            </button>
            <p className="auth-foot">
              <button type="button" className="auth-link" onClick={() => { clearTotpRequired(); setTotpCode(''); }}>Back to sign in</button>
            </p>
          </>
        ) : view === 'forgot' ? (
          <>
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-sub">Enter your account email and we'll send you a link to choose a new password.</p>
            {resetResult === 'sent' && (
              <p className="auth-note" role="status">
                If an account exists for <strong>{resetEmail.trim()}</strong>, a reset link is on its way. It expires in 1 hour — check your spam folder too.
              </p>
            )}
            {resetResult === 'no-email' && (
              <p className="auth-note warn" role="status">
                Email isn't set up for this lab yet. Ask your PI or administrator to reset your password from Admin → Users.
              </p>
            )}
            <form onSubmit={onResetSubmit} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="reset-email">Email</label>
                <input id="reset-email" className="auth-input" type="email" autoComplete="email" required autoFocus
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button type="submit" className="auth-btn" disabled={loading || !resetEmail.trim()}>
                {loading ? <><span className="auth-spinner" />Sending…</> : 'Send reset link'}
              </button>
            </form>
            <p className="auth-foot">
              <button type="button" className="auth-link" onClick={() => setView('login')}>Back to sign in</button>
            </p>
          </>
        ) : (
          <>
            <h1 className="auth-title">Sign in</h1>
            <p className="auth-sub">Use the email your lab registered for you — any provider, including Gmail.</p>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div className="auth-field">
                <label className="auth-label" htmlFor="email">Email</label>
                <input
                  id="email" type="email" className="auth-input" autoComplete="email" placeholder="you@example.com"
                  aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined}
                  {...register('email', { required: 'Enter your email' })}
                />
                {errors.email && <span id="email-err" className="auth-error">{errors.email.message}</span>}
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="password">Password</label>
                <div className="auth-input-wrap">
                  <input
                    id="password" type={showPassword ? 'text' : 'password'} className="auth-input"
                    autoComplete="current-password" style={{ paddingRight: 56 }}
                    aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined}
                    {...register('password', { required: 'Enter your password' })}
                  />
                  <button type="button" className="auth-reveal" onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {errors.password && <span id="password-err" className="auth-error">{errors.password.message}</span>}
              </div>
              <div className="auth-row">
                <label className="auth-check">
                  <input type="checkbox" {...register('remember')} /> Remember me
                </label>
                <button type="button" className="auth-link" onClick={openForgot}>Forgot password?</button>
              </div>
              <button type="submit" className="auth-btn" disabled={loading}>
                {loading ? <><span className="auth-spinner" />Signing in…</> : 'Login'}
              </button>
            </form>
            <p className="auth-foot">
              Don't have an account?{' '}
              <button type="button" className="auth-link" onClick={onCreateAccount}>Sign up</button>
            </p>

          </>
        )}
      </div>
      <p className="auth-legal">Encrypted connection · <button type="button" className="auth-link" onClick={() => setShowSecurity(true)}>How your data is protected</button></p>
      {showSecurity && <SecurityInfo onClose={() => setShowSecurity(false)} />}
    </main>
  );
}
