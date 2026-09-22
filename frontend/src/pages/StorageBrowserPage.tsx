import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { storageUnitsApi, storageNodesApi, storagePositionsApi, samplesApi } from '../lib/api';
import { useCurrentLab } from '../features/storage/useCurrentLab';
import { StorageBreadcrumbs, type Crumb } from '../features/storage/StorageBreadcrumbs';
import { OccupancySummary, type OccupancyStats } from '../features/storage/OccupancySummary';
import { PositionGrid, type GridPosition } from '../features/storage/PositionGrid';
import { StorageUnitDialog } from '../features/storage/StorageUnitDialog';
import { StorageNodeDialog } from '../features/storage/StorageNodeDialog';
import { SampleBatchImportWizard } from '../features/storage/SampleBatchImportWizard';
import { SamplePlaceDialog } from '../features/storage/SamplePlaceDialog';
import { SampleActionsDialog } from '../features/storage/SampleActionsDialog';
import { BarcodeScanner } from '../components/BarcodeScanner';

interface StorageUnit {
  id: string; name: string; storage_type: string; status: string;
  version: number; archived_at?: number;
}

interface StorageNode {
  id: string; name: string; kind: 'shelf' | 'rack' | 'box';
  parent_id?: string; rows?: number; cols?: number;
  version: number; archived_at?: number;
}

type ParentKind = 'unit' | 'shelf' | 'rack';
const NEXT_KIND: Record<'shelf' | 'rack' | 'box', ParentKind> = { shelf: 'shelf', rack: 'rack', box: 'rack' };

export default function StorageBrowserPage() {
  const { loading: labLoading, error: labError, memberships, labId, setLabId } = useCurrentLab();

  const [units, setUnits] = useState<StorageUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<StorageUnit | null>(null);
  const [unitOccupancy, setUnitOccupancy] = useState<OccupancyStats | null>(null);

  const [parentStack, setParentStack] = useState<Array<{ id: string; name: string; kind: 'shelf' | 'rack' }>>([]);
  const [nodes, setNodes] = useState<StorageNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);

  const [selectedBox, setSelectedBox] = useState<StorageNode | null>(null);
  const [boxPositions, setBoxPositions] = useState<{ rows: number; cols: number; positions: any[] } | null>(null);

  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showNodeDialog, setShowNodeDialog] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [placeCell, setPlaceCell] = useState<{ row: number; col: number; label: string } | null>(null);
  const [actionsCell, setActionsCell] = useState<{ sampleId: string; label: string } | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  const currentParent = parentStack[parentStack.length - 1];
  const currentParentKind: ParentKind = currentParent ? NEXT_KIND[currentParent.kind] : 'unit';

  const loadUnits = useCallback(async () => {
    if (!labId) return;
    setUnitsLoading(true);
    try {
      const res = await storageUnitsApi.list(labId);
      setUnits(res.data as StorageUnit[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load storage units');
      setUnits([]);
    } finally {
      setUnitsLoading(false);
    }
  }, [labId]);

  useEffect(() => { loadUnits(); }, [loadUnits]);

  const loadUnitOccupancy = useCallback(async (unit: StorageUnit) => {
    if (!labId) return;
    try {
      const res = await storageUnitsApi.occupancy(labId, unit.id);
      setUnitOccupancy(res.data as OccupancyStats);
    } catch { setUnitOccupancy(null); }
  }, [labId]);

  const loadNodes = useCallback(async (unit: StorageUnit, parentId?: string) => {
    if (!labId) return;
    setNodesLoading(true);
    try {
      const res = await storageNodesApi.list(labId, unit.id, parentId);
      setNodes(res.data as StorageNode[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load storage nodes');
      setNodes([]);
    } finally {
      setNodesLoading(false);
    }
  }, [labId]);

  function openUnit(unit: StorageUnit) {
    setSelectedUnit(unit);
    setParentStack([]);
    setSelectedBox(null);
    loadUnitOccupancy(unit);
    loadNodes(unit, undefined);
  }

  const loadBoxPositions = useCallback(async (boxId: string) => {
    if (!labId) return;
    try {
      const res = await storagePositionsApi.listForBox(labId, boxId);
      setBoxPositions(res.data as any);
    } catch {
      setBoxPositions(null);
    }
  }, [labId]);

  function drillInto(node: StorageNode) {
    if (node.kind === 'box') {
      setSelectedBox(node);
      loadBoxPositions(node.id);
      return;
    }
    if (!selectedUnit) return;
    const next = [...parentStack, { id: node.id, name: node.name, kind: node.kind as 'shelf' | 'rack' }];
    setParentStack(next);
    setSelectedBox(null);
    loadNodes(selectedUnit, node.id);
  }

  function handleCellClick(cell: GridPosition) {
    if (!selectedBox) return;
    if (cell.state === 'empty') {
      setPlaceCell({ row: cell.row, col: cell.col, label: cell.label });
    } else if (cell.sample_id) {
      setActionsCell({ sampleId: cell.sample_id, label: cell.label });
    }
  }

  async function handleScan(value: string) {
    setShowScanner(false);
    if (!labId) return;
    try {
      const res = await samplesApi.resolveBarcode(labId, value);
      const found = res.data as { sample: { name: string }; position: { label: string } | null } | null;
      if (!found) {
        toast.error(`No sample found for barcode "${value}"`);
      } else if (found.position) {
        toast.success(`${found.sample.name} is at ${found.position.label}`);
      } else {
        toast(`${found.sample.name} found — not currently placed anywhere`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Barcode lookup failed');
    }
  }

  function navigateBreadcrumb(id: string | null) {
    if (!selectedUnit) return;
    setSelectedBox(null);
    if (id === null) {
      setParentStack([]);
      loadNodes(selectedUnit, undefined);
      return;
    }
    const idx = parentStack.findIndex((p) => p.id === id);
    const next = idx >= 0 ? parentStack.slice(0, idx + 1) : parentStack;
    setParentStack(next);
    loadNodes(selectedUnit, id);
  }

  async function handleArchiveUnit(unit: StorageUnit) {
    if (!labId) return;
    try {
      await storageUnitsApi.archive(labId, unit.id, unit.version);
      toast.success('Storage unit archived');
      loadUnits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive — it may still hold samples');
    }
  }

  async function handleRestoreUnit(unit: StorageUnit) {
    if (!labId) return;
    try {
      await storageUnitsApi.restore(labId, unit.id, unit.version);
      toast.success('Storage unit restored');
      loadUnits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not restore');
    }
  }

  async function handleArchiveNode(node: StorageNode) {
    if (!labId || !selectedUnit) return;
    try {
      await storageNodesApi.archive(labId, node.id, node.version);
      toast.success(`${node.kind} archived`);
      loadNodes(selectedUnit, currentParent?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive — it may still hold samples');
    }
  }

  if (labLoading) return <div className="page">Loading your lab…</div>;

  if (labError) {
    return <div className="page"><div className="card" style={{ padding: 32, textAlign: 'center' }}>Could not load lab membership: {labError}</div></div>;
  }

  if (memberships.length === 0) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          You are not a member of any lab yet. Ask a lab admin to add you before you can manage storage.
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Storage Hierarchy</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>Freezers → shelves → racks → boxes → positions</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setShowScanner(true)} style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>
            📷 Scan barcode
          </button>
          {memberships.length > 1 && (
            <select value={labId ?? ''} onChange={(e) => setLabId(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
              {memberships.map((m) => <option key={m.lab_id} value={m.lab_id}>{m.lab?.name ?? m.lab_id}</option>)}
            </select>
          )}
        </div>
      </div>

      {!selectedUnit ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={() => setShowUnitDialog(true)} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              + New storage unit
            </button>
          </div>
          {unitsLoading ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>Loading storage units…</div>
          ) : units.length === 0 ? (
            <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              No storage units yet. Create your first freezer to get started.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {units.map((unit) => (
                <div key={unit.id} className="card" style={{ padding: 16, opacity: unit.archived_at ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <button onClick={() => openUnit(unit)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: 15, color: 'var(--text)', textAlign: 'left' }}>
                      🧊 {unit.name}
                    </button>
                    {unit.archived_at ? (
                      <button onClick={() => handleRestoreUnit(unit)} style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', padding: '4px 8px' }}>Restore</button>
                    ) : (
                      <button onClick={() => handleArchiveUnit(unit)} style={{ fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer', padding: '4px 8px' }}>Archive</button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{unit.storage_type} · {unit.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button onClick={() => setSelectedUnit(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, padding: 0 }}>
              ← All storage units
            </button>
            <button onClick={() => setShowBatchImport(true)} style={{ padding: '6px 12px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>
              📋 Batch import
            </button>
          </div>

          <StorageBreadcrumbs
            crumbs={[
              { id: null, name: selectedUnit.name } as Crumb,
              ...parentStack.map((p): Crumb => ({ id: p.id, name: p.name })),
            ]}
            onNavigate={navigateBreadcrumb}
          />

          {unitOccupancy && <div className="card" style={{ padding: 16, marginBottom: 16 }}><OccupancySummary stats={unitOccupancy} /></div>}

          {selectedBox ? (
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{selectedBox.name}</div>
              {boxPositions ? (
                <PositionGrid rows={boxPositions.rows} cols={boxPositions.cols} positions={boxPositions.positions} onCellClick={handleCellClick} />
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>Loading positions…</div>
              )}
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                Click an empty position to place a sample, or an occupied one to move, check out, or dispose it.
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => setShowNodeDialog(true)} style={{ padding: '6px 14px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'none', cursor: 'pointer' }}>
                  + New {currentParentKind === 'unit' ? 'shelf' : currentParentKind === 'shelf' ? 'rack' : 'box'}
                </button>
              </div>
              {nodesLoading ? (
                <div className="card" style={{ padding: 32, textAlign: 'center' }}>Loading…</div>
              ) : nodes.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Nothing here yet.</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {nodes.map((node) => (
                    <div key={node.id} className="card" style={{ padding: 12, opacity: node.archived_at ? 0.6 : 1 }}>
                      <button onClick={() => drillInto(node)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text)', textAlign: 'left', width: '100%' }}>
                        {node.kind === 'box' ? '📦' : node.kind === 'rack' ? '🗄️' : '📚'} {node.name}
                      </button>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{node.kind}</span>
                        {node.archived_at ? (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>archived</span>
                        ) : (
                          <button onClick={() => handleArchiveNode(node)} style={{ fontSize: 10, border: '1px solid var(--border)', borderRadius: 4, background: 'none', cursor: 'pointer', padding: '2px 6px' }}>Archive</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {labId && (
        <StorageUnitDialog isOpen={showUnitDialog} onClose={() => setShowUnitDialog(false)} labId={labId} onCreated={loadUnits} />
      )}
      {labId && selectedUnit && (
        <StorageNodeDialog
          isOpen={showNodeDialog}
          onClose={() => setShowNodeDialog(false)}
          labId={labId}
          unitId={selectedUnit.id}
          parentId={currentParent?.id}
          parentKind={currentParentKind}
          onCreated={() => loadNodes(selectedUnit, currentParent?.id)}
        />
      )}
      {labId && selectedBox && placeCell && (
        <SamplePlaceDialog
          isOpen={!!placeCell}
          onClose={() => setPlaceCell(null)}
          labId={labId}
          boxId={selectedBox.id}
          row={placeCell.row}
          col={placeCell.col}
          label={placeCell.label}
          onPlaced={() => {
            loadBoxPositions(selectedBox.id);
            if (selectedUnit) loadUnitOccupancy(selectedUnit);
          }}
        />
      )}
      {labId && selectedUnit && actionsCell && (
        <SampleActionsDialog
          isOpen={!!actionsCell}
          onClose={() => setActionsCell(null)}
          labId={labId}
          unitId={selectedUnit.id}
          sampleId={actionsCell.sampleId}
          currentLabel={actionsCell.label}
          onChanged={() => {
            if (selectedBox) loadBoxPositions(selectedBox.id);
            loadUnitOccupancy(selectedUnit);
          }}
        />
      )}
      <BarcodeScanner isOpen={showScanner} onClose={() => setShowScanner(false)} onScan={handleScan} mode="simple" />
      {labId && selectedUnit && (
        <SampleBatchImportWizard
          isOpen={showBatchImport}
          onClose={() => setShowBatchImport(false)}
          labId={labId}
          unitId={selectedUnit.id}
          onImported={() => {
            if (selectedBox) loadBoxPositions(selectedBox.id);
            loadUnitOccupancy(selectedUnit);
          }}
        />
      )}
    </div>
  );
}
