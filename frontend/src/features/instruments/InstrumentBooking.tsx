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
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [remind, setRemind] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Confirmation | null>(null);
  const [adding, setAdding] = useState<{ name: string; location: string } | null>(null);

  const instruments = data?.instruments ?? [];
  const bookings = data?.bookings ?? [];
  const current = instruments.find((i) => i._id === picked);
  const itsBookings = bookings.filter((b) => b.instrument_id === picked);
  const mine = bookings.filter((b) => b.mine);

  const submit = async () => {
    if (!token || !picked) return;
    const start = new Date(`${date}T${from}`).getTime();
    const end = new Date(`${date}T${to}`).getTime();
    setBusy(true);
    try {
      setDone(await book({ token, instrument_id: picked, start_time: start, end_time: end, purpose, remind_every_2_days: remind }));
      setPurpose('');
    } catch (e) { toast.error(errText(e)); setDone(null); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); } catch (e) { toast.error(errText(e)); } };

  const saveInstrument = async () => {
    if (!token || !adding?.name.trim()) return toast.error('Enter the instrument name.');
    await act(async () => { await addInstrument({ token, name: adding.name.trim(), location: adding.location.trim() || undefined, status: 'available' }); setAdding(null); }, 'Instrument added');
  };

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
      {/* 1. Pick an instrument */}
      <section aria-label="Instruments">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>1. Choose an instrument</h3>
          {data.can_add_instrument && <button className="btn btn-secondary btn-sm" onClick={() => setAdding(adding ? null : { name: '', location: '' })}>+ Add instrument</button>}
        </div>
        {adding && (
          <div className="card" style={{ padding: 12, marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input aria-label="Instrument name" placeholder="Name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} style={{ ...input, flex: 1, minWidth: 140 }} />
            <input aria-label="Instrument location" placeholder="Location" value={adding.location} onChange={(e) => setAdding({ ...adding, location: e.target.value })} style={{ ...input, flex: 1, minWidth: 120 }} />
            <button className="btn btn-primary btn-sm" onClick={saveInstrument}>Save</button>
          </div>
        )}
        {instruments.length === 0 ? (
          <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No instruments yet.{data.can_add_instrument ? ' Add the first one.' : ' A manager can add them.'}</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {instruments.map((i) => {
              const next = bookings.find((b) => b.instrument_id === i._id);
              const on = picked === i._id;
              return (
                <button key={i._id} type="button" aria-pressed={on} disabled={!i.bookable} onClick={() => { setPicked(i._id); setDone(null); }}
                  style={{ textAlign: 'left', padding: 12, borderRadius: 10, cursor: i.bookable ? 'pointer' : 'not-allowed', opacity: i.bookable ? 1 : 0.55, background: on ? 'rgba(0,113,188,0.1)' : 'var(--surface)', border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`, color: 'var(--text)' }}>
                  <div style={{ fontWeight: 700 }}>🔬 {i.name}{i.model ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> · {i.model}</span> : null}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {[i.location, i.bookable ? 'Available to book' : i.status.replace(/_/g, ' '), next && `next booked ${when(next.start_time)}`].filter(Boolean).join(' · ')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Choose time and confirm, same page */}
      <section aria-label="Book" className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>2. Pick a time and confirm</h3>
        {!current ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Choose an instrument on the left.</div> : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{current.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={lbl} htmlFor="bk-date">Date</label><input id="bk-date" type="date" min={today()} value={date} onChange={(e) => { setDate(e.target.value); setDone(null); }} style={input} /></div>
              <div><label style={lbl} htmlFor="bk-from">From</label><input id="bk-from" type="time" value={from} onChange={(e) => { setFrom(e.target.value); setDone(null); }} style={input} /></div>
              <div><label style={lbl} htmlFor="bk-to">To</label><input id="bk-to" type="time" value={to} onChange={(e) => { setTo(e.target.value); setDone(null); }} style={input} /></div>
            </div>
            <label style={lbl} htmlFor="bk-purpose">What for? (optional)</label>
            <input id="bk-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. qPCR plate, 96 wells" style={{ ...input, marginBottom: 10 }} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} /> Remind me every 2 days until then
            </label>
            <button className="btn btn-primary" onClick={submit} disabled={busy} style={{ width: '100%' }}>{busy ? 'Booking…' : 'Confirm booking'}</button>

            {done && (
              <div role="status" style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.12)', color: 'var(--text)', fontSize: 13 }}>
                <strong>✓ Booked: {done.instrument}</strong><br />
                {when(done.start_time)} to {new Date(done.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{done.location ? ` · ${done.location}` : ''}<br />
                {done.reminders ? 'You will get a reminder every 2 days until it starts.' : 'No reminders set.'}
              </div>
            )}

            <h4 style={{ margin: '16px 0 6px', fontSize: 13 }}>Already booked</h4>
            {itsBookings.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing yet. Any time is free.</div> : itsBookings.map((b) => (
              <div key={b._id} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)' }}>{when(b.start_time)} to {new Date(b.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {b.user_name}</div>
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
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{when(b.start_time)} to {new Date(b.end_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{b.purpose ? ` · ${b.purpose}` : ''}</div>
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
