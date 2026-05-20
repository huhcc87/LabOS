import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { inventoryApi } from '../lib/api';

type Item = { id: number; name: string; quantity: number; unit: string; category: string; storage_location: string; reorder_threshold: number; };
type SlotItem = Item & { slot: string };

const STORAGE_UNITS = [
  { id: 'freezer-1', name: '-80°C Freezer', icon: '🧊', color: '#3b82f6', rows: 5, cols: 10 },
  { id: 'freezer-2', name: '-20°C Freezer', icon: '❄️', color: '#06b6d4', rows: 4, cols: 8 },
  { id: 'fridge-1', name: '4°C Refrigerator', icon: '🌡️', color: '#22c55e', rows: 4, cols: 6 },
  { id: 'cabinet-1', name: 'Chemical Cabinet', icon: '🗄️', color: '#f59e0b', rows: 5, cols: 8 },
  { id: 'shelf-1', name: 'Dry Shelf A', icon: '📦', color: '#8b5cf6', rows: 3, cols: 10 },
  { id: 'incubator-1', name: '37°C Incubator', icon: '🔥', color: '#ef4444', rows: 3, cols: 6 },
];

function slotId(unitId: string, row: number, col: number) {
  return `${unitId}-R${row}C${col}`;
}

const ASSIGNMENTS_KEY = 'labos_slot_assignments';

function loadAssignments(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || '{}'); } catch { return {}; }
}

function saveAssignments(a: Record<string, number[]>) {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(a));
}

export default function StorageMapPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState(STORAGE_UNITS[0].id);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [highlightItem, setHighlightItem] = useState<number | null>(null);

  // Drag-and-drop state
  const [assignments, setAssignments] = useState<Record<string, number[]>>(loadAssignments);
  const [draggingItemId, setDraggingItemId] = useState<number | null>(null);
  const [draggingFromSlot, setDraggingFromSlot] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  useEffect(() => {
    inventoryApi.list(1, 200).then(r => {
      setItems(r.data.items || []);
    }).catch(() => toast.error('Failed to load inventory')).finally(() => setLoading(false));
  }, []);

  const unit = STORAGE_UNITS.find(u => u.id === selectedUnit)!;

  // Items manually assigned anywhere (across all units)
  const manuallyAssigned = new Set(Object.values(assignments).flat());

  // Build slotMap: manual assignments first, then auto-place unassigned items
  const slotMap: Record<string, SlotItem[]> = {};

  Object.entries(assignments).forEach(([slot, itemIds]) => {
    if (!slot.startsWith(selectedUnit)) return;
    itemIds.forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      if (!slotMap[slot]) slotMap[slot] = [];
      slotMap[slot].push({ ...item, slot });
    });
  });

  items.forEach(item => {
    if (manuallyAssigned.has(item.id)) return;
    const loc = item.storage_location?.toLowerCase() || '';
    if (!loc.includes(selectedUnit.split('-')[0])) return;
    const row = (item.id % unit.rows) + 1;
    const col = (Math.floor(item.id / unit.rows) % unit.cols) + 1;
    const targetSlot = slotId(selectedUnit, row, col);
    if (!slotMap[targetSlot]) slotMap[targetSlot] = [];
    slotMap[targetSlot].push({ ...item, slot: targetSlot });
  });

  // Items not yet assigned to any slot (for dragging from the unassigned panel)
  const unassigned = items.filter(i => !manuallyAssigned.has(i.id));

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.storage_location?.toLowerCase().includes(search.toLowerCase()))
    : [];

  const highlightedSlots = new Set<string>();
  if (highlightItem !== null) {
    Object.entries(slotMap).forEach(([slot, slotItems]) => {
      if (slotItems.some(i => i.id === highlightItem)) highlightedSlots.add(slot);
    });
  }

  const selectedItems = selectedSlot ? (slotMap[selectedSlot] || []) : [];

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, itemId: number, fromSlot: string | null) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('itemId', String(itemId));
    setDraggingItemId(itemId);
    setDraggingFromSlot(fromSlot);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingItemId(null);
    setDraggingFromSlot(null);
    setDragOverSlot(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, slot: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(slot);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverSlot(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetSlot: string) => {
    e.preventDefault();
    const itemId = parseInt(e.dataTransfer.getData('itemId'));
    if (!itemId) return;

    setAssignments(prev => {
      const next = { ...prev };

      // Remove from previous slot if it was manually assigned
      if (draggingFromSlot) {
        next[draggingFromSlot] = (next[draggingFromSlot] || []).filter(id => id !== itemId);
        if (next[draggingFromSlot].length === 0) delete next[draggingFromSlot];
      } else {
        // Remove from any existing manual slot
        Object.keys(next).forEach(slot => {
          next[slot] = next[slot].filter(id => id !== itemId);
          if (next[slot].length === 0) delete next[slot];
        });
      }

      // Add to target slot
      if (!next[targetSlot]) next[targetSlot] = [];
      if (!next[targetSlot].includes(itemId)) next[targetSlot].push(itemId);

      saveAssignments(next);
      return next;
    });

    setDragOverSlot(null);
    setDraggingItemId(null);
    setDraggingFromSlot(null);

    const item = items.find(i => i.id === itemId);
    if (item) toast.success(`${item.name} → ${targetSlot.replace(selectedUnit + '-', '')}`);
  }, [draggingFromSlot, items, selectedUnit]);

  const handleRemoveFromSlot = (itemId: number, slot: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      next[slot] = (next[slot] || []).filter(id => id !== itemId);
      if (next[slot].length === 0) delete next[slot];
      saveAssignments(next);
      return next;
    });
    if (selectedSlot === slot && (slotMap[slot] || []).length <= 1) setSelectedSlot(null);
    toast.success('Item removed from slot');
  };

  const handleClearUnit = () => {
    setAssignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(slot => { if (slot.startsWith(selectedUnit)) delete next[slot]; });
      saveAssignments(next);
      return next;
    });
    setSelectedSlot(null);
    toast.success('Cleared manual assignments for this unit');
  };

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>Storage Map</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Visual lab storage — drag items onto slots to assign them, click to view contents
          </p>
        </div>
        <button className="btn btn-sm btn-secondary" onClick={handleClearUnit}>Clear Assignments</button>
      </div>

      {/* Storage unit selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {STORAGE_UNITS.map(u => (
          <button key={u.id} onClick={() => { setSelectedUnit(u.id); setSelectedSlot(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
              background: selectedUnit === u.id ? u.color + '20' : 'var(--surface)',
              border: `2px solid ${selectedUnit === u.id ? u.color : 'var(--border)'}`,
              color: selectedUnit === u.id ? u.color : 'var(--text)',
              fontWeight: selectedUnit === u.id ? 700 : 400, fontSize: 13, transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: 18 }}>{u.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{u.rows}×{u.cols} slots</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        {/* Map */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{unit.icon}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{unit.name}</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit.rows} rows × {unit.cols} columns = {unit.rows * unit.cols} slots</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: unit.color, display: 'inline-block' }} />Occupied</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} />Low stock</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--surface2)', display: 'inline-block' }} />Empty</span>
              {draggingItemId && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: unit.color, fontWeight: 600 }}>↓ Drop on any slot</span>}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `32px repeat(${unit.cols}, 1fr)`, gap: 4, marginBottom: 4 }}>
            <div />
            {Array.from({ length: unit.cols }, (_, c) => (
              <div key={c} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{c + 1}</div>
            ))}
          </div>

          {/* Grid */}
          {Array.from({ length: unit.rows }, (_, r) => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: `32px repeat(${unit.cols}, 1fr)`, gap: 4, marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                {String.fromCharCode(65 + r)}
              </div>
              {Array.from({ length: unit.cols }, (_, c) => {
                const slot = slotId(selectedUnit, r + 1, c + 1);
                const slotItems = slotMap[slot] || [];
                const occupied = slotItems.length > 0;
                const lowStock = slotItems.some(i => i.quantity <= i.reorder_threshold);
                const isHovered = hoveredSlot === slot;
                const isSelected = selectedSlot === slot;
                const isHighlighted = highlightedSlots.has(slot);
                const isDragOver = dragOverSlot === slot;
                const isDraggingSource = draggingItemId !== null && slotItems.some(i => i.id === draggingItemId);

                return (
                  <div key={c}
                    onMouseEnter={() => !draggingItemId && setHoveredSlot(slot)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    onClick={() => !draggingItemId && setSelectedSlot(isSelected ? null : slot)}
                    onDragOver={(e) => handleDragOver(e, slot)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, slot)}
                    title={occupied ? slotItems.map(i => i.name).join(', ') : 'Empty — drop here to assign'}
                    style={{
                      height: 36, borderRadius: 6,
                      cursor: draggingItemId ? 'copy' : occupied ? 'pointer' : 'default',
                      background: isDragOver
                        ? unit.color + '80'
                        : isSelected ? unit.color
                        : lowStock ? '#ef4444'
                        : occupied ? unit.color + '60'
                        : draggingItemId ? 'rgba(99,102,241,0.08)' : 'var(--surface2)',
                      border: `2px solid ${
                        isDragOver ? unit.color
                        : isSelected ? unit.color
                        : isHighlighted ? '#f59e0b'
                        : isDraggingSource ? 'rgba(99,102,241,0.5)'
                        : isHovered && occupied ? unit.color
                        : draggingItemId ? 'rgba(99,102,241,0.3)' : 'transparent'
                      }`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: occupied ? '#fff' : isDragOver ? unit.color : 'var(--text-muted)',
                      fontWeight: 700, transition: 'all 0.1s',
                      transform: isDragOver ? 'scale(1.1)' : isHovered && occupied ? 'scale(1.08)' : 'none',
                      boxShadow: isDragOver ? `0 0 0 3px ${unit.color}40` : 'none',
                    }}>
                    {isDragOver ? '+' : occupied ? (slotItems.length > 1 ? `${slotItems.length}` : '●') : ''}
                  </div>
                );
              })}
            </div>
          ))}

          {loading && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading inventory...</div>
          )}

          {draggingItemId && (
            <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: `${unit.color}15`, border: `1px dashed ${unit.color}`, fontSize: 12, color: unit.color, textAlign: 'center' }}>
              Drag the item over a slot and release to assign it
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Search */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Find Item</div>
            <input className="form-input" placeholder="Search inventory..." value={search}
              onChange={e => { setSearch(e.target.value); setHighlightItem(null); }} style={{ fontSize: 13, marginBottom: 8 }} />
            {filtered.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {filtered.slice(0, 20).map(item => (
                  <div key={item.id}
                    onClick={() => { setHighlightItem(item.id); setSearch(''); }}
                    style={{ padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: 'var(--surface2)', fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)20')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  >
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.storage_location || 'No location set'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Drag items panel */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Drag to Assign</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Drag any item below onto a slot in the grid
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {(unassigned.length > 0 ? unassigned : items).slice(0, 30).map(item => (
                <div key={item.id}
                  draggable
                  onDragStart={e => handleDragStart(e, item.id, null)}
                  onDragEnd={handleDragEnd}
                  style={{
                    padding: '7px 10px', borderRadius: 7, cursor: 'grab',
                    background: draggingItemId === item.id ? `${unit.color}25` : 'var(--surface2)',
                    border: `1px solid ${draggingItemId === item.id ? unit.color : 'transparent'}`,
                    fontSize: 12, userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    opacity: draggingItemId === item.id ? 0.5 : 1,
                  }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.category}</div>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>⠿</span>
                </div>
              ))}
              {unassigned.length === 0 && items.length === 0 && !loading && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 16 }}>No items in inventory</div>
              )}
            </div>
          </div>

          {/* Slot details */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              {selectedSlot ? `Slot ${selectedSlot.replace(`${selectedUnit}-`, '')}` : 'Select a Slot'}
            </div>
            {!selectedSlot ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Click any occupied slot to see its contents
              </div>
            ) : selectedItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                Empty slot — drag an item here to assign
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedItems.map(item => {
                  const isManual = assignments[selectedSlot]?.includes(item.id);
                  return (
                    <div key={item.id}
                      draggable
                      onDragStart={e => handleDragStart(e, item.id, selectedSlot)}
                      onDragEnd={handleDragEnd}
                      style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', cursor: 'grab', userSelect: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.name}</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isManual && (
                            <button onClick={() => handleRemoveFromSlot(item.id, selectedSlot!)} title="Remove from slot"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '0 2px' }}>
                              ×
                            </button>
                          )}
                          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>⠿</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{item.category}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span>Qty: <strong style={{ color: item.quantity <= item.reorder_threshold ? '#ef4444' : '#22c55e' }}>{item.quantity} {item.unit}</strong></span>
                        <span style={{ color: 'var(--text-muted)' }}>Min: {item.reorder_threshold}</span>
                      </div>
                      {item.quantity <= item.reorder_threshold && (
                        <div style={{ marginTop: 6, fontSize: 11, background: '#ef444420', color: '#ef4444', padding: '3px 8px', borderRadius: 6, fontWeight: 700 }}>
                          ⚠ LOW STOCK — Reorder needed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Storage Stats</div>
            {[
              { label: 'Total Items', value: items.length, color: 'var(--accent)' },
              { label: 'Low Stock', value: items.filter(i => i.quantity <= i.reorder_threshold).length, color: '#ef4444' },
              { label: 'This Unit', value: Object.values(slotMap).flat().length, color: '#22c55e' },
              { label: 'Manual Slots', value: Object.keys(assignments).filter(s => s.startsWith(selectedUnit)).length, color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
