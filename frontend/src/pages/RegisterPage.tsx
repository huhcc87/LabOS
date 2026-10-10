import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ConvexError } from 'convex/values';
import { useAuth } from '../context/AuthContext';
import { AuthBrand } from '../components/AuthBrand';
import '../styles/auth.css';

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
      await registerAccount(data.email.trim(), data.password, data.full_name.trim());
      toast.success('Welcome to LabOS');
    } catch (err) {
      toast.error(err instanceof ConvexError && typeof err.data === 'string' ? err.data : 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth">
      <AuthBrand />
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Any email works, including Gmail. Your PI can give you access to more of LabOS later.</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="auth-field">
            <label className="auth-label" htmlFor="full_name">Full name</label>
            <input id="full_name" className="auth-input" autoComplete="name"
              aria-invalid={!!errors.full_name}
              {...register('full_name', { required: 'Enter your name', minLength: { value: 2, message: 'Too short' } })} />
            {errors.full_name && <span className="auth-error">{errors.full_name.message}</span>}
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="auth-input" autoComplete="email" placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register('email', { required: 'Enter your email', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' } })} />
            {errors.email && <span className="auth-error">{errors.email.message}</span>}
          </div>
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="auth-input" autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password', {
                required: 'Choose a password',
                minLength: { value: 8, message: 'At least 8 characters' },
                pattern: { value: /\d/, message: 'Include at least one number' },
              })} />
            {errors.password
              ? <span className="auth-error">{errors.password.message}</span>
              : <div className="auth-hint">At least 8 characters, including a number.</div>}
          </div>
          <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <><span className="auth-spinner" />Creating account…</> : 'Sign up'}
          </button>
        </form>
        <p className="auth-foot">
          Already have an account?{' '}
          <button type="button" className="auth-link" onClick={onBackToLogin}>Sign in</button>
        </p>
      </div>
    </main>
  );
}
