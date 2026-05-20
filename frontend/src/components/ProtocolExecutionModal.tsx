import { useState, useEffect, useRef } from 'react';

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

export function ProtocolExecutionModal({ protocolTitle, protocolContent, onClose }: Props) {
  const [steps, setSteps] = useState<Step[]>(() => parseSteps(protocolContent));
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

  const finishedAt = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 720, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Protocol Execution Mode</div>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{protocolTitle}</h2>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: progress === 100 ? '#22c55e' : 'var(--accent)' }}>{progress}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{completed}/{steps.length} steps</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer', padding: 4 }}>×</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'var(--surface2)' }}>
          <div style={{ height: '100%', background: progress === 100 ? '#22c55e' : 'var(--accent)', width: `${progress}%`, transition: 'width 0.3s ease' }} />
        </div>

        {done ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#22c55e' }}>Protocol Completed!</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Finished at {finishedAt}</p>
            {executionNote && (
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>EXECUTION NOTES</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{executionNote}</div>
              </div>
            )}
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
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

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 450, overflowY: 'auto' }}>
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
                          <div style={{ fontSize: 14, color: step.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: step.done ? 'line-through' : 'none', lineHeight: 1.5 }}>
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
