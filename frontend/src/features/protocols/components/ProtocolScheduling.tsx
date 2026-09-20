import React, { useState, useMemo } from 'react'

interface ScheduledRun {
  id: string
  protocolId: string
  protocolName: string
  scheduledDate: string
  scheduledTime: string
  estimatedDuration: number // minutes
  assignedTo: { id: string; name: string; avatar?: string }
  equipment: { id: string; name: string; available: boolean }[]
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval: number
    endDate?: string
  }
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

interface Equipment {
  id: string
  name: string
  location: string
  bookings: { date: string; startTime: string; endTime: string; userId: string }[]
}

interface TeamMember {
  id: string
  name: string
  avatar?: string
  role: string
  availability: { date: string; available: boolean }[]
}

interface Props {
  protocolId?: string
  protocolName?: string
  estimatedDuration?: number
  scheduledRuns: ScheduledRun[]
  equipment: Equipment[]
  teamMembers: TeamMember[]
  onSchedule: (run: Omit<ScheduledRun, 'id' | 'status'>) => void
  onReschedule: (runId: string, newDate: string, newTime: string) => void
  onCancel: (runId: string, reason: string) => void
  onUpdateStatus: (runId: string, status: ScheduledRun['status']) => void
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function getNextDays(count: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    days.push(date.toISOString().split('T')[0])
  }
  return days
}

function isEquipmentAvailable(
  equipment: Equipment,
  date: string,
  startTime: string,
  duration: number
): boolean {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = startMinutes + duration

  return !equipment.bookings.some(booking => {
    if (booking.date !== date) return false
    const bookingStart = timeToMinutes(booking.startTime)
    const bookingEnd = timeToMinutes(booking.endTime)
    return !(endMinutes <= bookingStart || startMinutes >= bookingEnd)
  })
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export default function ProtocolScheduling({
  protocolId,
  protocolName,
  estimatedDuration = 60,
  scheduledRuns,
  equipment,
  teamMembers,
  onSchedule,
  onReschedule,
  onCancel,
  onUpdateStatus,
}: Props) {
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(getNextDays(1)[0])
  const [selectedTime, setSelectedTime] = useState('09:00')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [scheduleNotes, setScheduleNotes] = useState('')
  const [priority, setPriority] = useState<ScheduledRun['priority']>('medium')
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [recurringInterval, setRecurringInterval] = useState(1)
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null)
  const [rescheduleRunId, setRescheduleRunId] = useState<string | null>(null)
  const [newRescheduleDate, setNewRescheduleDate] = useState('')
  const [newRescheduleTime, setNewRescheduleTime] = useState('')

  const calendarDays = getNextDays(14)

  const runsByDate = useMemo(() => {
    const map: Record<string, ScheduledRun[]> = {}
    scheduledRuns.forEach(run => {
      if (!map[run.scheduledDate]) map[run.scheduledDate] = []
      map[run.scheduledDate].push(run)
    })
    return map
  }, [scheduledRuns])

  const availableEquipment = useMemo(() => {
    return equipment.filter(eq =>
      isEquipmentAvailable(eq, selectedDate, selectedTime, estimatedDuration)
    )
  }, [equipment, selectedDate, selectedTime, estimatedDuration])

  const conflicts = useMemo(() => {
    const issues: string[] = []

    // Check equipment conflicts
    selectedEquipment.forEach(eqId => {
      const eq = equipment.find(e => e.id === eqId)
      if (eq && !isEquipmentAvailable(eq, selectedDate, selectedTime, estimatedDuration)) {
        issues.push(`${eq.name} is not available at this time`)
      }
    })

    // Check assignee availability
    if (selectedAssignee) {
      const member = teamMembers.find(m => m.id === selectedAssignee)
      const dayAvailability = member?.availability.find(a => a.date === selectedDate)
      if (dayAvailability && !dayAvailability.available) {
        issues.push(`${member?.name} is not available on this date`)
      }
    }

    // Check for overlapping runs
    const existingRuns = runsByDate[selectedDate] || []
    const startMinutes = timeToMinutes(selectedTime)
    const endMinutes = startMinutes + estimatedDuration
    existingRuns.forEach(run => {
      const runStart = timeToMinutes(run.scheduledTime)
      const runEnd = runStart + run.estimatedDuration
      if (!(endMinutes <= runStart || startMinutes >= runEnd)) {
        issues.push(`Overlaps with "${run.protocolName}" run`)
      }
    })

    return issues
  }, [selectedDate, selectedTime, selectedAssignee, selectedEquipment, equipment, teamMembers, runsByDate, estimatedDuration])

  const handleSchedule = () => {
    if (!selectedAssignee) return

    const assignee = teamMembers.find(m => m.id === selectedAssignee)
    if (!assignee) return

    const selectedEq = equipment.filter(eq => selectedEquipment.includes(eq.id))

    onSchedule({
      protocolId: protocolId || '',
      protocolName: protocolName || 'Untitled Protocol',
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      estimatedDuration,
      assignedTo: { id: assignee.id, name: assignee.name, avatar: assignee.avatar },
      equipment: selectedEq.map(eq => ({
        id: eq.id,
        name: eq.name,
        available: isEquipmentAvailable(eq, selectedDate, selectedTime, estimatedDuration)
      })),
      notes: scheduleNotes || undefined,
      priority,
      recurring: isRecurring ? {
        frequency: recurringFrequency,
        interval: recurringInterval,
        endDate: recurringEndDate || undefined
      } : undefined,
    })

    setShowScheduleModal(false)
    resetForm()
  }

  const resetForm = () => {
    setSelectedDate(getNextDays(1)[0])
    setSelectedTime('09:00')
    setSelectedAssignee('')
    setSelectedEquipment([])
    setScheduleNotes('')
    setPriority('medium')
    setIsRecurring(false)
    setRecurringFrequency('weekly')
    setRecurringInterval(1)
    setRecurringEndDate('')
  }

  const handleCancel = () => {
    if (!cancellingRunId || !cancelReason.trim()) return
    onCancel(cancellingRunId, cancelReason)
    setCancellingRunId(null)
    setCancelReason('')
  }

  const handleReschedule = () => {
    if (!rescheduleRunId || !newRescheduleDate || !newRescheduleTime) return
    onReschedule(rescheduleRunId, newRescheduleDate, newRescheduleTime)
    setRescheduleRunId(null)
    setNewRescheduleDate('')
    setNewRescheduleTime('')
  }

  const priorityColors: Record<ScheduledRun['priority'], string> = {
    low: '#22c55e',
    medium: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444',
  }

  const statusColors: Record<ScheduledRun['status'], { bg: string; text: string }> = {
    scheduled: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    in_progress: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
    completed: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
    cancelled: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: 'var(--text)', fontSize: 16, fontWeight: 600, margin: 0 }}>
            Protocol Scheduling
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Plan and manage protocol execution schedules
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            display: 'flex', background: 'var(--surface)', borderRadius: 6,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <button
              onClick={() => setView('calendar')}
              style={{
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                background: view === 'calendar' ? 'var(--accent)' : 'transparent',
                color: view === 'calendar' ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 500,
              }}
            >
              Calendar
            </button>
            <button
              onClick={() => setView('list')}
              style={{
                padding: '6px 12px', border: 'none', cursor: 'pointer',
                background: view === 'list' ? 'var(--accent)' : 'transparent',
                color: view === 'list' ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 500,
              }}
            >
              List
            </button>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 6,
              color: '#fff', padding: '8px 16px', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>+</span> Schedule Run
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {/* Calendar Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: '1px solid var(--border)',
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                style={{
                  padding: 12, textAlign: 'center',
                  color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          }}>
            {calendarDays.map((date, index) => {
              const dayRuns = runsByDate[date] || []
              const isToday = date === getNextDays(1)[0]
              const dayOfWeek = new Date(date).getDay()

              return (
                <div
                  key={date}
                  style={{
                    minHeight: 120, padding: 8,
                    borderRight: (index + 1) % 7 !== 0 ? '1px solid var(--border)' : 'none',
                    borderBottom: index < 7 ? '1px solid var(--border)' : 'none',
                    background: isToday ? 'var(--accent-light)' : dayOfWeek === 0 || dayOfWeek === 6 ? 'var(--bg)' : 'transparent',
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                    marginBottom: 8,
                  }}>
                    {new Date(date).getDate()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {dayRuns.slice(0, 3).map(run => (
                      <div
                        key={run.id}
                        onClick={() => setRescheduleRunId(run.id)}
                        style={{
                          padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
                          background: statusColors[run.status].bg,
                          borderLeft: `3px solid ${priorityColors[run.priority]}`,
                        }}
                      >
                        <div style={{
                          fontSize: 10, fontWeight: 600,
                          color: statusColors[run.status].text,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {formatTime(run.scheduledTime)}
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--text)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {run.protocolName}
                        </div>
                      </div>
                    ))}
                    {dayRuns.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                        +{dayRuns.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {scheduledRuns.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 60, color: 'var(--text-muted)',
              background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 14 }}>No scheduled runs</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Click "Schedule Run" to plan a protocol execution
              </div>
            </div>
          ) : (
            scheduledRuns
              .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
              .map(run => (
                <div
                  key={run.id}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, padding: 16,
                    borderLeft: `4px solid ${priorityColors[run.priority]}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h4 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: 0 }}>
                          {run.protocolName}
                        </h4>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: statusColors[run.status].bg,
                          color: statusColors[run.status].text,
                          textTransform: 'capitalize',
                        }}>
                          {run.status.replace('_', ' ')}
                        </span>
                        {run.recurring && (
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: 11,
                            background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6',
                          }}>
                            Recurring
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          📅 {formatDate(run.scheduledDate)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          🕐 {formatTime(run.scheduledTime)}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                          ⏱️ {formatDuration(run.estimatedDuration)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {run.assignedTo.avatar ? (
                        <img
                          src={run.assignedTo.avatar}
                          alt={run.assignedTo.name}
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--accent) 0%, #8b5cf6 100%)',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {getInitials(run.assignedTo.name)}
                        </div>
                      )}
                      <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                        {run.assignedTo.name}
                      </span>
                    </div>
                  </div>

                  {run.equipment.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {run.equipment.map(eq => (
                        <span
                          key={eq.id}
                          style={{
                            padding: '4px 10px', borderRadius: 4, fontSize: 11,
                            background: eq.available ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: eq.available ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {eq.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {run.notes && (
                    <div style={{
                      marginTop: 12, padding: 10, background: 'var(--bg)',
                      borderRadius: 6, color: 'var(--text-soft)', fontSize: 13,
                    }}>
                      {run.notes}
                    </div>
                  )}

                  {run.status === 'scheduled' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => onUpdateStatus(run.id, 'in_progress')}
                        style={{
                          background: 'var(--accent)', border: 'none', borderRadius: 4,
                          color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        Start Run
                      </button>
                      <button
                        onClick={() => {
                          setRescheduleRunId(run.id)
                          setNewRescheduleDate(run.scheduledDate)
                          setNewRescheduleTime(run.scheduledTime)
                        }}
                        style={{
                          background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
                          color: 'var(--text)', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => setCancellingRunId(run.id)}
                        style={{
                          background: 'transparent', border: '1px solid #ef4444', borderRadius: 4,
                          color: '#ef4444', padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {run.status === 'in_progress' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={() => onUpdateStatus(run.id, 'completed')}
                        style={{
                          background: '#22c55e', border: 'none', borderRadius: 4,
                          color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}
                      >
                        Mark Complete
                      </button>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* Equipment Availability */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 16,
      }}>
        <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>
          Equipment Availability Today
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {equipment.map(eq => {
            const todayBookings = eq.bookings.filter(b => b.date === getNextDays(1)[0])
            const isAvailable = todayBookings.length === 0

            return (
              <div
                key={eq.id}
                style={{
                  padding: 12, background: 'var(--bg)', borderRadius: 8,
                  border: `1px solid ${isAvailable ? 'var(--border)' : 'rgba(239, 68, 68, 0.3)'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                    {eq.name}
                  </span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isAvailable ? '#22c55e' : '#ef4444',
                  }} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                  {eq.location}
                </div>
                {todayBookings.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-soft)' }}>
                    {todayBookings.map((b, i) => (
                      <div key={i}>
                        {formatTime(b.startTime)} - {formatTime(b.endTime)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <>
          <div
            onClick={() => setShowScheduleModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', zIndex: 201,
          }}>
            <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: '0 0 20px' }}>
              Schedule Protocol Run
            </h3>

            {protocolName && (
              <div style={{
                padding: 12, background: 'var(--bg)', borderRadius: 8, marginBottom: 16,
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>Protocol</div>
                <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{protocolName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  Estimated duration: {formatDuration(estimatedDuration)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Date & Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    min={getNextDays(1)[0]}
                    style={{
                      width: '100%', padding: 10, background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                    Time
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)}
                    style={{
                      width: '100%', padding: 10, background: 'var(--bg)',
                      border: '1px solid var(--border)', borderRadius: 6,
                      color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Assign To
                </label>
                <select
                  value={selectedAssignee}
                  onChange={e => setSelectedAssignee(e.target.value)}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14,
                  }}
                >
                  <option value="">Select team member...</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['low', 'medium', 'high', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      style={{
                        flex: 1, padding: '8px 12px', border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: priority === p ? priorityColors[p] : 'var(--bg)',
                        color: priority === p ? '#fff' : 'var(--text-muted)',
                        fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Equipment Required
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {equipment.map(eq => {
                    const isAvailable = availableEquipment.some(a => a.id === eq.id)
                    const isSelected = selectedEquipment.includes(eq.id)

                    return (
                      <button
                        key={eq.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEquipment(prev => prev.filter(id => id !== eq.id))
                          } else {
                            setSelectedEquipment(prev => [...prev, eq.id])
                          }
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
                          background: isSelected ? 'var(--accent)' : 'var(--bg)',
                          border: `1px solid ${isAvailable ? 'var(--border)' : '#ef4444'}`,
                          color: isSelected ? '#fff' : isAvailable ? 'var(--text)' : '#ef4444',
                          fontSize: 12, opacity: isAvailable ? 1 : 0.6,
                        }}
                      >
                        {eq.name}
                        {!isAvailable && ' (unavailable)'}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Recurring */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isRecurring}
                    onChange={e => setIsRecurring(e.target.checked)}
                  />
                  <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>
                    Make this a recurring schedule
                  </span>
                </label>
                {isRecurring && (
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Every</span>
                    <input
                      type="number"
                      min={1}
                      value={recurringInterval}
                      onChange={e => setRecurringInterval(parseInt(e.target.value) || 1)}
                      style={{
                        width: 60, padding: 6, background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13, textAlign: 'center',
                      }}
                    />
                    <select
                      value={recurringFrequency}
                      onChange={e => setRecurringFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                      style={{
                        padding: 6, background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13,
                      }}
                    >
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                    </select>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>until</span>
                    <input
                      type="date"
                      value={recurringEndDate}
                      onChange={e => setRecurringEndDate(e.target.value)}
                      min={selectedDate}
                      style={{
                        padding: 6, background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        color: 'var(--text)', fontSize: 13,
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  Notes (optional)
                </label>
                <textarea
                  value={scheduleNotes}
                  onChange={e => setScheduleNotes(e.target.value)}
                  placeholder="Add any special instructions or notes..."
                  rows={3}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, resize: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Conflicts Warning */}
              {conflicts.length > 0 && (
                <div style={{
                  padding: 12, background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8,
                }}>
                  <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Scheduling Conflicts
                  </div>
                  {conflicts.map((conflict, i) => (
                    <div key={i} style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>
                      • {conflict}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => { setShowScheduleModal(false); resetForm() }}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', padding: '10px 20px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!selectedAssignee}
                style={{
                  background: selectedAssignee ? 'var(--accent)' : 'var(--surface)', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '10px 20px', cursor: selectedAssignee ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600, opacity: selectedAssignee ? 1 : 0.5,
                }}
              >
                Schedule Run
              </button>
            </div>
          </div>
        </>
      )}

      {/* Cancel Modal */}
      {cancellingRunId && (
        <>
          <div
            onClick={() => { setCancellingRunId(null); setCancelReason('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 400, zIndex: 201,
          }}>
            <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>
              Cancel Scheduled Run
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Please provide a reason for cancelling this run:
            </p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Enter cancellation reason..."
              rows={3}
              style={{
                width: '100%', padding: 10, background: 'var(--bg)',
                border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text)', fontSize: 14, resize: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
              <button
                onClick={() => { setCancellingRunId(null); setCancelReason('') }}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
                style={{
                  background: cancelReason.trim() ? '#ef4444' : 'var(--surface)', border: 'none', borderRadius: 6,
                  color: '#fff', padding: '8px 16px', cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600, opacity: cancelReason.trim() ? 1 : 0.5,
                }}
              >
                Cancel Run
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reschedule Modal */}
      {rescheduleRunId && (
        <>
          <div
            onClick={() => { setRescheduleRunId(null); setNewRescheduleDate(''); setNewRescheduleTime('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', borderRadius: 12, padding: 24,
            width: '90%', maxWidth: 400, zIndex: 201,
          }}>
            <h3 style={{ color: 'var(--text)', fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>
              Reschedule Run
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  New Date
                </label>
                <input
                  type="date"
                  value={newRescheduleDate}
                  onChange={e => setNewRescheduleDate(e.target.value)}
                  min={getNextDays(1)[0]}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text)', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
                  New Time
                </label>
                <input
                  type="time"
                  value={newRescheduleTime}
                  onChange={e => setNewRescheduleTime(e.target.value)}
                  style={{
                    width: '100%', padding: 10, background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <button
                onClick={() => { setRescheduleRunId(null); setNewRescheduleDate(''); setNewRescheduleTime('') }}
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
                  color: 'var(--text)', padding: '8px 16px', cursor: 'pointer', fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={!newRescheduleDate || !newRescheduleTime}
                style={{
                  background: (newRescheduleDate && newRescheduleTime) ? 'var(--accent)' : 'var(--surface)',
                  border: 'none', borderRadius: 6, color: '#fff', padding: '8px 16px',
                  cursor: (newRescheduleDate && newRescheduleTime) ? 'pointer' : 'not-allowed',
                  fontSize: 13, fontWeight: 600, opacity: (newRescheduleDate && newRescheduleTime) ? 1 : 0.5,
                }}
              >
                Reschedule
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
