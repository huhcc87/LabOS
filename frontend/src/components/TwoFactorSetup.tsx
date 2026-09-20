import { useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export function TwoFactorSetup() {
  const { user, token } = useAuth();
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'disable'>('idle');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const setupTotp = useAction(api.totp.setupTotp);
  const verifyAndEnable = useAction(api.totp.verifyAndEnable);
  const disableTotp = useAction(api.totp.disable);

  const isEnabled = user?.totp_enabled;

  async function handleSetup() {
    if (!token) return;
    setLoading(true);
    try {
      const result = await setupTotp({ token });
      setSecret(result.secret);
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(result.otpauth_url, { width: 200, margin: 2 });
      setQrDataUrl(dataUrl);
      setStep('setup');
    } catch (err: any) {
      toast.error(err.message || 'Failed to set up 2FA');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!token || !code) return;
    setLoading(true);
    try {
      await verifyAndEnable({ token, code });
      toast.success('Two-factor authentication enabled!');
      setStep('idle');
      setCode('');
      setSecret('');
      setQrDataUrl('');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    if (!token || !password) return;
    setLoading(true);
    try {
      await disableTotp({ token, password });
      toast.success('Two-factor authentication disabled');
      setStep('idle');
      setPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    padding: 24, borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: '#fff', cursor: 'pointer',
    fontWeight: 600, fontSize: 14, opacity: loading ? 0.7 : 1,
  };

  const btnSecondary: React.CSSProperties = {
    padding: '10px 20px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, fontSize: 13,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', maxWidth: 300, padding: '10px 12px',
    border: '1px solid var(--border)', borderRadius: 8,
    background: 'var(--surface2)', color: 'var(--text)', fontSize: 14,
  };

  if (step === 'idle') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>{isEnabled ? '🔐' : '🔓'}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Two-Factor Authentication</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
              {isEnabled
                ? 'Your account is protected with 2FA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 16,
          background: isEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
          color: isEnabled ? '#22c55e' : '#f59e0b',
          border: `1px solid ${isEnabled ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
        }}>
          {isEnabled ? 'Enabled' : 'Not enabled'}
        </div>
        <div>
          {isEnabled ? (
            <button style={{ ...btnSecondary, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => setStep('disable')}>
              Disable 2FA
            </button>
          ) : (
            <button style={btnPrimary} onClick={handleSetup} disabled={loading}>
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Set Up Two-Factor Authentication</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Scan the QR code below with your authenticator app (Google Authenticator, Authy, or 1Password).
        </p>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 20, background: '#fff', borderRadius: 12, marginBottom: 20,
          width: 'fit-content',
        }}>
          {qrDataUrl && <img src={qrDataUrl} alt="TOTP QR Code" style={{ width: 200, height: 200 }} />}
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            Or enter this secret key manually:
          </p>
          <code style={{
            display: 'inline-block', padding: '8px 14px', borderRadius: 8,
            background: 'var(--surface2)', fontSize: 13, fontFamily: 'monospace',
            letterSpacing: 2, wordBreak: 'break-all', userSelect: 'all',
          }}>
            {secret}
          </code>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
            Enter the 6-digit code from your app to verify:
          </label>
          <input
            style={{ ...inputStyle, letterSpacing: 6, fontSize: 18, fontWeight: 700, textAlign: 'center', maxWidth: 200 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleVerify(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={handleVerify} disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
          <button style={btnSecondary} onClick={() => { setStep('idle'); setCode(''); setSecret(''); setQrDataUrl(''); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (step === 'disable') {
    return (
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Disable Two-Factor Authentication</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Enter your password to confirm disabling 2FA. Your account will be less secure.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Password</label>
          <input
            style={inputStyle}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && password) handleDisable(); }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{ ...btnPrimary, background: '#ef4444' }}
            onClick={handleDisable}
            disabled={loading || !password}
          >
            {loading ? 'Disabling...' : 'Disable 2FA'}
          </button>
          <button style={btnSecondary} onClick={() => { setStep('idle'); setPassword(''); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
