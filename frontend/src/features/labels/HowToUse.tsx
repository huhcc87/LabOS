import { useEffect, useState } from 'react';

/** Short guide for the sample → label → freezer flow, plus a live check that the USB scanner reaches this page. */
export default function HowToUse() {
  const [open, setOpen] = useState(false);
  return (
    <details className="card" style={{ padding: '12px 16px', marginBottom: 16 }} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>How to use: add a sample, print its QR label, scan it into a freezer box</summary>
      <ol style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
        <li><strong>Add the sample once.</strong> Sample Hub → Samples → <em>+ New Sample</em>. Fill in the details and click <em>Create &amp; print QR label</em>.</li>
        <li><strong>Print.</strong> The label opens with its QR code and barcode. Click <em>Print</em> (scale 100%, margins none) and stick it on the tube.</li>
        <li><strong>When the sample arrives, scan it.</strong> Click anywhere on a LabOS page first so the browser window is active, then scan the label with the USB scanner (or type the code in the <em>Scan a label</em> box on this page and press Enter).</li>
        <li><strong>Store it.</strong> This Freezer page opens with the sample. The last box you used and its next free position are already picked. Click <em>Store sample</em>. Done.</li>
        <li><strong>Later:</strong> scan the same label to see where it is, move it, mark it used up, or discard it.</li>
      </ol>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '10px 0 0' }}>
        If a scan does nothing: the scanner types into whichever window is in front. Click on this page and scan again. Use Chrome or Edge.
      </p>
      {open && <ScannerCheck />}
    </details>
  );
}

/** Shows exactly what the scanner sends to this page, so a setup problem is easy to see. */
function ScannerCheck() {
  const [seen, setSeen] = useState('');
  const [slow, setSlow] = useState(0);
  useEffect(() => {
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const now = performance.now();
      const gap = last ? now - last : 0;
      last = now;
      if (e.key === 'Enter') { setSeen(s => s + ' ⏎'); return; }
      if (e.key.length !== 1) return;
      if (gap > 80) setSlow(n => n + 1);
      setSeen(s => (s + e.key).slice(-80));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return (
    <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--surface-2, rgba(0,0,0,0.04))', fontSize: 13 }}>
      <strong>Scanner check</strong> — scan any label now. What this page receives:
      <div aria-live="polite" style={{ fontFamily: 'monospace', fontSize: 15, marginTop: 6, minHeight: 22 }}>{seen || 'nothing yet'}</div>
      {slow > 2 && <div style={{ color: 'var(--warn-text)', marginTop: 4 }}>Characters are arriving slowly; if scans don't open the sample, use the Scan a label box and press Enter.</div>}
      <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => { setSeen(''); setSlow(0); }}>Clear</button>
    </div>
  );
}
