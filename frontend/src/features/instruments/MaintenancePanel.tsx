import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';
import { PRESETS, statusOf } from './InstrumentBooking';

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 };

const TYPES: [string, string][] = [['repair', 'Repair'], ['service', 'Service'], ['preventive', 'Preventive maintenance'], ['calibration', 'Calibration'], ['part', 'Part replacement'], ['inspection', 'Inspection / safety check']];
const CATEGORIES: [string, string][] = [['mechanical', 'Mechanical (moving parts, lid, door)'], ['electrical', 'Electrical / power'], ['software', 'Software / firmware'], ['leak', 'Leak / seal'], ['contamination', 'Contamination'], ['noise', 'Noise / vibration'], ['error_code', 'Error code on screen'], ['calibration_drift', 'Readings off / calibration drift'], ['consumable', 'Consumable / part needed'], ['other', 'Other']];
const PRIORITIES: [string, string][] = [['low', 'Low: can wait'], ['normal', 'Normal'], ['high', 'High: blocks experiments'], ['urgent', 'Urgent: safety risk']];
const IMPACTS: [string, string][] = [['not_working', 'Not working (take out of service)'], ['partly_working', 'Partly working'], ['still_usable', 'Still usable']];
const PI_ACTIONS: [string, string][] = [['planned', 'Plan the repair'], ['sent_out', 'Send out to vendor / manufacturer'], ['in_progress', 'Repair in the lab'], ['waiting_parts', 'Waiting for parts'], ['completed', 'Fixed: back in service'], ['retired', "Can't be repaired: retire instrument"]];
const STATUS: Record<string, { text: string; color: string; bg: string }> = {
  reported: { text: 'Reported: waiting for PI/admin', color: '#b45309', bg: 'rgba(245,158,11,0.14)' },
  planned: { text: 'Repair planned', color: '#7c3aed', bg: 'rgba(124,58,237,0.12)' },
  sent_out: { text: 'Sent out for repair', color: '#0e7490', bg: 'rgba(8,145,178,0.14)' },
  in_progress: { text: 'Being repaired', color: '#1d4ed8', bg: 'rgba(59,130,246,0.14)' },
  waiting_parts: { text: 'Waiting for parts', color: '#a16207', bg: 'rgba(234,179,8,0.16)' },
  completed: { text: 'Fixed', color: '#15803d', bg: 'rgba(34,197,94,0.14)' },
  retired: { text: 'Retired', color: '#475569', bg: 'rgba(100,116,139,0.16)' },
};
const PRIORITY_COLOR: Record<string, string> = { low: '#64748b', normal: '#0369a1', high: '#c2410c', urgent: '#b91c1c' };
const INSTRUMENT_STATE: Record<string, string> = { active: 'Active', available: 'Active', not_used: 'Not used', maintenance: 'Under repair' };
const stamp = (ms: number) => new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayOnly = (ms: number) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const pretty = (s?: string) => (s ?? '').replace(/_/g, ' ');

interface Form { customName: string; instrument: string; type: string; category: string; priority: string; impact: string; code: string; note: string }
interface Plan { status: string; vendor: string; expected: string; cost: string; note: string }

const CUSTOM = '__custom__';

/** A dropdown; with `custom`, the last choice lets the person type their own value. */
function Select({ id, label, value, onChange, options, custom }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][]; custom?: boolean }) {
  const [typing, setTyping] = useState(false);
  return (
    <div>
      <label style={lbl} htmlFor={id}>{label}</label>
      <select id={id} value={typing ? CUSTOM : value} onChange={(e) => { const isCustom = e.target.value === CUSTOM; setTyping(isCustom); onChange(isCustom ? '' : e.target.value); }} style={input}>
        {options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        {custom && <option value={CUSTOM}>Other: type my own…</option>}
      </select>
      {typing && <input aria-label={`${label} (your own)`} autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type here" maxLength={60} style={{ ...input, marginTop: 6 }} />}
    </div>
  );
}

/** Instrument problems: anyone reports with details; PI/admin are notified and plan, send out, repair or retire. */
export default function MaintenancePanel() {
  const { token } = useAuth();
  const data = useQuery(api.maintenanceFlow.overview, token ? { token } : 'skip');
  const report = useMutation(api.maintenanceFlow.report);
  const update = useMutation(api.maintenanceFlow.update);
  const remove = useMutation(api.maintenanceFlow.remove);
  // Equipment list (the same instruments used for booking)
  const equipment = useQuery(api.instrumentBooking.overview, token ? { token } : 'skip');
  const addEquipment = useMutation(api.instruments.create);
  const [addingEq, setAddingEq] = useState<{ picked: string[]; custom: string; model: string; serial: string; location: string } | null>(null);

  const [form, setForm] = useState<Form | null>(null);
  const [filter, setFilter] = useState('open');
  const [instFilter, setInstFilter] = useState('all');
  const [plan, setPlan] = useState<{ id: Id<'maintenance'>; p: Plan } | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); return true; } catch (e) { toast.error(errText(e)); return false; } };
  const set = (k: keyof Form, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const send = async () => {
    if (!token || !form) return;
    if (!form.instrument) return toast.error('Choose the instrument.');
    if (!form.note.trim()) return toast.error('Write a short note about the problem.');
    // A common instrument or your own that isn't in the equipment list yet is added first.
    const newName = form.instrument === '__custom__' ? form.customName.trim() : form.instrument.startsWith('preset:') ? form.instrument.slice(7) : '';
    if (form.instrument === '__custom__' && !newName) return toast.error('Type the instrument name.');
    setBusy(true);
    const ok = await act(async () => {
      const id = newName ? await addEquipment({ token, name: newName.slice(0, 80), status: 'active' }) : (form.instrument as Id<'instruments'>);
      await report({ token, instrument_id: id as Id<'instruments'>, maintenance_type: form.type, category: form.category, priority: form.priority, impact: form.impact, error_code: form.code, note: form.note });
    }, 'Sent to the PI and admins.');
    setBusy(false);
    if (ok) setForm(null);
  };

  const savePlan = async () => {
    if (!token || !plan) return;
    const { p } = plan;
    const cost = p.cost.trim() === '' ? undefined : Number(p.cost);
    if (cost !== undefined && !(cost >= 0)) return toast.error('Cost must be a number.');
    if (p.status === 'sent_out' && !p.vendor.trim()) return toast.error('Say who it is sent to (vendor or manufacturer).');
    if (p.status === 'retired' && !confirm('Retire this instrument? It will be removed from the instrument lists.')) return;
    const ok = await act(() => update({ token, id: plan.id, status: p.status, note: p.note, vendor: p.vendor, cost, expected_date: p.expected ? new Date(`${p.expected}T12:00:00`).getTime() : undefined }), 'Updated. The reporter is notified.');
    if (ok) setPlan(null);
  };

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  const open = (s: string) => !['completed', 'retired'].includes(s);
  const shown = data.issues.filter((i) => (filter === 'all' || (filter === 'open' ? open(i.status) : i.status === filter)) && (instFilter === 'all' || i.instrument_id === instFilter));
  const priorityRank = (p?: string) => PRIORITIES.findIndex(([k]) => k === p);
  shown.sort((a, b) => Number(open(b.status)) - Number(open(a.status)) || priorityRank(b.priority) - priorityRank(a.priority) || b.created_at - a.created_at);

  const haveNames = new Set((equipment?.instruments ?? []).map((i) => i.name.toLowerCase()));
  const pickedNames = (a: { picked: string[]; custom: string }) => [...new Set([...a.picked, ...a.custom.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)])].filter((n) => !haveNames.has(n.toLowerCase()));
  const saveEquipment = async () => {
    if (!token || !addingEq) return;
    const names = pickedNames(addingEq);
    if (names.length === 0) return toast.error('Tick at least one instrument or type your own.');
    const single = names.length === 1;
    const ok = await act(async () => {
      for (const name of names) await addEquipment({ token, name: name.slice(0, 80), model: single ? addingEq.model.trim() || undefined : undefined, serial_number: single ? addingEq.serial.trim() || undefined : undefined, location: addingEq.location.trim() || undefined, status: 'active' });
    }, `${names.length} instrument${names.length === 1 ? '' : 's'} added`);
    if (ok) setAddingEq(null);
  };
  const openCount = (id: string) => data.issues.filter((i) => i.instrument_id === id && open(i.status)).length;

  return (
    <div>
      {/* Equipment management: every instrument, its state, and a quick way to report a problem */}
      <section aria-label="Equipment" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Equipment <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({equipment?.instruments.length ?? 0})</span></h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setAddingEq(addingEq ? null : { picked: [], custom: '', model: '', serial: '', location: '' })}>+ Add equipment</button>
        </div>
        {addingEq && (
          <div className="card" style={{ padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>Pick the instruments your lab has</strong>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setAddingEq({ ...addingEq, picked: PRESETS.filter((p) => !haveNames.has(p.toLowerCase())) })}>Select all</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAddingEq({ ...addingEq, picked: [] })}>Clear</button>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 4, marginBottom: 10 }}>
              {PRESETS.map((p) => {
                const have = haveNames.has(p.toLowerCase());
                return (
                  <label key={p} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', opacity: have ? 0.5 : 1 }}>
                    <input type="checkbox" disabled={have} checked={have || addingEq.picked.includes(p)} onChange={(e) => setAddingEq({ ...addingEq, picked: e.target.checked ? [...addingEq.picked, p] : addingEq.picked.filter((x) => x !== p) })} /> {p}{have ? ' (added)' : ''}
                  </label>
                );
              })}
            </div>
            <div style={grid}>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl} htmlFor="eq-custom">Not in the list? Type your own (one per line or separated by commas)</label><textarea id="eq-custom" rows={2} value={addingEq.custom} onChange={(e) => setAddingEq({ ...addingEq, custom: e.target.value })} placeholder="e.g. Cell sorter, Lyophilizer" style={input} /></div>
              <div><label style={lbl} htmlFor="eq-loc">Room / location (for all of these)</label><input id="eq-loc" value={addingEq.location} onChange={(e) => setAddingEq({ ...addingEq, location: e.target.value })} style={input} /></div>
              <div><label style={lbl} htmlFor="eq-model">Model (only if adding one instrument)</label><input id="eq-model" value={addingEq.model} onChange={(e) => setAddingEq({ ...addingEq, model: e.target.value })} style={input} /></div>
              <div><label style={lbl} htmlFor="eq-serial">Serial number (only if adding one)</label><input id="eq-serial" value={addingEq.serial} onChange={(e) => setAddingEq({ ...addingEq, serial: e.target.value })} style={input} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={saveEquipment}>Add {pickedNames(addingEq).length || ''} selected</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddingEq(null)}>Cancel</button>
            </div>
          </div>
        )}
        {!equipment || equipment.instruments.length === 0 ? (
          <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No equipment yet. Press "+ Add equipment".</div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {equipment.instruments.map((i, n) => {
              const st = statusOf(i);
              const problems = openCount(i._id);
              return (
                <div key={i._id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap', borderTop: n ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[i.location, i.model, i.serial_number && `S/N ${i.serial_number}`, i.next_calibration && `calibration due ${dayOnly(i.next_calibration)}`].filter(Boolean).join(' · ') || 'No details'}</div>
                  </div>
                  {problems > 0 && <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 700 }}>{problems} open problem{problems > 1 ? 's' : ''}</span>}
                  <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setForm({ customName: '', instrument: i._id, type: 'repair', category: 'mechanical', priority: 'normal', impact: 'not_working', code: '', note: '' })}>Report problem</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Problems and repairs</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
            <option value="open">Open problems</option><option value="all">All reports</option>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.text}</option>)}
          </select>
          <select aria-label="Instrument filter" value={instFilter} onChange={(e) => setInstFilter(e.target.value)} style={{ ...input, width: 'auto' }}>
            <option value="all">All instruments</option>
            {data.instruments.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={() => setForm({ customName: '', instrument: '', type: 'repair', category: 'mechanical', priority: 'normal', impact: 'not_working', code: '', note: '' })}>🔧 Report a problem</button>
      </div>

      {form && (
        <div className="card" role="region" aria-label="Report a problem" style={{ padding: 16, marginBottom: 16 }}>
          <div style={grid}>
            <div>
              <label style={lbl} htmlFor="mt-inst">Instrument</label>
              <select id="mt-inst" value={form.instrument} onChange={(e) => set('instrument', e.target.value)} style={input}>
                <option value="">Select an instrument…</option>
                {data.instruments.length > 0 && <optgroup label="Your equipment">
                  {data.instruments.map((i) => <option key={i._id} value={i._id}>{i.name}{i.location ? ` (${i.location})` : ''} — {INSTRUMENT_STATE[i.status] ?? i.status}</option>)}
                </optgroup>}
                <optgroup label="Other common instruments (added to your equipment when you send)">
                  {PRESETS.filter((p) => !haveNames.has(p.toLowerCase())).map((p) => <option key={p} value={`preset:${p}`}>{p}</option>)}
                </optgroup>
                <option value="__custom__">Other: type my own instrument…</option>
              </select>
              {form.instrument === '__custom__' && <input aria-label="Your own instrument name" autoFocus placeholder="Instrument name" maxLength={80} value={form.customName} onChange={(e) => set('customName', e.target.value)} style={{ ...input, marginTop: 6 }} />}
            </div>
            <Select id="mt-type" label="What is needed" value={form.type} onChange={(v) => set('type', v)} options={TYPES} custom />
            <Select id="mt-cat" label="Kind of problem" value={form.category} onChange={(v) => set('category', v)} options={CATEGORIES} custom />
            <Select id="mt-pri" label="Priority" value={form.priority} onChange={(v) => set('priority', v)} options={PRIORITIES} />
            <Select id="mt-imp" label="Current state" value={form.impact} onChange={(v) => set('impact', v)} options={IMPACTS} />
            <div><label style={lbl} htmlFor="mt-code">Error code (optional)</label><input id="mt-code" value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="e.g. E4" style={input} /></div>
          </div>
          <label style={lbl} htmlFor="mt-note">Note: what is wrong?</label>
          <textarea id="mt-note" rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. Lid will not close, started after the last run" style={{ ...input, marginBottom: 10 }} />
          {form.impact === 'not_working' && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>The instrument will show "Under repair" everywhere in the app and can't be booked until a PI/admin marks it fixed.</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send to PI / admin'}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{data.issues.length === 0 ? 'No problems reported. If an instrument is not working, press "Report a problem".' : 'Nothing matches this filter.'}</div>
      ) : shown.map((m) => {
        const st = STATUS[m.status] ?? { text: m.status, color: 'var(--text-muted)', bg: 'var(--surface2)' };
        const planning = plan?.id === m._id;
        return (
          <div key={m._id} className="card" style={{ padding: 14, marginBottom: 10, borderLeft: `4px solid ${PRIORITY_COLOR[m.priority ?? 'normal']}` }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700 }}>
                  {m.instrument_name}{' '}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {pretty(m.maintenance_type)}{m.category ? ` · ${pretty(m.category)}` : ''}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {[m.location && `Where: ${m.location}`, `Reported ${stamp(m.created_at)} by ${m.reporter}`, m.priority && `Priority: ${m.priority}`, m.impact && `State: ${pretty(m.impact)}`, m.error_code && `Error ${m.error_code}`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
              {data.can_handle && open(m.status) && <button className="btn btn-primary btn-sm" onClick={() => setPlan(planning ? null : { id: m._id, p: { status: m.status === 'reported' ? 'planned' : m.status, vendor: m.vendor ?? '', expected: m.expected_date ? new Date(m.expected_date).toISOString().slice(0, 10) : '', cost: m.cost !== undefined ? String(m.cost) : '', note: '' } })}>{planning ? 'Close' : 'Update status'}</button>}
              <button className="btn btn-secondary btn-sm" onClick={() => setHistory(history === m._id ? null : m._id)}>History</button>
              {m.can_delete && <button className="btn btn-secondary btn-sm" aria-label={`Delete report for ${m.instrument_name}`} onClick={() => { if (confirm('Delete this report?')) act(() => remove({ token: token!, id: m._id }), 'Deleted'); }}>🗑</button>}
            </div>
            {m.notes && <div style={{ marginTop: 8, fontSize: 13 }}>“{m.notes}”</div>}
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
              {[m.vendor && `Vendor: ${m.vendor}`, m.expected_date && `Expected back: ${dayOnly(m.expected_date)}`, m.cost !== undefined && `Cost: $${m.cost.toFixed(2)}`, m.resolution_note && `Fix note: ${m.resolution_note}`].filter(Boolean).join(' · ')}
            </div>

            {planning && plan && (
              <div role="region" aria-label="Update status" style={{ marginTop: 10, padding: 12, borderRadius: 8, background: 'var(--surface2)' }}>
                <div style={grid}>
                  <Select id="pl-status" label="Next step" value={plan.p.status} onChange={(v) => setPlan({ ...plan, p: { ...plan.p, status: v } })} options={PI_ACTIONS} />
                  <div><label style={lbl} htmlFor="pl-vendor">Vendor / service company</label><input id="pl-vendor" value={plan.p.vendor} onChange={(e) => setPlan({ ...plan, p: { ...plan.p, vendor: e.target.value } })} placeholder="e.g. Bio-Rad service" style={input} /></div>
                  <div><label style={lbl} htmlFor="pl-date">Expected back / planned date</label><input id="pl-date" type="date" value={plan.p.expected} onChange={(e) => setPlan({ ...plan, p: { ...plan.p, expected: e.target.value } })} style={input} /></div>
                  <div><label style={lbl} htmlFor="pl-cost">Cost ($, optional)</label><input id="pl-cost" type="number" min={0} step="0.01" value={plan.p.cost} onChange={(e) => setPlan({ ...plan, p: { ...plan.p, cost: e.target.value } })} style={input} /></div>
                </div>
                <label style={lbl} htmlFor="pl-note">Note to the reporter (optional)</label>
                <input id="pl-note" value={plan.p.note} onChange={(e) => setPlan({ ...plan, p: { ...plan.p, note: e.target.value } })} placeholder="e.g. Technician visits Thursday" style={{ ...input, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={savePlan}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPlan(null)}>Cancel</button>
                </div>
              </div>
            )}

            {history === m._id && (
              <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-muted)' }}>
                {(m.updates ?? []).map((u, n) => <li key={n}>{stamp(u.at)} · {u.by} · <strong>{STATUS[u.status]?.text ?? u.status}</strong>{u.note ? ` · ${u.note}` : ''}</li>)}
                {(m.updates ?? []).length === 0 && <li>No history.</li>}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
