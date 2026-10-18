import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import toast from 'react-hot-toast';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../context/AuthContext';
import { errText } from '../../lib/errors';

const input: React.CSSProperties = { padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 3 };
const when = (ms: number) => new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);

const OTHER = '__other__';
/** Common lab instruments, so adding one is a pick from a list. */
const PRESETS = ['PCR Thermocycler', 'qPCR / Real-time PCR System', 'Centrifuge', 'Ultracentrifuge', 'Microscope (Fluorescence)', 'Confocal Microscope', 'Plate Reader', 'Flow Cytometer', 'Gel Imager', 'NanoDrop Spectrophotometer', 'Biosafety Cabinet', 'CO2 Incubator', 'Shaking Incubator', 'Autoclave', '-80 °C Freezer', 'Water Bath', 'Sequencer', 'Mass Spectrometer', 'HPLC'];

/** Active = can be booked. Not used = switched off by a manager. */
const statusOf = (i: { bookable: boolean; status: string }) =>
  i.bookable ? { text: 'Active', color: '#15803d', bg: 'rgba(34,197,94,0.14)' }
    : i.status === 'not_used' ? { text: 'Not used', color: '#475569', bg: 'rgba(100,116,139,0.16)' }
    : { text: i.status.replace(/_/g, ' '), color: '#b45309', bg: 'rgba(245,158,11,0.14)' };

interface Confirmation { instrument: string; location?: string; start_time: number; end_time: number; reminders: boolean }

/** Instruments and bookings on one screen: pick an instrument, choose a time, confirm. */
export default function InstrumentBooking() {
  const { token } = useAuth();
  const data = useQuery(api.instrumentBooking.overview, token ? { token } : 'skip');
  const book = useMutation(api.instrumentBooking.book);
  const cancel = useMutation(api.instrumentBooking.cancel);
  const setReminder = useMutation(api.instrumentBooking.setReminder);
  const addInstrument = useMutation(api.instruments.create);

  const [picked, setPicked] = useState<Id<'instruments'> | null>(null);
  const [date, setDate] = useState(today());
  // Lab, person and room start filled in; the booker can type over them.
  const [labName, setLabName] = useState<string | null>(null);
  const [personName, setPersonName] = useState<string | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [toDate, setToDate] = useState(''); // empty = same day as the start
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);
  const [adding, setAdding] = useState<{ preset: string; name: string; location: string } | null>(null);
  const setActive = useMutation(api.instrumentBooking.setActive);

  const instruments = data?.instruments ?? [];
  const bookings = data?.bookings ?? [];
  const current = instruments.find((i) => i._id === picked);
  const itsBookings = bookings.filter((b) => b.instrument_id === picked);
  const mine = bookings.filter((b) => b.mine);

  const submit = async () => {
    if (!token || !picked) return;
    const start = new Date(`${date}T${from}`).getTime();
    const end = new Date(`${toDate || date}T${to}`).getTime();
    setBusy(true);
    try {
      setDone(await book({
        token, instrument_id: picked, start_time: start, end_time: end, purpose, remind_every_2_days: remind,
        lab_name: labName ?? data?.lab, person_name: personName ?? data?.person, room: room ?? current?.location,
        when_text: `${when(start)} to ${when(end)}`,
      }));
      setPurpose('');
    } catch (e) { toast.error(errText(e)); setDone(null); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errText(e)); } };

  const saveInstrument = async () => {
    if (!token || !adding) return;
    const name = adding.preset === OTHER ? adding.name.trim() : adding.preset;
    if (!name) return toast.error('Enter the instrument name.');
    await act(async () => { await addInstrument({ token, name, location: adding.location.trim() || undefined, status: 'active' }); setAdding(null); }, 'Instrument added');
  };

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
      {/* 1. Pick an instrument */}
      <section aria-label="Instruments">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>1. Choose an instrument</h3>
          {data.can_add_instrument && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(adding ? null : { preset: PRESETS[0], name: '', location: '' })}>+ Add instrument</button>}
        </div>
        {adding && (
          <div className="card" style={{ padding: 12, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select aria-label="Instrument type" value={adding.preset} onChange={(e) => setAdding({ ...adding, preset: e.target.value })} style={{ ...input, flex: 1, minWidth: 160 }}>
              {PRESETS.map((p) => <option key={p}>{p}</option>)}
              <option value={OTHER}>Other…</option>
            </select>
            {adding.preset === OTHER && <input aria-label="Instrument name" placeholder="Name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} style={{ ...input, flex: 1, minWidth: 140 }} />}
            <input aria-label="Instrument location" placeholder="Location" value={adding.location} onChange={(e) => setAdding({ ...adding, location: e.target.value })} style={{ ...input, flex: 1, minWidth: 120 }} />
            <button className="btn btn-primary btn-sm" onClick={saveInstrument}>Save</button>
          </div>
        )}
        {instruments.length === 0 && (
          <div className="card" style={{ padding: 16, marginBottom: 10, textAlign: 'center', color: 'var(--text-muted)' }}>No instruments yet. Use the list below: choose "Other" to add one, or press "+ Add instrument" to pick from common ones.</div>
        )}
        {(
          <>
            <select aria-label="Instrument" value={picked ?? ''} onChange={(e) => {
              if (e.target.value === '__add__') { setAdding({ preset: OTHER, name: '', location: '' }); return; } // not in the list: type it yourself
              setPicked((e.target.value || null) as Id<'instruments'> | null); setDone(null);
            }} style={{ ...input, marginBottom: 10 }}>
              <option value="">Select an instrument…</option>
              {instruments.map((i) => <option key={i._id} value={i._id} disabled={!i.bookable}>{i.name}{i.location ? ` (${i.location})` : ''} — {statusOf(i).text}</option>)}
              <option value="__add__">➕ Other: my instrument isn't listed (add it)</option>
            </select>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {instruments.map((i, n) => {
                const st = statusOf(i);
                const next = bookings.find((b) => b.instrument_id === i._id);
                return (
                  <div key={i._id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap', borderTop: n ? '1px solid var(--border)' : 'none', background: picked === i._id ? 'rgba(0,113,188,0.08)' : undefined }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[i.location, next && `next booked ${when(next.start_time)}`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span style={{ padding: '2px 9px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: st.color, background: st.bg }}>{st.text}</span>
                    {data.can_manage && (
                      <button className="btn btn-secondary btn-sm" onClick={() => act(() => setActive({ token: token!, id: i._id, active: !i.bookable }), i.bookable ? 'Marked not used' : 'Marked active')}>{i.bookable ? 'Mark not used' : 'Mark active'}</button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 2. Choose time and confirm, same page */}
      <section aria-label="Book" className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>2. Pick a time and confirm</h3>
        {!current ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Choose an instrument on the left.</div> : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{current.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl} htmlFor="bk-lab">Lab name</label><input id="bk-lab" value={labName ?? data.lab} onChange={(e) => setLabName(e.target.value)} placeholder="Lab name" style={input} /></div>
              <div><label style={lbl} htmlFor="bk-person">Person name</label><input id="bk-person" value={personName ?? data.person} onChange={(e) => setPersonName(e.target.value)} placeholder="Your name" style={input} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={lbl} htmlFor="bk-room">Room number</label><input id="bk-room" value={room ?? current.location ?? ''} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 214" style={input} /></div>
              <div><label style={lbl} htmlFor="bk-date">From date</label><input id="bk-date" type="date" min={today()} value={date} onChange={(e) => { setDate(e.target.value); setDone(null); }} style={input} /></div>
              <div><label style={lbl} htmlFor="bk-from">From time</label><input id="bk-from" type="time" value={from} onChange={(e) => { setFrom(e.target.value); setDone(null); }} style={input} /></div>
              <div><label style={lbl} htmlFor="bk-todate">To date</label><input id="bk-todate" type="date" min={date} value={toDate || date} onChange={(e) => { setToDate(e.target.value); setDone(null); }} style={input} /></div>
              <div><label style={lbl} htmlFor="bk-to">To time</label><input id="bk-to" type="time" value={to} onChange={(e) => { setTo(e.target.value); setDone(null); }} style={input} /></div>
            </div>
            <label style={lbl} htmlFor="bk-purpose">What for? (optional)</label>
            <input id="bk-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. qPCR plate, 96 wells" style={{ ...input, marginBottom: 10 }} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} /> Reminder: notify me every 2 days until the booking starts
            </label>
            <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: '100%' }}>{busy ? 'Booking…' : 'Confirm booking'}</button>

            {done && (
              <div role="status" style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.12)', color: 'var(--text)', fontSize: 13 }}>
                <strong>✓ Booked: {done.instrument}</strong><br />
                {personName ?? data.person}{(labName ?? data.lab) ? ` · ${labName ?? data.lab}` : ''}<br />
                From {when(done.start_time)} to {when(done.end_time)}{done.location ? ` · ${done.location}` : ''}<br />
                {done.reminders ? 'You will get a reminder every 2 days until it starts.' : 'No reminders set.'}
              </div>
            )}

            <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>Already booked</h4>
            {itsBookings.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing yet. Any time is free.</div> : itsBookings.map((b) => (
              <div key={b._id} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)' }}>{when(b.start_time)} to {new Date(b.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {b.person_name ?? b.user_name}{b.room ? ` · ${b.room}` : ''}</div>
            ))}
          </>
        )}
      </section>

      {/* My bookings with the reminder switch */}
      <section aria-label="My bookings" style={{ gridColumn: '1 / -1' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>My bookings</h3>
        {mine.length === 0 ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>You have no upcoming bookings.</div> : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {mine.map((b, n) => (
              <div key={b._id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', borderTop: n ? '1px solid var(--border)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600 }}>{instruments.find((i) => i._id === b.instrument_id)?.name ?? 'Instrument'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{when(b.start_time)} to {new Date(b.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{[b.room, b.lab_name, b.purpose].filter(Boolean).map((x) => ` · ${x}`).join('')}</div>
                </div>
                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!b.remind_every_2_days} disabled={b.start_time <= Date.now()} onChange={(e) => act(() => setReminder({ token: token!, id: b._id, on: e.target.checked }), e.target.checked ? 'Reminders on' : 'Reminders off')} />
                  Remind every 2 days
                </label>
                <button className="btn btn-secondary btn-sm" onClick={() => { if (confirm('Cancel this booking?')) act(() => cancel({ token: token!, id: b._id }), 'Booking cancelled'); }}>Cancel</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
