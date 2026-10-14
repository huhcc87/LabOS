import { useEffect, useState } from 'react';

// ChronoBio viewer: a self-contained page generated offline by the `chronobio/` Python package
// (python -m chronobio ... build_viewer) and shipped as a static file. It never reads LabOS data.
const VIEWER_URL = '/chronobio/viewer.html';
const MARKER = 'chronobio-viewer';          // present in the generated page; the SPA fallback page lacks it



type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; html: string };

export default function ChronoBioTab() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch(VIEWER_URL)
      .then(r => (r.ok ? r.text() : ''))
      .then(html => { if (!cancelled) setState(html.includes(MARKER) ? { kind: 'ready', html } : { kind: 'missing' }); })
      .catch(() => { if (!cancelled) setState({ kind: 'missing' }); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, fontSize: 13, lineHeight: 1.5,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text)' }}>ChronoBio evidence explorer (experimental).</strong>{' '}
        A snapshot built offline from public abstracts on KRAS inhibitors with a small local model. It is not live and does not use your lab data.
        Hypotheses are drafts for a researcher to judge, not findings: a critic marked “advisory” is the model’s own opinion only.
      </div>
      {state.kind === 'loading' && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
      {state.kind === 'missing' && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No ChronoBio snapshot is installed. Generate one with the <code>chronobio</code> package and place it at <code>frontend/public{VIEWER_URL}</code>.
        </div>
      )}
      {state.kind === 'ready' && (
        <iframe
          title="ChronoBio evidence explorer"
          srcDoc={state.html}
          sandbox="allow-scripts allow-downloads"
          style={{ width: '100%', height: 'calc(100vh - 260px)', minHeight: 560, border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }}
        />
      )}
    </div>
  );
}
