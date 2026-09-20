import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { Protocol, ProtocolStep } from '../types/protocol.types'

interface StepExecution {
  stepIndex: number
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  startedAt?: string
  completedAt?: string
  actualDuration?: number // in seconds
  notes: string
  deviation: string
  outcome: 'success' | 'partial' | 'failed' | null
  photos: string[] // base64 or URLs
}

interface ExecutionSession {
  id: string
  protocolId: string
  protocolVersion: string
  startedAt: string
  completedAt?: string
  executedBy: string
  steps: StepExecution[]
  overallNotes: string
  status: 'in_progress' | 'completed' | 'aborted'
}

interface Props {
  protocol: Protocol
  onClose: () => void
  onComplete: (session: ExecutionSession) => void
}

function parseDuration(duration?: string): number {
  if (!duration) return 0
  const lower = duration.toLowerCase()
  let total = 0

  // Match hours
  const hours = lower.match(/(\d+(?:\.\d+)?)\s*h/)
  if (hours) total += parseFloat(hours[1]) * 3600

  // Match minutes
  const mins = lower.match(/(\d+(?:\.\d+)?)\s*min/)
  if (mins) total += parseFloat(mins[1]) * 60

  // Match seconds
  const secs = lower.match(/(\d+(?:\.\d+)?)\s*sec/)
  if (secs) total += parseFloat(secs[1])

  // If just a number, assume minutes
  if (total === 0) {
    const num = parseFloat(duration)
    if (!isNaN(num)) total = num * 60
  }

  return total
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ProtocolExecutionMode({ protocol, onClose, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState(0)
  const [session, setSession] = useState<ExecutionSession>(() => ({
    id: `exec-${Date.now()}`,
    protocolId: protocol.id,
    protocolVersion: protocol.version || '1.0',
    startedAt: new Date().toISOString(),
    executedBy: 'Current User', // Would come from auth context
    steps: protocol.steps.map((_, i) => ({
      stepIndex: i,
      status: i === 0 ? 'in_progress' : 'pending',
      notes: '',
      deviation: '',
      outcome: null,
      photos: [],
    })),
    overallNotes: '',
    status: 'in_progress',
  }))

  const [timer, setTimer] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [timerMode, setTimerMode] = useState<'countup' | 'countdown'>('countup')
  const [targetTime, setTargetTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [showNotes, setShowNotes] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [confirmAbort, setConfirmAbort] = useState(false)

  const step = protocol.steps[currentStep]
  const stepExecution = session.steps[currentStep]
  const completedSteps = session.steps.filter(s => s.status === 'completed').length
  const progress = (completedSteps / protocol.steps.length) * 100

  // Initialize timer based on step duration
  useEffect(() => {
    const duration = parseDuration(step?.duration)
    if (duration > 0) {
      setTimerMode('countdown')
      setTargetTime(duration)
      setTimer(duration)
    } else {
      setTimerMode('countup')
      setTimer(0)
    }
    setIsTimerRunning(false)
  }, [currentStep, step?.duration])

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (timerMode === 'countdown') {
            if (prev <= 1) {
              // Timer finished - play sound
              if (audioRef.current) {
                audioRef.current.play().catch(() => {})
              }
              setIsTimerRunning(false)
              return 0
            }
            return prev - 1
          }
          return prev + 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isTimerRunning, timerMode])

  const updateStepExecution = useCallback((updates: Partial<StepExecution>) => {
    setSession(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) =>
        i === currentStep ? { ...s, ...updates } : s
      ),
    }))
  }, [currentStep])

  const startStep = () => {
    updateStepExecution({
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    })
    setIsTimerRunning(true)
  }

  const completeStep = (outcome: 'success' | 'partial' | 'failed') => {
    const now = new Date().toISOString()
    const startedAt = stepExecution.startedAt ? new Date(stepExecution.startedAt).getTime() : Date.now()
    const actualDuration = Math.floor((Date.now() - startedAt) / 1000)

    updateStepExecution({
      status: 'completed',
      completedAt: now,
      actualDuration,
      outcome,
    })
    setIsTimerRunning(false)

    // Move to next step or show summary
    if (currentStep < protocol.steps.length - 1) {
      setCurrentStep(prev => prev + 1)
      setSession(prev => ({
        ...prev,
        steps: prev.steps.map((s, i) =>
          i === currentStep + 1 ? { ...s, status: 'in_progress', startedAt: now } : s
        ),
      }))
    } else {
      setShowSummary(true)
    }
  }

  const skipStep = () => {
    updateStepExecution({
      status: 'skipped',
      completedAt: new Date().toISOString(),
    })
    setIsTimerRunning(false)

    if (currentStep < protocol.steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      setShowSummary(true)
    }
  }

  const goToPreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
      setIsTimerRunning(false)
    }
  }

  const finishExecution = () => {
    const completedSession: ExecutionSession = {
      ...session,
      completedAt: new Date().toISOString(),
      status: 'completed',
    }
    onComplete(completedSession)
  }

  const abortExecution = () => {
    const abortedSession: ExecutionSession = {
      ...session,
      completedAt: new Date().toISOString(),
      status: 'aborted',
    }
    onComplete(abortedSession)
  }

  // Summary View
  if (showSummary) {
    const totalTime = session.steps.reduce((acc, s) => acc + (s.actualDuration || 0), 0)
    const successSteps = session.steps.filter(s => s.outcome === 'success').length
    const failedSteps = session.steps.filter(s => s.outcome === 'failed').length
    const skippedSteps = session.steps.filter(s => s.status === 'skipped').length

    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
          padding: '20px 24px', color: '#fff',
        }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Execution Complete</h2>
          <p style={{ margin: '8px 0 0', opacity: 0.9 }}>{protocol.title}</p>
        </div>

        {/* Summary Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>{formatTime(totalTime)}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Total Time</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>{successSteps}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Successful Steps</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#ef4444' }}>{failedSteps}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Failed Steps</div>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{skippedSteps}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Skipped Steps</div>
            </div>
          </div>

          {/* Step Results */}
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Step-by-Step Results</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {session.steps.map((s, i) => (
              <div key={i} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: s.outcome === 'success' ? '#10b981' : s.outcome === 'failed' ? '#ef4444' : s.status === 'skipped' ? '#f59e0b' : '#6b7280',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 13,
                }}>
                  {s.outcome === 'success' ? '✓' : s.outcome === 'failed' ? '✕' : s.status === 'skipped' ? '⏭' : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                    Step {i + 1}: {protocol.steps[i].title}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                    {s.status === 'skipped' ? 'Skipped' : s.actualDuration ? `Duration: ${formatTime(s.actualDuration)}` : 'Not started'}
                    {protocol.steps[i].duration && ` (Expected: ${protocol.steps[i].duration})`}
                  </div>
                  {s.notes && (
                    <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 8, fontStyle: 'italic' }}>
                      Notes: {s.notes}
                    </div>
                  )}
                  {s.deviation && (
                    <div style={{ color: '#f59e0b', fontSize: 13, marginTop: 4 }}>
                      Deviation: {s.deviation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Overall Notes */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Overall Notes</h3>
            <textarea
              value={session.overallNotes}
              onChange={e => setSession(prev => ({ ...prev, overallNotes: e.target.value }))}
              placeholder="Add any overall observations, conclusions, or notes about this protocol run..."
              rows={4}
              style={{
                width: '100%', padding: 12, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 8,
                color: 'var(--text)', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid var(--border)', padding: '16px 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={() => setShowSummary(false)}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', padding: '10px 20px',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            Back to Steps
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-muted)', padding: '10px 20px',
                cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}
            >
              Discard
            </button>
            <button
              onClick={finishExecution}
              style={{
                background: '#10b981', border: 'none', borderRadius: 8,
                color: '#fff', padding: '10px 24px', cursor: 'pointer',
                fontSize: 14, fontWeight: 600,
              }}
            >
              Save Execution Record
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Audio for timer alarm */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleH0jSIzJ6tmLUy84d7Dpq4FHNlx7nLWcjGY/RH2Ypp2RdF1OTG+CkI+EcGNYV2p5goJ4aV9ZYHGAh4V/c2FQTF1xhJCMhHZmWlBZbH+MkY6Eb2ZiW2t5hYqKgXFmZGdyf4eJhn5waGpue4aKiYV+dnNyeYCFhYN9d3Z3e4CDg4GAdnZ4e4CDg4F/fHl5e3+Af4CDf357e3x+f4CAf357e3x+f4GAf357e3x+f4GAf357e3x+f4GAf357e3x+f4GAf357e35+f3+Af3x7fH1+gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAf35/f35/gICAfn1+fn5/gICAfn1+fn5/gICAf35/f35/gICAfn1+fn5/gIB/fn1+fn5/gICAf35/f35/gICAfn1+fn5/gICAf35/f35/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn5+fn5/gICAf35/f39/gICAfn1+fn5/gICAfn1+fn5/gICAf35/f35/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn1+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAf39/f39/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gICAfn5+fn5/gIA=" type="audio/wav" />
      </audio>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
        padding: '16px 24px', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>EXECUTING PROTOCOL</div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{protocol.title}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Progress */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Progress</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{completedSteps} / {protocol.steps.length}</div>
          </div>
          {/* Abort Button */}
          <button
            onClick={() => setConfirmAbort(true)}
            style={{
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
            }}
          >
            Exit
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 4, background: 'var(--surface)' }}>
        <div style={{
          height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)',
          width: `${progress}%`, transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Step List Sidebar */}
        <div style={{
          width: 280, background: 'var(--surface)', borderRight: '1px solid var(--border)',
          overflow: 'auto', padding: 16,
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Steps
          </div>
          {protocol.steps.map((s, i) => {
            const exec = session.steps[i]
            const isCurrent = i === currentStep
            return (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px', marginBottom: 4, borderRadius: 8, cursor: 'pointer',
                  background: isCurrent ? 'var(--accent-light)' : 'transparent',
                  border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: exec.status === 'completed' ? '#10b981' : exec.status === 'skipped' ? '#f59e0b' : exec.status === 'in_progress' ? 'var(--accent)' : 'var(--border)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {exec.status === 'completed' ? '✓' : exec.status === 'skipped' ? '⏭' : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: isCurrent ? 'var(--accent)' : 'var(--text)',
                    fontSize: 13, fontWeight: isCurrent ? 600 : 500,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {s.title}
                  </div>
                  {s.duration && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                      {s.duration}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Current Step Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          {/* Step Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                STEP {currentStep + 1} OF {protocol.steps.length}
              </div>
              <h3 style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700, margin: 0 }}>
                {step.title}
              </h3>
              {step.qcPoint && (
                <span style={{
                  display: 'inline-block', background: '#065f46', color: '#6ee7b7',
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 600, marginTop: 8,
                }}>
                  QC CHECKPOINT
                </span>
              )}
            </div>

            {/* Timer */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 20, minWidth: 180, textAlign: 'center',
            }}>
              <div style={{
                fontSize: 36, fontWeight: 700, fontFamily: 'monospace',
                color: timerMode === 'countdown' && timer < 60 ? '#ef4444' : 'var(--text)',
              }}>
                {formatTime(timer)}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4, marginBottom: 12 }}>
                {timerMode === 'countdown' ? 'Remaining' : 'Elapsed'}
                {step.duration && ` (${step.duration})`}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  style={{
                    background: isTimerRunning ? '#f59e0b' : '#10b981',
                    border: 'none', borderRadius: 6, color: '#fff',
                    padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {isTimerRunning ? '⏸ Pause' : '▶ Start'}
                </button>
                <button
                  onClick={() => {
                    setTimer(timerMode === 'countdown' ? targetTime : 0)
                    setIsTimerRunning(false)
                  }}
                  style={{
                    background: 'var(--surface-hover)', border: '1px solid var(--border)',
                    borderRadius: 6, color: 'var(--text)', padding: '8px 12px',
                    cursor: 'pointer', fontSize: 13,
                  }}
                >
                  ↺
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, marginBottom: 20,
          }}>
            <p style={{ color: 'var(--text)', fontSize: 16, lineHeight: 1.8, margin: 0 }}>
              {step.instruction}
            </p>
          </div>

          {/* Parameters */}
          {(step.duration || step.temperature || step.rpm) && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {step.duration && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Duration</div>
                  <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>⏱ {step.duration}</div>
                </div>
              )}
              {step.temperature && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Temperature</div>
                  <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>🌡 {step.temperature}</div>
                </div>
              )}
              {step.rpm && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>RPM</div>
                  <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>🔄 {step.rpm}</div>
                </div>
              )}
            </div>
          )}

          {/* Caution */}
          {step.caution && (
            <div style={{
              background: '#7f1d1d22', border: '1px solid #ef4444',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>⚠️ CAUTION</div>
              <div style={{ color: '#fca5a5', fontSize: 15 }}>{step.caution}</div>
            </div>
          )}

          {/* Expected Output */}
          {step.expectedOutput && (
            <div style={{
              background: '#065f4622', border: '1px solid #10b981',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>✓ Expected Outcome</div>
              <div style={{ color: '#6ee7b7', fontSize: 15 }}>{step.expectedOutput}</div>
            </div>
          )}

          {/* Notes Section */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 20, marginBottom: 20,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: showNotes ? 16 : 0, cursor: 'pointer',
            }}
              onClick={() => setShowNotes(!showNotes)}
            >
              <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 14 }}>
                📝 Notes & Observations {stepExecution.notes && '(1)'}
              </div>
              <span style={{ color: 'var(--text-muted)' }}>{showNotes ? '▼' : '▶'}</span>
            </div>
            {showNotes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea
                  value={stepExecution.notes}
                  onChange={e => updateStepExecution({ notes: e.target.value })}
                  placeholder="Add observations or notes for this step..."
                  rows={3}
                  style={{
                    width: '100%', padding: 12, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    color: 'var(--text)', fontSize: 14, resize: 'vertical',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div>
                  <label style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600 }}>Deviation from Protocol:</label>
                  <textarea
                    value={stepExecution.deviation}
                    onChange={e => updateStepExecution({ deviation: e.target.value })}
                    placeholder="Document any deviations from the standard protocol..."
                    rows={2}
                    style={{
                      width: '100%', marginTop: 8, padding: 12, background: '#78350f22',
                      border: '1px solid #f59e0b44', borderRadius: 8,
                      color: '#fbbf24', fontSize: 14, resize: 'vertical',
                      fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Troubleshooting Tip */}
          {step.troubleshootingTip && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--accent)',
              borderRadius: 12, padding: 16, marginBottom: 20,
            }}>
              <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>💡 Troubleshooting Tip</div>
              <div style={{ color: 'var(--text)', fontSize: 14 }}>{step.troubleshootingTip}</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--surface)',
      }}>
        <button
          onClick={goToPreviousStep}
          disabled={currentStep === 0}
          style={{
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, color: currentStep === 0 ? 'var(--text-muted)' : 'var(--text)',
            padding: '12px 20px', cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 500, opacity: currentStep === 0 ? 0.5 : 1,
          }}
        >
          ← Previous Step
        </button>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={skipStep}
            style={{
              background: 'transparent', border: '1px solid #f59e0b',
              borderRadius: 8, color: '#f59e0b', padding: '12px 20px',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            Skip Step
          </button>
          <button
            onClick={() => completeStep('partial')}
            style={{
              background: '#f59e0b', border: 'none', borderRadius: 8,
              color: '#fff', padding: '12px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Partial Success
          </button>
          <button
            onClick={() => completeStep('failed')}
            style={{
              background: '#ef4444', border: 'none', borderRadius: 8,
              color: '#fff', padding: '12px 20px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Failed
          </button>
          <button
            onClick={() => completeStep('success')}
            style={{
              background: '#10b981', border: 'none', borderRadius: 8,
              color: '#fff', padding: '12px 24px', cursor: 'pointer',
              fontSize: 14, fontWeight: 600,
            }}
          >
            Complete Step ✓
          </button>
        </div>
      </div>

      {/* Abort Confirmation Modal */}
      {confirmAbort && (
        <>
          <div
            onClick={() => setConfirmAbort(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            padding: 24, width: 400, zIndex: 301,
          }}>
            <h3 style={{ color: 'var(--text)', margin: '0 0 12px', fontSize: 18 }}>Exit Protocol Execution?</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 20px', fontSize: 14, lineHeight: 1.6 }}>
              You have completed {completedSteps} of {protocol.steps.length} steps.
              Your progress will be saved as an aborted execution.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setConfirmAbort(false)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text)', padding: '10px 20px',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                Continue Execution
              </button>
              <button
                onClick={abortExecution}
                style={{
                  background: '#ef4444', border: 'none', borderRadius: 8,
                  color: '#fff', padding: '10px 20px', cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Exit & Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
