import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@lab.local', password: 'Admin123!', color: '#ef4444' },
  { label: 'PI', email: 'pi@lab.local', password: 'Pi123!', color: '#8b5cf6' },
  { label: 'Manager', email: 'manager@lab.local', password: 'Manager123!', color: '#0071bc' },
  { label: 'Staff', email: 'staff@lab.local', password: 'Staff123!', color: '#22c55e' },
  { label: 'Trainee', email: 'trainee@lab.local', password: 'Trainee123!', color: '#f59e0b' },
];

const FEATURES = [
  { icon: '🔬', title: 'Lab Hub', desc: 'Protocols, instruments & bookings' },
  { icon: '🧪', title: 'Sample Hub', desc: 'Full sample lifecycle tracking' },
  { icon: '📝', title: 'Grant Hub', desc: 'NIH & NSF grant management' },
  { icon: '🛡️', title: 'Safety & Compliance', desc: 'GLP, 21 CFR Part 11, ISO 17025' },
  { icon: '📈', title: 'Reports & Analytics', desc: 'Live dashboards and KPI tracking' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { email: 'admin@lab.local', password: 'Admin123!' },
  });

  async function onSubmit(data: LoginForm) {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome to LabOS v2!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* Accent stripe */}
      <div className="login-top-stripe" />

      <div className="login-split">
        {/* ── Left panel: branding ── */}
        <div className="login-panel-left">
          <div className="login-left-inner">
            {/* Logo */}
            <div className="login-brand-row">
              <div className="login-logo-box">⬡</div>
              <div>
                <div className="login-brand-name">LabOS <span className="login-brand-v">v2</span></div>
                <div className="login-brand-sub">Laboratory Operations System</div>
              </div>
            </div>

            <h2 className="login-left-headline">
              Research-grade lab management for modern institutions
            </h2>
            <p className="login-left-desc">
              Centralize your protocols, samples, instruments, grants, safety records,
              and team collaboration — all in one secure platform.
            </p>

            {/* Feature list */}
            <div className="login-features">
              {FEATURES.map(f => (
                <div key={f.title} className="login-feature-row">
                  <span className="login-feature-icon">{f.icon}</span>
                  <div>
                    <div className="login-feature-title">{f.title}</div>
                    <div className="login-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Compliance badges */}
            <div className="login-compliance">
              {['GLP', '21 CFR Part 11', 'ISO 17025', 'HIPAA Ready', 'SOC 2'].map(b => (
                <span key={b} className="login-compliance-badge">{b}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div className="login-panel-right">
          <div className="login-form-card">
            <div className="login-form-header">
              <div className="login-secure-badge">
                <span>🔒</span> Secure Sign In
              </div>
              <h3 className="login-form-title">Welcome back</h3>
              <p className="login-form-subtitle">Sign in to your LabOS account to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="login-form">
              <div className="lf-group">
                <label className="lf-label">Email Address</label>
                <div className="lf-input-wrap">
                  <span className="lf-icon">✉</span>
                  <input
                    className={`lf-input ${errors.email ? 'lf-input-error' : ''}`}
                    {...register('email', { required: 'Email is required' })}
                    placeholder="user@institution.edu"
                    autoComplete="email"
                    type="email"
                  />
                </div>
                {errors.email && <span className="lf-error">{errors.email.message}</span>}
              </div>

              <div className="lf-group">
                <label className="lf-label">Password</label>
                <div className="lf-input-wrap">
                  <span className="lf-icon">🔑</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`lf-input ${errors.password ? 'lf-input-error' : ''}`}
                    {...register('password', { required: 'Password is required' })}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="lf-toggle-pw"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
                {errors.password && <span className="lf-error">{errors.password.message}</span>}
              </div>

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? (
                  <span className="login-btn-loading">
                    <span className="login-spinner" /> Signing in…
                  </span>
                ) : (
                  'Sign In to LabOS'
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="login-demo-section">
              <div className="login-demo-divider">
                <span>Quick demo access</span>
              </div>
              <div className="login-demo-pills">
                {DEMO_USERS.map(u => (
                  <button
                    key={u.label}
                    className="login-demo-pill"
                    style={{ '--pill-color': u.color } as React.CSSProperties}
                    onClick={() => { setValue('email', u.email); setValue('password', u.password); }}
                    type="button"
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="login-form-footer">
              <span>🔒 256-bit SSL encrypted</span>
              <span>·</span>
              <span>Data stays on your server</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
