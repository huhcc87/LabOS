import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';
import { parseScan } from './scanCode';
import { LocationPicker, type Location } from './LocationPicker';

/** Label fields that map onto the sample record; everything else is kept under "details". */
const MAPPED = ['name', 'type', 'owner', 'volume', 'expiry'];
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 };

interface Form { sample_id: string; name: string; type: string; owner: string; volume: string; expiry: string; notes: string }

/** Scan a printed label (camera, USB scanner or typed), then choose where to store the sample. */
export default function ScanStore({ initialCode }: { initialCode?: string }) {
  const { token, user } = useAuth();
  const t = token ?? undefined;
  const [code, setCode] = useState<string | null>(initialCode ? parseScan(initialCode) : null);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState('');
  const [moving, setMoving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const result = useQuery(api.labels.lookup, code && token ? { token: t, code } : 'skip');
  const store = useMutation(api.labels.store);
  const unstore = useMutation(api.labels.unstore);

  const reset = () => { setCode(null); setTyped(''); setMoving(false); setDone(null); setTypedError(''); };
  const accept = useCallback((text: string) => {
    const c = parseScan(text);
    if (!c) { setTypedError('Nothing to read. Scan again or type the code.'); return false; }
    setTypedError(''); setCode(c); setDone(null); setMoving(false); return true;
  }, []);

  return (
    <div style={{ maxWidth: 760 }}>
      {done && (
        <div role="status" style={{ padding: 14, borderRadius: 8, background: 'var(--ok-bg)', color: 'var(--ok-text)', marginBottom: 16, fontWeight: 700 }}>
          Stored: {done}
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }} onClick={reset}>Scan next</button>
        </div>
      )}

      {!code && !done && (
        <>
          <Camera onCode={accept} />
          <form onSubmit={e => { e.preventDefault(); accept(typed); }} style={{ marginTop: 16 }}>
            <label htmlFor="scan-input" style={lbl}>Or scan with a USB scanner, or type or paste any code</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="scan-input" className="form-input" style={{ flex: 1 }} value={typed} autoFocus placeholder="Any QR code or barcode text" onChange={e => setTyped(e.target.value)} />
              <button className="btn btn-primary" type="submit" disabled={!typed.trim()}>Find</button>
            </div>
            {typedError && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13, margin: '6px 0 0' }}>{typedError}</p>}
          </form>
        </>
      )}

      {code && !done && (result === undefined ? <p style={{ color: 'var(--text-muted)' }}>Looking up {code}…</p> : (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{code}</h2>
            <button className="btn btn-sm btn-secondary" onClick={reset}>Scan another</button>
          </div>
          {result.known && result.stored && !moving ? (
            <>
              <p style={{ margin: '12px 0', fontSize: 14 }}>Already stored at <strong>{result.stored.path}</strong>.</p>
              <Details details={result.known ? result.details : {}} />
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button className="btn btn-secondary" onClick={() => setMoving(true)}>Move to another position</button>
                <button className="btn btn-sm" style={{ background: 'var(--bad-bg)', color: 'var(--bad-text)', border: '1px solid transparent', fontWeight: 700 }}
                  onClick={async () => { try { await unstore({ token: t, code }); toast.success('Removed from storage'); reset(); } catch (e) { toast.error(errText(e)); } }}>
                  Remove from storage
                </button>
              </div>
            </>
          ) : (
            <StoreForm
              code={code} token={t} defaultOwner={user?.full_name ?? ''}
              details={result.known ? result.details : {}} known={result.known}
              onSave={async (loc, form, extra) => {
                const [exp] = [form.expiry ? new Date(`${form.expiry}T00:00:00`).getTime() : undefined];
                await store({
                  token: t, code, ...loc,
                  sample: { sample_id: form.sample_id, label: form.name, sample_type: form.type, owner: form.owner, volume: form.volume, expiry_date: exp, notes: form.notes, details: extra },
                });
                const path = result.known && result.stored ? 'moved' : 'saved';
                setDone(`${code} ${path} — ${form.name || form.sample_id}`);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Details({ details }: { details: Record<string, string> }) {
  const entries = Object.entries(details);
  if (!entries.length) return null;
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 14px', margin: 0, fontSize: 14 }}>
      {entries.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>))}
    </dl>
  );
}

function StoreForm({ code, token, defaultOwner, details, known, onSave }: {
  code: string; token: string | undefined; defaultOwner: string; details: Record<string, string>; known: boolean;
  onSave: (loc: Location, form: Form, extra: Record<string, string>) => Promise<void>;
}) {
  const [form, setForm] = useState<Form>({
    sample_id: code, name: details.name ?? '', type: details.type ?? '', owner: details.owner ?? defaultOwner,
    volume: details.volume ?? '', expiry: /^\d{4}-\d{2}-\d{2}$/.test(details.expiry ?? '') ? details.expiry : '', notes: '',
  });
  const [loc, setLoc] = useState<Location | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const extra = Object.fromEntries(Object.entries(details).filter(([k]) => !MAPPED.includes(k)));
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));
  const onLoc = useCallback((l: Location | null) => setLoc(l), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loc) return;
    setBusy(true); setError('');
    try { await onSave(loc, form, extra); } catch (err) { setError(errText(err)); setBusy(false); }
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 14 }}>
      {!known && <p className="auth-note warn">This isn't a LabOS label (it may come from a supplier or another system), so there are no saved details yet. Fill them in and it is stored the same way.</p>}
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Sample details</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl} htmlFor="ss-name">Name *</label><input id="ss-name" className="form-input" style={{ width: '100%' }} value={form.name} onChange={set('name')} /></div>
        <div><label style={lbl} htmlFor="ss-id">Sample ID</label><input id="ss-id" className="form-input" style={{ width: '100%' }} value={form.sample_id} onChange={set('sample_id')} /></div>
        <div><label style={lbl} htmlFor="ss-type">Type</label><input id="ss-type" className="form-input" style={{ width: '100%' }} value={form.type} onChange={set('type')} /></div>
        <div><label style={lbl} htmlFor="ss-owner">Owner</label><input id="ss-owner" className="form-input" style={{ width: '100%' }} value={form.owner} onChange={set('owner')} /></div>
        <div><label style={lbl} htmlFor="ss-vol">Volume</label><input id="ss-vol" className="form-input" style={{ width: '100%' }} value={form.volume} onChange={set('volume')} /></div>
        <div><label style={lbl} htmlFor="ss-exp">Expiry</label><input id="ss-exp" type="date" className="form-input" style={{ width: '100%' }} value={form.expiry} onChange={set('expiry')} /></div>
      </div>
      {Object.keys(extra).length > 0 && (<div style={{ marginBottom: 12 }}><div style={{ ...lbl, color: 'var(--text-muted)', fontWeight: 400 }}>Also from the label (saved with the sample)</div><Details details={extra} /></div>)}
      <div style={{ marginBottom: 12 }}><label style={lbl} htmlFor="ss-notes">Notes</label><textarea id="ss-notes" className="form-input" style={{ width: '100%', resize: 'vertical' }} rows={2} value={form.notes} onChange={set('notes')} /></div>
      <h3 style={{ fontSize: 15, margin: '16px 0 10px' }}>Where to store it</h3>
      <LocationPicker token={token} onChange={onLoc} />
      {error && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13 }}>{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={busy || !loc || !(form.name.trim() || form.sample_id.trim())} style={{ marginTop: 16 }}>
        {busy ? 'Saving…' : 'Store sample'}
      </button>
    </form>
  );
}

/** Camera scanner using ZXing; stops itself after a successful read. */
function Camera({ onCode }: { onCode: (text: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<(() => void) | null>(null);
  const [on, setOn] = useState(false);
  const [error, setError] = useState('');

  const halt = useCallback(() => { stop.current?.(); stop.current = null; setOn(false); }, []);
  useEffect(() => halt, [halt]);

  const start = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser can’t use the camera here. Camera scanning needs HTTPS (or localhost).'); return; }
    setOn(true);
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const controls = await new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, video.current!, (result, _err, c) => {
        if (result && onCode(result.getText())) { c.stop(); setOn(false); stop.current = null; }
      });
      stop.current = () => controls.stop();
    } catch (e) {
      setOn(false);
      setError((e as Error)?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow the camera in your browser, or type the code below.' : 'Could not start the camera. You can type the code below instead.');
    }
  };

  return (
    <div>
      {on && <video ref={video} muted playsInline style={{ width: '100%', maxWidth: 420, borderRadius: 8, background: '#000', display: 'block', marginBottom: 10 }} aria-label="Camera preview" />}
      {on ? <button className="btn btn-secondary" onClick={halt}>Stop camera</button>
        : <button className="btn btn-primary" onClick={start}>Scan with camera</button>}
      {error && <p role="alert" style={{ color: 'var(--bad-text)', fontSize: 13, margin: '8px 0 0' }}>{error}</p>}
    </div>
  );
}
