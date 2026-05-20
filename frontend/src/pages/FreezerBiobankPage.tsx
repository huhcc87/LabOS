import { useState, useEffect, useCallback } from 'react';
import { freezerApi } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FreezerUnit {
  id: string;
  name: string;
  location: string;
  temp: string;
  type: 'ult' | 'freezer' | 'fridge' | 'ln2';
  racks: number;
  boxes: number;
  capacity: number;
  used: number;
}

interface BoxCell {
  row: number;
  col: number;
  sampleId?: string;
  sampleType?: string;
  date?: string;
  owner?: string;
  expiry?: string;
  volume?: string;
}

interface Sample {
  id: string;
  type: string;
  date: string;
  owner: string;
  expiry: string;
  volume: string;
  status: 'ok' | 'expiring_soon' | 'expired';
  freezer: string;
  rack: string;
  box: string;
  position: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const FREEZERS: FreezerUnit[] = [
  { id: 'f1', name: 'ULT Freezer 1', location: 'Room 204', temp: '-80°C', type: 'ult', racks: 4, boxes: 48, capacity: 480, used: 312 },
  { id: 'f2', name: 'ULT Freezer 2', location: 'Room 204', temp: '-80°C', type: 'ult', racks: 4, boxes: 48, capacity: 480, used: 198 },
  { id: 'f3', name: '-20°C Freezer', location: 'Room 202', temp: '-20°C', type: 'freezer', racks: 3, boxes: 30, capacity: 300, used: 211 },
  { id: 'f4', name: 'Sample Fridge', location: 'Room 201', temp: '+4°C', type: 'fridge', racks: 2, boxes: 20, capacity: 200, used: 87 },
  { id: 'f5', name: 'LN₂ Dewar', location: 'Storage B', temp: '-196°C', type: 'ln2', racks: 6, boxes: 60, capacity: 600, used: 421 },
];

const SAMPLE_TYPES = ['DNA', 'RNA', 'Protein', 'Serum', 'Plasma', 'FFPE', 'Cell Line', 'PDX', 'Organoid', 'Other'];

function makeBoxCells(freezerId: string, rack: number, box: number): BoxCell[] {
  const cells: BoxCell[] = [];
  const seed = freezerId.charCodeAt(1) + rack * 7 + box * 13;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const idx = r * 9 + c;
      const occupied = (seed + idx * 17) % 5 !== 0;
      if (occupied) {
        const sampleTypes = SAMPLE_TYPES;
        const typeIdx = (seed + idx) % sampleTypes.length;
        const daysAgo = (seed + idx * 3) % 730;
        const expDays = (seed + idx * 7) % 365 - 100;
        const owners = ['Dr. Chen', 'Dr. Patel', 'Dr. Kim', 'Dr. Lee', 'Dr. Martinez'];
        cells.push({
          row: r, col: c,
          sampleId: `S${String(seed + idx).slice(-5)}`,
          sampleType: sampleTypes[typeIdx],
          date: new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10),
          owner: owners[(seed + idx) % owners.length],
          expiry: new Date(Date.now() + expDays * 86400000).toISOString().slice(0, 10),
          volume: `${((seed + idx) % 9 + 1) * 50} µL`,
        });
      } else {
        cells.push({ row: r, col: c });
      }
    }
  }
  return cells;
}

const MOCK_EXPIRING: Sample[] = [
  { id: 'S41233', type: 'RNA', date: '2025-11-10', owner: 'Dr. Patel', expiry: '2026-05-15', volume: '200 µL', status: 'expiring_soon', freezer: 'ULT Freezer 1', rack: 'Rack 2', box: 'Box 4', position: 'B3' },
  { id: 'S38812', type: 'Serum', date: '2024-08-22', owner: 'Dr. Chen', expiry: '2026-05-20', volume: '500 µL', status: 'expiring_soon', freezer: 'ULT Freezer 1', rack: 'Rack 1', box: 'Box 7', position: 'E6' },
  { id: 'S29901', type: 'DNA', date: '2023-06-01', owner: 'Dr. Kim', expiry: '2026-04-30', volume: '100 µL', status: 'expired', freezer: '-20°C Freezer', rack: 'Rack 2', box: 'Box 2', position: 'A1' },
];

const INP: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };

const ROWS = ['A','B','C','D','E','F','G','H','I'];
const COLS = Array.from({ length: 9 }, (_, i) => i + 1);

export default function FreezerBiobankPage() {
  const [freezers, setFreezers] = useState<FreezerUnit[]>(FREEZERS);
  const [selectedFreezer, setSelectedFreezer] = useState<FreezerUnit>(FREEZERS[0]);
  const [selectedRack, setSelectedRack] = useState(1);
  const [selectedBox, setSelectedBox] = useState(1);
  const [selectedCell, setSelectedCell] = useState<BoxCell | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'map' | 'expiry' | 'search'>('map');
  const [apiSlots, setApiSlots] = useState<BoxCell[]>([]);
  const [expiringList, setExpiringList] = useState<Sample[]>(MOCK_EXPIRING);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAddFreezer, setShowAddFreezer] = useState(false);
  const [newFreezerName, setNewFreezerName] = useState('');
  const [newFreezerLocation, setNewFreezerLocation] = useState('');
  const [newFreezerTemp, setNewFreezerTemp] = useState('-80°C');
  const [savingCell, setSavingCell] = useState(false);
  const [editCell, setEditCell] = useState<BoxCell | null>(null);

  const fetchFreezers = useCallback(async () => {
    try {
      const res = await freezerApi.list();
      const data = res.data as any[];
      if (data.length > 0) {
        const mapped: FreezerUnit[] = data.map(f => ({
          id: String(f.id), name: f.name, location: f.location, temp: f.temp_setting,
          type: f.freezer_type as any, racks: f.total_racks, boxes: f.boxes_per_rack * f.total_racks,
          capacity: f.total_slots, used: f.used_slots,
        }));
        setFreezers(mapped);
        setSelectedFreezer(mapped[0]);
      }
    } catch { /* use defaults */ }
  }, []);

  const fetchSlots = useCallback(async () => {
    if (!selectedFreezer || selectedFreezer.id.startsWith('f')) return;
    try {
      const res = await freezerApi.getSlots(Number(selectedFreezer.id), selectedRack, selectedBox);
      const slots = res.data as any[];
      const cells: BoxCell[] = slots.map(s => ({
        row: s.row_idx, col: s.col_idx, sampleId: s.sample_id || undefined,
        sampleType: s.sample_type || undefined, date: s.date_stored || undefined,
        owner: s.owner || undefined, expiry: s.expiry_date || undefined, volume: s.volume || undefined,
      }));
      setApiSlots(cells);
    } catch { setApiSlots([]); }
  }, [selectedFreezer, selectedRack, selectedBox]);

  const fetchExpiring = useCallback(async () => {
    try {
      const res = await freezerApi.getExpiring(30);
      if ((res.data as any[]).length > 0) setExpiringList(res.data as any);
    } catch { /* use mock */ }
  }, []);

  useEffect(() => { fetchFreezers(); fetchExpiring(); }, [fetchFreezers, fetchExpiring]);
  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleSearch = async () => {
    if (!search) return;
    try {
      const res = await freezerApi.search(search);
      setSearchResults(res.data as any[]);
    } catch { setSearchResults([]); }
  };

  const handleCellSave = async () => {
    if (!editCell || selectedFreezer.id.startsWith('f')) return;
    setSavingCell(true);
    try {
      await freezerApi.upsertSlot(Number(selectedFreezer.id), selectedRack, selectedBox, editCell.row, editCell.col, {
        sample_id: editCell.sampleId || '', sample_type: editCell.sampleType || '',
        date_stored: editCell.date || '', owner: editCell.owner || '',
        expiry_date: editCell.expiry || '', volume: editCell.volume || '', notes: '',
      });
      await fetchSlots();
      setSelectedCell(editCell);
      setEditCell(null);
    } catch { /* no-op */ }
    setSavingCell(false);
  };

  const resolvedCells = apiSlots.length > 0 ? apiSlots : makeBoxCells(selectedFreezer.id, selectedRack, selectedBox);
  const cells = resolvedCells;
  const usedCells = cells.filter(c => c.sampleId).length;
  const totalCells = cells.length;

  const getCellColor = (cell: BoxCell) => {
    if (!cell.sampleId) return 'var(--surface2)';
    if (!cell.expiry) return '#4ade80';
    const daysToExpiry = Math.ceil((new Date(cell.expiry).getTime() - Date.now()) / 86400000);
    if (daysToExpiry < 0) return '#ef4444';
    if (daysToExpiry < 30) return '#fbbf24';
    return '#4ade80';
  };

  const expiringCount = expiringList.filter(s => s.status === 'expiring_soon').length;
  const expiredCount = expiringList.filter(s => s.status === 'expired').length;

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Freezer & Biobank Map</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>Visual sample location tracking · Expiry monitoring · Quick retrieval</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Storage Units', value: freezers.length, color: 'var(--text)', icon: '🧊' },
          { label: 'Total Samples', value: freezers.reduce((a, f) => a + f.used, 0), color: '#60a5fa', icon: '🧪' },
          { label: 'Expiring Soon', value: expiringCount, color: '#fbbf24', icon: '⏰' },
          { label: 'Expired', value: expiredCount, color: '#f87171', icon: '⚠️' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'map' as const, label: '🗺️ Visual Map' }, { key: 'expiry' as const, label: '⏰ Expiry Tracker' }, { key: 'search' as const, label: '🔍 Sample Search' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '10px 18px', fontSize: 14, fontWeight: tab === t.key ? 600 : 400, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)', borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}` }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISUAL MAP ── */}
      {tab === 'map' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
          {/* Freezer sidebar */}
          <div>
            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Storage Units</h4>
              {freezers.map(f => {
                const pct = Math.round((f.used / f.capacity) * 100);
                const icons = { ult: '🧊', freezer: '❄️', fridge: '🌡️', ln2: '💨' };
                return (
                  <div key={f.id} onClick={() => { setSelectedFreezer(f); setSelectedRack(1); setSelectedBox(1); setSelectedCell(null); }}
                    style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: selectedFreezer.id === f.id ? 'rgba(99,102,241,0.12)' : 'var(--surface2)', border: `1px solid ${selectedFreezer.id === f.id ? 'var(--primary)' : 'transparent'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{icons[f.type]} {f.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.temp}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{f.location}</div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct > 90 ? '#ef4444' : pct > 70 ? '#fbbf24' : '#4ade80', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{pct}% full</div>
                  </div>
                );
              })}
            </div>

            {/* Rack / Box selectors */}
            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Navigate</h4>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>RACK</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from({ length: selectedFreezer.racks }, (_, i) => i + 1).map(r => (
                    <button key={r} onClick={() => { setSelectedRack(r); setSelectedBox(1); setSelectedCell(null); }}
                      style={{ width: 34, height: 34, borderRadius: 6, border: '1px solid', borderColor: selectedRack === r ? 'var(--primary)' : 'var(--border)', background: selectedRack === r ? 'rgba(99,102,241,0.15)' : 'none', color: selectedRack === r ? 'var(--primary)' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>BOX</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Array.from({ length: Math.ceil(selectedFreezer.boxes / selectedFreezer.racks) }, (_, i) => i + 1).map(b => (
                    <button key={b} onClick={() => { setSelectedBox(b); setSelectedCell(null); }}
                      style={{ width: 34, height: 34, borderRadius: 6, border: '1px solid', borderColor: selectedBox === b ? 'var(--primary)' : 'var(--border)', background: selectedBox === b ? 'rgba(99,102,241,0.15)' : 'none', color: selectedBox === b ? 'var(--primary)' : 'var(--text)', cursor: 'pointer', fontSize: 12 }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Box grid */}
          <div>
            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{selectedFreezer.name} · Rack {selectedRack} · Box {selectedBox}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{usedCells}/{totalCells} positions occupied ({Math.round(usedCells/totalCells*100)}%)</div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                  {[{ color: '#4ade80', label: 'OK' }, { color: '#fbbf24', label: '<30 days' }, { color: '#ef4444', label: 'Expired' }, { color: 'var(--surface2)', label: 'Empty' }].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      <span style={{ color: 'var(--text-muted)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid header */}
              <div style={{ display: 'grid', gridTemplateColumns: '24px repeat(9, 1fr)', gap: 3, marginBottom: 4 }}>
                <div />
                {COLS.map(c => <div key={c} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{c}</div>)}
              </div>

              {/* Grid rows */}
              {ROWS.map((rowLabel, r) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: '24px repeat(9, 1fr)', gap: 3, marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{rowLabel}</div>
                  {COLS.map((_, c) => {
                    const cell = cells.find(x => x.row === r && x.col === c);
                    if (!cell) return <div key={c} style={{ aspectRatio: '1', background: 'var(--surface2)', borderRadius: 4 }} />;
                    const bg = getCellColor(cell);
                    const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                    return (
                      <div key={c} onClick={() => setSelectedCell(isSelected ? null : cell)}
                        title={cell.sampleId ? `${cell.sampleId} · ${cell.sampleType}` : 'Empty'}
                        style={{ aspectRatio: '1', background: bg, borderRadius: 4, cursor: cell.sampleId ? 'pointer' : 'default', opacity: isSelected ? 0.7 : 1, border: isSelected ? '2px solid white' : '2px solid transparent', transition: 'all 0.1s', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(0,0,0,0.5)', fontWeight: 700 }}>
                        {cell.sampleId ? rowLabel + (c + 1) : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Cell detail */}
            {selectedCell && selectedCell.sampleId && (
              <div className="card" style={{ borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.04)' }}>
                <h4 style={{ fontWeight: 600, marginBottom: 12 }}>Sample Details — {ROWS[selectedCell.row]}{selectedCell.col + 1}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Sample ID', value: selectedCell.sampleId },
                    { label: 'Type', value: selectedCell.sampleType },
                    { label: 'Stored Date', value: selectedCell.date },
                    { label: 'Owner', value: selectedCell.owner },
                    { label: 'Expiry Date', value: selectedCell.expiry },
                    { label: 'Volume', value: selectedCell.volume },
                  ].map(f => (
                    <div key={f.label}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{f.value || '—'}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>📋 Copy ID</button>
                  <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>🔖 Print Label</button>
                  <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>📤 Move Sample</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPIRY TRACKER ── */}
      {tab === 'expiry' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Expiry Alerts</h3>
          {expiringList.length === 0 && <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>All samples are within valid date ranges. ✓</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {expiringList.map(s => {
              const isExpired = s.status === 'expired';
              return (
                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderColor: isExpired ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <span style={{ fontSize: 22 }}>{isExpired ? '❌' : '⏰'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.id} · {s.type}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.freezer} · {s.rack} · {s.box} · Position {s.position} · Owner: {s.owner}</div>
                      <div style={{ fontSize: 12, color: isExpired ? '#f87171' : '#fbbf24', marginTop: 2 }}>
                        {isExpired ? `Expired: ${s.expiry}` : `Expires: ${s.expiry}`} · Volume: {s.volume}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>Extend Expiry</button>
                    <button style={{ padding: '5px 12px', fontSize: 12, border: '1px solid #f87171', borderRadius: 6, background: 'none', cursor: 'pointer', color: '#f87171' }}>Mark Discarded</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SEARCH ── */}
      {tab === 'search' && (
        <div>
          <div style={{ marginBottom: 20, display: 'flex', gap: 8 }}>
            <input style={{ ...INP, maxWidth: 500, fontSize: 15, padding: '10px 16px' }} placeholder="Search by sample ID, type, owner..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button onClick={handleSearch} style={{ padding: '10px 20px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Search</button>
          </div>
          {searchResults.length > 0 ? (
            <div className="card" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Sample ID', 'Type', 'Freezer', 'Location', 'Owner', 'Volume', 'Expiry'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.sample_id}</td>
                      <td style={{ padding: '10px 12px' }}>{s.sample_type}</td>
                      <td style={{ padding: '10px 12px' }}>{s.freezer}</td>
                      <td style={{ padding: '10px 12px' }}>Rack {s.rack} · Box {s.box} · {s.position}</td>
                      <td style={{ padding: '10px 12px' }}>{s.owner}</td>
                      <td style={{ padding: '10px 12px' }}>{s.volume}</td>
                      <td style={{ padding: '10px 12px', color: s.expiry_date < new Date().toISOString().slice(0,10) ? '#f87171' : '#4ade80' }}>{s.expiry_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : search ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>No samples found for "{search}" — press Search to query</div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Enter a sample ID, type, or owner name and press Search</div>
          )}
        </div>
      )}
    </div>
  );
}
