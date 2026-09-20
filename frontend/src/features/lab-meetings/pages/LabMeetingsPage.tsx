import React, { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useMeetings } from '../hooks/useMeetings'
import { getMeetingTypeColor, getMeetingTypeLabel, getMeetingTypeIcon } from '../utils/meetingUtils'
import MeetingCard from '../components/MeetingCard'
import NextMeetingBanner from '../components/NextMeetingBanner'
import MeetingDetailDrawer from '../components/MeetingDetailDrawer'
import CreateMeetingModal from '../components/CreateMeetingModal'
import ActionItemsPanel from '../components/ActionItemsPanel'
import ProgressReportPanel from '../components/ProgressReportPanel'
import MeetingAnalytics from '../components/MeetingAnalytics'
import VideoCallRoom from '../components/VideoCallRoom'
import { videoApi } from '../../../lib/api'
import toast from 'react-hot-toast'
import type { Meeting, MeetingType, MeetingStatus } from '../types/meeting.types'

// Meeting Templates
const MEETING_TEMPLATES = [
  {
    id: 'weekly-lab',
    name: 'Weekly Lab Meeting',
    icon: '🔬',
    type: 'weekly' as MeetingType,
    duration: 60,
    description: 'Standard weekly lab meeting with project updates and announcements',
    defaultAgenda: [
      { title: 'Announcements', duration: 5, presenter: 'PI' },
      { title: 'Safety Updates', duration: 5, presenter: 'Safety Officer' },
      { title: 'Project Updates', duration: 30, presenter: 'All Members' },
      { title: 'Equipment/Resource Issues', duration: 10, presenter: 'All' },
      { title: 'Open Discussion', duration: 10, presenter: 'All' },
    ],
  },
  {
    id: 'journal-club',
    name: 'Journal Club',
    icon: '📚',
    type: 'journal_club' as MeetingType,
    duration: 90,
    description: 'Paper discussion and critical analysis session',
    defaultAgenda: [
      { title: 'Paper Introduction', duration: 10, presenter: 'Presenter' },
      { title: 'Background/Context', duration: 15, presenter: 'Presenter' },
      { title: 'Methods Deep Dive', duration: 20, presenter: 'Presenter' },
      { title: 'Results Analysis', duration: 25, presenter: 'Presenter' },
      { title: 'Critical Discussion', duration: 15, presenter: 'All' },
      { title: 'Lab Applications', duration: 5, presenter: 'All' },
    ],
  },
  {
    id: 'one-on-one',
    name: '1:1 Meeting',
    icon: '👥',
    type: 'one_on_one' as MeetingType,
    duration: 30,
    description: 'Individual progress and mentorship meeting',
    defaultAgenda: [
      { title: 'Research Progress', duration: 10, presenter: 'Mentee' },
      { title: 'Challenges/Roadblocks', duration: 10, presenter: 'Mentee' },
      { title: 'Career Development', duration: 5, presenter: 'Both' },
      { title: 'Next Steps', duration: 5, presenter: 'Both' },
    ],
  },
  {
    id: 'thesis-committee',
    name: 'Thesis Committee',
    icon: '🎓',
    type: 'progress_report' as MeetingType,
    duration: 120,
    description: 'Thesis committee meeting with formal progress evaluation',
    defaultAgenda: [
      { title: 'Research Overview', duration: 15, presenter: 'Student' },
      { title: 'Completed Work', duration: 30, presenter: 'Student' },
      { title: 'Proposed Work', duration: 20, presenter: 'Student' },
      { title: 'Committee Questions', duration: 30, presenter: 'Committee' },
      { title: 'Closed Session', duration: 15, presenter: 'Committee' },
      { title: 'Feedback & Recommendations', duration: 10, presenter: 'Committee' },
    ],
  },
  {
    id: 'lab-retreat',
    name: 'Lab Retreat',
    icon: '🏕️',
    type: 'lab_retreat' as MeetingType,
    duration: 480,
    description: 'Annual lab retreat with presentations and team building',
    defaultAgenda: [
      { title: 'Welcome & Overview', duration: 15, presenter: 'PI' },
      { title: 'Research Presentations', duration: 180, presenter: 'All' },
      { title: 'Group Discussions', duration: 60, presenter: 'All' },
      { title: 'Career Workshop', duration: 60, presenter: 'Invited Speaker' },
      { title: 'Team Building Activity', duration: 90, presenter: 'All' },
      { title: 'Lab Goals Discussion', duration: 45, presenter: 'All' },
      { title: 'Wrap-up & Feedback', duration: 30, presenter: 'PI' },
    ],
  },
];

// Knowledge Base Article Type
interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  meetingId?: string;
  views: number;
}

// Poll Type
interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  createdBy: string;
  status: 'active' | 'closed';
  meetingId?: string;
}

export default function LabMeetingsPage() {
  const { user, hasRole } = useAuth()
  const isPiOrAdmin = hasRole('pi')
  const isManagerOrAbove = hasRole('manager')
  const currentUserName = user?.full_name || 'Unknown'
  const currentUserRole = user?.role || 'trainee'

  const store = useMeetings(currentUserName, currentUserRole)

  const [showCreate, setShowCreate] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [showAgendaFormForNext, setShowAgendaFormForNext] = useState(false)
  const [showProgressFormForNext, setShowProgressFormForNext] = useState(false)
  const [typeFilter, setTypeFilter] = useState<MeetingType | ''>('')
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | ''>('')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Meeting | null>(null)

  // Video call state
  const [activeVideoCall, setActiveVideoCall] = useState<{ roomId: string; meetingId?: string | number; meetingTitle?: string } | null>(null)
  const [joiningCall, setJoiningCall] = useState(false)

  // Deep-link: if URL contains ?room=…, auto-join that room
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room && !activeVideoCall) {
      setActiveVideoCall({ roomId: room, meetingTitle: `LabHuddle · joined via link` })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // New feature states
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<typeof MEETING_TEMPLATES[0] | null>(null)

  // Knowledge Base
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([
    { id: '1', title: 'Western Blot Protocol Tips', category: 'Protocols', content: 'Key tips from lab meetings about optimizing Western blots...', tags: ['western blot', 'protein'], createdBy: 'Lab Meeting - March 2024', createdAt: '2024-03-15', views: 45 },
    { id: '2', title: 'qPCR Troubleshooting Guide', category: 'Troubleshooting', content: 'Common issues and solutions discussed in meetings...', tags: ['qPCR', 'molecular biology'], createdBy: 'Journal Club - Feb 2024', createdAt: '2024-02-20', views: 32 },
    { id: '3', title: 'Cell Culture Best Practices', category: 'Protocols', content: 'Compilation of cell culture tips from various meetings...', tags: ['cell culture', 'tissue culture'], createdBy: 'Weekly Meeting', createdAt: '2024-03-01', views: 67 },
    { id: '4', title: 'Statistical Analysis Methods', category: 'Analysis', content: 'Statistical approaches discussed in journal clubs...', tags: ['statistics', 'analysis'], createdBy: 'Journal Club', createdAt: '2024-03-10', views: 28 },
  ])
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [knowledgeCategory, setKnowledgeCategory] = useState('')

  // Polls
  const [polls, setPolls] = useState<Poll[]>([
    { id: '1', question: 'Best time for next lab retreat?', options: [{ id: 'a', text: 'June 15-16', votes: 8 }, { id: 'b', text: 'June 22-23', votes: 5 }, { id: 'c', text: 'July 6-7', votes: 3 }], createdBy: 'PI', status: 'active' },
    { id: '2', question: 'Preferred journal club format?', options: [{ id: 'a', text: 'Single presenter', votes: 4 }, { id: 'b', text: 'Panel discussion', votes: 7 }, { id: 'c', text: 'Rotating sections', votes: 6 }], createdBy: 'Lab Manager', status: 'active' },
  ])
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [newPollQuestion, setNewPollQuestion] = useState('')
  const [newPollOptions, setNewPollOptions] = useState(['', ''])

  // AI Transcription
  const [transcriptions, setTranscriptions] = useState<{ meetingId: string; text: string; summary: string; actionItems: string[]; timestamp: string }[]>([
    { meetingId: '1', text: 'Full transcription text...', summary: 'Discussed project timelines and resource allocation. Key decisions made about equipment purchase.', actionItems: ['Order new centrifuge by Friday', 'Schedule training session for new software'], timestamp: '2024-03-20T14:00:00' },
  ])
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false)
  const [selectedTranscription, setSelectedTranscription] = useState<typeof transcriptions[0] | null>(null)

  // Whiteboard
  const [whiteboardOpen, setWhiteboardOpen] = useState(false)

  const tab = store.activeTab

  // When drawer is open, wire its operations to the selected meeting
  const sm = store.selectedMeeting
  const meetingActionItems = sm ? store.actionItems.filter(a => a.meetingId === sm.id) : []

  function handleOpenNext() {
    if (store.nextMeeting) store.setSelectedMeeting(store.nextMeeting)
  }
  function handleSubmitTopicForNext() {
    if (store.nextMeeting) { store.setSelectedMeeting(store.nextMeeting); setShowAgendaFormForNext(true) }
  }

  function handleEditMeeting(meeting: Meeting) {
    setEditingMeeting(meeting)
    setShowCreate(true)
    store.setSelectedMeeting(null)
  }

  function handleSaveMeeting(data: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'agenda' | 'attendees' | 'actionItems' | 'progressReports' | 'minutes' | 'minutesPublished'>) {
    if (editingMeeting) {
      store.updateMeeting(editingMeeting.id, data)
    } else {
      store.addMeeting(data)
    }
    setShowCreate(false)
    setEditingMeeting(null)
  }

  function handleDeleteMeeting(meeting: Meeting) {
    setConfirmDelete(meeting)
    store.setSelectedMeeting(null)
  }

  function confirmDeleteMeeting() {
    if (confirmDelete) {
      store.deleteMeeting(confirmDelete.id)
      setConfirmDelete(null)
    }
  }

  // Video call functions
  async function startVideoCall(meeting?: Meeting) {
    setJoiningCall(true)
    try {
      const meetingId = meeting?.id
      const res = await videoApi.createRoom(meetingId)
      setActiveVideoCall({
        roomId: res.data.room_id,
        meetingId: meetingId,
        meetingTitle: meeting?.title,
      })
      store.setSelectedMeeting(null)
      toast.success('Video call started!')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start video call')
    } finally {
      setJoiningCall(false)
    }
  }

  function leaveVideoCall() {
    setActiveVideoCall(null)
  }

  const MEETING_TYPES: MeetingType[] = ['weekly', 'journal_club', 'lab_retreat', 'one_on_one', 'progress_report', 'special']

  // Stats for header
  const openActions = store.actionItems.filter(a => a.status === 'open' || a.status === 'in_progress').length
  const overdueActions = store.actionItems.filter(a => a.status === 'overdue').length
  const pendingReports = store.meetings.reduce((s, m) => s + m.progressReports.filter(r => r.status === 'submitted').length, 0)
  const pendingAgenda = store.meetings.reduce((s, m) => s + m.agenda.filter(a => a.status === 'pending_approval').length, 0)

  // Loading state
  if (store.loading) {
    return (
      <div style={{ padding: 0, minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <div style={{ color: '#64748b', fontSize: 15 }}>Loading meetings...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 0, minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#1e293b', fontSize: 22, fontWeight: 800, margin: 0 }}>Lab Meetings</h1>
            <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0 0' }}>
              {store.upcoming.length} upcoming · {store.past.length} past · Role: <strong>{currentUserRole}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Quick stat pills */}
            {openActions > 0 && (
              <span onClick={() => store.setActiveTab('actions')} style={{ background: '#fef9c3', color: '#92400e', fontSize: 12, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                ✓ {openActions} open action{openActions > 1 ? 's' : ''}
              </span>
            )}
            {overdueActions > 0 && (
              <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 12, padding: '5px 10px', borderRadius: 6, fontWeight: 700 }}>
                ⚠ {overdueActions} overdue
              </span>
            )}
            {isPiOrAdmin && pendingAgenda > 0 && (
              <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 12, padding: '5px 10px', borderRadius: 6, fontWeight: 600 }}>
                📋 {pendingAgenda} agenda pending
              </span>
            )}
            {isPiOrAdmin && pendingReports > 0 && (
              <span style={{ background: '#f5f3ff', color: '#7c3aed', fontSize: 12, padding: '5px 10px', borderRadius: 6, fontWeight: 600 }}>
                📊 {pendingReports} report{pendingReports > 1 ? 's' : ''} to review
              </span>
            )}
            {/* Start Instant Video Call Button */}
            <button
              onClick={() => startVideoCall()}
              disabled={joiningCall}
              style={{
                background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px',
                cursor: joiningCall ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 8px rgba(34,197,94,0.3)',
              }}
            >
              🎥 {joiningCall ? 'Starting...' : 'Start Video Call'}
            </button>
            {isPiOrAdmin && (
              <button onClick={() => setShowCreate(true)} style={{ background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                + Schedule Meeting
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Next meeting banner */}
        {store.nextMeeting && tab === 'upcoming' && (
          <NextMeetingBanner
            meeting={store.nextMeeting}
            onClick={handleOpenNext}
            onSubmitTopic={handleSubmitTopicForNext}
            onSubmitReport={() => { store.setSelectedMeeting(store.nextMeeting!); store.setActiveTab('progress') }}
            isPiOrAdmin={isPiOrAdmin}
          />
        )}

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 4, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            { key: 'upcoming', label: 'Upcoming', icon: '📅', count: store.upcoming.length },
            { key: 'past', label: 'Past', icon: '📂', count: store.past.length },
            { key: 'actions', label: 'Actions', icon: '✓', count: openActions, alert: overdueActions > 0 },
            { key: 'progress', label: 'Reports', icon: '📊', count: isPiOrAdmin ? pendingReports : undefined },
            { key: 'templates', label: 'Templates', icon: '📋' },
            { key: 'knowledge', label: 'Knowledge', icon: '📚', count: knowledgeArticles.length },
            { key: 'polls', label: 'Polls', icon: '📊', count: polls.filter(p => p.status === 'active').length },
            { key: 'analytics', label: 'Analytics', icon: '📈', show: isManagerOrAbove },
          ] as any[]).filter(t => t.show !== false).map((t: any) => (
            <button key={t.key} onClick={() => store.setActiveTab(t.key)} style={{
              flex: 1, minWidth: 80, background: tab === t.key ? '#6366f1' : 'transparent', border: 'none', borderRadius: 8,
              color: tab === t.key ? '#fff' : '#64748b', padding: '9px 12px', cursor: 'pointer', fontSize: 12,
              fontWeight: tab === t.key ? 700 : 400, transition: 'all 0.15s', position: 'relative',
            }}>
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span style={{ marginLeft: 5, background: tab === t.key ? 'rgba(255,255,255,0.3)' : (t.alert ? '#ef4444' : '#e2e8f0'), color: tab === t.key ? '#fff' : (t.alert ? '#fff' : '#64748b'), fontSize: 11, padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── UPCOMING ─────────────────────────────────────────────────────── */}
        {tab === 'upcoming' && (
          <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={e => { setSearch(e.target.value); store.setFilters({ ...store.filters, search: e.target.value }) }}
                placeholder="Search meetings..." style={{ flex: 1, minWidth: 200, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
              <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value as any); store.setFilters({ ...store.filters, type: e.target.value as any }) }}
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#475569', padding: '8px 12px', fontSize: 13 }}>
                <option value="">All types</option>
                {MEETING_TYPES.map(t => <option key={t} value={t}>{getMeetingTypeIcon(t)} {getMeetingTypeLabel(t)}</option>)}
              </select>
            </div>

            {/* Type filter chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {MEETING_TYPES.map(t => {
                const count = store.upcoming.filter(m => m.type === t).length
                if (count === 0) return null
                const active = typeFilter === t
                return (
                  <button key={t} onClick={() => { setTypeFilter(active ? '' : t); store.setFilters({ ...store.filters, type: active ? '' : t }) }} style={{
                    background: active ? getMeetingTypeColor(t) : '#fff', border: `1px solid ${getMeetingTypeColor(t)}44`,
                    borderRadius: 20, color: active ? '#fff' : getMeetingTypeColor(t), padding: '4px 12px', cursor: 'pointer', fontSize: 12,
                  }}>
                    {getMeetingTypeIcon(t)} {getMeetingTypeLabel(t)} ({count})
                  </button>
                )
              })}
            </div>

            {store.filteredUpcoming.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
                <div style={{ fontSize: 15, color: '#64748b' }}>No upcoming meetings</div>
                {isPiOrAdmin && <button onClick={() => setShowCreate(true)} style={{ marginTop: 12, background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>Schedule First Meeting</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {store.filteredUpcoming.map(m => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    onClick={() => store.setSelectedMeeting(m)}
                    isPiOrAdmin={isPiOrAdmin}
                    onCancel={() => store.cancelMeeting(m.id)}
                    onEdit={() => handleEditMeeting(m)}
                    onDelete={() => handleDeleteMeeting(m)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAST ─────────────────────────────────────────────────────────── */}
        {tab === 'past' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input value={search} onChange={e => { setSearch(e.target.value); store.setFilters({ ...store.filters, search: e.target.value }) }}
                placeholder="Search past meetings..." style={{ flex: 1, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b', padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            </div>
            {store.filteredPast.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8', background: '#fff', borderRadius: 10 }}>No past meetings found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {store.filteredPast.map(m => (
                  <MeetingCard
                    key={m.id}
                    meeting={m}
                    onClick={() => store.setSelectedMeeting(m)}
                    isPiOrAdmin={isPiOrAdmin}
                    onDelete={() => handleDeleteMeeting(m)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ACTION ITEMS ─────────────────────────────────────────────────── */}
        {tab === 'actions' && (
          <ActionItemsPanel
            items={store.myActionItems} isPiOrAdmin={isPiOrAdmin} isManagerOrAbove={isManagerOrAbove}
            currentUserName={currentUserName}
            onUpdateStatus={store.updateActionItemStatus} onDelete={store.deleteActionItem}
          />
        )}

        {/* ── PROGRESS REPORTS ─────────────────────────────────────────────── */}
        {tab === 'progress' && (
          <div>
            {store.upcoming.length > 0 ? (
              <ProgressReportPanel
                reports={store.meetings.flatMap(m => m.progressReports)}
                isPiOrAdmin={isPiOrAdmin} currentUserName={currentUserName}
                meetingTitle={store.nextMeeting?.title || 'Next Meeting'}
                onSubmit={(r) => store.nextMeeting && store.submitProgressReport(store.nextMeeting.id, r)}
                onAcknowledge={(reportId, comment) => {
                  const meeting = store.meetings.find(m => m.progressReports.some(r => r.id === reportId))
                  if (meeting) store.acknowledgeProgressReport(meeting.id, reportId, comment)
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>No upcoming meetings to submit reports for</div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ────────────────────────────────────────────────────── */}
        {tab === 'analytics' && isManagerOrAbove && (
          <MeetingAnalytics meetings={store.meetings} actionItems={store.actionItems} />
        )}

        {/* ── TEMPLATES ─────────────────────────────────────────────────────── */}
        {tab === 'templates' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Meeting Templates</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Choose a template to quickly schedule common meeting types</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {MEETING_TEMPLATES.map(template => (
                <div
                  key={template.id}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: '2px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => {
                    setSelectedTemplate(template)
                    if (isPiOrAdmin) {
                      setShowCreate(true)
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <span style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: getMeetingTypeColor(template.type) + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                    }}>
                      {template.icon}
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{template.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{template.duration} minutes</div>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b' }}>{template.description}</p>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Default Agenda:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {template.defaultAgenda.slice(0, 4).map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: getMeetingTypeColor(template.type) }} />
                          <span style={{ color: '#475569' }}>{item.title}</span>
                          <span style={{ color: '#94a3b8', marginLeft: 'auto' }}>{item.duration}min</span>
                        </div>
                      ))}
                      {template.defaultAgenda.length > 4 && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>+{template.defaultAgenda.length - 4} more items</div>
                      )}
                    </div>
                  </div>

                  <button
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: 8,
                      background: getMeetingTypeColor(template.type),
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isPiOrAdmin) {
                        setSelectedTemplate(template)
                        setShowCreate(true)
                        toast.success(`Using "${template.name}" template`)
                      } else {
                        toast.error('Only PI/Admin can schedule meetings')
                      }
                    }}
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── KNOWLEDGE BASE ─────────────────────────────────────────────────── */}
        {tab === 'knowledge' && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              borderRadius: 20,
              padding: '24px',
              marginBottom: 24,
              color: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 48 }}>📚</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Lab Knowledge Base</h2>
                    <p style={{ margin: '4px 0 0', opacity: 0.9, fontSize: 14 }}>
                      Insights and learnings captured from lab meetings
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    placeholder="Search articles..."
                    value={knowledgeSearch}
                    onChange={(e) => setKnowledgeSearch(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(255,255,255,0.9)',
                      fontSize: 14,
                      width: 250,
                    }}
                  />
                  <select
                    value={knowledgeCategory}
                    onChange={(e) => setKnowledgeCategory(e.target.value)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(255,255,255,0.9)',
                      fontSize: 14,
                    }}
                  >
                    <option value="">All Categories</option>
                    <option value="Protocols">Protocols</option>
                    <option value="Troubleshooting">Troubleshooting</option>
                    <option value="Analysis">Analysis</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
              {knowledgeArticles
                .filter(a =>
                  (!knowledgeSearch || a.title.toLowerCase().includes(knowledgeSearch.toLowerCase()) || a.tags.some(t => t.toLowerCase().includes(knowledgeSearch.toLowerCase()))) &&
                  (!knowledgeCategory || a.category === knowledgeCategory)
                )
                .map(article => (
                <div
                  key={article.id}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: article.category === 'Protocols' ? '#dcfce7' : article.category === 'Troubleshooting' ? '#fee2e2' : '#dbeafe',
                      color: article.category === 'Protocols' ? '#166534' : article.category === 'Troubleshooting' ? '#dc2626' : '#1e40af',
                    }}>{article.category}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{article.views} views</span>
                  </div>

                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{article.title}</h3>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{article.content.slice(0, 100)}...</p>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {article.tags.map(tag => (
                      <span key={tag} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, background: '#f1f5f9', color: '#64748b' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#94a3b8' }}>
                    <span>From: {article.createdBy}</span>
                    <span>{new Date(article.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── POLLS ─────────────────────────────────────────────────────────── */}
        {tab === 'polls' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Lab Polls & Surveys</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Gather feedback and make group decisions</p>
              </div>
              {isPiOrAdmin && (
                <button
                  onClick={() => setShowCreatePoll(true)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  + Create Poll
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
              {polls.map(poll => {
                const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0)
                return (
                  <div
                    key={poll.id}
                    style={{
                      background: '#fff',
                      borderRadius: 16,
                      padding: '24px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      border: poll.status === 'active' ? '2px solid #22c55e' : '2px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>{poll.question}</h3>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: poll.status === 'active' ? '#dcfce7' : '#f1f5f9',
                        color: poll.status === 'active' ? '#166534' : '#64748b',
                      }}>{poll.status === 'active' ? '🟢 Active' : 'Closed'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {poll.options.map(option => {
                        const percent = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
                        return (
                          <div key={option.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <span style={{ fontSize: 14, color: '#475569' }}>{option.text}</span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>{option.votes} ({percent.toFixed(0)}%)</span>
                            </div>
                            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${percent}%`, background: '#6366f1', borderRadius: 4, transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {poll.status === 'active' && (
                      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => {
                            // Simulate voting
                            const randomOption = poll.options[Math.floor(Math.random() * poll.options.length)]
                            setPolls(polls.map(p => p.id === poll.id ? {
                              ...p,
                              options: p.options.map(o => o.id === randomOption.id ? { ...o, votes: o.votes + 1 } : o)
                            } : p))
                            toast.success('Vote recorded!')
                          }}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            background: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                          }}
                        >
                          🗳️ Cast Vote
                        </button>
                        {isPiOrAdmin && (
                          <button
                            onClick={() => setPolls(polls.map(p => p.id === poll.id ? { ...p, status: 'closed' } : p))}
                            style={{
                              padding: '10px 16px',
                              borderRadius: 8,
                              background: '#f1f5f9',
                              color: '#64748b',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            Close Poll
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
                      Created by {poll.createdBy} • {totalVotes} total votes
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Create Poll Modal */}
            {showCreatePoll && (
              <>
                <div onClick={() => setShowCreatePoll(false)} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 300 }} />
                <div style={{
                  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  background: '#fff', borderRadius: 16, padding: 24, width: 'min(500px, 90vw)', zIndex: 301,
                  boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
                }}>
                  <h3 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700 }}>Create New Poll</h3>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Question</label>
                    <input
                      value={newPollQuestion}
                      onChange={(e) => setNewPollQuestion(e.target.value)}
                      placeholder="What would you like to ask?"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14 }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Options</label>
                    {newPollOptions.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <input
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...newPollOptions]
                            newOpts[i] = e.target.value
                            setNewPollOptions(newOpts)
                          }}
                          placeholder={`Option ${i + 1}`}
                          style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14 }}
                        />
                        {newPollOptions.length > 2 && (
                          <button
                            onClick={() => setNewPollOptions(newPollOptions.filter((_, idx) => idx !== i))}
                            style={{ padding: '10px', borderRadius: 8, background: '#fee2e2', border: 'none', cursor: 'pointer' }}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setNewPollOptions([...newPollOptions, ''])}
                      style={{ padding: '8px 16px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 13 }}
                    >
                      + Add Option
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowCreatePoll(false)}
                      style={{ padding: '10px 20px', borderRadius: 8, background: '#f1f5f9', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (newPollQuestion && newPollOptions.filter(o => o.trim()).length >= 2) {
                          setPolls([...polls, {
                            id: Date.now().toString(),
                            question: newPollQuestion,
                            options: newPollOptions.filter(o => o.trim()).map((text, i) => ({ id: `opt-${i}`, text, votes: 0 })),
                            createdBy: currentUserName,
                            status: 'active',
                          }])
                          setShowCreatePoll(false)
                          setNewPollQuestion('')
                          setNewPollOptions(['', ''])
                          toast.success('Poll created!')
                        } else {
                          toast.error('Please enter a question and at least 2 options')
                        }
                      }}
                      style={{ padding: '10px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
                    >
                      Create Poll
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {sm && (
        <MeetingDetailDrawer
          meeting={sm} onClose={() => store.setSelectedMeeting(null)}
          isPiOrAdmin={isPiOrAdmin} isManagerOrAbove={isManagerOrAbove}
          currentUserName={currentUserName} currentUserRole={currentUserRole}
          onApproveAgenda={(id) => store.approveAgendaItem(sm.id, id)}
          onRejectAgenda={(id, reason) => store.rejectAgendaItem(sm.id, id, reason)}
          onReorderAgenda={(from, to) => store.reorderAgenda(sm.id, from, to)}
          onAddAgendaItem={(item) => store.addAgendaItem(sm.id, item)}
          onMarkAttendance={(userId, status) => store.markAttendance(sm.id, userId, status)}
          onSaveMinutes={(text) => store.saveMinutes(sm.id, text)}
          onPublishMinutes={() => store.publishMinutes(sm.id)}
          onUpdateActionStatus={store.updateActionItemStatus}
          onDeleteAction={store.deleteActionItem}
          meetingActionItems={meetingActionItems}
          onSubmitProgressReport={(r) => store.submitProgressReport(sm.id, r)}
          onAcknowledgeReport={(reportId, comment) => store.acknowledgeProgressReport(sm.id, reportId, comment)}
          onEdit={() => handleEditMeeting(sm)}
          onDelete={() => handleDeleteMeeting(sm)}
          onCancel={() => store.cancelMeeting(sm.id)}
          onStartVideoCall={() => startVideoCall(sm)}
        />
      )}

      {/* Create/Edit Meeting Modal */}
      {showCreate && isPiOrAdmin && (
        <CreateMeetingModal
          currentUserName={currentUserName}
          editMeeting={editingMeeting}
          onSave={handleSaveMeeting}
          onClose={() => { setShowCreate(false); setEditingMeeting(null) }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <>
          <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, background: '#00000066', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24,
            width: 'min(400px, 90vw)', zIndex: 301, boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
            <h3 style={{ color: '#1e293b', fontSize: 16, fontWeight: 700, margin: '0 0 8px', textAlign: 'center' }}>Delete Meeting?</h3>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
              Are you sure you want to delete "<strong>{confirmDelete.title}</strong>"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, color: '#64748b', padding: '9px 18px', cursor: 'pointer', fontSize: 13 }}>
                Cancel
              </button>
              <button onClick={confirmDeleteMeeting} style={{ background: '#dc2626', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                Delete Meeting
              </button>
            </div>
          </div>
        </>
      )}

      {/* Video Call Room */}
      {activeVideoCall && (
        <VideoCallRoom
          roomId={activeVideoCall.roomId}
          meetingId={activeVideoCall.meetingId}
          meetingTitle={activeVideoCall.meetingTitle}
          userName={currentUserName}
          userId={user?.id || 0}
          onLeave={leaveVideoCall}
        />
      )}
    </div>
  )
}
