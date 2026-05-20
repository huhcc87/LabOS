import { useState, useMemo, useEffect, useCallback } from 'react'
import { meetingsApi } from '../../../lib/api'
import type { Meeting, ActionItem, AgendaItem, ProgressReport, MeetingFilters, ActionItemStatus, AttendanceStatus } from '../types/meeting.types'
import { isUpcoming, isPast, filterMeetings } from '../utils/meetingUtils'
import toast from 'react-hot-toast'

const DEFAULT_FILTERS: MeetingFilters = {
  search: '', type: '', status: '', organizer: '', dateFrom: '', dateTo: '',
}

export function useMeetings(currentUserName: string, currentUserRole: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)
  const [filters, setFilters] = useState<MeetingFilters>(DEFAULT_FILTERS)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'actions' | 'progress' | 'analytics' | 'templates' | 'knowledge' | 'polls'>('upcoming')
  const [loading, setLoading] = useState(true)

  // Fetch meetings from API
  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await meetingsApi.list(1, 100)
      const apiMeetings = res.data.items.map((m: any) => ({
        id: String(m.id),
        title: m.title,
        type: m.type,
        scheduledAt: m.scheduled_at,
        endTime: m.end_time,
        location: m.location,
        zoomLink: m.video_link || undefined,
        status: m.status,
        organizer: m.organizer_name || 'Unknown',
        organizerRole: 'pi',
        description: m.description,
        isRecurring: m.is_recurring,
        recurringPattern: m.recurring_pattern || undefined,
        agenda: JSON.parse(m.agenda_json || '[]'),
        attendees: JSON.parse(m.attendees_json || '[]'),
        actionItems: [],
        minutes: m.minutes,
        minutesPublished: m.minutes_published,
        minutesPublishedAt: m.minutes_published_at || undefined,
        progressReports: [],
        tags: m.tags ? m.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        _apiId: m.id, // Store API ID for updates
      }))
      setMeetings(apiMeetings)
    } catch (err) {
      toast.error('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  const upcoming = useMemo(() => meetings.filter(isUpcoming).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()), [meetings])
  const past = useMemo(() => meetings.filter(isPast).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()), [meetings])
  const nextMeeting = upcoming[0] || null

  const filteredUpcoming = useMemo(() => filterMeetings(upcoming, filters.search, filters.type, filters.status), [upcoming, filters])
  const filteredPast = useMemo(() => filterMeetings(past, filters.search, filters.type, filters.status), [past, filters])

  const myActionItems = useMemo(() => actionItems.filter(ai => {
    if (currentUserRole === 'pi' || currentUserRole === 'admin' || currentUserRole === 'superadmin') return true
    return ai.assignedTo === currentUserName || ai.assignedToName === currentUserName
  }), [actionItems, currentUserName, currentUserRole])

  // ── MEETING CRUD ──────────────────────────────────────────────────────────
  async function addMeeting(m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'agenda' | 'attendees' | 'actionItems' | 'progressReports' | 'minutes' | 'minutesPublished'>) {
    try {
      const res = await meetingsApi.create({
        title: m.title,
        type: m.type,
        scheduled_at: m.scheduledAt,
        end_time: m.endTime,
        location: m.location,
        video_link: m.zoomLink || null,
        description: m.description,
        is_recurring: m.isRecurring,
        recurring_pattern: m.recurringPattern || null,
        agenda_json: '[]',
        attendees_json: '[]',
        tags: m.tags?.join(',') || '',
      })
      toast.success('Meeting created')
      await fetchMeetings()
      return res.data
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create meeting')
      throw err
    }
  }

  async function updateMeeting(id: string, patch: Partial<Meeting>) {
    const meeting = meetings.find(m => m.id === id)
    if (!meeting) return

    try {
      const apiId = (meeting as any)._apiId || parseInt(id)
      const apiPatch: any = {}
      if (patch.title) apiPatch.title = patch.title
      if (patch.type) apiPatch.type = patch.type
      if (patch.status) apiPatch.status = patch.status
      if (patch.scheduledAt) apiPatch.scheduled_at = patch.scheduledAt
      if (patch.endTime) apiPatch.end_time = patch.endTime
      if (patch.location) apiPatch.location = patch.location
      if (patch.zoomLink !== undefined) apiPatch.video_link = patch.zoomLink
      if (patch.description) apiPatch.description = patch.description
      if (patch.isRecurring !== undefined) apiPatch.is_recurring = patch.isRecurring
      if (patch.recurringPattern) apiPatch.recurring_pattern = patch.recurringPattern
      if (patch.agenda) apiPatch.agenda_json = JSON.stringify(patch.agenda)
      if (patch.attendees) apiPatch.attendees_json = JSON.stringify(patch.attendees)
      if (patch.minutes !== undefined) apiPatch.minutes = patch.minutes
      if (patch.minutesPublished !== undefined) apiPatch.minutes_published = patch.minutesPublished
      if (patch.tags) apiPatch.tags = patch.tags.join(',')

      await meetingsApi.update(apiId, apiPatch)

      // Update local state
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m))
      if (selectedMeeting?.id === id) setSelectedMeeting(prev => prev ? { ...prev, ...patch } : null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update meeting')
    }
  }

  async function deleteMeeting(id: string) {
    const meeting = meetings.find(m => m.id === id)
    if (!meeting) return

    try {
      const apiId = (meeting as any)._apiId || parseInt(id)
      await meetingsApi.delete(apiId)
      setMeetings(prev => prev.filter(m => m.id !== id))
      if (selectedMeeting?.id === id) setSelectedMeeting(null)
      toast.success('Meeting deleted')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to delete meeting')
    }
  }

  async function cancelMeeting(id: string) {
    const meeting = meetings.find(m => m.id === id)
    if (!meeting) return

    try {
      const apiId = (meeting as any)._apiId || parseInt(id)
      await meetingsApi.cancel(apiId)
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m))
      toast('Meeting cancelled', { icon: '⚠️' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel meeting')
    }
  }

  // ── AGENDA ────────────────────────────────────────────────────────────────
  function addAgendaItem(meetingId: string, item: Omit<AgendaItem, 'id' | 'meetingId' | 'submittedAt'>) {
    const newItem: AgendaItem = {
      ...item, id: `ag-${Date.now()}`, meetingId, submittedAt: new Date().toISOString(),
    }
    const meeting = meetings.find(m => m.id === meetingId)
    if (meeting) {
      const updatedAgenda = [...meeting.agenda, newItem]
      updateMeeting(meetingId, { agenda: updatedAgenda })
    }
    toast.success('Agenda topic submitted')
  }

  function approveAgendaItem(meetingId: string, itemId: string) {
    const meeting = meetings.find(m => m.id === meetingId)
    if (meeting) {
      const updatedAgenda = meeting.agenda.map(a =>
        a.id === itemId ? { ...a, status: 'approved' as const, approvedBy: currentUserName, approvedAt: new Date().toISOString() } : a
      )
      updateMeeting(meetingId, { agenda: updatedAgenda })
    }
    toast.success('Agenda item approved')
  }

  function rejectAgendaItem(meetingId: string, itemId: string, reason?: string) {
    const meeting = meetings.find(m => m.id === meetingId)
    if (meeting) {
      const updatedAgenda = meeting.agenda.map(a =>
        a.id === itemId ? { ...a, status: 'rejected' as const, piNotes: reason } : a
      )
      updateMeeting(meetingId, { agenda: updatedAgenda })
    }
    toast('Agenda item rejected', { icon: '✕' })
  }

  function reorderAgenda(meetingId: string, fromIdx: number, toIdx: number) {
    const meeting = meetings.find(m => m.id === meetingId)
    if (meeting) {
      const arr = [...meeting.agenda]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      const reorderedAgenda = arr.map((a, i) => ({ ...a, order: i + 1 }))
      updateMeeting(meetingId, { agenda: reorderedAgenda })
    }
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  function markAttendance(meetingId: string, userId: string, status: AttendanceStatus) {
    const meeting = meetings.find(m => m.id === meetingId)
    if (meeting) {
      const updatedAttendees = meeting.attendees.map(a => a.userId === userId ? { ...a, status } : a)
      updateMeeting(meetingId, { attendees: updatedAttendees })
    }
  }

  // ── MINUTES ───────────────────────────────────────────────────────────────
  function saveMinutes(meetingId: string, text: string) {
    updateMeeting(meetingId, { minutes: text })
    toast.success('Minutes saved')
  }

  async function publishMinutes(meetingId: string) {
    const meeting = meetings.find(m => m.id === meetingId)
    if (!meeting) return

    try {
      const apiId = (meeting as any)._apiId || parseInt(meetingId)
      await meetingsApi.publishMinutes(apiId)
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, minutesPublished: true, minutesPublishedAt: new Date().toISOString(), status: 'completed' } : m))
      toast.success('Minutes published to all lab members')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to publish minutes')
    }
  }

  // ── ACTION ITEMS ──────────────────────────────────────────────────────────
  function addActionItem(item: Omit<ActionItem, 'id' | 'createdAt'>) {
    const nai: ActionItem = { ...item, id: `ai-${Date.now()}`, createdAt: new Date().toISOString() }
    setActionItems(prev => [...prev, nai])
    toast.success('Action item added')
  }

  function updateActionItemStatus(id: string, status: ActionItemStatus) {
    setActionItems(prev => prev.map(a => a.id === id ? { ...a, status, completedAt: status === 'completed' ? new Date().toISOString() : a.completedAt } : a))
    if (status === 'completed') toast.success('Action item marked complete!')
  }

  function deleteActionItem(id: string) {
    setActionItems(prev => prev.filter(a => a.id !== id))
  }

  // ── PROGRESS REPORTS ─────────────────────────────────────────────────────
  function submitProgressReport(meetingId: string, report: Omit<ProgressReport, 'id' | 'meetingId' | 'submittedAt' | 'status'>) {
    const nr: ProgressReport = { ...report, id: `pr-${Date.now()}`, meetingId, submittedAt: new Date().toISOString(), status: 'submitted' }
    setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, progressReports: [...m.progressReports.filter(p => p.submittedBy !== report.submittedBy), nr] } : m))
    if (selectedMeeting?.id === meetingId) {
      setSelectedMeeting(prev => prev ? { ...prev, progressReports: [...prev.progressReports.filter(p => p.submittedBy !== report.submittedBy), nr] } : null)
    }
    toast.success('Progress report submitted!')
  }

  function acknowledgeProgressReport(meetingId: string, reportId: string, comment: string) {
    setMeetings(prev => prev.map(m => {
      if (m.id !== meetingId) return m
      return { ...m, progressReports: m.progressReports.map(p => p.id === reportId ? { ...p, status: 'acknowledged' as const, piComment: comment } : p) }
    }))
    toast.success('Report acknowledged')
  }

  return {
    meetings, upcoming, past, nextMeeting,
    filteredUpcoming, filteredPast,
    actionItems, myActionItems,
    selectedMeeting, setSelectedMeeting,
    filters, setFilters,
    activeTab, setActiveTab,
    loading,
    // CRUD
    addMeeting, updateMeeting, deleteMeeting, cancelMeeting,
    addAgendaItem, approveAgendaItem, rejectAgendaItem, reorderAgenda,
    markAttendance,
    saveMinutes, publishMinutes,
    addActionItem, updateActionItemStatus, deleteActionItem,
    submitProgressReport, acknowledgeProgressReport,
    refetch: fetchMeetings,
  }
}
