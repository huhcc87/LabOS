import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import { storageUnitsApi } from '../../lib/api';

interface StorageUnitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labId: string;
  onCreated: () => void;
}

const STORAGE_TYPES = [
  { value: '-196', label: '-196°C (LN2)' },
  { value: '-150', label: '-150°C' },
  { value: '-80', label: '-80°C (ULT)' },
  { value: '-20', label: '-20°C' },
  { value: '4', label: '4°C (fridge)' },
  { value: 'rt', label: 'Room temperature' },
  { value: 'custom', label: 'Custom' },
];

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

export function StorageUnitDialog({ isOpen, onClose, labId, onCreated }: StorageUnitDialogProps) {
  const [name, setName] = useState('');
  const [storageType, setStorageType] = useState('-80');
  const [notes, setNotes] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [shelves, setShelves] = useState(2);
  const [racksPerShelf, setRacksPerShelf] = useState(5);
  const [boxesPerRack, setBoxesPerRack] = useState(4);
  const [boxRows, setBoxRows] = useState(9);
  const [boxCols, setBoxCols] = useState(9);
  const [preview, setPreview] = useState<{ shelves: number; racks: number; boxes: number; positions: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const template = { shelves, racksPerShelf, boxesPerRack, boxRows, boxCols };

  async function handlePreview() {
    try {
      const res = await storageUnitsApi.previewTemplate(labId, template);
      setPreview(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not preview template');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      await storageUnitsApi.create(labId, {
        name, storage_type: storageType, status: 'normal', notes: notes || undefined,
        template: useTemplate ? template : undefined,
      });
      toast.success('Storage unit created');
      onCreated();
      onClose();
      setName(''); setNotes(''); setUseTemplate(false); setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create storage unit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New storage unit" size="md">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle} htmlFor="unit-name">Name</label>
          <input id="unit-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="ULT Freezer 3" />
        </div>
        <div>
          <label style={labelStyle} htmlFor="unit-type">Storage type</label>
          <select id="unit-type" style={inputStyle} value={storageType} onChange={(e) => setStorageType(e.target.value)}>
            {STORAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="unit-notes">Notes</label>
          <textarea id="unit-notes" style={{ ...inputStyle, minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={useTemplate} onChange={(e) => { setUseTemplate(e.target.checked); setPreview(null); }} />
          Set up shelves/racks/boxes now
        </label>

        {useTemplate && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="tpl-shelves">Shelves</label>
              <input id="tpl-shelves" type="number" min={1} style={inputStyle} value={shelves} onChange={(e) => setShelves(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tpl-racks">Racks per shelf</label>
              <input id="tpl-racks" type="number" min={1} style={inputStyle} value={racksPerShelf} onChange={(e) => setRacksPerShelf(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="tpl-boxes">Boxes per rack</label>
              <input id="tpl-boxes" type="number" min={1} style={inputStyle} value={boxesPerRack} onChange={(e) => setBoxesPerRack(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div>
                <label style={labelStyle} htmlFor="tpl-rows">Box rows</label>
                <input id="tpl-rows" type="number" min={1} style={inputStyle} value={boxRows} onChange={(e) => setBoxRows(Number(e.target.value))} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="tpl-cols">Box cols</label>
                <input id="tpl-cols" type="number" min={1} style={inputStyle} value={boxCols} onChange={(e) => setBoxCols(Number(e.target.value))} />
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="button" onClick={handlePreview} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                Preview
              </button>
              {preview && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  This will create {preview.shelves} shelves, {preview.racks} racks, {preview.boxes} boxes ({preview.positions} positions).
                </p>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
