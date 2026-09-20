import React from 'react'
import type { Meeting, ActionItem } from '../types/meeting.types'
import { getMeetingTypeColor, getMeetingTypeLabel, getAttendanceRate, getActionItemCompletionRate } from '../utils/meetingUtils'

interface Props {
  meetings: Meeting[]
  actionItems: ActionItem[]
}

export default function MeetingAnalytics({ meetings, actionItems }: Props) {
  const completed = meetings.filter(m => m.status === 'completed')
  const attendanceRate = getAttendanceRate(completed)
  const completionRate = getActionItemCompletionRate(actionItems)
  const avgAttendees = completed.length > 0 ? Math.round(completed.reduce((s, m) => s + m.attendees.length, 0) / completed.length) : 0

  // Meetings by type
  const byType = meetings.reduce((acc, m) => { acc[m.type] = (acc[m.type] || 0) + 1; return acc }, {} as Record<string, number>)

  // Action items by status
  const aiByStatus = actionItems.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc }, {} as Record<string, number>)

  // Presenter frequency
  const presenterFreq: Record<string, number> = {}
  meetings.forEach(m => m.agenda.forEach(a => {
    if (a.status === 'presented' || a.status === 'approved') {
      presenterFreq[a.presenter] = (presenterFreq[a.presenter] || 0) + 1
    }
  }))
  const topPresenters = Object.entries(presenterFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Reports submitted per member
  const reportsByMember: Record<string, number> = {}
  meetings.forEach(m => m.progressReports.forEach(r => {
    reportsByMember[r.submitterName] = (reportsByMember[r.submitterName] || 0) + 1
  }))

  const Card = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
      <div style={{ color: '#1e293b', fontSize: 12, fontWeight: 700, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{sub}</div>}
    </div>
  )

  const Bar = ({ label, count, max, color }: { label: string; count: number; max: number; color: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#1e293b', fontSize: 13 }}>{label}</span>
        <span style={{ color: '#64748b', fontSize: 12, fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (count / max) * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width 0.5s' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <Card label="Total Meetings" value={meetings.length} sub={`${completed.length} completed`} color="#6366f1" />
        <Card label="Attendance Rate" value={`${attendanceRate}%`} sub="present + remote" color={attendanceRate >= 80 ? '#16a34a' : attendanceRate >= 60 ? '#d97706' : '#dc2626'} />
        <Card label="Action Completion" value={`${completionRate}%`} sub={`${actionItems.filter(a => a.status === 'completed').length}/${actionItems.length} done`} color={completionRate >= 70 ? '#16a34a' : '#f59e0b'} />
        <Card label="Avg. Attendees" value={avgAttendees} sub="per meeting" color="#0ea5e9" />
        <Card label="Overdue Items" value={actionItems.filter(a => a.status === 'overdue').length} sub="needs attention" color="#ef4444" />
        <Card label="Reports Submitted" value={meetings.reduce((s, m) => s + m.progressReports.length, 0)} sub="progress reports" color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Meetings by type */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Meetings by Type</div>
          {Object.entries(byType).length === 0
            ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No meetings yet</div>
            : Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <Bar key={type} label={getMeetingTypeLabel(type as any)} count={count} max={Math.max(...Object.values(byType))} color={getMeetingTypeColor(type as any)} />
            ))
          }
        </div>

        {/* Action items by status */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Action Items by Status</div>
          {Object.entries(aiByStatus).length === 0
            ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No action items</div>
            : Object.entries(aiByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const colors: Record<string, string> = { open: '#f59e0b', in_progress: '#6366f1', completed: '#22c55e', overdue: '#ef4444', cancelled: '#94a3b8' }
              return <Bar key={status} label={status.replace('_', ' ')} count={count} max={Math.max(...Object.values(aiByStatus))} color={colors[status] || '#94a3b8'} />
            })
          }
        </div>

        {/* Top presenters */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Top Presenters</div>
          {topPresenters.length === 0
            ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No presentation data yet</div>
            : topPresenters.map(([name, count]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
                  {name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{name}</div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 3 }}>
                    <div style={{ height: '100%', width: `${(count / topPresenters[0][1]) * 100}%`, background: '#6366f1', borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ color: '#6366f1', fontSize: 12, fontWeight: 700 }}>{count}</span>
              </div>
            ))
          }
        </div>

        {/* Progress report submissions */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ color: '#1e293b', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Progress Reports by Member</div>
          {Object.keys(reportsByMember).length === 0
            ? <div style={{ color: '#94a3b8', fontSize: 12 }}>No reports submitted yet</div>
            : Object.entries(reportsByMember).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fae8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#9333ea', flexShrink: 0 }}>
                  {name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#1e293b', fontSize: 12, fontWeight: 600 }}>{name}</div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 2, marginTop: 3 }}>
                    <div style={{ height: '100%', width: `${(count / Math.max(...Object.values(reportsByMember))) * 100}%`, background: '#9333ea', borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ color: '#9333ea', fontSize: 12, fontWeight: 700 }}>{count} report{count > 1 ? 's' : ''}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
