import { useCallback, useEffect, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { HUBS } from '../../convex/hubs';
import { useAuth } from '../context/AuthContext';

interface Student {
  _id: Id<'users'>;
  full_name: string;
  email: string;
  role: string;
  position?: string;
  allowed_hubs: string[];
}

const HUB_ICON: Record<string, string> = {
  'Lab Hub': '🔬', 'Sample Hub': '🧪', 'Grant Hub': '📝', 'Safety & Quality': '🛡️', 'Resources': '📦',
};

const errText = (e: unknown) =>
  (e as { data?: string })?.data ?? (e instanceof Error ? e.message : 'Something went wrong');

/** PI page: add students and switch each hub on or off for them. */
export default function MyStudentsPage() {
  const convex = useConvex();
  const { token } = useAuth();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStudents(await convex.query(api.piAccess.listMyStudents, { token }) as Student[]);
      setError('');
    } catch (e) {
      setStudents([]);
      setError(errText(e));
    }
  }, [convex, token]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    if (!token) return;
    setBusy(true);
    try { await fn(); setError(''); await load(); }
    catch (e) { setError(errText(e)); }
    finally { setBusy(false); }
  };

  const addStudent = () => run(async () => {
    await convex.mutation(api.piAccess.addStudent, { token: token!, email });
    setEmail('');
  });

  const toggleHub = (s: Student, hub: string) => {
    const hubs = s.allowed_hubs.includes(hub) ? s.allowed_hubs.filter(h => h !== hub) : [...s.allowed_hubs, hub];
    // Optimistic: flip the switch now, the reload confirms it.
    setStudents(prev => prev?.map(x => x._id === s._id ? { ...x, allowed_hubs: hubs } : x) ?? prev);
    run(() => convex.mutation(api.piAccess.setStudentHubs, { token: token!, student_id: s._id, hubs }));
  };

  const removeStudent = (s: Student) => {
    if (!confirm(`Remove ${s.full_name} from your students? They will get normal access again.`)) return;
    run(() => convex.mutation(api.piAccess.removeStudent, { token: token!, student_id: s._id }));
  };

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>🎓 My Students</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 20px' }}>
        Add the people in your lab, then choose which parts of LabOS each one can use. Dashboard is always on.
      </p>

      <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input" type="email" placeholder="Student's account email"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && email.trim()) addStudent(); }}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button className="btn btn-primary" disabled={!email.trim() || busy} onClick={addStudent}>+ Add student</button>
        <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)' }}>
          New students start with Lab Hub and Sample Hub. The account must already exist (Admin → Users).
        </div>
      </div>

      {error && (
        <div role="alert" className="card" style={{ padding: 12, marginBottom: 16, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {students === null ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : students.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No students yet. Add one by email above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {students.map(s => (
            <div key={s._id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700 }}>{s.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.email} · {s.position ? `🎓 ${s.position}` : s.role}</div>
                </div>
                <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => removeStudent(s)}>Remove</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {HUBS.map(hub => {
                  const on = s.allowed_hubs.includes(hub);
                  return (
                    <button
                      key={hub} onClick={() => toggleHub(s, hub)} disabled={busy} aria-pressed={on}
                      title={on ? `Turn off ${hub}` : `Turn on ${hub}`}
                      style={{
                        padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${on ? '#22c55e' : 'var(--border)'}`,
                        background: on ? 'rgba(34,197,94,0.15)' : 'var(--surface2)',
                        color: on ? '#4ade80' : 'var(--text-muted)',
                      }}
                    >
                      {HUB_ICON[hub]} {hub} {on ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
