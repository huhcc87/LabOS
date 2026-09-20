import React, { useState, useMemo } from 'react'
import type { ProtocolAnalytics, ExecutionSession } from '../types/protocol.types'

interface Props {
  protocolId: string
  protocolTitle: string
  analytics: ProtocolAnalytics
  executions: ExecutionSession[]
  estimatedDuration?: string
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  })
}

// Simple bar chart component
function BarChart({ data, height = 200 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, padding: '20px 0' }}>
      {data.map((item, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: '100%', maxWidth: 40,
              height: `${(item.value / max) * 100}%`,
              minHeight: item.value > 0 ? 4 : 0,
              background: item.color || 'var(--accent)',
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.3s ease',
            }}
          />
          <div style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center', whiteSpace: 'nowrap' }}>
            {item.label}
          </div>
          <div style={{ color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// Donut chart component
function DonutChart({ value, total, color, size = 120 }: { value: number; total: number; color: string; size?: number }) {
  const percentage = total > 0 ? (value / total) * 100 : 0
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="50" y="50" textAnchor="middle" dy="0.3em" fill="var(--text)" fontSize="20" fontWeight="700">
        {Math.round(percentage)}%
      </text>
    </svg>
  )
}

export default function ProtocolAnalyticsDashboard({ protocolId, protocolTitle, analytics, executions, estimatedDuration }: Props) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  // Filter executions by time range
  const filteredExecutions = useMemo(() => {
    if (timeRange === 'all') return executions
    const now = new Date()
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    return executions.filter(e => new Date(e.startedAt) >= cutoff)
  }, [executions, timeRange])

  // Calculate stats
  const stats = useMemo(() => {
    const completed = filteredExecutions.filter(e => e.status === 'completed')
    const aborted = filteredExecutions.filter(e => e.status === 'aborted')

    const successSteps = completed.flatMap(e => e.steps.filter(s => s.outcome === 'success'))
    const failedSteps = completed.flatMap(e => e.steps.filter(s => s.outcome === 'failed'))

    const durations = completed
      .map(e => e.steps.reduce((acc, s) => acc + (s.actualDuration || 0), 0))
      .filter(d => d > 0)

    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0

    return {
      totalExecutions: filteredExecutions.length,
      completedCount: completed.length,
      abortedCount: aborted.length,
      successRate: filteredExecutions.length > 0 ? (completed.length / filteredExecutions.length) * 100 : 0,
      stepSuccessRate: successSteps.length + failedSteps.length > 0
        ? (successSteps.length / (successSteps.length + failedSteps.length)) * 100
        : 100,
      avgDuration,
    }
  }, [filteredExecutions])

  // Executions by month
  const executionsByMonth = useMemo(() => {
    const months: Record<string, number> = {}
    filteredExecutions.forEach(e => {
      const month = new Date(e.startedAt).toLocaleDateString('en-US', { month: 'short' })
      months[month] = (months[month] || 0) + 1
    })
    return Object.entries(months).map(([label, value]) => ({ label, value }))
  }, [filteredExecutions])

  // Executions by user
  const executionsByUser = useMemo(() => {
    const users: Record<string, number> = {}
    filteredExecutions.forEach(e => {
      users[e.executedBy] = (users[e.executedBy] || 0) + 1
    })
    return Object.entries(users)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [filteredExecutions])

  // Step performance
  const stepPerformance = useMemo(() => {
    const stepStats: Record<number, { success: number; failed: number; avgDuration: number; count: number }> = {}
    filteredExecutions.forEach(e => {
      e.steps.forEach(s => {
        if (!stepStats[s.stepIndex]) {
          stepStats[s.stepIndex] = { success: 0, failed: 0, avgDuration: 0, count: 0 }
        }
        if (s.outcome === 'success') stepStats[s.stepIndex].success++
        if (s.outcome === 'failed') stepStats[s.stepIndex].failed++
        if (s.actualDuration) {
          stepStats[s.stepIndex].avgDuration += s.actualDuration
          stepStats[s.stepIndex].count++
        }
      })
    })
    return Object.entries(stepStats).map(([index, stats]) => ({
      stepIndex: parseInt(index),
      successRate: stats.success + stats.failed > 0 ? (stats.success / (stats.success + stats.failed)) * 100 : 100,
      avgDuration: stats.count > 0 ? stats.avgDuration / stats.count : 0,
    }))
  }, [filteredExecutions])

  // Failure reasons
  const failureReasons = useMemo(() => {
    const reasons: Record<string, number> = {}
    filteredExecutions.forEach(e => {
      e.steps.forEach(s => {
        if (s.outcome === 'failed' && s.deviation) {
          reasons[s.deviation] = (reasons[s.deviation] || 0) + 1
        }
      })
    })
    return Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count }))
  }, [filteredExecutions])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: 0 }}>
            Protocol Analytics
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Performance metrics and execution statistics
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 8, padding: 4 }}>
          {(['7d', '30d', '90d', 'all'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                background: timeRange === range ? 'var(--accent)' : 'transparent',
                border: 'none', borderRadius: 6,
                color: timeRange === range ? '#fff' : 'var(--text-muted)',
                padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              }}
            >
              {range === 'all' ? 'All Time' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>
            {stats.totalExecutions}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Total Executions
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#10b981' }}>
            {stats.successRate.toFixed(0)}%
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Completion Rate
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6' }}>
            {formatDuration(stats.avgDuration)}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Avg. Duration
            {estimatedDuration && <span style={{ color: 'var(--text-soft)' }}> (Est: {estimatedDuration})</span>}
          </div>
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#8b5cf6' }}>
            {stats.stepSuccessRate.toFixed(0)}%
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Step Success Rate
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Executions Over Time */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20,
        }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            Executions Over Time
          </h4>
          {executionsByMonth.length > 0 ? (
            <BarChart data={executionsByMonth} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No data available
            </div>
          )}
        </div>

        {/* Success/Failure Donut */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            Completion Status
          </h4>
          <DonutChart value={stats.completedCount} total={stats.totalExecutions} color="#10b981" />
          <div style={{ display: 'flex', gap: 20, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#10b981' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Completed ({stats.completedCount})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#ef4444' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aborted ({stats.abortedCount})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Top Users */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20,
        }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            Top Executors
          </h4>
          {executionsByUser.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {executionsByUser.map((user, i) => (
                <div key={user.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--surface-hover)',
                    color: i < 3 ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, color: 'var(--text)', fontSize: 13 }}>{user.name}</div>
                  <div style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>{user.count}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No data available
            </div>
          )}
        </div>

        {/* Step Performance */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20,
        }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            Step Performance
          </h4>
          {stepPerformance.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stepPerformance.slice(0, 5).map(step => (
                <div key={step.stepIndex} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 60, color: 'var(--text-muted)', fontSize: 12 }}>
                    Step {step.stepIndex + 1}
                  </div>
                  <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${step.successRate}%`, height: '100%',
                      background: step.successRate >= 90 ? '#10b981' : step.successRate >= 70 ? '#f59e0b' : '#ef4444',
                      borderRadius: 4,
                    }} />
                  </div>
                  <div style={{ width: 40, color: 'var(--text)', fontSize: 12, fontWeight: 600, textAlign: 'right' }}>
                    {step.successRate.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No data available
            </div>
          )}
        </div>

        {/* Common Issues */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 20,
        }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            Common Issues
          </h4>
          {failureReasons.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {failureReasons.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: 10, background: '#7f1d1d11', borderRadius: 6,
                }}>
                  <span style={{ color: '#ef4444', fontSize: 14 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fca5a5', fontSize: 12, lineHeight: 1.4 }}>
                      {item.reason.length > 60 ? item.reason.slice(0, 60) + '...' : item.reason}
                    </div>
                    <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>
                      {item.count} occurrence{item.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#10b981', fontSize: 13, textAlign: 'center', padding: 20 }}>
              No issues reported
            </div>
          )}
        </div>
      </div>

      {/* Recent Executions Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: 0 }}>
            Recent Executions
          </h4>
        </div>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredExecutions.slice(0, 10).map((exec, i) => {
            const duration = exec.steps.reduce((acc, s) => acc + (s.actualDuration || 0), 0)
            const successSteps = exec.steps.filter(s => s.outcome === 'success').length
            const totalSteps = exec.steps.length

            return (
              <div
                key={exec.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  borderBottom: i < Math.min(filteredExecutions.length, 10) - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: exec.status === 'completed' ? '#065f46' : '#7f1d1d',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                }}>
                  {exec.status === 'completed' ? '✓' : '✕'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                    {formatDate(exec.startedAt)} • {exec.executedBy}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                    {successSteps}/{totalSteps} steps • {formatDuration(duration)}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, fontWeight: 500,
                  background: exec.status === 'completed' ? '#065f46' : '#7f1d1d',
                  color: exec.status === 'completed' ? '#6ee7b7' : '#fca5a5',
                }}>
                  {exec.status.toUpperCase()}
                </span>
              </div>
            )
          })}
          {filteredExecutions.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              No executions in selected time range
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
