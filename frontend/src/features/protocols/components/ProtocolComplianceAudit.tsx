import React, { useState, useMemo } from 'react'

interface AuditEntry {
  id: string
  timestamp: string
  action: 'created' | 'edited' | 'approved' | 'rejected' | 'executed' | 'deviation' | 'reviewed' | 'archived' | 'restored' | 'version_created' | 'comment_added' | 'attachment_added' | 'training_completed'
  userId: string
  userName: string
  userRole: string
  details: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
  sessionId?: string
  sectionAffected?: string
  complianceFlags?: string[]
}

interface Deviation {
  id: string
  executionId: string
  stepIndex: number
  type: 'minor' | 'major' | 'critical'
  description: string
  reportedBy: string
  reportedAt: string
  rootCause?: string
  correctiveAction?: string
  preventiveAction?: string
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  resolvedBy?: string
  resolvedAt?: string
  attachments?: string[]
}

interface ComplianceCheck {
  id: string
  requirement: string
  category: 'documentation' | 'training' | 'approval' | 'execution' | 'storage' | 'review'
  status: 'compliant' | 'non_compliant' | 'needs_review' | 'not_applicable'
  lastChecked: string
  checkedBy?: string
  notes?: string
  regulation: string
}

interface Props {
  protocolId: string
  protocolName: string
  auditTrail: AuditEntry[]
  deviations: Deviation[]
  complianceChecks: ComplianceCheck[]
  onAddDeviation: (deviation: Omit<Deviation, 'id' | 'status' | 'reportedAt'>) => void
  onUpdateDeviation: (deviationId: string, updates: Partial<Deviation>) => void
  onExportAuditReport: (format: 'pdf' | 'csv' | 'json') => void
  onRunComplianceCheck: () => void
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function ProtocolComplianceAudit({
  protocolId,
  protocolName,
  auditTrail,
  deviations,
  complianceChecks,
  onAddDeviation,
  onUpdateDeviation,
  onExportAuditReport,
  onRunComplianceCheck,
}: Props) {
  const [activeTab, setActiveTab] = useState<'audit' | 'deviations' | 'compliance'>('audit')
  const [auditFilter, setAuditFilter] = useState<string>('all')
  const [deviationFilter, setDeviationFilter] = useState<Deviation['status'] | 'all'>('all')
  const [showDeviationModal, setShowDeviationModal] = useState(false)
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // New deviation form state
  const [newDeviation, setNewDeviation] = useState({
    executionId: '',
    stepIndex: 0,
    type: 'minor' as Deviation['type'],
    description: '',
    reportedBy: '',
    rootCause: '',
    correctiveAction: '',
    preventiveAction: '',
  })

  const actionIcons: Record<AuditEntry['action'], string> = {
    created: '✨',
    edited: '✏️',
    approved: '✅',
    rejected: '❌',
    executed: '▶️',
    deviation: '⚠️',
    reviewed: '👁️',
    archived: '📦',
    restored: '♻️',
    version_created: '📋',
    comment_added: '💬',
    attachment_added: '📎',
    training_completed: '🎓',
  }

  const actionColors: Record<AuditEntry['action'], string> = {
    created: '#22c55e',
    edited: '#3b82f6',
    approved: '#22c55e',
    rejected: '#ef4444',
    executed: '#8b5cf6',
    deviation: '#f59e0b',
    reviewed: '#06b6d4',
    archived: '#6b7280',
    restored: '#22c55e',
    version_created: '#3b82f6',
    comment_added: '#8b5cf6',
    attachment_added: '#06b6d4',
    training_completed: '#22c55e',
  }

  const deviationTypeColors: Record<Deviation['type'], { bg: string; text: string }> = {
    minor: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    major: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    critical: { bg: 'rgba(220, 38, 38, 0.2)', text: '#dc2626' },
  }

  const deviationStatusColors: Record<Deviation['status'], { bg: string; text: string }> = {
    open: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    investigating: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    resolved: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    closed: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
  }

  const complianceStatusColors: Record<ComplianceCheck['status'], { bg: string; text: string; icon: string }> = {
    compliant: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: '✓' },
    non_compliant: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', icon: '✗' },
    needs_review: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', icon: '!' },
    not_applicable: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', icon: '—' },
  }

  const filteredAudit = useMemo(() => {
    let filtered = auditTrail
    if (auditFilter !== 'all') {
      filtered = filtered.filter(entry => entry.action === auditFilter)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(entry =>
        entry.details.toLowerCase().includes(query) ||
        entry.userName.toLowerCase().includes(query) ||
        entry.action.toLowerCase().includes(query)
      )
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditTrail, auditFilter, searchQuery])

  const filteredDeviations = useMemo(() => {
    let filtered = deviations
    if (deviationFilter !== 'all') {
      filtered = filtered.filter(d => d.status === deviationFilter)
    }
    return filtered.sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
  }, [deviations, deviationFilter])

  const complianceStats = useMemo(() => {
    const stats = { compliant: 0, non_compliant: 0, needs_review: 0, not_applicable: 0 }
    complianceChecks.forEach(check => {
      stats[check.status]++
    })
    const applicableTotal = stats.compliant + stats.non_compliant + stats.needs_review
    const complianceRate = applicableTotal > 0
      ? Math.round((stats.compliant / applicableTotal) * 100)
      : 100
    return { ...stats, complianceRate }
  }, [complianceChecks])

  const deviationStats = useMemo(() => {
    return {
      open: deviations.filter(d => d.status === 'open').length,
      investigating: deviations.filter(d => d.status === 'investigating').length,
      resolved: deviations.filter(d => d.status === 'resolved').length,
      closed: deviations.filter(d => d.status === 'closed').length,
      critical: deviations.filter(d => d.type === 'critical' && d.status !== 'closed').length,
    }
  }, [deviations])

  const handleAddDeviation = () => {
    onAddDeviation({
      executionId: newDeviation.executionId,
      stepIndex: newDeviation.stepIndex,
      type: newDeviation.type,
      description: newDeviation.description,
      reportedBy: newDeviation.reportedBy,
      rootCause: newDeviation.rootCause || undefined,
      correctiveAction: newDeviation.correctiveAction || undefined,
      preventiveAction: newDeviation.preventiveAction || undefined,
    })
    setShowDeviationModal(false)
    setNewDeviation({
      executionId: '',
      stepIndex: 0,
      type: 'minor',
      description: '',
      reportedBy: '',
      rootCause: '',
      correctiveAction: '',
      preventiveAction: '',
    })
  }

  const complianceByCategory = useMemo(() => {
    const categories: Record<string, ComplianceCheck[]> = {}
    complianceChecks.forEach(check => {
      if (!categories[check.category]) categories[check.category] = []
      categories[check.category].push(check)
    })
    return categories
  }, [complianceChecks])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Compliance & Audit Trail
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            21 CFR Part 11 compliant tracking and reporting
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onRunComplianceCheck}
            style={{
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
              color: 'var(--text)', padding: '8px 12px', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🔍 Run Check
          </button>
          <div style={{ position: 'relative' }}>
            <button
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 6,
                color: '#fff', padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onClick={() => onExportAuditReport('pdf')}
            >
              📄 Export Report
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Compliance Rate
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 28, fontWeight: 700,
              color: complianceStats.complianceRate >= 90 ? '#22c55e' : complianceStats.complianceRate >= 70 ? '#f59e0b' : '#ef4444',
            }}>
              {complianceStats.complianceRate}%
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ({complianceStats.compliant}/{complianceStats.compliant + complianceStats.non_compliant + complianceStats.needs_review})
            </span>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Open Deviations
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 28, fontWeight: 700,
              color: deviationStats.open + deviationStats.investigating > 0 ? '#f59e0b' : '#22c55e',
            }}>
              {deviationStats.open + deviationStats.investigating}
            </span>
            {deviationStats.critical > 0 && (
              <span style={{
                padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
              }}>
                {deviationStats.critical} Critical
              </span>
            )}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Audit Events (30 days)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
              {auditTrail.length}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              entries
            </span>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>
            Issues Requiring Action
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{
              fontSize: 28, fontWeight: 700,
              color: complianceStats.non_compliant + complianceStats.needs_review > 0 ? '#ef4444' : '#22c55e',
            }}>
              {complianceStats.non_compliant + complianceStats.needs_review}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
      }}>
        {[
          { id: 'audit', label: 'Audit Trail', count: auditTrail.length },
          { id: 'deviations', label: 'Deviations', count: deviations.length },
          { id: 'compliance', label: 'Compliance Checks', count: complianceChecks.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'audit' | 'deviations' | 'compliance')}
            style={{
              padding: '12px 20px', background: 'transparent', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {tab.label}
            <span style={{
              padding: '2px 8px', borderRadius: 10, fontSize: 11,
              background: activeTab === tab.id ? 'var(--accent-light)' : 'var(--surface)',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Audit Trail Tab */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, padding: 10, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 13,
              }}
            />
            <select
              value={auditFilter}
              onChange={e => setAuditFilter(e.target.value)}
              style={{
                padding: 10, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 13, minWidth: 150,
              }}
            >
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="edited">Edited</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="executed">Executed</option>
              <option value="deviation">Deviation</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </div>

          {/* Audit List */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {filteredAudit.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontSize: 14 }}>No audit entries found</div>
              </div>
            ) : (
              <div style={{ maxHeight: 500, overflow: 'auto' }}>
                {filteredAudit.map((entry, index) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: 16,
                      borderBottom: index < filteredAudit.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `${actionColors[entry.action]}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {actionIcons[entry.action]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          color: actionColors[entry.action],
                          fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                        }}>
                          {entry.action.replace('_', ' ')}
                        </span>
                        <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                          {entry.userName}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          ({entry.userRole})
                        </span>
                        {entry.sectionAffected && (
                          <span style={{
                            padding: '2px 6px', borderRadius: 4, fontSize: 10,
                            background: 'var(--bg)', color: 'var(--text-muted)',
                          }}>
                            {entry.sectionAffected}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-soft)', fontSize: 13, marginTop: 4 }}>
                        {entry.details}
                      </div>
                      {(entry.oldValue || entry.newValue) && (
                        <div style={{
                          marginTop: 8, padding: 10, background: 'var(--bg)',
                          borderRadius: 6, fontSize: 12,
                        }}>
                          {entry.oldValue && (
                            <div style={{ color: '#ef4444', fontFamily: 'monospace' }}>
                              - {entry.oldValue}
                            </div>
                          )}
                          {entry.newValue && (
                            <div style={{ color: '#22c55e', fontFamily: 'monospace' }}>
                              + {entry.newValue}
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{
                        display: 'flex', gap: 16, marginTop: 8, color: 'var(--text-muted)', fontSize: 11,
                      }}>
                        <span>{formatDateTime(entry.timestamp)}</span>
                        {entry.ipAddress && <span>IP: {entry.ipAddress}</span>}
                        {entry.sessionId && <span>Session: {entry.sessionId.slice(0, 8)}...</span>}
                      </div>
                      {entry.complianceFlags && entry.complianceFlags.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {entry.complianceFlags.map((flag, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b',
                              }}
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deviations Tab */}
      {activeTab === 'deviations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['all', 'open', 'investigating', 'resolved', 'closed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setDeviationFilter(status)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                    background: deviationFilter === status ? 'var(--accent)' : 'var(--surface)',
                    border: `1px solid ${deviationFilter === status ? 'var(--accent)' : 'var(--border)'}`,
                    color: deviationFilter === status ? '#fff' : 'var(--text-muted)',
                    fontSize: 12, textTransform: 'capitalize',
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDeviationModal(true)}
              style={{
                background: '#f59e0b', border: 'none', borderRadius: 6,
                color: '#fff', padding: '8px 16px', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              + Report Deviation
            </button>
          </div>

          {/* Deviations List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredDeviations.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 60, color: 'var(--text-muted)',
                background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 14 }}>No deviations reported</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  All protocol executions are running as expected
                </div>
              </div>
            ) : (
              filteredDeviations.map(deviation => (
                <div
                  key={deviation.id}
                  onClick={() => setSelectedDeviation(deviation)}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: 16, cursor: 'pointer',
                    borderLeft: `4px solid ${deviationTypeColors[deviation.type].text}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: deviationTypeColors[deviation.type].bg,
                          color: deviationTypeColors[deviation.type].text,
                          textTransform: 'uppercase',
                        }}>
                          {deviation.type}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: deviationStatusColors[deviation.status].bg,
                          color: deviationStatusColors[deviation.status].text,
                          textTransform: 'capitalize',
                        }}>
                          {deviation.status}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          Step {deviation.stepIndex + 1}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text)', fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
                        {deviation.description}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {formatTimeAgo(deviation.reportedAt)}
                      </div>
                      <div style={{ color: 'var(--text-soft)', fontSize: 12, marginTop: 4 }}>
                        {deviation.reportedBy}
                      </div>
                    </div>
                  </div>
                  {(deviation.rootCause || deviation.correctiveAction) && (
                    <div style={{
                      marginTop: 12, padding: 12, background: 'var(--bg)', borderRadius: 8,
                    }}>
                      {deviation.rootCause && (
                        <div style={{ marginBottom: deviation.correctiveAction ? 8 : 0 }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Root Cause</div>
                          <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>{deviation.rootCause}</div>
                        </div>
                      )}
                      {deviation.correctiveAction && (
                        <div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 2 }}>Corrective Action</div>
                          <div style={{ color: 'var(--text-soft)', fontSize: 13 }}>{deviation.correctiveAction}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {deviation.status !== 'closed' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      {deviation.status === 'open' && (
                        <button
                          onClick={e => { e.stopPropagation(); onUpdateDeviation(deviation.id, { status: 'investigating' }) }}
                          style={{
                            background: '#f59e0b', border: 'none', borderRadius: 4,
                            color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          }}
                        >
                          Start Investigation
                        </button>
                      )}
                      {deviation.status === 'investigating' && (
                        <button
                          onClick={e => { e.stopPropagation(); onUpdateDeviation(deviation.id, { status: 'resolved' }) }}
                          style={{
                            background: '#3b82f6', border: 'none', borderRadius: 4,
                            color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          }}
                        >
                          Mark Resolved
                        </button>
                      )}
                      {deviation.status === 'resolved' && (
                        <button
                          onClick={e => { e.stopPropagation(); onUpdateDeviation(deviation.id, { status: 'closed' }) }}
                          style={{
                            background: '#22c55e', border: 'none', borderRadius: 4,
                            color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          }}
                        >
                          Close Deviation
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Compliance Checks Tab */}
      {activeTab === 'compliance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(complianceByCategory).map(([category, checks]) => (
            <div
              key={category}
              style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, overflow: 'hidden',
              }}
            >
              <div style={{
                padding: '12px 16px', background: 'var(--bg)',
                borderBottom: '1px solid var(--border)',
              }}>
                <h4 style={{
                  color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: 0,
                  textTransform: 'capitalize',
                }}>
                  {category}
                </h4>
              </div>
              <div>
                {checks.map((check, index) => (
                  <div
                    key={check.id}
                    style={{
                      padding: 16,
                      borderBottom: index < checks.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: complianceStatusColors[check.status].bg,
                      color: complianceStatusColors[check.status].text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 700, flexShrink: 0,
                    }}>
                      {complianceStatusColors[check.status].icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 500 }}>
                        {check.requirement}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 10,
                          background: 'var(--bg)', color: 'var(--text-muted)',
                        }}>
                          {check.regulation}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          Last checked: {formatTimeAgo(check.lastChecked)}
                        </span>
                        {check.checkedBy && (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                            by {check.checkedBy}
                          </span>
                        )}
                      </div>
                      {check.notes && (
                        <div style={{
                          marginTop: 8, padding: 8, background: 'var(--bg)',
                          borderRadius: 4, color: 'var(--text-soft)', fontSize: 12,
                        }}>
                          {check.notes}
                        </div>
                      )}
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: complianceStatusColors[check.status].bg,
                      color: complianceStatusColors[check.status].text,
                      textTransform: 'capitalize', whiteSpace: 'nowrap',
                    }}>
                      {check.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Deviation Modal */}
      {showDeviationModal && (
        <>
          <div
            onClick={() => setShowDeviationModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', zIndex: 201,
          }}>
            <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: '0 0 20px' }}>
              Report Deviation
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Deviation Type *
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['minor', 'major', 'critical'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewDeviation(prev => ({ ...prev, type }))}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 6, cursor: 'pointer',
                        background: newDeviation.type === type ? deviationTypeColors[type].bg : 'var(--bg)',
                        border: `1px solid ${newDeviation.type === type ? deviationTypeColors[type].text : 'var(--border)'}`,
                        color: newDeviation.type === type ? deviationTypeColors[type].text : 'var(--text-muted)',
                        fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Execution ID
                  </label>
                  <input
                    type="text"
                    value={newDeviation.executionId}
                    onChange={e => setNewDeviation(prev => ({ ...prev, executionId: e.target.value }))}
                    placeholder="e.g., EXE-001"
                    style={{
                      width: '100%', padding: 10, background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Step Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newDeviation.stepIndex + 1}
                    onChange={e => setNewDeviation(prev => ({ ...prev, stepIndex: parseInt(e.target.value) - 1 || 0 }))}
                    style={{
                      width: '100%', padding: 10, background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Description *
                </label>
                <textarea
                  value={newDeviation.description}
                  onChange={e => setNewDeviation(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what deviated from the expected procedure..."
                  rows={3}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, resize: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Root Cause (if known)
                </label>
                <textarea
                  value={newDeviation.rootCause}
                  onChange={e => setNewDeviation(prev => ({ ...prev, rootCause: e.target.value }))}
                  placeholder="What caused this deviation?"
                  rows={2}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, resize: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Corrective Action
                </label>
                <textarea
                  value={newDeviation.correctiveAction}
                  onChange={e => setNewDeviation(prev => ({ ...prev, correctiveAction: e.target.value }))}
                  placeholder="What action was taken to address this deviation?"
                  rows={2}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, resize: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Preventive Action
                </label>
                <textarea
                  value={newDeviation.preventiveAction}
                  onChange={e => setNewDeviation(prev => ({ ...prev, preventiveAction: e.target.value }))}
                  placeholder="What measures will prevent this from happening again?"
                  rows={2}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, resize: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Reported By *
                </label>
                <input
                  type="text"
                  value={newDeviation.reportedBy}
                  onChange={e => setNewDeviation(prev => ({ ...prev, reportedBy: e.target.value }))}
                  placeholder="Your name"
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 13, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setShowDeviationModal(false)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddDeviation}
                disabled={!newDeviation.description.trim() || !newDeviation.reportedBy.trim()}
                style={{
                  background: (newDeviation.description.trim() && newDeviation.reportedBy.trim()) ? '#f59e0b' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: '#fff', padding: '10px 20px',
                  cursor: (newDeviation.description.trim() && newDeviation.reportedBy.trim()) ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600,
                  opacity: (newDeviation.description.trim() && newDeviation.reportedBy.trim()) ? 1 : 0.5,
                }}
              >
                Submit Deviation
              </button>
            </div>
          </div>
        </>
      )}

      {/* Deviation Detail Modal */}
      {selectedDeviation && (
        <>
          <div
            onClick={() => setSelectedDeviation(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', zIndex: 201,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: deviationTypeColors[selectedDeviation.type].bg,
                    color: deviationTypeColors[selectedDeviation.type].text,
                    textTransform: 'uppercase',
                  }}>
                    {selectedDeviation.type} Deviation
                  </span>
                  <span style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: deviationStatusColors[selectedDeviation.status].bg,
                    color: deviationStatusColors[selectedDeviation.status].text,
                    textTransform: 'capitalize',
                  }}>
                    {selectedDeviation.status}
                  </span>
                </div>
                <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: 0 }}>
                  Deviation Report
                </h3>
              </div>
              <button
                onClick={() => setSelectedDeviation(null)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: 20, color: 'var(--text-muted)', padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
                padding: 12, background: 'var(--bg)', borderRadius: 8,
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Execution ID</div>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                    {selectedDeviation.executionId}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Step</div>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                    {selectedDeviation.stepIndex + 1}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reported</div>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                    {formatDateTime(selectedDeviation.reportedAt)}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Description</div>
                <div style={{
                  padding: 12, background: 'var(--bg)', borderRadius: 8,
                  color: 'var(--text)', fontSize: 14, lineHeight: 1.6,
                }}>
                  {selectedDeviation.description}
                </div>
              </div>

              {selectedDeviation.rootCause && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Root Cause</div>
                  <div style={{
                    padding: 12, background: 'var(--bg)', borderRadius: 8,
                    color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6,
                  }}>
                    {selectedDeviation.rootCause}
                  </div>
                </div>
              )}

              {selectedDeviation.correctiveAction && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Corrective Action</div>
                  <div style={{
                    padding: 12, background: 'rgba(59, 130, 246, 0.1)', borderRadius: 8,
                    color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6,
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                  }}>
                    {selectedDeviation.correctiveAction}
                  </div>
                </div>
              )}

              {selectedDeviation.preventiveAction && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Preventive Action</div>
                  <div style={{
                    padding: 12, background: 'rgba(34, 197, 94, 0.1)', borderRadius: 8,
                    color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.6,
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                  }}>
                    {selectedDeviation.preventiveAction}
                  </div>
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 12, background: 'var(--bg)', borderRadius: 8,
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reported By</div>
                  <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                    {selectedDeviation.reportedBy}
                  </div>
                </div>
                {selectedDeviation.resolvedBy && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Resolved By</div>
                    <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                      {selectedDeviation.resolvedBy}
                    </div>
                    {selectedDeviation.resolvedAt && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                        {formatDateTime(selectedDeviation.resolvedAt)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setSelectedDeviation(null)}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Close
              </button>
              {selectedDeviation.status !== 'closed' && (
                <button
                  onClick={() => {
                    const nextStatus: Record<Deviation['status'], Deviation['status']> = {
                      open: 'investigating',
                      investigating: 'resolved',
                      resolved: 'closed',
                      closed: 'closed',
                    }
                    onUpdateDeviation(selectedDeviation.id, { status: nextStatus[selectedDeviation.status] })
                    setSelectedDeviation(null)
                  }}
                  style={{
                    background: 'var(--accent)', border: 'none', borderRadius: 6,
                    color: '#fff', padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {selectedDeviation.status === 'open' && 'Start Investigation'}
                  {selectedDeviation.status === 'investigating' && 'Mark Resolved'}
                  {selectedDeviation.status === 'resolved' && 'Close Deviation'}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
