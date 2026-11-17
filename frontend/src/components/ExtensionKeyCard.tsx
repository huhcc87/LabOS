import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

/** The address the extension posts to: this deployment's HTTP site (…convex.site), plus /extension. */
export function extensionApiBase(): string {
  const site = import.meta.env.VITE_CONVEX_SITE_URL || (import.meta.env.VITE_CONVEX_URL ?? '').replace('.convex.cloud', '.convex.site');
  return site ? `${site.replace(/\/$/, '')}/extension` : '';
}

const btn: React.CSSProperties = { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' };
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 12, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', wordBreak: 'break-all' };

/** Make or revoke the key the LabOS Reagent Capture browser extension uses to send products to your Reagent Cart. */
export default function ExtensionKeyCard() {
  const { token } = useAuth();
  const status = useQuery(api.extensionKeys.status, token ? { token } : 'skip');
  const create = useMutation(api.extensionKeys.create);
  const revoke = useMutation(api.extensionKeys.revoke);
  const [fresh, setFresh] = useState('');
  const base = extensionApiBase();

  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Copy failed. Select it and copy by hand.'));

  const make = async () => {
    if (!token) return;
    try { setFresh((await create({ token })).key); } catch { toast.error('Could not create the key'); }
  };
  const remove = async () => {
    if (!token || !window.confirm('Revoke the extension key? The extension stops working until you make a new one.')) return;
    try { await revoke({ token }); setFresh(''); toast.success('Key revoked'); } catch { toast.error('Could not revoke the key'); }
  };

  return (
    <div style={{ marginTop: 24, padding: 16, border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Browser extension key</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Lets the LabOS Reagent Capture extension send products from vendor pages to your Reagent Cart. It can only add requests, as you. Anyone with the key can do the same, so keep it private.
      </div>

      {fresh && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Your new key (shown once, copy it now):</div>
          <div style={mono}>{fresh}</div>
          <button style={{ ...btn, marginTop: 8 }} onClick={() => copy(fresh)}>Copy key</button>
        </div>
      )}
      {base && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, marginBottom: 4 }}>Paste this as the API base URL in the extension options:</div>
          <div style={mono}>{base}</div>
          <button style={{ ...btn, marginTop: 8 }} onClick={() => copy(base)}>Copy URL</button>
        </div>
      )}

      {status?.has_key && !fresh && (
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Active key ending in <strong>{status.key_hint}</strong>, made {new Date(status.created_at).toLocaleDateString()}
          {status.last_used_at ? `, last used ${new Date(status.last_used_at).toLocaleString()}` : ', not used yet'}.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...btn, background: 'var(--accent)', color: '#fff', border: 'none' }} onClick={make}>
          {status?.has_key ? 'Make a new key (replaces the old one)' : 'Make extension key'}
        </button>
        {status?.has_key && <button style={{ ...btn, color: '#ef4444' }} onClick={remove}>Revoke</button>}
      </div>
    </div>
  );
}
