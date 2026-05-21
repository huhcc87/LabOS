import { useState, useMemo, useEffect, useRef } from 'react';
import Barcode from '../components/Barcode';
import toast from 'react-hot-toast';

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

// ─── Known printer models ─────────────────────────────────────────────────────
const KNOWN_PRINTERS = [
  { id: 'dymo',    name: 'Dymo LabelWriter', models: '450 · 550 · 4XL',             vendorId: 0x0922, accent: '#e74c3c', icon: '🔴' },
  { id: 'brother', name: 'Brother QL Series', models: 'QL-800 · 820NWB · 1110NWB',  vendorId: 0x04f9, accent: '#2980b9', icon: '🔵' },
  { id: 'zebra',   name: 'Zebra ZD / ZT',    models: 'ZD420 · ZD620 · ZT230',       vendorId: 0x0a5f, accent: '#27ae60', icon: '🟢' },
  { id: 'any',     name: 'Other / Generic',  models: 'Any USB label printer',        vendorId: null,   accent: '#8e44ad', icon: '🔌' },
] as const;

// ─── Unique ID generator ──────────────────────────────────────────────────────
function generateLabId(prefix = 'LAB'): string {
  const yr = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${yr}-${rand}`;
}

// ─── Typography & color settings ─────────────────────────────────────────────
interface Typography {
  namePt: number;
  fieldPt: number;
  uidPt: number;
  qrPct: number;
  fontFamily: string;
  nameColor: string;
  fieldColor: string;
  fieldLabelColor: string;
  labelBg: string;
  borderColor: string;
}

const DEFAULT_TYPOGRAPHY: Typography = {
  namePt: 8, fieldPt: 6, uidPt: 5, qrPct: 60,
  fontFamily: 'system',
  nameColor: '#0f172a',
  fieldColor: '#1e293b',
  fieldLabelColor: '#94a3b8',
  labelBg: '#ffffff',
  borderColor: '#94a3b8',
};

const FONT_FAMILIES: Record<string, { label: string; css: string }> = {
  system:    { label: 'System (default)',  css: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  mono:      { label: 'Monospace',         css: 'ui-monospace, "Courier New", monospace' },
  serif:     { label: 'Serif',             css: 'Georgia, "Times New Roman", serif' },
  condensed: { label: 'Condensed',         css: '"Arial Narrow", Arial, sans-serif' },
  rounded:   { label: 'Rounded',           css: '"Trebuchet MS", Tahoma, sans-serif' },
};

// ─── Saved template ───────────────────────────────────────────────────────────
interface LabelTemplate {
  id: string;
  name: string;
  createdAt: string;
  entityType: string;
  sizeId: string;
  showQr: boolean;
  showBarcode: boolean;
  brand: string;
  fields: LabelField[];
  copies: number;
  typo: Typography;
}

// ─── Single-label preview (used both on-screen and in print) ──────────────────
function LabelCard({
  size, fields, uid, showQr, showBarcode, brand, typo,
}: {
  size: LabelSize;
  fields: LabelField[];
  uid: string;
  codeType: 'qrcode' | 'barcode';
  showQr: boolean;
  showBarcode: boolean;
  brand: string;
  typo: Typography;
}) {
  const pxPerMm = 3.78;
  const w = size.widthMm * pxPerMm;
  const h = size.heightMm * pxPerMm;

  const isTiny = size.heightMm < 14;
  const visibleFields = fields.filter(f => f.show && f.value.trim());

  // QR size driven by typo.qrPct — user-controlled
  const qrMax = h - (isTiny ? 2 : 6);
  const qrSize = Math.max(8, Math.min(qrMax, (h * typo.qrPct) / 100));

  // UID display: show last segment on tiny, full on standard
  const uidDisplay = isTiny ? uid.split('-').slice(-1)[0] : uid;

  const ff = FONT_FAMILIES[typo.fontFamily]?.css ?? FONT_FAMILIES.system.css;

  return (
    <div
      className="label-card"
      style={{
        width: w, height: h,
        background: typo.labelBg,
        color: typo.nameColor,
        border: `1px dashed ${typo.borderColor}`,
        fontFamily: ff,
        boxSizing: 'border-box',
        padding: isTiny ? 2 : 4,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'row',
        gap: 3, alignItems: 'stretch',
      }}
    >
      {/* Left: QR / barcode */}
      {(showQr || showBarcode) && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {showQr && <Barcode value={uid} type="qrcode" width={qrSize} height={qrSize} />}
          {showBarcode && !showQr && (
            <Barcode value={uid} type="barcode" width={w * 0.55} height={Math.min(h * 0.7, 50)}
              showText textSize={typo.uidPt} />
          )}
        </div>
      )}

      {/* Right: all text fields — unified layout, wrapping allowed */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 1, overflow: 'hidden' }}>

        {/* Name — largest */}
        {fields[0]?.show && fields[0]?.value && (
          <div style={{
            fontSize: typo.namePt,
            fontWeight: 800,
            lineHeight: 1.15,
            color: typo.nameColor,
            fontFamily: ff,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}>
            {fields[0].value}
          </div>
        )}

        {/* All remaining visible fields */}
        {visibleFields.slice(1).map(f => (
          <div key={f.key} style={{
            fontSize: typo.fieldPt,
            fontWeight: 600,
            lineHeight: 1.1,
            color: typo.fieldColor,
            fontFamily: ff,
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
          }}>
            <span style={{ color: typo.fieldLabelColor, fontWeight: 400 }}>{f.label}: </span>
            {f.value}
          </div>
        ))}

        {/* Brand + UID */}
        <div style={{
          fontSize: typo.uidPt,
          fontFamily: ff,
          color: typo.fieldLabelColor,
          lineHeight: 1,
          wordBreak: 'break-all',
          marginTop: 1,
        }}>
          {brand} · {uidDisplay}
        </div>

        {/* Dual-code: barcode strip below fields */}
        {showQr && showBarcode && !isTiny && (
          <div style={{ marginTop: 2 }}>
            <Barcode value={uid} type="barcode" width={w * 0.55} height={h * 0.18} showText={false} />
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
  const [typo, setTypo] = useState<Typography>(DEFAULT_TYPOGRAPHY);
  const [printerStatus, setPrinterStatus] = useState<'unknown' | 'browser' | 'connected'>('unknown');
  const [connectedPrinterName, setConnectedPrinterName] = useState<string | null>(null);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // ── Saved templates ──────────────────────────────────────────────────────────
  const [savedTemplates, setSavedTemplates] = useState<LabelTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('labos_label_templates') || '[]'); }
    catch { return []; }
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const updateTypo = (patch: Partial<Typography>) => setTypo(prev => ({ ...prev, ...patch }));

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

  const persistTemplates = (list: LabelTemplate[]) => {
    setSavedTemplates(list);
    localStorage.setItem('labos_label_templates', JSON.stringify(list));
  };

  const saveTemplate = () => {
    const name = templateName.trim();
    if (!name) return;
    const tpl: LabelTemplate = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      entityType, sizeId, showQr, showBarcode, brand, fields, copies, typo,
    };
    persistTemplates([...savedTemplates, tpl]);
    setTemplateName('');
    setShowSaveModal(false);
    toast.success(`Template "${name}" saved`);
  };

  const loadTemplate = (tpl: LabelTemplate) => {
    setEntityType(tpl.entityType);
    setSizeId(tpl.sizeId);
    setShowQr(tpl.showQr);
    setShowBarcode(tpl.showBarcode);
    setBrand(tpl.brand);
    setFields(tpl.fields);
    setCopies(tpl.copies);
    setTypo(tpl.typo);
    setUid(generateLabId());
    toast.success(`Loaded "${tpl.name}"`);
  };

  const deleteTemplate = (id: string) => {
    persistTemplates(savedTemplates.filter(t => t.id !== id));
  };

  const tryConnectPrinter = async (vendorId: number | null) => {
    setShowPrinterModal(false);
    const nav: any = navigator;
    if (!nav.usb) {
      setPrinterStatus('browser');
      alert('Web USB is not available in this browser. Use Chrome or Edge for USB printer pairing. The system print dialog will work for any printer your OS sees.');
      return;
    }
    try {
      const filters = vendorId
        ? [{ vendorId }]
        : [{ vendorId: 0x0922 }, { vendorId: 0x04f9 }, { vendorId: 0x0a5f }];
      const device = await nav.usb.requestDevice({ filters });
      await device.open();
      const name = device.productName || 'Label printer';
      setConnectedPrinterName(name);
      setPrinterStatus('connected');
    } catch {
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
            {printerStatus === 'connected'
              ? `🖨️ ${connectedPrinterName ?? 'Paired printer'}`
              : '🖨️ Browser print'}
          </div>
          <button onClick={() => setShowPrinterModal(true)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            Connect printer
          </button>
          <button onClick={() => { setTemplateName(''); setShowSaveModal(true); }}
            style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            💾 Save Template
          </button>
          <button onClick={handlePrint}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: 'none', background: 'var(--primary, #6366f1)', color: '#fff', cursor: 'pointer' }}>
            🖨️ Print {copies > 1 ? `× ${copies}` : ''}
          </button>
        </div>
      </div>

      {/* ── Printer Selection Modal ─────────────────────────────────────────── */}
      {showPrinterModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowPrinterModal(false)}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16, padding: 28, width: 480, maxWidth: '92vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Select printer</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Choose your label printer model to filter the USB device picker
                </div>
              </div>
              <button onClick={() => setShowPrinterModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {KNOWN_PRINTERS.map(p => (
                <button key={p.id} onClick={() => tryConnectPrinter(p.vendorId ?? null)}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: `1px solid ${p.accent}44`,
                    background: `${p.accent}11`,
                    color: 'var(--text)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${p.accent}22`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${p.accent}11`)}
                >
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{p.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.models}</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '10px 12px', background: 'rgba(99,102,241,0.07)', borderRadius: 8 }}>
              <strong>Note:</strong> Web USB pairing requires Chrome or Edge. After pairing, use <strong>Print</strong> to send labels — LabOS uses your OS print dialog for full print-quality output.
            </div>
          </div>
        </div>
      )}

      {/* ── Save Template Modal ──────────────────────────────────────────────── */}
      {showSaveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowSaveModal(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 28, width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>💾 Save Label Template</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Save your current label setup — size, fields, font settings — so you can reload it instantly next time.
            </p>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Template name</div>
            <input
              autoFocus
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveTemplate()}
              placeholder={`e.g. "Cryo Vial – Human Tissue" or "Ampicillin Reagent"`}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 18 }}>
              Saving: <strong>{ENTITY_PRESETS[entityType]?.emoji} {ENTITY_PRESETS[entityType]?.label}</strong> · {LABEL_SIZES.find(s => s.id === sizeId)?.name} · {fields.filter(f => f.show).length} fields
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowSaveModal(false)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={saveTemplate} disabled={!templateName.trim()}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: templateName.trim() ? '#22c55e' : 'var(--border)', color: templateName.trim() ? '#fff' : 'var(--text-muted)', cursor: templateName.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: 14 }}>
                💾 Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Templates Panel ────────────────────────────────────────────── */}
      {savedTemplates.length > 0 && (
        <div style={{ marginBottom: 20, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📂 Saved Templates <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>({savedTemplates.length})</span></div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a template to load it instantly</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {savedTemplates.map(tpl => {
              const preset = ENTITY_PRESETS[tpl.entityType];
              const tplSize = LABEL_SIZES.find(s => s.id === tpl.sizeId);
              const date = new Date(tpl.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={tpl.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid var(--border)', flex: '0 0 auto', maxWidth: 260,
                  transition: 'border-color 0.15s',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{preset?.emoji || '🏷️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tpl.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tplSize?.name || tpl.sizeId} · {date}</div>
                  </div>
                  <button onClick={() => loadTemplate(tpl)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--accent, #6366f1)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    Load
                  </button>
                  <button onClick={() => deleteTemplate(tpl.id)} title="Delete template"
                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

          {/* Label Style Customisation */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>🎨 Label Style & Font</div>
              <button onClick={() => setTypo(DEFAULT_TYPOGRAPHY)}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Reset all
              </button>
            </div>

            {/* Font family */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Font family</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {Object.entries(FONT_FAMILIES).map(([key, ff]) => (
                  <button key={key} onClick={() => updateTypo({ fontFamily: key })}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', border: '1px solid',
                      borderColor: typo.fontFamily === key ? 'var(--accent, #6366f1)' : 'var(--border)',
                      background: typo.fontFamily === key ? 'rgba(99,102,241,0.12)' : 'transparent',
                      color: typo.fontFamily === key ? 'var(--accent, #6366f1)' : 'var(--text-muted)',
                      fontFamily: ff.css, fontWeight: 600,
                    }}>
                    {ff.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font sizes */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Font sizes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {([
                  { label: 'Name size (pt)', key: 'namePt', min: 4, max: 32, color: typo.nameColor },
                  { label: 'Fields size (pt)', key: 'fieldPt', min: 3, max: 20, color: typo.fieldColor },
                  { label: 'UID size (pt)', key: 'uidPt', min: 3, max: 16, color: typo.fieldLabelColor },
                  { label: 'QR / barcode (%)', key: 'qrPct', min: 20, max: 95, color: '#6366f1' },
                ] as { label: string; key: keyof Typography; min: number; max: number; color: string }[]).map(row => (
                  <div key={row.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.label}</label>
                      <input
                        type="number" min={row.min} max={row.max} value={typo[row.key] as number}
                        onChange={e => updateTypo({ [row.key]: Math.max(row.min, Math.min(row.max, parseInt(e.target.value) || row.min)) })}
                        style={{ width: 46, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11, textAlign: 'center' }}
                      />
                    </div>
                    <input type="range" min={row.min} max={row.max} value={typo[row.key] as number}
                      onChange={e => updateTypo({ [row.key]: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: row.color }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Colors</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {([
                  { label: 'Label background', key: 'labelBg' },
                  { label: 'Border color', key: 'borderColor' },
                  { label: 'Name text', key: 'nameColor' },
                  { label: 'Field values', key: 'fieldColor' },
                  { label: 'Field labels', key: 'fieldLabelColor' },
                ] as { label: string; key: keyof Typography }[]).map(row => (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="color"
                      value={typo[row.key] as string}
                      onChange={e => updateTypo({ [row.key]: e.target.value })}
                      style={{ width: 32, height: 32, padding: 2, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none' }}
                    />
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{row.label}</label>
                  </div>
                ))}
                {/* Quick color presets */}
                <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>Quick themes</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: 'White', bg: '#ffffff', border: '#94a3b8', name: '#0f172a', field: '#1e293b', fl: '#94a3b8' },
                      { label: 'Cream', bg: '#fffbeb', border: '#d97706', name: '#92400e', field: '#78350f', fl: '#d97706' },
                      { label: 'Ice Blue', bg: '#eff6ff', border: '#3b82f6', name: '#1e3a8a', field: '#1e40af', fl: '#93c5fd' },
                      { label: 'Mint', bg: '#f0fdf4', border: '#16a34a', name: '#14532d', field: '#166534', fl: '#86efac' },
                      { label: 'Dark', bg: '#0f172a', border: '#334155', name: '#f1f5f9', field: '#cbd5e1', fl: '#64748b' },
                      { label: 'Pink', bg: '#fdf2f8', border: '#db2777', name: '#831843', field: '#9d174d', fl: '#f9a8d4' },
                    ].map(theme => (
                      <button key={theme.label} onClick={() => updateTypo({ labelBg: theme.bg, borderColor: theme.border, nameColor: theme.name, fieldColor: theme.field, fieldLabelColor: theme.fl })}
                        style={{
                          padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                          background: theme.bg, color: theme.name,
                          border: `1.5px solid ${theme.border}`,
                        }}>
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
              <LabelCard size={size} fields={fields} uid={uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} typo={typo} />
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
                      <LabelCard key={j} size={size} fields={fields} uid={l.uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} typo={typo} />
                    ))}
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {labelsToPrint.map((l, j) => (
                  <div key={j} className={j < labelsToPrint.length - 1 ? 'page-break' : ''}>
                    <LabelCard size={size} fields={fields} uid={l.uid} codeType={codeType} showQr={showQr} showBarcode={showBarcode} brand={brand} typo={typo} />
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
