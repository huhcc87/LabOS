/**
 * Electronic Signature Dialog — 21 CFR Part 11 compliant.
 * Requires password re-entry. Records signer identity, reason, meaning, timestamp, IP (server-side).
 *
 * Usage:
 *   <ElectronicSignatureDialog
 *     entityType="sop"
 *     entityId={42}
 *     entityTitle="SOP-042: Cell Culture Protocol"
 *     content={sopText}          // used for content hash
 *     onSigned={(sig) => ...}
 *     onClose={() => ...}
 *   />
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL as API } from '../lib/api';


function authHeaders() {
  const token = localStorage.getItem('lab_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface SignatureRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_title: string;
  signer_id: number;
  signer_email: string;
  signer_name: string;
  reason: string;
  meaning: string;
  content_hash: string;
  signed_at: string;
  is_valid: boolean;
  invalidated_reason?: string;
}

const REASONS: { value: string; label: string; description: string }[] = [
  { value: 'authored', label: 'Authored', description: 'I am the author of this document' },
  { value: 'reviewed', label: 'Reviewed', description: 'I have reviewed and verified this document' },
  { value: 'approved', label: 'Approved', description: 'I approve this document for use' },
  { value: 'witnessed', label: 'Witnessed', description: 'I witnessed the described procedure or result' },
  { value: 'rejected', label: 'Rejected', description: 'I reject this document — see meaning below' },
];

interface Props {
  entityType: string;
  entityId: number;
  entityTitle: string;
  content?: string;
  onSigned: (sig: SignatureRecord) => void;
  onClose: () => void;
}

export function ElectronicSignatureDialog({ entityType, entityId, entityTitle, content = '', onSigned, onClose }: Props) {
  const [reason, setReason] = useState('reviewed');
  const [meaning, setMeaning] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => pwRef.current?.focus(), 100);
  }, []);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('lab_user') || '{}'); } catch { return {}; }
  })();

  const selectedReason = REASONS.find(r => r.value === reason)!;

  const submit = async () => {
    if (!password) { setError('Password is required to sign'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/signatures/sign`, {
        entity_type: entityType,
        entity_id: entityId,
        entity_title: entityTitle,
        reason,
        meaning,
        password,
        content,
      }, { headers: authHeaders() });
      onSigned(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Signing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={dialog}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, borderBottom: '2px solid #e2e8f0', paddingBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            ✍️
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17 }}>Electronic Signature</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>21 CFR Part 11 · HIPAA · GLP Compliant</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>×</button>
        </div>

        {/* Document being signed */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{entityTitle || `${entityType} #${entityId}`}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Type: {entityType}</div>
        </div>

        {/* Signer identity */}
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signing as</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{user.full_name || 'Unknown'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
        </div>

        {/* Reason */}
        <label style={labelStyle}>Signature Reason *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {REASONS.map(r => (
            <label key={r.value} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
              border: `2px solid ${reason === r.value ? '#3b82f6' : '#e2e8f0'}`,
              borderRadius: 8, cursor: 'pointer',
              background: reason === r.value ? '#eff6ff' : '#fff',
              transition: 'all 0.15s',
            }}>
              <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{r.description}</div>
              </div>
            </label>
          ))}
        </div>

        {/* Meaning */}
        <label style={labelStyle}>Meaning / Note (optional)</label>
        <textarea
          style={{ ...inputStyle, height: 72, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder={`e.g. "${selectedReason.description}"`}
          value={meaning}
          onChange={e => setMeaning(e.target.value)}
          maxLength={500}
        />

        {/* Password */}
        <label style={labelStyle}>Confirm Your Password *</label>
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <input
            ref={pwRef}
            type={showPw ? 'text' : 'password'}
            style={{ ...inputStyle, paddingRight: 44 }}
            placeholder="Enter your current password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}
          >
            {showPw ? '🙈' : '👁'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 14px' }}>
          Required per 21 CFR Part 11.200 — your identity is verified before signing.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#b91c1c', fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={cancelBtn}>Cancel</button>
          <button onClick={submit} disabled={loading || !password} style={{ ...signBtn, opacity: loading || !password ? 0.6 : 1 }}>
            {loading ? 'Signing…' : `✍️ Sign as "${REASONS.find(r => r.value === reason)?.label}"`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Signature Badge Strip ────────────────────────────────────────────────────
// Shows existing signatures on a document; includes a "Sign" button.

interface SignaturePanelProps {
  entityType: string;
  entityId: number;
  entityTitle: string;
  content?: string;
  compact?: boolean;
}

export function SignaturePanel({ entityType, entityId, entityTitle, content = '', compact = false }: SignaturePanelProps) {
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/signatures/${entityType}/${entityId}`, { headers: authHeaders() });
      setSignatures(res.data);
    } catch {
      setSignatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const REASON_COLORS: Record<string, string> = {
    approved: '#10b981', reviewed: '#3b82f6', authored: '#8b5cf6',
    witnessed: '#f59e0b', rejected: '#ef4444',
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {signatures.filter(s => s.is_valid).map(s => (
          <span key={s.id} title={`${s.signer_name} · ${s.reason} · ${new Date(s.signed_at).toLocaleString()}`} style={{
            background: (REASON_COLORS[s.reason] ?? '#6b7280') + '22',
            color: REASON_COLORS[s.reason] ?? '#6b7280',
            border: `1px solid ${(REASON_COLORS[s.reason] ?? '#6b7280')}55`,
            borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600,
          }}>
            ✍️ {s.signer_name.split(' ')[0]} · {s.reason}
          </span>
        ))}
        <button
          onClick={() => setShowDialog(true)}
          style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          + Sign
        </button>
        {showDialog && (
          <ElectronicSignatureDialog
            entityType={entityType} entityId={entityId} entityTitle={entityTitle} content={content}
            onSigned={sig => { setSignatures(prev => [...prev, sig]); setShowDialog(false); }}
            onClose={() => setShowDialog(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>✍️ Electronic Signatures</div>
        <button
          onClick={() => setShowDialog(true)}
          style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Sign Document
        </button>
      </div>
      <div style={{ padding: 16 }}>
        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading signatures…</p>
        ) : signatures.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>No signatures yet. Click "Sign Document" to apply the first signature.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {signatures.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: s.is_valid ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${s.is_valid ? '#86efac' : '#fca5a5'}`, borderRadius: 8,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: (REASON_COLORS[s.reason] ?? '#6b7280') + '22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>
                  ✍️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.signer_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{s.signer_email}</div>
                  {s.meaning && <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>"{s.meaning}"</div>}
                  {s.invalidated_reason && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>Invalidated: {s.invalidated_reason}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    background: (REASON_COLORS[s.reason] ?? '#6b7280') + '22',
                    color: REASON_COLORS[s.reason] ?? '#6b7280',
                    border: `1px solid ${(REASON_COLORS[s.reason] ?? '#6b7280')}55`,
                    borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4,
                  }}>
                    {s.reason}
                  </span>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(s.signed_at).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#cbd5e1', fontFamily: 'monospace', marginTop: 2 }}>{s.content_hash.slice(0, 12)}…</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showDialog && (
        <ElectronicSignatureDialog
          entityType={entityType} entityId={entityId} entityTitle={entityTitle} content={content}
          onSigned={sig => { setSignatures(prev => [...prev, sig]); setShowDialog(false); }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};

const dialog: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, boxSizing: 'border-box', marginBottom: 14, outline: 'none',
  fontFamily: 'inherit',
};

const cancelBtn: React.CSSProperties = {
  background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0',
  borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};

const signBtn: React.CSSProperties = {
  background: '#1d4ed8', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
