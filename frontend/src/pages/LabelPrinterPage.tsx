import { useState, useMemo, useEffect, useRef } from 'react';
import Barcode from '../components/Barcode';

// ─── Label presets (mm) ───────────────────────────────────────────────────────
interface LabelSize {
  id: string;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  layout: 'sheet' | 'roll';
  cols?: number;
  rows?: number;
  // sheet margins / gutters (mm)
  sheetMarginX?: number;
  sheetMarginY?: number;
  gutterX?: number;
  gutterY?: number;
}

const LABEL_SIZES: LabelSize[] = [
  { id: 'dymo30334', name: 'Dymo 30334 Multi-Purpose', description: '25 × 54 mm — perfect for racks', widthMm: 54, heightMm: 25, layout: 'roll' },
  { id: 'dymo30336', name: 'Dymo 30336 Multi-Purpose', description: '25 × 54 mm', widthMm: 54, heightMm: 25, layout: 'roll' },
  { id: 'cryo', name: 'Cryo vial label', description: '19 × 13 mm — fits 2 mL vials', widthMm: 19, heightMm: 13, layout: 'roll' },
  { id: 'cryomicro', name: 'Cryo micro label', description: '38 × 6.4 mm — wrap around tubes', widthMm: 38, heightMm: 6.4, layout: 'roll' },
  { id: 'avery5160', name: 'Avery 5160 (Letter sheet)', description: '67.7 × 25.4 mm — 30 per page', widthMm: 67.7, heightMm: 25.4, layout: 'sheet', cols: 3, rows: 10, sheetMarginX: 4.7, sheetMarginY: 12.7, gutterX: 3.2, gutterY: 0 },
  { id: 'avery5163', name: 'Avery 5163 (Letter sheet)', description: '101.6 × 50.8 mm — 10 per page', widthMm: 101.6, heightMm: 50.8, layout: 'sheet', cols: 2, rows: 5, sheetMarginX: 4, sheetMarginY: 12.7, gutterX: 4.7, gutterY: 0 },
  { id: 'generic50', name: 'Generic 50 × 30 mm', description: 'Standard small label', widthMm: 50, heightMm: 30, layout: 'roll' },
];

// ─── Custom field types ───────────────────────────────────────────────────────
interface LabelField {
  key: string;
  label: string;
  value: string;
  show: boolean;
}

const DEFAULT_FIELDS: LabelField[] = [
  { key: 'name', label: 'Name', value: '', show: true },
  { key: 'type', label: 'Type', value: '', show: true },
  { key: 'origin', label: 'Origin', value: '', show: true },
  { key: 'purpose', label: 'Purpose', value: '', show: true },
  { key: 'owner', label: 'Owner', value: '', show: true },
  { key: 'date', label: 'Prep Date', value: new Date().toISOString().slice(0, 10), show: true },
  { key: 'expiry', label: 'Expires', value: '', show: true },
  { key: 'storage', label: 'Storage', value: '', show: false },
  { key: 'lot', label: 'Lot #', value: '', show: false },
  { key: 'hazard', label: 'Hazard', value: '', show: false },
  { key: 'concentration', label: 'Concentration', value: '', show: false },
  { key: 'volume', label: 'Volume', value: '', show: false },
];

// ─── Presets by entity type ───────────────────────────────────────────────────
const ENTITY_PRESETS: Record<string, { label: string; emoji: string; fields: Partial<Record<string, { value?: string; show?: boolean }>> }> = {
  sample: {
    label: 'Sample / Specimen', emoji: '🧪',
    fields: { name: { show: true }, type: { show: true }, origin: { show: true }, purpose: { show: true }, date: { show: true }, storage: { show: true }, hazard: { show: true } },
  },
  reagent: {
    label: 'Reagent / Chemical', emoji: '⚗️',
    fields: { name: { show: true }, type: { show: true }, lot: { show: true }, expiry: { show: true }, concentration: { show: true }, storage: { show: true }, hazard: { show: true } },
  },
  plasmid: {
    label: 'Plasmid / Vector', emoji: '🧬',
    fields: { name: { show: true }, type: { show: true }, origin: { show: true }, owner: { show: true }, date: { show: true }, storage: { show: true } },
  },
  freezerbox: {
    label: 'Freezer / Box', emoji: '🧊',
    fields: { name: { show: true }, type: { show: true }, owner: { show: true }, date: { show: true }, storage: { show: true } },
  },
  equipment: {
    label: 'Equipment', emoji: '🔭',
    fields: { name: { show: true }, type: { show: true }, owner: { show: true }, date: { show: true }, lot: { show: true } },
  },
  custom: {
    label: 'Blank / Custom', emoji: '🏷️',
    fields: {},
  },
};

// ─── Unique ID generator ──────────────────────────────────────────────────────
function generateLabId(prefix = 'LAB'): string {
  const yr = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${yr}-${rand}`;
}

// ─── Single-label preview (used both on-screen and in print) ──────────────────
function LabelCard({
  size, fields, uid, codeType, showQr, showBarcode, brand,
}: {
  size: LabelSize;
  fields: LabelField[];
  uid: string;
  codeType: 'qrcode' | 'barcode';
  showQr: boolean;
  showBarcode: boolean;
  brand: string;
}) {
  // Convert mm → px at 3.78 px/mm (96 DPI ~ 25.4 mm/in → 3.78 px/mm)
  const pxPerMm = 3.78;
  const w = size.widthMm * pxPerMm;
  const h = size.heightMm * pxPerMm;

  const isTiny = size.heightMm < 14;
  const visibleFields = fields.filter(f => f.show && f.value.trim());

  // Decide layout based on aspect / size
  const layout = isTiny ? 'inline' : 'card';

  return (
    <div
      className="label-card"
      style={{
        width: w,
        height: h,
        background: '#ffffff',
        color: '#0f172a',
        border: '1px dashed #94a3b8',
        boxSizing: 'border-box',
        padding: isTiny ? 2 : 4,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: layout === 'inline' ? 'row' : 'row',
        gap: 4,
        alignItems: 'center',
      }}
    >
      {/* Left: codes */}
      {(showQr || showBarcode) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          {showQr && (
            <Barcode
              value={uid}
              type="qrcode"
              width={Math.min(h - (isTiny ? 4 : 8), w * 0.32)}
              height={Math.min(h - (isTiny ? 4 : 8), w * 0.32)}
            />
          )}
          {showBarcode && !showQr && (
            <Barcode
              value={uid}
              type="barcode"
              width={w * 0.55}
              height={Math.min(h * 0.7, 50)}
              showText
              textSize={Math.max(6, h * 0.06)}
            />
          )}
        </div>
      )}

      {/* Right: textual content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        {/* Top: brand + uid */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontSize: Math.max(6, h * 0.07), color: '#64748b', fontWeight: 600,
          lineHeight: 1, marginBottom: 2,
        }}>
          <span>{brand}</span>
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{uid}</span>
        </div>

        {/* Main: name (largest field) */}
        {fields[0]?.show && fields[0]?.value && (
          <div style={{
            fontSize: Math.max(9, h * (isTiny ? 0.32 : 0.18)),
            fontWeight: 700,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {fields[0].value}
          </div>
        )}

        {/* Remaining fields */}
        {!isTiny && visibleFields.length > 1 && (
          <div style={{ fontSize: Math.max(6, h * 0.08), lineHeight: 1.3, color: '#334155' }}>
            {visibleFields.slice(1, isTiny ? 2 : 6).map(f => (
              <div key={f.key} style={{
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                <span style={{ color: '#94a3b8' }}>{f.label}: </span>
                <span style={{ fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom barcode strip when both QR + barcode requested */}
        {showQr && showBarcode && !isTiny && (
          <div style={{ marginTop: 2 }}>
            <Barcode value={uid} type="barcode" width={w * 0.55} height={h * 0.22} showText={false} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LabelPrinterPage() {
  const [entityType, setEntityType] = useState('sample');
  const [sizeId, setSizeId] = useState('dymo30334');
  const [codeType, setCodeType] = useState<'qrcode' | 'barcode'>('qrcode');
  const [showQr, setShowQr] = useState(true);
  const [showBarcode, setShowBarcode] = useState(false);
  const [brand, setBrand] = useState('LabOS');
  const [fields, setFields] = useState<LabelField[]>(DEFAULT_FIELDS);
  const [uid, setUid] = useState(generateLabId());
  const [copies, setCopies] = useState(1);
  const [printerStatus, setPrinterStatus] = useState<'unknown' | 'browser' | 'connected'>('unknown');
  const printAreaRef = useRef<HTMLDivElement>(null);

  const size = useMemo(() => LABEL_SIZES.find(s => s.id === sizeId)!, [sizeId]);

  // Apply preset visibility when entity type changes
  useEffect(() => {
    const preset = ENTITY_PRESETS[entityType];
    setFields(prev => prev.map(f => {
      const override = preset.fields[f.key];
      if (!override) return f;
      return { ...f, show: override.show ?? f.show, value: override.value ?? f.value };
    }));
  }, [entityType]);

  const updateField = (key: string, patch: Partial<LabelField>) => {
    setFields(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f));
  };

  const addCustomField = () => {
    const i = fields.length + 1;
    setFields(prev => [...prev, { key: `custom${i}`, label: `Custom ${i}`, value: '', show: true }]);
  };

  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  const handleNewUid = () => setUid(generateLabId());

  const tryConnectPrinter = async () => {
    // Web USB is supported on Chromium-based browsers. Many lab label printers
    // (Dymo LabelWriter, Brother QL series) expose USB endpoints. We can detect
    // device pairing but actual raw printing requires vendor-specific protocols,
    // so we fall back to browser print after pairing.
    const nav: any = navigator;
    if (!nav.usb) {
      setPrinterStatus('browser');
      alert('Web USB not available in this browser. Falling back to system print dialog — works fine for any printer your OS sees.');
      return;
    }
    try {
      const device = await nav.usb.requestDevice({
        filters: [
          { vendorId: 0x0922 },  // Dymo
          { vendorId: 0x04f9 },  // Brother
          { vendorId: 0x0a5f },  // Zebra
        ],
      });
      await device.open();
      setPrinterStatus('connected');
      alert(`Paired with ${device.productName || 'label printer'}. Use Print to send labels.`);
    } catch (err) {
      setPrinterStatus('browser');
    }
  };

  // Generate the sheet/roll for printing
  const labelsToPrint = Array.from({ length: copies }, (_, i) => ({
    uid: copies === 1 ? uid : `${uid}-${(i + 1).toString().padStart(2, '0')}`,
  }));

  // Sheet grid layout (for Avery-style sheets)
  let printGridStyle: React.CSSProperties = {};
  if (size.layout === 'sheet') {
    printGridStyle = {
      display: 'grid',
      gridTemplateColumns: `repeat(${size.cols || 1}, ${size.widthMm}mm)`,
      gridAutoRows: `${size.heightMm}mm`,
      columnGap: `${size.gutterX || 0}mm`,
      rowGap: `${size.gutterY || 0}mm`,
      padding: `${size.sheetMarginY || 0}mm ${size.sheetMarginX || 0}mm`,
    };
  }

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .label-print-area, .label-print-area * { visibility: visible; }
          .label-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page {
            size: ${size.layout === 'sheet' ? '8.5in 11in' : `${size.widthMm}mm ${size.heightMm}mm`};
            margin: 0;
          }
          .page-break { break-after: page; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>🏷️ Label Printer</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            Generate QR-coded and barcoded labels for samples, reagents, plasmids, equipment, and freezer boxes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: printerStatus === 'connected' ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.1)',
            color: printerStatus === 'connected' ? '#22c55e' : '#818cf8',
          }}>
            {printerStatus === 'connected' ? '🖨️ Paired printer' : '🖨️ Browser print'}
          </div>
          <button onClick={tryConnectPrinter}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            Connect printer
          </button>
          <button onClick={handlePrint}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: 'var(--primary, #6366f1)', color: '#fff', cursor: 'pointer' }}>
            🖨️ Print {copies > 1 ? `× ${copies}` : ''}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
        {/* LEFT: Configuration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Entity preset */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>What are you labelling?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {Object.entries(ENTITY_PRESETS).map(([key, p]) => (
                <button key={key} onClick={() => setEntityType(key)}
                  style={{
                    padding: '10px 4px', border: '1px solid ' + (entityType === key ? 'var(--primary)' : 'var(--border)'),
                    borderRadius: 8, background: entityType === key ? 'rgba(99,102,241,0.1)' : 'transparent',
                    cursor: 'pointer', color: 'var(--text)', fontSize: 11, fontWeight: 600, textAlign: 'center',
                  }}>
                  <div style={{ fontSize: 20, marginBottom: 2 }}>{p.emoji}</div>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label size */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Label format</div>
            <select value={sizeId} onChange={e => setSizeId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
              {LABEL_SIZES.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.widthMm} × {s.heightMm} mm</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>{size.description}</p>
          </div>

          {/* Code options */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Code & ID</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={showQr} onChange={e => setShowQr(e.target.checked)} />
                QR code
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={showBarcode} onChange={e => setShowBarcode(e.target.checked)} />
                Code128 barcode
              </label>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={uid} onChange={e => setUid(e.target.value.toUpperCase())}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontFamily: 'ui-monospace, monospace' }} />
              <button onClick={handleNewUid}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
                ↻ New ID
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              The ID is encoded in the QR/barcode. Scanning it pulls up this entity in LabOS.
            </p>
          </div>

          {/* Fields */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Label fields
              </div>
              <button onClick={addCustomField}
                style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11 }}>
                + Add field
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {fields.map(f => (
                <div key={f.key} style={{ display: 'grid', gridTemplateColumns: 'auto 90px 1fr', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={f.show} onChange={e => updateField(f.key, { show: e.target.checked })} />
                  <input value={f.label} onChange={e => updateField(f.key, { label: e.target.value })}
                    style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} />
                  <input value={f.value} placeholder={`${f.label.toLowerCase()}…`} onChange={e => updateField(f.key, { value: e.target.value })}
                    style={{ padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Copies + branding */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Print options</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Copies</label>
                <input type="number" min={1} max={500} value={copies} onChange={e => setCopies(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Brand text</label>
                <input value={brand} onChange={e => setBrand(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '8px 0 0' }}>
              Multiple copies get sequential suffixes (-01, -02…) so each label stays uniquely scannable.
            </p>
          </div>
        </div>

        {/* RIGHT: Live preview + print area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Preview</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {ENTITY_PRESETS[entityType].emoji} {size.name} — {size.widthMm} × {size.heightMm} mm
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {copies} label{copies > 1 ? 's' : ''} will print
              {size.layout === 'sheet' && size.cols && size.rows && (
                <> ({Math.ceil(copies / (size.cols * size.rows))} sheet{Math.ceil(copies / (size.cols * size.rows)) > 1 ? 's' : ''})</>
              )}
            </div>
          </div>

          {/* Single big preview */}
          <div className="card" style={{ display: 'flex', justifyContent: 'center', padding: 30, background: 'var(--surface2)' }}>
            <div style={{ transform: size.widthMm < 30 ? 'scale(2.5)' : size.widthMm < 60 ? 'scale(1.6)' : 'scale(1)', transformOrigin: 'center' }}>
              <LabelCard size={size} fields={fields} uid={uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} />
            </div>
          </div>

          {/* Print-only area */}
          <div ref={printAreaRef} className="label-print-area" style={{
            background: '#ffffff', padding: size.layout === 'sheet' ? 0 : 4,
            borderRadius: 8, border: '1px solid var(--border)',
          }}>
            {size.layout === 'sheet' ? (
              // Group labels into pages
              Array.from({ length: Math.ceil(labelsToPrint.length / ((size.cols || 1) * (size.rows || 1))) }, (_, pageIdx) => {
                const start = pageIdx * (size.cols || 1) * (size.rows || 1);
                const end = Math.min(start + (size.cols || 1) * (size.rows || 1), labelsToPrint.length);
                return (
                  <div key={pageIdx} style={printGridStyle} className={pageIdx < Math.ceil(labelsToPrint.length / ((size.cols || 1) * (size.rows || 1))) - 1 ? 'page-break' : ''}>
                    {labelsToPrint.slice(start, end).map((l, j) => (
                      <LabelCard key={j} size={size} fields={fields} uid={l.uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} />
                    ))}
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {labelsToPrint.map((l, j) => (
                  <div key={j} className={j < labelsToPrint.length - 1 ? 'page-break' : ''}>
                    <LabelCard size={size} fields={fields} uid={l.uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
