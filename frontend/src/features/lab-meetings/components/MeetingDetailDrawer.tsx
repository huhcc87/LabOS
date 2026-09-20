import React, { useEffect, useState } from 'react'
import type { Meeting, AgendaItem, ActionItem, AttendanceStatus, ActionItemStatus, ProgressReport } from '../types/meeting.types'
import { MeetingTypeBadge, MeetingStatusBadge } from './MeetingBadges'
import { formatMeetingDate, formatTime, formatMeetingDuration } from '../utils/meetingUtils'
import AgendaBuilder from './AgendaBuilder'
import AgendaItemForm from './AgendaItemForm'
import AttendanceSheet from './AttendanceSheet'
import MinutesEditor from './MinutesEditor'
import ProgressReportPanel from './ProgressReportPanel'
import ActionItemsPanel from './ActionItemsPanel'

type DrawerTab = 'agenda' | 'attendance' | 'actions' | 'progress' | 'minutes'

interface Props {
  meeting: Meeting | null
  onClose: () => void
  isPiOrAdmin: boolean
  isManagerOrAbove: boolean
  currentUserName: string
  currentUserRole: string
  onApproveAgenda: (itemId: string) => void
  onRejectAgenda: (itemId: string, reason?: string) => void
  onReorderAgenda: (from: number, to: number) => void
  onAddAgendaItem: (item: Omit<AgendaItem, 'id' | 'meetingId' | 'submittedAt'>) => void
  onMarkAttendance: (userId: string, status: AttendanceStatus) => void
  onSaveMinutes: (text: string) => void
  onPublishMinutes: () => void
  onUpdateActionStatus: (id: string, status: ActionItemStatus) => void
  onDeleteAction: (id: string) => void
  meetingActionItems: ActionItem[]
  onSubmitProgressReport: (report: Omit<ProgressReport, 'id' | 'meetingId' | 'submittedAt' | 'status'>) => void
  onAcknowledgeReport: (reportId: string, comment: string) => void
  onEdit?: () => void
  onDelete?: () => void
  onCancel?: () => void
  onStartVideoCall?: () => void
}

export default function MeetingDetailDrawer({
  meeting: m, onClose, isPiOrAdmin, isManagerOrAbove, currentUserName, currentUserRole,
  onApproveAgenda, onRejectAgenda, onReorderAgenda, onAddAgendaItem,
  onMarkAttendance, onSaveMinutes, onPublishMinutes,
  onUpdateActionStatus, onDeleteAction, meetingActionItems,
  onSubmitProgressReport, onAcknowledgeReport,
  onEdit, onDelete, onCancel, onStartVideoCall,
}: Props) {
  const [tab, setTab] = useState<DrawerTab>('agenda')
  const [showAgendaForm, setShowAgendaForm] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => { if (m) setTab('agenda') }, [m?.id])

  const TABS: { key: DrawerTab; label: string; icon: string; show: boolean }[] = [
    { key: 'agenda', label: 'Agenda', icon: '📋', show: true },
    { key: 'attendance', label: 'Attendance', icon: '👥', show: true },
    { key: 'actions', label: 'Actions', icon: '✓', show: true },
    { key: 'progress', label: 'Reports', icon: '📊', show: true },
    { key: 'minutes', label: 'Minutes', icon: '📝', show: true },
  ]

  const pendingCount = m?.agenda.filter(a => a.status === 'pending_approval').length || 0
  const overdueActions = meetingActionItems.filter(a => a.status === 'overdue').length

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#00000077', zIndex: 100, opacity: m ? 1 : 0, pointerEvents: m ? 'auto' : 'none', transition: 'opacity 0.3s' }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(760px, 98vw)',
        background: '#fff', borderLeft: '1px solid #e2e8f0', zIndex: 101, overflowY: 'auto',
        transform: m ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {m && (
          <>
            {/* Sticky header */}
            <div style={{ position: 'sticky', top: 0, background: '#fff', borderBottom: '1px solid #f1f5f9', padding: '16px 20px', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <MeetingTypeBadge type={m.type} />
                    <MeetingStatusBadge status={m.status} />
                    {isPiOrAdmin && pendingCount > 0 && (
                      <span style={{ background: '#fef9c3', color: '#92400e', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ⏳ {pendingCount} pending approval
                      </span>
                    )}
                    {overdueActions > 0 && (
                      <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                        ⚠ {overdueActions} overdue
                      </span>
                    )}
                  </div>
                  <h2 style={{ color: '#1e293b', fontSize: 17, fontWeight: 800, margin: 0, lineHeight: 1.3 }}>{m.title}</h2>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 5 }}>
                    <span style={{ color: '#64748b', fontSize: 12 }}>📅 {formatMeetingDate(m.scheduledAt)}</span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>🕐 {formatTime(m.scheduledAt)} – {formatTime(m.endTime)} ({formatMeetingDuration(m.scheduledAt, m.endTime)})</span>
                    <span style={{ color: '#64748b', fontSize: 12 }}>📍 {m.location}</span>
                  </div>
                  {/* Video Meeting Buttons */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {/* Start LabOS Video Call */}
                    {onStartVideoCall && (
                      <button
                        onClick={onStartVideoCall}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                          color: '#fff', fontSize: 13, fontWeight: 700,
                          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                        }}
                      >
                        🎥 Start LabOS Video Call
                      </button>
                    )}
                    {/* External Zoom Link */}
                    {m.zoomLink && (
                      <a
                        href={m.zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: '#22c55e', color: '#fff', fontSize: 13, fontWeight: 700,
                          padding: '8px 16px', borderRadius: 8, textDecoration: 'none',
                          boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
                        }}
                      >
                        🔗 Join External Link
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, color: '#64748b', padding: '8px 12px', cursor: 'pointer', fontSize: 16 }}>✕</button>
                  {/* Admin controls */}
                  {isPiOrAdmin && m.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      {onEdit && (
                        <button onClick={onEdit} style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Edit
                        </button>
                      )}
                      {onCancel && (
                        <button onClick={onCancel} style={{ background: '#fef9c3', border: 'none', borderRadius: 6, color: '#92400e', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Cancel
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={onDelete} style={{ background: '#fee2e2', border: 'none', borderRadius: 6, color: '#dc2626', padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 2, marginTop: 14, background: '#f8fafc', borderRadius: 8, padding: 4 }}>
                {TABS.filter(t => t.show).map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, background: tab === t.key ? '#fff' : 'transparent',
                    border: 'none', borderRadius: 6, color: tab === t.key ? '#1e293b' : '#94a3b8',
                    padding: '7px 8px', cursor: 'pointer', fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
                    boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s',
                  }}>
                    {t.icon} {t.label}
                    {t.key === 'agenda' && isPiOrAdmin && pendingCount > 0 && (
                      <span style={{ marginLeft: 4, background: '#f59e0b', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 10 }}>{pendingCount}</span>
                    )}
                    {t.key === 'actions' && overdueActions > 0 && (
                      <span style={{ marginLeft: 4, background: '#ef4444', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 10 }}>{overdueActions}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px', flex: 1 }}>
              {tab === 'agenda' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ color: '#475569', fontSize: 13 }}>{m.agenda.filter(a => a.status === 'approved').length} approved · {m.agenda.filter(a => a.status === 'pending_approval').length} pending</div>
                    <button onClick={() => setShowAgendaForm(true)} style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      + Submit Topic
                    </button>
                  </div>
                  {showAgendaForm && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                      <AgendaItemForm
                        meetingTitle={m.title}
                        currentUserName={currentUserName}
                        currentUserRole={currentUserRole}
                        onSubmit={(data) => {
                          onAddAgendaItem({
                            ...data, presenterRole: currentUserRole, order: m.agenda.length + 1,
                            status: isPiOrAdmin ? 'approved' : 'pending_approval',
                            submittedBy: currentUserName, submittedByRole: currentUserRole,
                            ...(isPiOrAdmin ? { approvedBy: currentUserName, approvedAt: new Date().toISOString() } : {}),
                          })
                          setShowAgendaForm(false)
                        }}
                        onCancel={() => setShowAgendaForm(false)}
                      />
                    </div>
                  )}
                  <AgendaBuilder meeting={m} isPiOrAdmin={isPiOrAdmin} onApprove={onApproveAgenda} onReject={onRejectAgenda} onReorder={onReorderAgenda} />
                </div>
              )}

              {tab === 'attendance' && (
                <AttendanceSheet meeting={m} isPiOrAdmin={isPiOrAdmin} isManagerOrAbove={isManagerOrAbove} onMark={onMarkAttendance} />
              )}

              {tab === 'actions' && (
                <ActionItemsPanel
                  items={meetingActionItems} isPiOrAdmin={isPiOrAdmin} isManagerOrAbove={isManagerOrAbove}
                  currentUserName={currentUserName}
                  onUpdateStatus={onUpdateActionStatus} onDelete={onDeleteAction}
                />
              )}

              {tab === 'progress' && (
                <ProgressReportPanel
                  reports={m.progressReports} isPiOrAdmin={isPiOrAdmin}
                  currentUserName={currentUserName} meetingTitle={m.title}
                  onSubmit={onSubmitProgressReport} onAcknowledge={onAcknowledgeReport}
                />
              )}

              {tab === 'minutes' && (
                <MinutesEditor meeting={m} isPiOrAdmin={isPiOrAdmin} onSave={onSaveMinutes} onPublish={onPublishMinutes} />
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
