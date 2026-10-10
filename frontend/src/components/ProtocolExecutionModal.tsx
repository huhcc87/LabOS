import { useState, useEffect, useRef } from 'react';
import { downloadTextFile, protocolFilename } from '../lib/protocolFile';

interface Step {
  index: number;
  text: string;
  timerSeconds: number | null;
  done: boolean;
  note: string;
  startedAt?: number;
  timeLeft?: number;
}

interface Props {
  protocolTitle: string;
  protocolContent: string;
  /** Version / category / approval line, included in the downloaded file. */
  subtitle?: string;
  /** Called when the user saves edited steps. */
  onSave?: (content: string) => void;
  onClose: () => void;
}

function parseSteps(content: string): Step[] {
  const lines = content.split('\n');
  const steps: Step[] = [];
  let index = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Numbered: "1." or "1)" or "Step 1:"
    const isNumbered = /^(\d+[.):]|\bstep\s+\d+[:.)])/i.test(trimmed);
    // Bullet
    const isBullet = /^[-*•]\s/.test(trimmed);
    if (isNumbered || isBullet) {
      const text = trimmed.replace(/^(\d+[.):]|\bstep\s+\d+[:.)]|-|\*|•)\s*/i, '').trim();
      if (!text) continue;
      // Try to detect timer hints: "incubate 30 min", "wait 5 minutes", "centrifuge 10 min"
      const timerMatch = text.match(/(\d+)\s*(min(?:ute)?s?|sec(?:ond)?s?|hour?s?)\b/i);
      let timerSeconds: number | null = null;
      if (timerMatch) {
        const val = parseInt(timerMatch[1]);
        const unit = timerMatch[2].toLowerCase();
        if (unit.startsWith('sec')) timerSeconds = val;
        else if (unit.startsWith('min')) timerSeconds = val * 60;
        else if (unit.startsWith('hour') || unit.startsWith('hr')) timerSeconds = val * 3600;
      }
      steps.push({ index: index++, text, timerSeconds, done: false, note: '' });
    }
  }
  if (steps.length === 0) {
    // Fallback: treat each non-empty line as a step
    lines.filter(l => l.trim()).forEach((l, i) => {
      steps.push({ index: i, text: l.trim(), timerSeconds: null, done: false, note: '' });
    });
  }
  return steps;
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function ProtocolExecutionModal({ protocolTitle, protocolContent, subtitle, onSave, onClose }: Props) {
  const [steps, setSteps] = useState<Step[]>(() => parseSteps(protocolContent));
  const [rawText, setRawText] = useState(protocolContent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [isFull, setIsFull] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [activeTimer, setActiveTimer] = useState<{ stepIndex: number; timeLeft: number } | null>(null);
  const [executionNote, setExecutionNote] = useState('');
  const [done, setDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completed = steps.filter(s => s.done).length;
  const progress = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0;

  useEffect(() => {
    if (activeTimer) {
      intervalRef.current = setInterval(() => {
        setActiveTimer(prev => {
          if (!prev) return null;
          if (prev.timeLeft <= 1) {
            clearInterval(intervalRef.current!);
            // Auto-check step
            setSteps(ps => ps.map(s => s.index === prev.stepIndex ? { ...s, done: true } : s));
            return null;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [activeTimer?.stepIndex]);

  // Keep the fullscreen flag in sync when the user leaves with Esc; leave fullscreen on close.
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setIsFull(false); };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  function startTimer(step: Step) {
    if (!step.timerSeconds) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveTimer({ stepIndex: step.index, timeLeft: step.timerSeconds });
  }

  function stopTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setActiveTimer(null);
  }

  function toggleStep(idx: number) {
    setSteps(prev => prev.map(s => s.index === idx ? { ...s, done: !s.done } : s));
  }

  function updateNote(idx: number, note: string) {
    setSteps(prev => prev.map(s => s.index === idx ? { ...s, note } : s));
  }

  function handleFinish() {
    setDone(true);
  }

  // Real browser fullscreen when allowed; otherwise the modal still fills the whole window.
  async function toggleFull() {
    if (!isFull) {
      setIsFull(true);
      try { await overlayRef.current?.requestFullscreen?.(); } catch { /* window-sized fallback */ }
    } else {
      setIsFull(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    }
  }

  function startEdit() {
    stopTimer();
    setDraft(rawText);
    setEditing(true);
  }

  function saveEdit() {
    const next = parseSteps(draft);
    // Keep progress and notes for steps whose text did not change.
    setSteps(next.map(s => {
      const old = steps[s.index];
      return old && old.text === s.text ? { ...s, done: old.done, note: old.note } : s;
    }));
    setRawText(draft);
    setEditing(false);
    onSave?.(draft);
  }

  function download() {
    const lines = [
      `# ${protocolTitle}`,
      ...(subtitle ? [`_${subtitle}_`] : []),
      `Downloaded: ${new Date().toLocaleString()}`,
      '',
      '## Steps',
      ...steps.map((s, i) => `${i + 1}. [${s.done ? 'x' : ' '}] ${s.text}${s.note ? ` — _${s.note}_` : ''}`),
      ...(executionNote ? ['', '## Execution notes', executionNote] : []),
    ];
    downloadTextFile(protocolFilename(protocolTitle), lines.join('\n'));
  }

  const finishedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fillBody: React.CSSProperties = isFull ? { flex: 1, minHeight: 0, overflowY: 'auto' } : {};

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'center',
        background: isFull ? 'var(--surface)' : 'rgba(0,0,0,0.7)',
        alignItems: isFull ? 'stretch' : 'flex-start',
        padding: isFull ? 0 : '24px 16px',
        overflowY: isFull ? 'hidden' : 'auto',
      }}
    >
      <div style={{
        background: 'var(--surface)', width: '100%',
        border: isFull ? 'none' : '1px solid var(--border)',
        borderRadius: isFull ? 0 : 16,
        maxWidth: isFull ? 'none' : 720,
        boxShadow: isFull ? 'none' : '0 20px 60px rgba(0,0,0,0.4)',
        ...(isFull ? { display: 'flex', flexDirection: 'column', height: '100%' } : {}),
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Protocol Execution Mode</div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{protocolTitle}</h2>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: progress === 100 ? '#22c55e' : 'var(--accent)' }}>{progress}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{completed}/{steps.length} steps</div>
          </div>
          {!done && !editing && <button className="btn btn-sm btn-secondary" onClick={startEdit} title="Edit steps">✏️ Edit</button>}
          <button className="btn btn-sm btn-secondary" onClick={download} title="Download protocol">⬇ Download</button>
          <button className="btn btn-sm btn-secondary" onClick={toggleFull} title={isFull ? 'Exit full screen' : 'Full screen'}>
            {isFull ? '⤡ Exit full screen' : '⛶ Full screen'}
          </button>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--surface2)' }}>
          <div style={{ height: '100%', background: progress === 100 ? '#22c55e' : 'var(--accent)', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        {editing ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, ...(isFull ? { flex: 1, minHeight: 0 } : {}) }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>One step per line. Add times like "30 min" for an automatic timer.</div>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={isFull ? undefined : 14}
              style={{ width: '100%', flex: isFull ? 1 : undefined, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: isFull ? 15 : 13, color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>💾 Save steps</button>
            </div>
          </div>
        ) : done ? (
          <div style={{ padding: 40, textAlign: 'center', ...fillBody }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#22c55e' }}>Protocol Completed!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Finished at {finishedAt}</p>
            {executionNote && (
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>EXECUTION NOTES</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{executionNote}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={download}>⬇ Download record</button>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 24, ...fillBody }}>
            {/* Active Timer Banner */}
            {activeTimer && (
              <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>⏱</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>TIMER RUNNING — Step {activeTimer.stepIndex + 1}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>{fmt(activeTimer.timeLeft)}</div>
                </div>
                <button onClick={stopTimer} style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Stop</button>
              </div>
            )}

            {steps.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>
                No steps yet. Click <b>✏️ Edit</b> above to add them, one per line.
              </div>
            )}

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: isFull ? 'none' : 450, overflowY: isFull ? 'visible' : 'auto' }}>
              {steps.map((step, i) => {
                const isTimerActive = activeTimer?.stepIndex === step.index;
                return (
                  <div key={step.index} style={{
                    border: `1px solid ${step.done ? '#22c55e40' : 'var(--border)'}`,
                    borderLeft: `4px solid ${step.done ? '#22c55e' : i === steps.findIndex(s => !s.done) ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: step.done ? 'rgba(34,197,94,0.05)' : 'var(--surface2)',
                    opacity: step.done ? 0.75 : 1,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <button
                        onClick={() => toggleStep(step.index)}
                        style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
                          background: step.done ? '#22c55e' : 'var(--surface)',
                          border: `2px solid ${step.done ? '#22c55e' : 'var(--border)'}`,
                          color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        {step.done ? '✓' : ''}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ fontSize: isFull ? 16 : 14, color: step.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: step.done ? 'line-through' : 'none', lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-muted)', marginRight: 8 }}>#{i + 1}</span>{step.text}
                          </div>
                          {step.timerSeconds && !step.done && (
                            <button
                              onClick={() => isTimerActive ? stopTimer() : startTimer(step)}
                              style={{
                                flexShrink: 0, fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                                background: isTimerActive ? '#ef444420' : 'rgba(99,102,241,0.15)',
                                color: isTimerActive ? '#ef4444' : '#6366f1',
                                border: `1px solid ${isTimerActive ? '#ef444440' : 'rgba(99,102,241,0.3)'}`,
                              }}
                            >
                              {isTimerActive ? '⏹ Stop' : `⏱ ${fmt(step.timerSeconds)}`}
                            </button>
                          )}
                        </div>
                        {step.done && (
                          <input
                            value={step.note}
                            onChange={e => updateNote(step.index, e.target.value)}
                            placeholder="Add observation note..."
                            style={{ marginTop: 6, width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Execution Notes */}
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>OVERALL EXECUTION NOTES</label>
              <textarea
                value={executionNote}
                onChange={e => setExecutionNote(e.target.value)}
                placeholder="Any deviations, observations, or issues during this run..."
                rows={3}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                onClick={handleFinish}
                disabled={completed === 0}
                style={{
                  background: progress === 100 ? '#22c55e' : 'var(--accent)',
                  color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px',
                  cursor: completed > 0 ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 700, opacity: completed === 0 ? 0.5 : 1,
                }}
              >
                {progress === 100 ? '✓ Complete Protocol' : `Complete (${completed}/${steps.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
