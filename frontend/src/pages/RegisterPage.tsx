import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ConvexError } from 'convex/values';
import { useAuth } from '../context/AuthContext';

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
}

interface Props {
  onBackToLogin: () => void;
}

export default function RegisterPage({ onBackToLogin }: Props) {
  const { register: registerAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterForm>();

  async function onSubmit(data: RegisterForm) {
    setLoading(true);
    try {
      await registerAccount(data.email, data.password, data.full_name);
      toast.success('Welcome to LabOS v3!');
    } catch (err) {
      const msg = err instanceof ConvexError && typeof err.data === 'string' ? err.data : 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-top-stripe" />
      <div className="login-split">
        <div className="login-panel-left">
          <div className="login-left-inner">
            <div className="login-brand-row">
              <div className="login-logo-box">⬡</div>
              <div>
                <div className="login-brand-name">LabOS <span className="login-brand-v">v3</span></div>
                <div className="login-brand-sub">Laboratory Operations System</div>
              </div>
            </div>
            <h1 className="login-left-headline">Join your lab's workspace</h1>
            <p className="login-left-desc">
              Create your account to access protocols, samples, instruments, grants, and
              safety records — all in one secure platform.
            </p>
          </div>
        </div>

        <div className="login-panel-right">
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-secure-badge">
                <span>🔒</span> Secure Sign Up
              </div>
              <h2 className="login-form-title">Create your account</h2>
              <p className="login-form-subtitle">Sign up for LabOS to get started</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
              <div className="lf-group">
                <label className="lf-label">Full Name</label>
                <div className="lf-input-wrap">
                  <span className="lf-icon">👤</span>
                  <input
                    className={`lf-input ${errors.full_name ? 'lf-input-error' : ''}`}
                    {...register('full_name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
                    placeholder="Jane Doe"
                    autoComplete="name"
                  />
                </div>
                {errors.full_name && <span className="lf-error">{errors.full_name.message}</span>}
              </div>

              <div className="lf-group">
                <label className="lf-label">Email Address</label>
                <div className="lf-input-wrap">
                  <span className="lf-icon">✉</span>
                  <input
                    type="email"
                    className={`lf-input ${errors.email ? 'lf-input-error' : ''}`}
                    {...register('email', { required: 'Email is required' })}
                    placeholder="user@institution.edu"
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="lf-error">{errors.email.message}</span>}
              </div>

              <div className="lf-group">
                <label className="lf-label">Password</label>
                <div className="lf-input-wrap">
                  <span className="lf-icon">🔑</span>
                  <input
                    type="password"
                    className={`lf-input ${errors.password ? 'lf-input-error' : ''}`}
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 8, message: 'Min. 8 characters' },
                      pattern: { value: /\d/, message: 'Must contain a digit' },
                    })}
                    placeholder="At least 8 characters, 1 digit"
                    autoComplete="new-password"
                  />
                </div>
                {errors.password && <span className="lf-error">{errors.password.message}</span>}
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="login-btn-loading"><span className="login-spinner" /> Creating account…</span>
                ) : 'Create Account'}
              </button>
            </form>

            <button
              type="button"
              onClick={onBackToLogin}
              style={{
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: 13, textDecoration: 'underline', marginTop: 16,
              }}
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
