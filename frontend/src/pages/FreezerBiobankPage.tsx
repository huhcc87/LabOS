import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../convex/_generated/api';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../context/AuthContext';
import { Icon } from '../components/Icon';
import { errText } from '../lib/errors';
import {
  BoxDialog, ConfirmDelete, FreezerDialog, NameDialog, SampleDialog, type SampleValues,
} from '../features/freezer/dialogs';

type Shelf = Doc<'freezer_shelves'>;
type Rack = Doc<'freezer_racks'>;
type Box = Doc<'freezer_boxes'> & { filled: number };
type Slot = Doc<'freezer_slots'>;

/** What the open dialog is for (one at a time). */
type Dialog =
  | { kind: 'newFreezer' } | { kind: 'editFreezer' } | { kind: 'deleteFreezer' }
  | { kind: 'newShelf' } | { kind: 'renameShelf'; shelf: Shelf } | { kind: 'deleteShelf'; shelf: Shelf }
  | { kind: 'newRack'; shelf: Shelf } | { kind: 'renameRack'; rack: Rack } | { kind: 'deleteRack'; rack: Rack }
  | { kind: 'newBox'; rack: Rack } | { kind: 'renameBox'; box: Box } | { kind: 'deleteBox'; box: Box }
  | { kind: 'sample'; box: Box; row: number; col: number };

const letter = (n: number) => String.fromCharCode(65 + n);
const DAY = 86400000;

function slotState(s: Slot | undefined): 'empty' | 'ok' | 'soon' | 'expired' {
  if (!s) return 'empty';
  if (s.expiry_date === undefined) return 'ok';
  const left = s.expiry_date - Date.now();
  return left < 0 ? 'expired' : left < 30 * DAY ? 'soon' : 'ok';
}
const STATE_STYLE = {
  ok: { bg: 'var(--ok-bg)', fg: 'var(--ok-text)', mark: '' },
  soon: { bg: 'var(--warn-bg)', fg: 'var(--warn-text)', mark: '!' },
  expired: { bg: 'var(--bad-bg)', fg: 'var(--bad-text)', mark: '!!' },
} as const;

export default function FreezerBiobankPage() {
  const { token, user, hasRole } = useAuth();
  const canBuild = hasRole('staff'); // add/delete freezers, shelves, racks, boxes
  const t = token ?? undefined;
  const skip = token ? undefined : 'skip';

  const freezers = useQuery(api.freezer.list, skip ?? { token: t });
  const [freezerId, setFreezerId] = useState<Id<'freezers'> | null>(null);
  const freezer = freezers?.find(f => f._id === freezerId) ?? freezers?.[0];
  const structure = useQuery(api.freezer.structure, freezer && token ? { token: t, freezer_id: freezer._id } : 'skip');

  const [rackId, setRackId] = useState<Id<'freezer_racks'> | null>(null);
  const [boxId, setBoxId] = useState<Id<'freezer_boxes'> | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [tab, setTab] = useState<'storage' | 'expiring' | 'search'>('storage');

  const racksByShelf = useMemo(() => {
    const m = new Map<string, Rack[]>();
    for (const r of structure?.racks ?? []) m.set(r.shelf_id, [...(m.get(r.shelf_id) ?? []), r]);
    return m;
  }, [structure]);
  const rack = structure?.racks.find(r => r._id === rackId);
  const boxes = (structure?.boxes ?? []).filter(b => b.rack_id === rack?._id);
  const box = (structure?.boxes ?? []).find(b => b._id === boxId && b.rack_id === rack?._id);
  const shelf = structure?.shelves.find(s => s._id === rack?.shelf_id);

  const slots = useQuery(api.freezer.boxSlots, box && token ? { token: t, box_id: box._id } : 'skip');
  const slotAt = useMemo(() => new Map((slots ?? []).map(s => [`${s.row}:${s.col}`, s])), [slots]);

  // Impact counts for the delete confirmation (only queried while that dialog is open)
  const impactTarget =
    dialog?.kind === 'deleteFreezer' && freezer ? { kind: 'freezer' as const, id: freezer._id }
    : dialog?.kind === 'deleteShelf' ? { kind: 'shelf' as const, id: dialog.shelf._id }
    : dialog?.kind === 'deleteRack' ? { kind: 'rack' as const, id: dialog.rack._id }
    : dialog?.kind === 'deleteBox' ? { kind: 'box' as const, id: dialog.box._id }
    : null;
  const impact = useQuery(api.freezer.impact, impactTarget && token ? { token: t, ...impactTarget } : 'skip');

  const m = {
    createFreezer: useMutation(api.freezer.create), updateFreezer: useMutation(api.freezer.update), removeFreezer: useMutation(api.freezer.remove),
    addShelf: useMutation(api.freezer.addShelf), renameShelf: useMutation(api.freezer.renameShelf), removeShelf: useMutation(api.freezer.removeShelf),
    addRack: useMutation(api.freezer.addRack), renameRack: useMutation(api.freezer.renameRack), removeRack: useMutation(api.freezer.removeRack),
    addBox: useMutation(api.freezer.addBox), renameBox: useMutation(api.freezer.renameBox), removeBox: useMutation(api.freezer.removeBox),
    setSlot: useMutation(api.freezer.setSlot), clearSlot: useMutation(api.freezer.clearSlot),
  };
  const close = () => setDialog(null);

  /** Run a quick action and surface errors as a toast. */
  const act = async (work: () => Promise<unknown>) => { try { await work(); } catch (e) { toast.error(errText(e)); } };

  const loading = freezers === undefined;
  const sampleValues = (s: Slot | undefined): SampleValues => ({
    sample_id: s?.sample_id ?? '', label: s?.label ?? '', sample_type: s?.sample_type ?? '', owner: s?.owner ?? user?.full_name ?? '',
    volume: s?.volume ?? '', barcode: s?.barcode ?? '',
    expiry: s?.expiry_date ? new Date(s.expiry_date).toISOString().slice(0, 10) : '', notes: s?.notes ?? '',
  });

  return (
    <div className="page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Freezers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>Freezer → shelf → rack → box → position. Add what you store, delete what you don't.</p>
        </div>
        {canBuild && (
          <button className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDialog({ kind: 'newFreezer' })}>
            <Icon name="plus" /> New freezer
          </button>
        )}
      </div>

      {/* Freezer picker */}
      {freezers && freezers.length > 0 && (
        <div role="tablist" aria-label="Freezers" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {freezers.map(f => {
            const on = f._id === freezer?._id;
            return (
              <button key={f._id} role="tab" aria-selected={on} className="chip-link"
                onClick={() => { setFreezerId(f._id); setRackId(null); setBoxId(null); }}
                style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-light)', fontWeight: 700 } : undefined}>
                {f.name}{f.temperature !== undefined ? <span style={{ opacity: 0.8 }}>· {f.temperature}°C</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([['storage', 'Storage'], ['expiring', 'Expiring soon'], ['search', 'Find a sample']] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', background: 'none', border: 0, cursor: 'pointer', fontSize: 14, marginBottom: -1,
            borderBottom: `2px solid ${tab === k ? 'var(--accent)' : 'transparent'}`,
            color: tab === k ? 'var(--accent)' : 'var(--text-muted)', fontWeight: tab === k ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      {tab === 'expiring' && <Expiring token={t} />}
      {tab === 'search' && <Search token={t} />}

      {tab === 'storage' && (loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading freezers…</p>
      ) : !freezer ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>No freezers yet</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 16px' }}>
            {canBuild ? 'Add your first freezer, then its shelves, racks and boxes.' : 'Ask a lab manager or your PI to add the lab’s freezers.'}
          </p>
          {canBuild && <button className="btn btn-primary" onClick={() => setDialog({ kind: 'newFreezer' })}>New freezer</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 20, alignItems: 'start' }}>
          {/* Shelves, top to bottom */}
          <section className="card" style={{ padding: 0 }} aria-label={`${freezer.name} layout`}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{freezer.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{[freezer.location, freezer.temperature !== undefined ? `${freezer.temperature}°C` : ''].filter(Boolean).join(' · ') || 'No location set'}</div>
              </div>
              {canBuild && (
                <span>
                  <button className="icon-btn" aria-label="Edit freezer" title="Edit freezer" onClick={() => setDialog({ kind: 'editFreezer' })}><Icon name="pencil" /></button>
                  <button className="icon-btn danger" aria-label="Delete freezer" title="Delete freezer" onClick={() => setDialog({ kind: 'deleteFreezer' })}><Icon name="trash" /></button>
                </span>
              )}
            </header>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {structure === undefined ? <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading…</p>
                : structure.shelves.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                    No shelves yet.{canBuild ? ' Add the top shelf to start.' : ''}
                  </p>
                ) : structure.shelves.map(s => (
                  <div key={s._id}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{s.name}</h3>
                      {canBuild && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <button className="btn btn-sm btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setDialog({ kind: 'newRack', shelf: s })}>
                            <Icon name="plus" size={13} /> Add rack
                          </button>
                          <button className="icon-btn" aria-label={`Rename ${s.name}`} title="Rename shelf" onClick={() => setDialog({ kind: 'renameShelf', shelf: s })}><Icon name="pencil" /></button>
                          <button className="icon-btn danger" aria-label={`Delete ${s.name}`} title="Delete shelf" onClick={() => setDialog({ kind: 'deleteShelf', shelf: s })}><Icon name="trash" /></button>
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
                      {(racksByShelf.get(s._id) ?? []).map(r => {
                        const n = structure.boxes.filter(b => b.rack_id === r._id).length;
                        const on = r._id === rack?._id;
                        return (
                          <button key={r._id} onClick={() => { setRackId(r._id); setBoxId(null); }} aria-pressed={on}
                            style={{
                              padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                              background: on ? 'var(--accent-light)' : 'var(--surface2)', color: 'var(--text)',
                              border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                            }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n} box{n === 1 ? '' : 'es'}</div>
                          </button>
                        );
                      })}
                      {(racksByShelf.get(s._id) ?? []).length === 0 && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No racks on this shelf.</span>}
                    </div>
                  </div>
                ))}
              {canBuild && (
                <button className="btn btn-secondary" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setDialog({ kind: 'newShelf' })}>
                  <Icon name="plus" /> Add shelf{structure && structure.shelves.length > 0 ? ' below' : ''}
                </button>
              )}
            </div>
          </section>

          {/* Boxes in the chosen rack, then the box itself */}
          <section aria-label="Rack contents" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {!rack ? (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                Pick a rack on the left to see its boxes.
              </div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{freezer.name} › {shelf?.name}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{rack.name}</div>
                  </div>
                  {canBuild && (
                    <span>
                      <button className="icon-btn" aria-label={`Rename ${rack.name}`} title="Rename rack" onClick={() => setDialog({ kind: 'renameRack', rack })}><Icon name="pencil" /></button>
                      <button className="icon-btn danger" aria-label={`Delete ${rack.name}`} title="Delete rack" onClick={() => setDialog({ kind: 'deleteRack', rack })}><Icon name="trash" /></button>
                    </span>
                  )}
                </header>
                <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                  {boxes.map(b => {
                    const total = b.rows * b.cols;
                    const on = b._id === box?._id;
                    return (
                      <button key={b._id} onClick={() => setBoxId(b._id)} aria-pressed={on} style={{
                        padding: 12, borderRadius: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
                        background: on ? 'var(--accent-light)' : 'var(--surface)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{b.rows} × {b.cols} · {b.filled}/{total} used</div>
                        <div style={{ height: 4, borderRadius: 2, background: 'var(--surface3)' }} aria-hidden="true">
                          <div style={{ width: `${Math.round((b.filled / total) * 100)}%`, height: '100%', borderRadius: 2, background: 'var(--accent)' }} />
                        </div>
                      </button>
                    );
                  })}
                  {canBuild && (
                    <button onClick={() => setDialog({ kind: 'newBox', rack })} style={{
                      padding: 12, borderRadius: 8, cursor: 'pointer', border: '1px dashed var(--border)', background: 'transparent',
                      color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 74,
                    }}><Icon name="plus" /> New box</button>
                  )}
                  {boxes.length === 0 && !canBuild && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>No boxes in this rack yet.</span>}
                </div>
              </div>
            )}

            {box && (
              <div className="card" style={{ padding: 0 }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{freezer.name} › {shelf?.name} › {rack?.name}</div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{box.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{slots ? slots.filter(s => s.sample_id || s.label).length : box.filled} of {box.rows * box.cols} positions used</div>
                  </div>
                  {canBuild && (
                    <span>
                      <button className="icon-btn" aria-label={`Rename ${box.name}`} title="Rename box" onClick={() => setDialog({ kind: 'renameBox', box })}><Icon name="pencil" /></button>
                      <button className="icon-btn danger" aria-label={`Delete ${box.name}`} title="Delete box" onClick={() => setDialog({ kind: 'deleteBox', box })}><Icon name="trash" /></button>
                    </span>
                  )}
                </header>
                <div style={{ padding: 16, overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `24px repeat(${box.cols}, minmax(40px, 1fr))`, gap: 4, minWidth: 24 + box.cols * 44 }}>
                    <span />
                    {Array.from({ length: box.cols }, (_, c) => <span key={c} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{c + 1}</span>)}
                    {Array.from({ length: box.rows }, (_, r) => (
                      <RowCells key={r} r={r} box={box} slotAt={slotAt} onPick={(row, col) => setDialog({ kind: 'sample', box, row, col })} />
                    ))}
                  </div>
                  <ul style={{ display: 'flex', gap: 16, flexWrap: 'wrap', listStyle: 'none', padding: 0, margin: '14px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                    <li>Empty (click to add)</li><li style={{ color: 'var(--ok-text)' }}>■ In storage</li>
                    <li style={{ color: 'var(--warn-text)' }}>! Expires within 30 days</li><li style={{ color: 'var(--bad-text)' }}>!! Expired</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>
      ))}

      {/* Dialogs */}
      {dialog?.kind === 'newFreezer' && <FreezerDialog onClose={close} onSubmit={async v => { const id = await m.createFreezer({ token: t, ...v }); setFreezerId(id); }} />}
      {dialog?.kind === 'editFreezer' && freezer && <FreezerDialog initial={freezer} onClose={close} onSubmit={v => m.updateFreezer({ token: t, id: freezer._id, ...v })} />}
      {dialog?.kind === 'deleteFreezer' && freezer && (
        <ConfirmDelete title="Delete freezer" what={freezer.name} impact={impact} onClose={close}
          onConfirm={async () => { await m.removeFreezer({ token: t, id: freezer._id }); setFreezerId(null); setRackId(null); setBoxId(null); }} />
      )}
      {dialog?.kind === 'newShelf' && freezer && (
        <NameDialog title="Add shelf" fieldLabel="Shelf name" placeholder={structure?.shelves.length ? `Shelf ${structure.shelves.length + 1}` : 'Top shelf'} confirm="Add shelf"
          onClose={close} onSubmit={name => m.addShelf({ token: t, freezer_id: freezer._id, name }).then(() => undefined)} />
      )}
      {dialog?.kind === 'renameShelf' && <NameDialog title="Rename shelf" fieldLabel="Shelf name" initial={dialog.shelf.name} confirm="Save" onClose={close} onSubmit={name => m.renameShelf({ token: t, id: dialog.shelf._id, name })} />}
      {dialog?.kind === 'deleteShelf' && <ConfirmDelete title="Delete shelf" what={dialog.shelf.name} impact={impact} onClose={close}
        onConfirm={async () => { await m.removeShelf({ token: t, id: dialog.shelf._id }); if (rack?.shelf_id === dialog.shelf._id) { setRackId(null); setBoxId(null); } }} />}
      {dialog?.kind === 'newRack' && (
        <NameDialog title={`Add rack to ${dialog.shelf.name}`} fieldLabel="Rack name" initial={`Rack #${(racksByShelf.get(dialog.shelf._id)?.length ?? 0) + 1}`} confirm="Add rack"
          onClose={close} onSubmit={async name => { const id = await m.addRack({ token: t, shelf_id: dialog.shelf._id, name }); setRackId(id); setBoxId(null); }} />
      )}
      {dialog?.kind === 'renameRack' && <NameDialog title="Rename rack" fieldLabel="Rack name" initial={dialog.rack.name} confirm="Save" onClose={close} onSubmit={name => m.renameRack({ token: t, id: dialog.rack._id, name })} />}
      {dialog?.kind === 'deleteRack' && <ConfirmDelete title="Delete rack" what={dialog.rack.name} impact={impact} onClose={close}
        onConfirm={async () => { await m.removeRack({ token: t, id: dialog.rack._id }); if (rackId === dialog.rack._id) { setRackId(null); setBoxId(null); } }} />}
      {dialog?.kind === 'newBox' && <BoxDialog onClose={close} onSubmit={async v => { const id = await m.addBox({ token: t, rack_id: dialog.rack._id, ...v }); setBoxId(id); }} />}
      {dialog?.kind === 'renameBox' && <NameDialog title="Rename box" fieldLabel="Box name" initial={dialog.box.name} confirm="Save" onClose={close} onSubmit={name => m.renameBox({ token: t, id: dialog.box._id, name })} />}
      {dialog?.kind === 'deleteBox' && <ConfirmDelete title="Delete box" what={dialog.box.name} impact={impact} onClose={close}
        onConfirm={async () => { await m.removeBox({ token: t, id: dialog.box._id }); if (boxId === dialog.box._id) setBoxId(null); }} />}
      {dialog?.kind === 'sample' && (() => {
        const s = slotAt.get(`${dialog.row}:${dialog.col}`);
        const { box: b, row, col } = dialog;
        return (
          <SampleDialog position={`${letter(row)}${col + 1} in ${b.name}`} existing={!!s} initial={sampleValues(s)} defaultOwner={user?.full_name ?? ''} onClose={close}
            onSave={v => m.setSlot({
              token: t, box_id: b._id, row, col,
              sample_id: v.sample_id.trim() || undefined, label: v.label.trim() || undefined, sample_type: v.sample_type.trim() || undefined,
              owner: v.owner.trim() || undefined, volume: v.volume.trim() || undefined, barcode: v.barcode.trim() || undefined,
              expiry_date: v.expiry ? new Date(`${v.expiry}T00:00:00`).getTime() : undefined, notes: v.notes.trim() || undefined,
            }).then(() => undefined)}
            onDelete={() => m.clearSlot({ token: t, box_id: b._id, row, col })} />
        );
      })()}
    </div>
  );
}

function RowCells({ r, box, slotAt, onPick }: {
  r: number; box: Box; slotAt: Map<string, Slot>; onPick: (row: number, col: number) => void;
}) {
  return (
    <>
      <span style={{ alignSelf: 'center', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>{letter(r)}</span>
      {Array.from({ length: box.cols }, (_, c) => {
        const s = slotAt.get(`${r}:${c}`);
        const st = slotState(s);
        const pos = `${letter(r)}${c + 1}`;
        const text = s ? (s.sample_id || s.label || '') : '';
        const style = st === 'empty'
          ? { background: 'var(--surface2)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }
          : { background: STATE_STYLE[st].bg, color: STATE_STYLE[st].fg, border: '1px solid transparent' };
        return (
          <button key={c} onClick={() => onPick(r, c)} style={{ ...style, borderRadius: 6, minHeight: 40, padding: 2, fontSize: 11, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            aria-label={s ? `${pos}: ${text}${st === 'soon' ? ', expires soon' : st === 'expired' ? ', expired' : ''}. Open` : `${pos}: empty. Add a sample`}
            title={s ? `${pos} · ${text}${s.sample_type ? ` · ${s.sample_type}` : ''}` : `${pos} · add a sample`}>
            {s ? <>{STATE_STYLE[st as 'ok'].mark}{text}</> : <Icon name="plus" size={12} />}
          </button>
        );
      })}
    </>
  );
}

function Expiring({ token }: { token: string | undefined }) {
  const [days, setDays] = useState(30);
  const rows = useQuery(api.freezer.getExpiring, token ? { token, days } : 'skip');
  return (
    <section aria-label="Expiring samples">
      <label style={{ fontSize: 14 }}>Show samples that expire within{' '}
        <select className="form-select" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 120, display: 'inline-block' }}>
          {[7, 30, 60, 90, 180].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
      </label>
      <div className="card" style={{ padding: 0, marginTop: 14 }}>
        {rows === undefined ? <p style={{ padding: 16, margin: 0 }}>Loading…</p>
          : rows.length === 0 ? <p style={{ padding: 24, margin: 0, color: 'var(--text-muted)' }}>Nothing expires in the next {days} days.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Sample</th><th style={{ padding: 10 }}>Where</th><th style={{ padding: 10 }}>Expires</th>
              </tr></thead>
              <tbody>{rows.map(s => (
                <tr key={s._id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, fontWeight: 700 }}>{s.sample_id || s.label}</td>
                  <td style={{ padding: 10, color: 'var(--text-muted)' }}>{s.path}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: s.expired ? 'var(--bad-bg)' : 'var(--warn-bg)', color: s.expired ? 'var(--bad-text)' : 'var(--warn-text)' }}>
                      {s.expired ? 'Expired ' : ''}{s.expiry_date ? new Date(s.expiry_date).toLocaleDateString() : ''}
                    </span>
                  </td>
                </tr>))}</tbody>
            </table>}
      </div>
    </section>
  );
}

function Search({ token }: { token: string | undefined }) {
  const [q, setQ] = useState('');
  const rows = useQuery(api.freezer.search, token && q.trim().length >= 2 ? { token, query: q } : 'skip');
  return (
    <section aria-label="Find a sample">
      <label htmlFor="fz-search" style={{ display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Search by sample ID, name, type, owner or barcode</label>
      <input id="fz-search" className="form-input" style={{ width: '100%', maxWidth: 520 }} value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. HeLa, S-00123, DNA" />
      <div className="card" style={{ padding: 0, marginTop: 14 }}>
        {q.trim().length < 2 ? <p style={{ padding: 24, margin: 0, color: 'var(--text-muted)' }}>Type at least 2 characters.</p>
          : rows === undefined ? <p style={{ padding: 16, margin: 0 }}>Searching…</p>
            : rows.length === 0 ? <p style={{ padding: 24, margin: 0, color: 'var(--text-muted)' }}>No samples match “{q}”.</p>
              : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{rows.map(s => (
                <li key={s._id} style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                  <strong>{s.sample_id || s.label}</strong>{s.sample_type ? ` · ${s.sample_type}` : ''}{s.owner ? ` · ${s.owner}` : ''}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.path}</div>
                </li>))}</ul>}
      </div>
    </section>
  );
}
