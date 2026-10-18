import { useEffect, useState } from 'react';
import LabelPrinterPage from './LabelPrinterPage';
import ScanStore from '../features/labels/ScanStore';
import BarcodeLabelsPage from './BarcodeLabelsPage';

/** One place for labels: print them, then scan them to store the sample. */
export default function LabelsPage() {
  // A phone camera scan of a label opens the app at /?label=CODE
  const [scanned] = useState(() => new URLSearchParams(window.location.search).get('label'));
  const [tab, setTab] = useState<'print' | 'stock' | 'scan'>(scanned ? 'scan' : 'print');
  useEffect(() => { if (scanned) window.history.replaceState(null, '', window.location.pathname); }, [scanned]);

  return (
    <div>
      <div role="tablist" aria-label="Labels" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['print', 'Print labels'], ['stock', 'Reagent & lot labels'], ['scan', 'Scan & store']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'none', border: 0, cursor: 'pointer', fontSize: 14, marginBottom: -1,
            borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`,
            color: tab === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: tab === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>
      {tab === 'print' ? <LabelPrinterPage /> : tab === 'stock' ? <BarcodeLabelsPage /> : (
        <>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 16px', maxWidth: 640 }}>
            Scan any QR code or barcode: a sample label, a reagent lot label, an item barcode or a supplier label. Samples get stored; stock can be used or relabelled; open orders go to Receiving.
          </p>
          <ScanStore initialCode={scanned ?? undefined} />
        </>
      )}
    </div>
  );
}
