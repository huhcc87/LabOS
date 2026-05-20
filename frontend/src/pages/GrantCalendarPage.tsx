import { useState } from 'react';

interface CalendarEvent {
  id: number;
  title: string;
  type: 'deadline' | 'review' | 'submission' | 'meeting' | 'milestone';
  date: string;
  time?: string;
  grant?: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  reminder: boolean;
}

const INITIAL_EVENTS: CalendarEvent[] = [];

const NIH_DEADLINES = [
  { cycle: 'Cycle I', dates: ['Feb 5', 'Jun 5', 'Oct 5'], types: ['R01', 'R21', 'R03'] },
  { cycle: 'Cycle II', dates: ['Mar 5', 'Jul 5', 'Nov 5'], types: ['R01 (New)', 'P01'] },
  { cycle: 'Cycle III', dates: ['Apr 8', 'Aug 8', 'Dec 8'], types: ['K Awards'] },
];

const EVENT_COLORS: Record<string, { bg: string; border: string }> = {
  deadline: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' },
  review: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6' },
  submission: { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e' },
  meeting: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7' },
  milestone: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' },
};

export default function GrantCalendarPage() {
  const [events] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'list'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr && (filterType === 'all' || e.type === filterType));
  };

  const filteredEvents = events
    .filter(e => filterType === 'all' || e.type === filterType)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const upcomingEvents = filteredEvents.filter(e => new Date(e.date) >= new Date());

  const getDaysUntil = (date: string) => {
    const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Grant Calendar</h1>
          <p className="page-subtitle">Track deadlines, milestones, and important dates</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary">📥 Sync with Google Calendar</button>
          <button className="btn btn-secondary">🔔 Manage Reminders</button>
          <button className="btn btn-primary">+ Add Event</button>
        </div>
      </div>

      {/* Stats */}
      <div className="metrics-grid">
        <div className="metric-card" style={{ borderLeftColor: '#ef4444' }}>
          <span className="metric-label">Upcoming Deadlines</span>
          <div className="metric-value" style={{ color: '#ef4444' }}>
            {upcomingEvents.filter(e => e.type === 'deadline').length}
          </div>
          <div className="metric-sub">Next 90 days</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#f59e0b' }}>
          <span className="metric-label">This Week</span>
          <div className="metric-value" style={{ color: '#f59e0b' }}>
            {upcomingEvents.filter(e => getDaysUntil(e.date) <= 7).length}
          </div>
          <div className="metric-sub">Events coming up</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#a855f7' }}>
          <span className="metric-label">Meetings</span>
          <div className="metric-value" style={{ color: '#a855f7' }}>
            {events.filter(e => e.type === 'meeting').length}
          </div>
          <div className="metric-sub">Scheduled</div>
        </div>
        <div className="metric-card" style={{ borderLeftColor: '#22c55e' }}>
          <span className="metric-label">Milestones</span>
          <div className="metric-value" style={{ color: '#22c55e' }}>
            {events.filter(e => e.type === 'milestone').length}
          </div>
          <div className="metric-sub">Tracked</div>
        </div>
      </div>

      {/* NIH Standard Deadlines Reference */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>📅 NIH Standard Due Dates</h3>
          <a href="https://grants.nih.gov/grants/how-to-apply-application-guide/due-dates-and-submission-policies/due-dates.htm" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
            View All →
          </a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {NIH_DEADLINES.map(cycle => (
            <div key={cycle.cycle} style={{ padding: 12, background: 'var(--surface2)', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{cycle.cycle}</div>
              <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 4 }}>
                {cycle.dates.join(' | ')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cycle.types.join(', ')}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: 24 }}>
        {/* Calendar / List View */}
        <div className="card">
          {/* Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={prevMonth} className="btn btn-sm btn-secondary">←</button>
              <h2 style={{ fontSize: 20, fontWeight: 700, minWidth: 200, textAlign: 'center' }}>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button onClick={nextMonth} className="btn btn-sm btn-secondary">→</button>
              <button onClick={goToToday} className="btn btn-sm btn-secondary">Today</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="view-toggle">
                <button className={`view-toggle-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Month</button>
                <button className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
              </div>
              <select
                className="form-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={{ width: 140 }}
              >
                <option value="all">All Types</option>
                <option value="deadline">Deadlines</option>
                <option value="meeting">Meetings</option>
                <option value="milestone">Milestones</option>
                <option value="review">Reviews</option>
              </select>
            </div>
          </div>

          {view === 'month' ? (
            /* Calendar Grid */
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                {/* Day Headers */}
                {dayNames.map(day => (
                  <div key={day} style={{ padding: 10, background: 'var(--surface2)', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {day}
                  </div>
                ))}
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ padding: 8, background: 'var(--surface)', minHeight: 100 }} />
                ))}
                {/* Calendar Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayEvents = getEventsForDay(day);
                  const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                  return (
                    <div
                      key={day}
                      style={{
                        padding: 8,
                        background: isToday ? 'var(--accent-light)' : 'var(--surface)',
                        minHeight: 100,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        fontSize: 13,
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? 'var(--accent)' : 'var(--text)',
                        marginBottom: 4,
                      }}>
                        {day}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            onClick={() => setSelectedEvent(event)}
                            style={{
                              padding: '2px 4px',
                              borderRadius: 4,
                              fontSize: 10,
                              background: EVENT_COLORS[event.type].bg,
                              borderLeft: `2px solid ${EVENT_COLORS[event.type].border}`,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List View */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {upcomingEvents.map(event => {
                const daysUntil = getDaysUntil(event.date);
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    style={{
                      padding: 16,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      borderLeft: `4px solid ${EVENT_COLORS[event.type].border}`,
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: EVENT_COLORS[event.type].bg,
                          color: EVENT_COLORS[event.type].border,
                          textTransform: 'uppercase',
                        }}>
                          {event.type}
                        </span>
                        {event.grant && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{event.grant}</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{event.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        {event.time && ` at ${event.time}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: daysUntil <= 7 ? '#ef4444' : daysUntil <= 30 ? '#f59e0b' : 'var(--text-soft)',
                      }}>
                        {daysUntil}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar - Upcoming & Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Event Detail */}
          {selectedEvent && (
            <div className="card" style={{ borderTop: `4px solid ${EVENT_COLORS[selectedEvent.type].border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 600,
                  background: EVENT_COLORS[selectedEvent.type].bg,
                  color: EVENT_COLORS[selectedEvent.type].border,
                  textTransform: 'uppercase',
                }}>
                  {selectedEvent.type}
                </span>
                <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{selectedEvent.title}</h3>
              <div style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16 }}>
                <div style={{ marginBottom: 4 }}>📅 {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                {selectedEvent.time && <div style={{ marginBottom: 4 }}>🕐 {selectedEvent.time}</div>}
                {selectedEvent.grant && <div style={{ marginBottom: 4 }}>📋 {selectedEvent.grant}</div>}
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginBottom: 16 }}>{selectedEvent.description}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-primary">✏️ Edit</button>
                <button className="btn btn-sm btn-secondary">🔔 Set Reminder</button>
              </div>
            </div>
          )}

          {/* Urgent Deadlines */}
          <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#ef4444' }}>🔴 Urgent Deadlines</h4>
            {upcomingEvents.filter(e => e.type === 'deadline' && getDaysUntil(e.date) <= 30).length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No urgent deadlines</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingEvents.filter(e => e.type === 'deadline' && getDaysUntil(e.date) <= 30).map(event => (
                  <div key={event.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--text-soft)' }}>{event.title}</span>
                    <span style={{ fontWeight: 600, color: getDaysUntil(event.date) <= 7 ? '#ef4444' : '#f59e0b' }}>
                      {getDaysUntil(event.date)}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Legend</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(EVENT_COLORS).map(([type, colors]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: colors.bg, border: `2px solid ${colors.border}` }} />
                  <span style={{ fontSize: 12, color: 'var(--text-soft)', textTransform: 'capitalize' }}>{type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Add */}
          <div className="card">
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Quick Add</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-sm btn-secondary btn-full">📅 Add Deadline</button>
              <button className="btn btn-sm btn-secondary btn-full">👥 Schedule Meeting</button>
              <button className="btn btn-sm btn-secondary btn-full">🎯 Add Milestone</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
