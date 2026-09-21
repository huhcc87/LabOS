import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '../../components/Modal';
import { storageNodesApi } from '../../lib/api';

type ParentKind = 'unit' | 'shelf' | 'rack';
type NodeKind = 'shelf' | 'rack' | 'box';

const CHILD_KIND: Record<ParentKind, NodeKind> = { unit: 'shelf', shelf: 'rack', rack: 'box' };
const CHILD_LABEL: Record<NodeKind, string> = { shelf: 'shelf', rack: 'rack', box: 'box' };

interface StorageNodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  labId: string;
  unitId: string;
  parentId?: string;
  parentKind: ParentKind;
  onCreated: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 };

export function StorageNodeDialog({ isOpen, onClose, labId, unitId, parentId, parentKind, onCreated }: StorageNodeDialogProps) {
  const kind = CHILD_KIND[parentKind];
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState(kind === 'box' ? 'Box ' : kind === 'rack' ? 'Rack ' : 'Shelf ');
  const [count, setCount] = useState(4);
  const [start, setStart] = useState(1);
  const [padding, setPadding] = useState(1);
  const [rows, setRows] = useState(9);
  const [cols, setCols] = useState(9);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'single') {
        if (!name.trim()) { toast.error('Name is required'); setSubmitting(false); return; }
        await storageNodesApi.create(labId, {
          unitId, parentId, kind, name,
          rows: kind === 'box' ? rows : undefined, cols: kind === 'box' ? cols : undefined,
        });
      } else {
        await storageNodesApi.createBatch(labId, {
          unitId, parentId, kind, count, prefix, start, padding,
          rows: kind === 'box' ? rows : undefined, cols: kind === 'box' ? cols : undefined,
        });
      }
      toast.success(`${CHILD_LABEL[kind]} created`);
      onCreated();
      onClose();
      setName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to create ${CHILD_LABEL[kind]}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`New ${CHILD_LABEL[kind]}`} size="sm">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['single', 'batch'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: mode === m ? 'var(--accent)' : 'none', color: mode === m ? '#fff' : 'var(--text)' }}>
              {m === 'single' ? 'One at a time' : 'Batch'}
            </button>
          ))}
        </div>

        {mode === 'single' ? (
          <div>
            <label style={labelStyle} htmlFor="node-name">Name</label>
            <input id="node-name" style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="node-prefix">Prefix</label>
              <input id="node-prefix" style={inputStyle} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="node-count">Count</label>
              <input id="node-count" type="number" min={1} style={inputStyle} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="node-start">Start at</label>
              <input id="node-start" type="number" min={0} style={inputStyle} value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="node-padding">Zero padding</label>
              <input id="node-padding" type="number" min={1} max={4} style={inputStyle} value={padding} onChange={(e) => setPadding(Number(e.target.value))} />
            </div>
          </div>
        )}

        {kind === 'box' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <label style={labelStyle} htmlFor="box-rows">Rows</label>
              <input id="box-rows" type="number" min={1} style={inputStyle} value={rows} onChange={(e) => setRows(Number(e.target.value))} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="box-cols">Columns</label>
              <input id="box-cols" type="number" min={1} style={inputStyle} value={cols} onChange={(e) => setCols(Number(e.target.value))} />
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
