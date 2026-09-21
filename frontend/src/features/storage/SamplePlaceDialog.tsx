import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import { BarcodeScanner } from '../../components/BarcodeScanner';
import { samplesApi } from '../../lib/api';

interface SampleOption {
  id: string;
  sample_id: string;
  name: string;
  barcode?: string;
}

interface SamplePlaceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labId: string;
  boxId: string;
  row: number;
  col: number;
  label: string;
  onPlaced: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};

export function SamplePlaceDialog({ isOpen, onClose, labId, boxId, row, col, label, onPlaced }: SamplePlaceDialogProps) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SampleOption[]>([]);
  const [selected, setSelected] = useState<SampleOption | null>(null);
  const [searching, setSearching] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  async function runSearch(term: string) {
    if (!term.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await samplesApi.searchByName(labId, term);
      setResults(res.data as SampleOption[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  async function handleScan(value: string) {
    setShowScanner(false);
    setSearch(value);
    try {
      const res = await samplesApi.resolveBarcode(labId, value);
      const found = (res.data as { sample: SampleOption; position: unknown } | null)?.sample;
      if (found) {
        setSelected(found);
        setResults([found]);
      } else {
        toast.error(`No sample found for barcode "${value}"`);
        await runSearch(value);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Barcode lookup failed');
    }
  }

  async function handlePlace() {
    if (!selected) return;
    setPlacing(true);
    try {
      await samplesApi.place(labId, selected.id, boxId, row, col, label);
      toast.success(`${selected.name} placed at ${label}`);
      onPlaced();
      onClose();
      setSearch(''); setResults([]); setSelected(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not place sample — position may already be occupied');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Place sample at ${label}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            style={inputStyle}
            placeholder="Search by sample ID, name, or barcode"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(search)}
          />
          <button type="button" onClick={() => runSearch(search)} style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          <button type="button" onClick={() => setShowScanner(true)} style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            📷 Scan
          </button>
        </div>

        <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No results yet — search or scan a sample to place here.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                style={{
                  textAlign: 'left', padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${selected?.id === r.id ? 'var(--primary)' : 'var(--border)'}`,
                  background: selected?.id === r.id ? 'rgba(99,102,241,0.1)' : 'none',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.sample_id}{r.barcode ? ` · ${r.barcode}` : ''}</div>
              </button>
            ))
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePlace}
            disabled={!selected || placing}
            style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600, opacity: !selected || placing ? 0.6 : 1 }}
          >
            {placing ? 'Placing…' : 'Place here'}
          </button>
        </div>
      </div>

      <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} mode="simple" />
    </Modal>
  );
}
