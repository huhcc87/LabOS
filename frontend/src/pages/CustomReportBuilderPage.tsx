import { useState, useRef } from 'react';
import { API_BASE_URL as API } from '../lib/api';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
});

// ── Block types ───────────────────────────────────────────────────────────────

type BlockType = 'heading' | 'text' | 'metric' | 'table' | 'chart' | 'divider' | 'spacer';

interface Block {
  id: string;
  type: BlockType;
  config: Record<string, any>;
}

const BLOCK_PALETTE: { type: BlockType; icon: string; label: string }[] = [
  { type: 'heading', icon: 'H', label: 'Heading' },
  { type: 'text', icon: '¶', label: 'Text' },
  { type: 'metric', icon: '#', label: 'Metric Card' },
  { type: 'table', icon: '⊞', label: 'Data Table' },
  { type: 'chart', icon: '▦', label: 'Chart' },
  { type: 'divider', icon: '—', label: 'Divider' },
  { type: 'spacer', icon: '↕', label: 'Spacer' },
];

const DATA_SOURCES = [
  { key: 'tasks', label: 'Tasks', endpoint: '/tasks?per_page=50' },
  { key: 'samples', label: 'Samples', endpoint: '/samples?per_page=50' },
  { key: 'inventory', label: 'Inventory', endpoint: '/inventory?per_page=50' },
  { key: 'incidents', label: 'Incidents', endpoint: '/incidents?per_page=50' },
  { key: 'capa', label: 'CAPA Records', endpoint: '/capa?per_page=50' },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultConfig = (type: BlockType): Record<string, any> => ({
  heading: { text: 'Report Section', level: 'h2' },
  text: { text: 'Enter your text here…' },
  metric: { label: 'Metric', value: '—', color: '#6366f1', source: '', field: '' },
  table: { source: 'tasks', columns: ['title', 'status', 'priority'], title: 'Data Table' },
  chart: { source: 'tasks', type: 'bar', field: 'status', title: 'Chart' },
  divider: {},
  spacer: { height: 24 },
}[type]);

// ── Block renderers (preview) ─────────────────────────────────────────────────

function HeadingBlock({ config }: { config: any }) {
  const Tag = config.level as 'h1' | 'h2' | 'h3';
  const sizes = { h1: 28, h2: 22, h3: 17 };
  return <div style={{ fontSize: sizes[Tag] ?? 22, fontWeight: 700, margin: '8px 0' }}>{config.text}</div>;
}

function TextBlock({ config }: { config: any }) {
  return <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-soft)', margin: '4px 0' }}>{config.text}</p>;
}

function MetricBlock({ config, liveData }: { config: any; liveData: any[] }) {
  let value: string | number = config.value;
  if (config.source && config.field && liveData.length) {
    const items = liveData;
    const counts: Record<string, number> = {};
    items.forEach((i: any) => {
      const v = i[config.field] ?? 'unknown';
      counts[v] = (counts[v] ?? 0) + 1;
    });
    value = config.field_value ? (counts[config.field_value] ?? 0) : items.length;
  }
  return (
    <div style={{ display: 'inline-block', padding: '16px 24px', borderRadius: 10, border: `2px solid ${config.color}`, minWidth: 120, textAlign: 'center' }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: config.color }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{config.label}</div>
    </div>
  );
}

function TableBlock({ config, liveData }: { config: any; liveData: any[] }) {
  const cols: string[] = config.columns ?? [];
  const rows = liveData.slice(0, 10);
  return (
    <div>
      {config.title && <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{config.title}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            {cols.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{c.replace(/_/g, ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No data — click Refresh Data</td></tr>
          ) : rows.map((row: any, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {cols.map(c => <td key={c} style={{ padding: '6px 10px' }}>{String(row[c] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChartBlock({ config, liveData }: { config: any; liveData: any[] }) {
  const counts: Record<string, number> = {};
  liveData.forEach((i: any) => {
    const v = String(i[config.field] ?? 'unknown');
    counts[v] = (counts[v] ?? 0) + 1;
  });
  const data = Object.entries(counts).map(([k, v]) => ({ label: k, value: v }));
  if (!data.length) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No data — click Refresh Data</div>;

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  const maxVal = Math.max(...data.map(d => d.value));
  const W = 400, H = 140, PAD = 32;
  const barW = Math.floor((W - PAD * 2) / data.length) - 4;

  return (
    <div>
      {config.title && <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>{config.title}</div>}
      {config.type === 'bar' && (
        <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', maxWidth: W }}>
          {data.map((d, i) => {
            const bh = Math.max(4, (d.value / maxVal) * H);
            const x = PAD + i * (barW + 4);
            return (
              <g key={d.label}>
                <rect x={x} y={H - bh} width={barW} height={bh} fill={COLORS[i % COLORS.length]} rx={3} />
                <text x={x + barW / 2} y={H + 14} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{d.label}</text>
                <text x={x + barW / 2} y={H - bh - 4} textAnchor="middle" fontSize={10} fill={COLORS[i % COLORS.length]}>{d.value}</text>
              </g>
            );
          })}
        </svg>
      )}
      {config.type === 'pie' && (
        <svg viewBox="0 0 200 140" style={{ width: 200 }}>
          {(() => {
            const total = data.reduce((s, d) => s + d.value, 0);
            let angle = -Math.PI / 2;
            return data.map((d, i) => {
              const sweep = (d.value / total) * 2 * Math.PI;
              const x1 = 70 + 55 * Math.cos(angle);
              const y1 = 70 + 55 * Math.sin(angle);
              angle += sweep;
              const x2 = 70 + 55 * Math.cos(angle);
              const y2 = 70 + 55 * Math.sin(angle);
              const large = sweep > Math.PI ? 1 : 0;
              return (
                <path key={d.label} d={`M70,70 L${x1},${y1} A55,55 0 ${large},1 ${x2},${y2} Z`}
                  fill={COLORS[i % COLORS.length]} />
              );
            });
          })()}
          {data.map((d, i) => (
            <g key={d.label}>
              <rect x={135} y={10 + i * 18} width={10} height={10} fill={COLORS[i % COLORS.length]} />
              <text x={150} y={19 + i * 18} fontSize={9} fill="var(--text-muted)">{d.label} ({d.value})</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

// ── Block editor config panel ─────────────────────────────────────────────────

function BlockEditor({ block, onChange }: { block: Block; onChange: (cfg: Record<string, any>) => void }) {
  const c = block.config;
  const set = (k: string, v: any) => onChange({ ...c, [k]: v });

  if (block.type === 'heading') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={c.text} onChange={e => set('text', e.target.value)} placeholder="Heading text"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <select value={c.level} onChange={e => set('level', e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
        <option value="h1">H1 — Large</option>
        <option value="h2">H2 — Medium</option>
        <option value="h3">H3 — Small</option>
      </select>
    </div>
  );

  if (block.type === 'text') return (
    <textarea value={c.text} onChange={e => set('text', e.target.value)} rows={3}
      style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', resize: 'vertical' }} />
  );

  if (block.type === 'metric') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={c.label} onChange={e => set('label', e.target.value)} placeholder="Label"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <input value={c.value} onChange={e => set('value', e.target.value)} placeholder="Static value (overridden by source)"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <select value={c.source} onChange={e => set('source', e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
        <option value="">— Static value —</option>
        {DATA_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <input value={c.color} onChange={e => set('color', e.target.value)} type="color"
        style={{ height: 32, padding: 2, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)' }} />
    </div>
  );

  if (block.type === 'table') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={c.title} onChange={e => set('title', e.target.value)} placeholder="Table title"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <select value={c.source} onChange={e => set('source', e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
        {DATA_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <input value={c.columns.join(', ')} onChange={e => set('columns', e.target.value.split(',').map((s: string) => s.trim()))}
        placeholder="Columns (comma-separated)"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
    </div>
  );

  if (block.type === 'chart') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input value={c.title} onChange={e => set('title', e.target.value)} placeholder="Chart title"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <select value={c.source} onChange={e => set('source', e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
        {DATA_SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <input value={c.field} onChange={e => set('field', e.target.value)} placeholder="Group-by field (e.g. status)"
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
      <select value={c.type} onChange={e => set('type', e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }}>
        <option value="bar">Bar chart</option>
        <option value="pie">Pie chart</option>
      </select>
    </div>
  );

  if (block.type === 'spacer') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Height (px)</span>
      <input type="number" value={c.height} onChange={e => set('height', Number(e.target.value))} min={8} max={200}
        style={{ width: 80, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)' }} />
    </div>
  );

  return <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No settings for this block.</div>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomReportBuilderPage() {
  const [blocks, setBlocks] = useState<Block[]>([
    { id: uid(), type: 'heading', config: { text: 'Lab Report', level: 'h1' } },
    { id: uid(), type: 'text', config: { text: 'Generated from LabOS v2. Customize this report by adding blocks from the palette on the left.' } },
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<Record<string, any[]>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [reportName, setReportName] = useState('Untitled Report');
  const [loadingData, setLoadingData] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const addBlock = (type: BlockType) => {
    const block: Block = { id: uid(), type, config: defaultConfig(type) };
    setBlocks(b => [...b, block]);
    setSelected(block.id);
  };

  const updateBlock = (id: string, cfg: Record<string, any>) => {
    setBlocks(b => b.map(bl => bl.id === id ? { ...bl, config: cfg } : bl));
  };

  const removeBlock = (id: string) => {
    setBlocks(b => b.filter(bl => bl.id !== id));
    if (selected === id) setSelected(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(b => {
      const idx = b.findIndex(bl => bl.id === id);
      if (idx < 0) return b;
      const next = idx + dir;
      if (next < 0 || next >= b.length) return b;
      const arr = [...b];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const refreshData = async () => {
    setLoadingData(true);
    const needed = new Set(blocks.filter(b => b.config.source).map(b => b.config.source));
    const results: Record<string, any[]> = {};
    await Promise.all(
      Array.from(needed).map(async key => {
        const src = DATA_SOURCES.find(s => s.key === key);
        if (!src) return;
        try {
          const r = await fetch(`${API}${src.endpoint}`, { headers: authHeaders() });
          if (r.ok) {
            const d = await r.json();
            results[key] = d.items ?? d ?? [];
          }
        } catch {}
      })
    );
    setLiveData(results);
    setLoadingData(false);
  };

  const exportPDF = () => window.print();

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ name: reportName, blocks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportName.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.blocks) { setBlocks(data.blocks); if (data.name) setReportName(data.name); }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedBlock = blocks.find(b => b.id === selected);

  const renderBlockPreview = (block: Block) => {
    const data = liveData[block.config.source] ?? [];
    switch (block.type) {
      case 'heading': return <HeadingBlock config={block.config} />;
      case 'text': return <TextBlock config={block.config} />;
      case 'metric': return <MetricBlock config={block.config} liveData={data} />;
      case 'table': return <TableBlock config={block.config} liveData={data} />;
      case 'chart': return <ChartBlock config={block.config} liveData={data} />;
      case 'divider': return <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />;
      case 'spacer': return <div style={{ height: block.config.height ?? 24 }} />;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>
      {/* Left: block palette + properties */}
      <div style={{ width: 240, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-sidebar, var(--bg-card))' }}>
        <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Add Block</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {BLOCK_PALETTE.map(({ type, icon, label }) => (
              <button key={type} onClick={() => addBlock(type)}
                style={{ padding: '8px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedBlock && (
          <div style={{ padding: 16, flex: 1, overflow: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
              {BLOCK_PALETTE.find(p => p.type === selectedBlock.type)?.label} Settings
            </div>
            <BlockEditor block={selectedBlock} onChange={cfg => updateBlock(selectedBlock.id, cfg)} />
          </div>
        )}
      </div>

      {/* Center: canvas */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-card)' }}>
          <input value={reportName} onChange={e => setReportName(e.target.value)}
            style={{ fontSize: 15, fontWeight: 600, border: 'none', background: 'none', color: 'var(--text)', outline: 'none', flex: 1, minWidth: 0 }} />
          <button onClick={refreshData} disabled={loadingData}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 12 }}>
            {loadingData ? '⟳ Loading…' : '⟳ Refresh Data'}
          </button>
          <button onClick={exportJSON}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 12 }}>
            ↓ JSON
          </button>
          <label style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
            ↑ Import
            <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
          </label>
          <button onClick={exportPDF}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            🖨 Print / PDF
          </button>
        </div>

        {/* Report canvas */}
        <div ref={printRef} style={{ flex: 1, overflow: 'auto', padding: 32, background: 'var(--bg)' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            {blocks.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 12 }}>
                Add blocks from the left panel to build your report.
              </div>
            )}
            {blocks.map((block, idx) => (
              <div key={block.id}
                onClick={() => setSelected(block.id)}
                style={{
                  position: 'relative',
                  padding: '10px 14px',
                  marginBottom: 4,
                  borderRadius: 6,
                  border: selected === block.id ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                  background: selected === block.id ? 'rgba(99,102,241,.04)' : undefined,
                }}>
                {renderBlockPreview(block)}
                {selected === block.id && (
                  <div style={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); moveBlock(block.id, -1); }} disabled={idx === 0}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>↑</button>
                    <button onClick={e => { e.stopPropagation(); moveBlock(block.id, 1); }} disabled={idx === blocks.length - 1}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>↓</button>
                    <button onClick={e => { e.stopPropagation(); removeBlock(block.id); }}
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 12, color: '#ef4444' }}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { display: none !important; }
          body > div:has([data-report]) { display: block !important; }
        }
      `}</style>
    </div>
  );
}
