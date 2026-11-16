import { useState } from 'react';

export interface CalBooking {
  _id: string; instrument_id?: string; start_time: number; end_time: number; status: string; user_name: string;
  person_name?: string; lab_name?: string; room?: string; purpose?: string;
}
export interface CalNote { _id: string; instrument_id?: string; date: string; text: string; author: string; can_delete: boolean }

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const fmtMin = (m: number) => new Date(2000, 0, 1, Math.floor(m / 60), m % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

interface Props {
  bookings: CalBooking[];
  notes?: CalNote[];
  from: string;                              // highlighted range start (YYYY-MM-DD)
  to?: string;                               // highlighted range end
  onPick?: (day: string) => void;            // a day was clicked (booking page uses it to fill the dates)
  instrumentName?: (id?: string) => string;  // when set, each booking and note shows which instrument it is for
  onAddNote?: (day: string, text: string) => Promise<void> | void; // when set, a note box appears under the day
  onDeleteNote?: (id: string) => void;
}

/** Month calendar: busy days and noted days are marked; the picked day lists every booking in full plus its notes. */
export default function BookingCalendar({ bookings, notes = [], from, to, onPick, instrumentName, onAddNote, onDeleteNote }: Props) {
  const [month, setMonth] = useState(() => { const d = new Date(`${from}T00:00`); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(from);
  const [draft, setDraft] = useState('');
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, n) => new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay() + n));
  const todayKey = ymd(new Date());
  const busy = (d: Date) => {
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return bookings.filter((b) => b.start_time < s + 86_400_000 && b.end_time > s);
  };
  const dayBookings = busy(new Date(`${selected}T00:00`));
  const dayNotes = notes.filter((n) => n.date === selected);
  const step = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const name = (id?: string) => instrumentName?.(id);
  const end = to || from;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <button type="button" className="btn btn-sm btn-secondary" aria-label="Previous month" onClick={() => step(-1)}>‹</button>
        <strong style={{ fontSize: 14 }}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="btn btn-sm btn-secondary" aria-label="Next month" onClick={() => step(1)}>›</button>
      </div>
      <div role="grid" aria-label="Booking calendar" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center', fontSize: 12 }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, n) => <div key={n} style={{ color: 'var(--text-muted)', fontWeight: 600, padding: 2 }}>{w}</div>)}
        {cells.map((d) => {
          const k = ymd(d), inMonth = d.getMonth() === month.getMonth();
          const inRange = onPick ? k >= from && k <= end : k === selected;
          const count = busy(d).length, noted = notes.some((n) => n.date === k);
          return (
            <button key={k} type="button" aria-label={`${d.toDateString()}${count ? `, ${count} booked` : ''}${noted ? ', has notes' : ''}`} aria-pressed={inRange}
              onClick={() => { setSelected(k); onPick?.(k); }}
              style={{ position: 'relative', padding: '7px 0', borderRadius: 6, border: k === selected ? '1px solid var(--primary, #005CC5)' : '1px solid transparent', cursor: 'pointer',
                background: inRange ? 'rgba(0,113,188,0.18)' : 'transparent', color: 'var(--text)', opacity: inMonth ? 1 : 0.45, fontWeight: k === todayKey ? 800 : 500 }}>
              {d.getDate()}
              <span aria-hidden style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2 }}>
                {count > 0 && <i style={{ width: 5, height: 5, borderRadius: '50%', background: '#b45309' }} />}
                {noted && <i style={{ width: 5, height: 5, borderRadius: '50%', background: '#0071bc' }} />}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}><span style={{ color: '#b45309' }}>●</span> booked &nbsp; <span style={{ color: '#0071bc' }}>●</span> note</div>

      <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>{new Date(`${selected}T00:00`).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</h4>
      {dayBookings.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No bookings.</div> : dayBookings.map((b) => (
        <div key={b._id} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600 }}>{name(b.instrument_id) ? `${name(b.instrument_id)} · ` : ''}{clock(b.start_time)} to {clock(b.end_time)}{b.status === 'pending_approval' ? ' (awaiting approval)' : ''}</div>
          <div style={{ color: 'var(--text-muted)' }}>{[b.person_name ?? b.user_name, b.lab_name, b.room && `Room ${b.room}`, b.purpose].filter(Boolean).join(' · ')}</div>
        </div>
      ))}

      <h4 style={{ margin: '12px 0 4px', fontSize: 13 }}>Notes</h4>
      {dayNotes.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No notes for this day.</div>}
      {dayNotes.map((n) => (
        <div key={n._id} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div>{n.text}</div>
            <div style={{ color: 'var(--text-muted)' }}>{n.author}{name(n.instrument_id) ? ` · ${name(n.instrument_id)}` : ''}</div>
          </div>
          {n.can_delete && onDeleteNote && <button type="button" className="btn btn-sm btn-secondary" aria-label="Delete note" onClick={() => onDeleteNote(n._id)}>✕</button>}
        </div>
      ))}
      {onAddNote && (
        <form style={{ display: 'flex', gap: 6, marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); if (!draft.trim()) return; await onAddNote(selected, draft); setDraft(''); }}>
          <input aria-label="Add a note" placeholder="Add a note for this day" value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
          <button type="submit" className="btn btn-sm btn-primary" disabled={!draft.trim()}>Add</button>
        </form>
      )}
    </div>
  );
}
