export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type MeetingType = 'weekly' | 'journal_club' | 'lab_retreat' | 'one_on_one' | 'progress_report' | 'special'
export type AgendaItemStatus = 'pending_approval' | 'approved' | 'rejected' | 'presented' | 'deferred'
export type AgendaCategory = 'research_update' | 'journal_club' | 'lab_business' | 'training' | 'guest_speaker' | 'other'
export type ActionItemStatus = 'open' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'
export type ActionItemPriority = 'low' | 'medium' | 'high' | 'urgent'
export type AttendanceStatus = 'present' | 'absent' | 'remote' | 'excused'
export type ProgressReportStatus = 'draft' | 'submitted' | 'acknowledged'

export interface AgendaItem {
  id: string
  meetingId: string
  title: string
  description: string
  presenter: string
  presenterRole: string
  durationMinutes: number
  order: number
  status: AgendaItemStatus
  category: AgendaCategory
  slideLink?: string
  notes?: string
  submittedBy: string
  submittedByRole: string
  submittedAt: string
  approvedBy?: string
  approvedAt?: string
  piNotes?: string
}

export interface ActionItem {
  id: string
  meetingId: string
  meetingTitle: string
  title: string
  description: string
  assignedTo: string
  assignedToName: string
  assignedToRole: string
  assignedBy: string
  dueDate: string
  status: ActionItemStatus
  priority: ActionItemPriority
  completedAt?: string
  notes?: string
  createdAt: string
}

export interface Attendee {
  userId: string
  name: string
  role: string
  status: AttendanceStatus
  joinedAt?: string
  leftAt?: string
}

export interface ProgressReport {
  id: string
  meetingId: string
  submittedBy: string
  submitterName: string
  submitterRole: string
  summary: string
  accomplishments: string[]
  challenges: string[]
  nextSteps: string[]
  papersRead?: string[]
  submittedAt: string
  status: ProgressReportStatus
  piComment?: string
}

export interface Meeting {
  id: string
  title: string
  type: MeetingType
  scheduledAt: string
  endTime: string
  location: string
  zoomLink?: string
  status: MeetingStatus
  organizer: string
  organizerRole: string
  description: string
  isRecurring: boolean
  recurringPattern?: 'weekly' | 'biweekly' | 'monthly'
  agenda: AgendaItem[]
  attendees: Attendee[]
  actionItems: ActionItem[]
  minutes: string
  minutesPublished: boolean
  minutesPublishedAt?: string
  progressReports: ProgressReport[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface MeetingFilters {
  search: string
  type: MeetingType | ''
  status: MeetingStatus | ''
  organizer: string
  dateFrom: string
  dateTo: string
}
