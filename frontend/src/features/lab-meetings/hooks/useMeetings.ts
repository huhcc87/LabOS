import { useState, useMemo, useEffect, useCallback } from 'react'
import { meetingsApi } from '../../../lib/api'
import type { Meeting, MeetingType, ActionItem, AgendaItem, Attendee, ProgressReport, MeetingFilters, ActionItemStatus, AttendanceStatus } from '../types/meeting.types'
import { isUpcoming, isPast, filterMeetings } from '../utils/meetingUtils'
import { errText } from '../../../lib/errors'
import toast from 'react-hot-toast'

const DEFAULT_FILTERS: MeetingFilters = {
  search: '', type: '', status: '', organizer: '', dateFrom: '', dateTo: '',
}

function parseList<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

const iso = (ms: number) => new Date(ms).toISOString()

/** Convex meeting row -> the shape the page uses. */
export function fromDoc(m: any): Meeting {
  const start = Number(m.scheduled_at)
  const end = m.end_time ?? start + (m.duration_minutes ?? 60) * 60000
  const meetingId = String(m.id)
  return {
    id: meetingId,
    title: m.title,
    type: (m.meeting_type || 'weekly') as MeetingType,
    scheduledAt: iso(start),
    endTime: iso(end),
    location: m.location ?? '',
    zoomLink: m.video_link || undefined,
    status: m.status,
    organizer: m.organizer_name || 'Unknown',
    organizerRole: 'pi',
    description: m.description ?? '',
    isRecurring: !!m.is_recurring,
    recurringPattern: m.recurring_pattern || undefined,
    agenda: parseList<AgendaItem>(m.agenda),
    attendees: parseList<Attendee>(m.attendees),
    actionItems: parseList<ActionItem>(m.action_items),
    minutes: m.minutes ?? '',
    minutesPublished: !!m.minutes_published,
    minutesPublishedAt: m.minutes_published_at ? iso(m.minutes_published_at) : undefined,
    progressReports: parseList<ProgressReport>(m.progress_reports),
    tags: m.tags ? String(m.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    createdAt: iso(m.created_at),
    updatedAt: iso(m.updated_at),
  }
}

/** A partial page-shaped meeting -> the fields Convex stores. */
export function toFields(p: Partial<Meeting>): Record<string, unknown> {
  const f: Record<string, unknown> = {}
  if (p.title !== undefined) f.title = p.title
  if (p.type !== undefined) f.meeting_type = p.type
  if (p.status !== undefined) f.status = p.status
  if (p.scheduledAt !== undefined) f.scheduled_at = Date.parse(p.scheduledAt)
  if (p.endTime !== undefined) f.end_time = Date.parse(p.endTime)
  if (p.location !== undefined) f.location = p.location
  if (p.zoomLink !== undefined) f.video_link = p.zoomLink
  if (p.description !== undefined) f.description = p.description
  if (p.isRecurring !== undefined) f.is_recurring = p.isRecurring
  if (p.recurringPattern !== undefined) f.recurring_pattern = p.recurringPattern
  if (p.agenda !== undefined) f.agenda = JSON.stringify(p.agenda)
  if (p.attendees !== undefined) f.attendees = JSON.stringify(p.attendees)
  if (p.actionItems !== undefined) f.action_items = JSON.stringify(p.actionItems)
  if (p.progressReports !== undefined) f.progress_reports = JSON.stringify(p.progressReports)
  if (p.minutes !== undefined) f.minutes = p.minutes
  if (p.minutesPublished !== undefined) f.minutes_published = p.minutesPublished
  if (p.tags !== undefined) f.tags = p.tags.join(',')
  if (f.scheduled_at !== undefined && f.end_time !== undefined) {
    f.duration_minutes = Math.max(1, Math.round(((f.end_time as number) - (f.scheduled_at as number)) / 60000))
  }
  return f
}

export interface NewMeetingExtras {
  attendeeNames?: string[]
  agenda?: Array<{ title: string; duration: number; presenter: string }>
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')

export function useMeetings(currentUserName: string, currentUserRole: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<MeetingFilters>(DEFAULT_FILTERS)
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'actions' | 'progress' | 'analytics' | 'templates' | 'knowledge' | 'polls'>('upcoming')
  const [loading, setLoading] = useState(true)

  // The open meeting is always read from the list, so edits show in the drawer at once.
  const selectedMeeting = useMemo(() => meetings.find(m => m.id === selectedId) ?? null, [meetings, selectedId])
  const setSelectedMeeting = useCallback((m: Meeting | null) => setSelectedId(m ? m.id : null), [])

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await meetingsApi.list(1, 500)
      setMeetings(res.data.items.map(fromDoc))
    } catch (err) {
      toast.error(`Failed to load meetings: ${errText(err)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll so a change by another lab member shows up without a reload.
  useEffect(() => {
    fetchMeetings()
    const t = setInterval(fetchMeetings, 30000)
    return () => clearInterval(t)
  }, [fetchMeetings])

  const upcoming = useMemo(() => meetings.filter(isUpcoming).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()), [meetings])
  const past = useMemo(() => meetings.filter(isPast).sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()), [meetings])
  const nextMeeting = upcoming[0] || null

  const filteredUpcoming = useMemo(() => filterMeetings(upcoming, filters.search, filters.type, filters.status), [upcoming, filters])
  const filteredPast = useMemo(() => filterMeetings(past, filters.search, filters.type, filters.status), [past, filters])

  const actionItems = useMemo(() => meetings.flatMap(m => m.actionItems), [meetings])
  const myActionItems = useMemo(() => actionItems.filter(ai => {
    if (['pi', 'admin', 'superadmin', 'manager'].includes(currentUserRole)) return true
    return ai.assignedTo === currentUserName || ai.assignedToName === currentUserName
  }), [actionItems, currentUserName, currentUserRole])

  // ── MEETING CRUD ──────────────────────────────────────────────────────────
  async function addMeeting(
    m: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'agenda' | 'attendees' | 'actionItems' | 'progressReports' | 'minutes' | 'minutesPublished'>,
    extras: NewMeetingExtras = {},
  ) {
    const now = new Date().toISOString()
    const id = `ag-${Date.now()}`
    const agenda: AgendaItem[] = (extras.agenda ?? []).map((a, i) => ({
      id: `${id}-${i}`, meetingId: '', title: a.title, description: '', presenter: a.presenter, presenterRole: 'pi',
      durationMinutes: a.duration, order: i + 1, status: 'approved', category: 'other',
      submittedBy: currentUserName, submittedByRole: currentUserRole, submittedAt: now,
    }))
    const attendees: Attendee[] = (extras.attendeeNames ?? []).map(name => ({ userId: slug(name), name, role: 'member', status: 'absent' }))
    try {
      await meetingsApi.create({ ...toFields({ ...m, agenda, attendees }), minutes_published: false })
      toast.success('Meeting created')
      await fetchMeetings()
    } catch (err) {
      toast.error(`Failed to create meeting: ${errText(err)}`)
      throw err
    }
  }

  /** Saves the change on the server first, then shows it; a failed save leaves the screen as it was. */
  async function updateMeeting(id: string, patch: Partial<Meeting>, opts: { silent?: boolean } = {}) {
    if (!meetings.some(m => m.id === id)) return
    try {
      await meetingsApi.update(id, toFields(patch))
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m))
    } catch (err) {
      if (!opts.silent) toast.error(`Failed to save: ${errText(err)}`)
      throw err
    }
  }

  async function run(fn: () => Promise<unknown>) {
    try { await fn() } catch { /* updateMeeting already told the user */ }
  }

  async function deleteMeeting(id: string) {
    try {
      await meetingsApi.delete(id)
      setMeetings(prev => prev.filter(m => m.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast.success('Meeting deleted')
    } catch (err) {
      toast.error(`Failed to delete meeting: ${errText(err)}`)
    }
  }

  async function cancelMeeting(id: string) {
    try {
      await meetingsApi.cancel(id)
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m))
      toast('Meeting cancelled', { icon: '⚠️' })
    } catch (err) {
      toast.error(`Failed to cancel meeting: ${errText(err)}`)
    }
  }

  const meetingOf = (id: string) => meetings.find(m => m.id === id)

  // ── AGENDA ────────────────────────────────────────────────────────────────
  function addAgendaItem(meetingId: string, item: Omit<AgendaItem, 'id' | 'meetingId' | 'submittedAt'>) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const newItem: AgendaItem = { ...item, id: `ag-${Date.now()}`, meetingId, submittedAt: new Date().toISOString() }
    run(async () => {
      await updateMeeting(meetingId, { agenda: [...meeting.agenda, newItem] })
      toast.success('Agenda topic submitted')
    })
  }

  function approveAgendaItem(meetingId: string, itemId: string) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const agenda = meeting.agenda.map(a =>
      a.id === itemId ? { ...a, status: 'approved' as const, approvedBy: currentUserName, approvedAt: new Date().toISOString() } : a)
    run(async () => { await updateMeeting(meetingId, { agenda }); toast.success('Agenda item approved') })
  }

  function rejectAgendaItem(meetingId: string, itemId: string, reason?: string) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const agenda = meeting.agenda.map(a => a.id === itemId ? { ...a, status: 'rejected' as const, piNotes: reason } : a)
    run(async () => { await updateMeeting(meetingId, { agenda }); toast('Agenda item rejected', { icon: '✕' }) })
  }

  function reorderAgenda(meetingId: string, fromIdx: number, toIdx: number) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const arr = [...meeting.agenda]
    const [moved] = arr.splice(fromIdx, 1)
    if (!moved) return
    arr.splice(toIdx, 0, moved)
    run(() => updateMeeting(meetingId, { agenda: arr.map((a, i) => ({ ...a, order: i + 1 })) }))
  }

  // ── ATTENDANCE ────────────────────────────────────────────────────────────
  function markAttendance(meetingId: string, userId: string, status: AttendanceStatus) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    run(() => updateMeeting(meetingId, { attendees: meeting.attendees.map(a => a.userId === userId ? { ...a, status } : a) }))
  }

  /** Replaces the attendee list with these names, keeping the status of people already on it. */
  function attendeesFromNames(existing: Attendee[], names: string[]): Attendee[] {
    return names.map(name => existing.find(a => a.name === name) ?? { userId: slug(name), name, role: 'member', status: 'absent' as const })
  }

  // ── MINUTES ───────────────────────────────────────────────────────────────
  function saveMinutes(meetingId: string, text: string) {
    run(async () => { await updateMeeting(meetingId, { minutes: text }); toast.success('Minutes saved') })
  }

  async function publishMinutes(meetingId: string) {
    try {
      await meetingsApi.publishMinutes(meetingId)
      setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, minutesPublished: true, minutesPublishedAt: new Date().toISOString(), status: 'completed' } : m))
      toast.success('Minutes published to all lab members')
    } catch (err) {
      toast.error(`Failed to publish minutes: ${errText(err)}`)
    }
  }

  // ── ACTION ITEMS (stored on their meeting) ───────────────────────────────
  function addActionItem(item: Omit<ActionItem, 'id' | 'createdAt'>) {
    const meeting = meetingOf(item.meetingId)
    if (!meeting) return
    const nai: ActionItem = { ...item, id: `ai-${Date.now()}`, createdAt: new Date().toISOString() }
    run(async () => { await updateMeeting(meeting.id, { actionItems: [...meeting.actionItems, nai] }); toast.success('Action item added') })
  }

  function updateActionItemStatus(id: string, status: ActionItemStatus) {
    const meeting = meetings.find(m => m.actionItems.some(a => a.id === id))
    if (!meeting) return
    const actionItems = meeting.actionItems.map(a => a.id === id ? { ...a, status, completedAt: status === 'completed' ? new Date().toISOString() : a.completedAt } : a)
    run(async () => { await updateMeeting(meeting.id, { actionItems }); if (status === 'completed') toast.success('Action item marked complete!') })
  }

  function deleteActionItem(id: string) {
    const meeting = meetings.find(m => m.actionItems.some(a => a.id === id))
    if (!meeting) return
    run(() => updateMeeting(meeting.id, { actionItems: meeting.actionItems.filter(a => a.id !== id) }))
  }

  // ── PROGRESS REPORTS ─────────────────────────────────────────────────────
  function submitProgressReport(meetingId: string, report: Omit<ProgressReport, 'id' | 'meetingId' | 'submittedAt' | 'status'>) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const nr: ProgressReport = { ...report, id: `pr-${Date.now()}`, meetingId, submittedAt: new Date().toISOString(), status: 'submitted' }
    const progressReports = [...meeting.progressReports.filter(p => p.submittedBy !== report.submittedBy), nr]
    run(async () => { await updateMeeting(meetingId, { progressReports }); toast.success('Progress report submitted!') })
  }

  function acknowledgeProgressReport(meetingId: string, reportId: string, comment: string) {
    const meeting = meetingOf(meetingId)
    if (!meeting) return
    const progressReports = meeting.progressReports.map(p => p.id === reportId ? { ...p, status: 'acknowledged' as const, piComment: comment } : p)
    run(async () => { await updateMeeting(meetingId, { progressReports }); toast.success('Report acknowledged') })
  }

  return {
    meetings, upcoming, past, nextMeeting,
    filteredUpcoming, filteredPast,
    actionItems, myActionItems,
    selectedMeeting, setSelectedMeeting,
    filters, setFilters,
    activeTab, setActiveTab,
    loading,
    addMeeting, updateMeeting, deleteMeeting, cancelMeeting, attendeesFromNames,
    addAgendaItem, approveAgendaItem, rejectAgendaItem, reorderAgenda,
    markAttendance,
    saveMinutes, publishMinutes,
    addActionItem, updateActionItemStatus, deleteActionItem,
    submitProgressReport, acknowledgeProgressReport,
    refetch: fetchMeetings,
  }
}
