import { useEffect, useState } from 'react';
import LabelPrinterPage from './LabelPrinterPage';
import ScanStore from '../features/labels/ScanStore';

/** One place for labels: print them, then scan them to store the sample. */
export default function LabelsPage() {
  // A phone camera scan of a label opens the app at /?label=CODE
  const [scanned] = useState(() => new URLSearchParams(window.location.search).get('label'));
  const [tab, setTab] = useState<'print' | 'scan'>(scanned ? 'scan' : 'print');
  useEffect(() => { if (scanned) window.history.replaceState(null, '', window.location.pathname); }, [scanned]);

  return (
    <div>
      <div role="tablist" aria-label="Labels" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['print', 'Print labels'], ['scan', 'Scan & store']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'none', border: 0, cursor: 'pointer', fontSize: 14, marginBottom: -1,
            borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`,
            color: tab === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: tab === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>
      {tab === 'print' ? <LabelPrinterPage /> : (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 16px', maxWidth: 640 }}>
            Scan any QR code or barcode — a LabOS label or one from a supplier — then choose where the sample is stored.
          </p>
          <ScanStore initialCode={scanned ?? undefined} />
        </>
      )}
    </div>
  );
}
