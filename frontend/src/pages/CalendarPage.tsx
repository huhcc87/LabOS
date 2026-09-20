import { useEffect, useState } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import toast from 'react-hot-toast';
import { schedulingApi, instrumentsApi } from '../lib/api';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { downloadBlob } from '../lib/utils';
import api from '../lib/api';

const localizer = momentLocalizer(moment);

const EVENT_TYPE_OPTIONS = ['general', 'maintenance', 'protocol_deadline', 'training', 'meeting', 'other'];

const EVENT_TITLE_TEMPLATES: Record<string, string[]> = {
  meeting: ['Team Meeting', 'Lab Meeting', 'Project Review', 'Weekly Standup', 'One-on-One', 'Department Meeting', 'Journal Club', 'Progress Report'],
  training: ['Safety Training', 'Equipment Training', 'New Employee Orientation', 'Protocol Training', 'Compliance Training', 'Software Training', 'Emergency Procedures'],
  maintenance: ['Equipment Calibration', 'Scheduled Maintenance', 'Filter Replacement', 'Deep Cleaning', 'System Update', 'Annual Inspection', 'Preventive Maintenance'],
  protocol_deadline: ['Protocol Review Due', 'SOP Update Due', 'Grant Deadline', 'Report Submission', 'Ethics Review Due', 'Compliance Deadline'],
  general: ['Lab Work Session', 'Experiment', 'Data Analysis', 'Sample Processing', 'Results Review', 'Documentation', 'Inventory Check'],
  other: ['External Visit', 'Conference Call', 'Seminar', 'Workshop', 'Lab Cleanup', 'Equipment Delivery'],
};

const LOCATION_OPTIONS = [
  'Main Lab - Room 101', 'Main Lab - Room 102', 'Main Lab - Room 103',
  'Conference Room A', 'Conference Room B', 'Clean Room', 'Cold Room',
  'BSL-2 Lab', 'Cell Culture Room', 'Microscopy Suite', 'NMR Room',
  'Mass Spec Room', 'Office', 'Virtual / Online',
];

const DURATION_PRESETS = [
  { label: '30 min', minutes: 30 }, { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 }, { label: '2 hr', minutes: 120 },
  { label: '3 hr', minutes: 180 }, { label: 'Half day', minutes: 240 },
  { label: 'Full day', minutes: 480 },
];

const REMINDER_OPTIONS = [
  { label: 'None', value: '' },
  { label: '15 min before', value: '15' },
  { label: '30 min before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '2 hours before', value: '120' },
  { label: '1 day before', value: '1440' },
  { label: '2 days before', value: '2880' },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  general: '#22c55e',
  maintenance: '#f59e0b',
  protocol_deadline: '#ef4444',
  training: '#6366f1',
  meeting: '#8b5cf6',
  other: '#94a3b8',
  booking: '#06b6d4',
};

interface CalEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  resource: any;
  color: string;
}

interface LabUser { id: number; full_name: string; email: string; }

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<CalEvent | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [calView, setCalView] = useState<any>(Views.MONTH);
  const [labUsers, setLabUsers] = useState<LabUser[]>([]);

  // ── Feature 6: Filters ───────────────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set([...EVENT_TYPE_OPTIONS, 'booking'])
  );

  // ── Form state ───────────────────────────────────────────────────────────
  const [selectedEventType, setSelectedEventType] = useState('general');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  // Feature 1: recurrence
  const [recurrenceRule, setRecurrenceRule] = useState('none');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');
  // Feature 2: attendees
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);
  // Feature 4: reminder
  const [reminderMinutes, setReminderMinutes] = useState('');

  const getTitleOptions = () => EVENT_TITLE_TEMPLATES[selectedEventType] || EVENT_TITLE_TEMPLATES.general;

  const applyDuration = (minutes: number) => {
    if (startTime) {
      const end = new Date(new Date(startTime).getTime() + minutes * 60000);
      setEndTime(end.toISOString().slice(0, 16));
    }
  };

  const resetForm = (start?: Date, end?: Date) => {
    setSelectedEventType('general');
    setSelectedTitle('');
    setCustomTitle('');
    setSelectedLocation('');
    setCustomLocation('');
    setStartTime(start ? start.toISOString().slice(0, 16) : '');
    setEndTime(end ? end.toISOString().slice(0, 16) : '');
    setDescription('');
    setRecurrenceRule('none');
    setRecurrenceEnd('');
    setSelectedAttendees([]);
    setReminderMinutes('');
  };

  const loadForm = (event: any) => {
    setSelectedEventType(event.event_type || 'general');
    setSelectedTitle('__custom__');
    setCustomTitle(event.title || '');
    setSelectedLocation(LOCATION_OPTIONS.includes(event.location) ? event.location : '__custom__');
    setCustomLocation(LOCATION_OPTIONS.includes(event.location) ? '' : event.location || '');
    setStartTime(event.start_time?.slice(0, 16) || '');
    setEndTime(event.end_time?.slice(0, 16) || '');
    setDescription(event.description || '');
    setRecurrenceRule(event.recurrence_rule || 'none');
    setRecurrenceEnd(event.recurrence_end?.slice(0, 10) || '');
    setSelectedAttendees(
      event.attendee_ids
        ? event.attendee_ids.split(',').map(Number).filter(Boolean)
        : []
    );
    setReminderMinutes(event.reminder_minutes ? String(event.reminder_minutes) : '');
  };

  async function loadAll() {
    setLoading(true);
    try {
      const [calResp, bookResp] = await Promise.all([
        schedulingApi.listCalendar(),
        instrumentsApi.listBookings(1, 500),
      ]);
      const calEvents: CalEvent[] = (calResp.data.items || []).map((e: any) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_time),
        end: new Date(e.end_time),
        resource: { ...e, type: 'calendar' },
        color: EVENT_TYPE_COLORS[e.event_type] || EVENT_TYPE_COLORS.general,
      }));
      const bookingEvents: CalEvent[] = (bookResp.data.items || []).map((b: any) => ({
        id: b.id + 100000,
        title: `${b.purpose} (${b.instrument_name || b.instrument_id})`,
        start: new Date(b.start_time),
        end: new Date(b.end_time),
        resource: { ...b, type: 'booking' },
        color: EVENT_TYPE_COLORS.booking,
      }));
      const all = [...calEvents, ...bookingEvents];
      setAllEvents(all);
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const resp = await api.get('/auth/users?per_page=100');
      setLabUsers(resp.data.items || []);
    } catch {
      // non-admin can't list users — silently skip
    }
  }

  useEffect(() => { loadAll(); loadUsers(); }, []);

  // ── Feature 6: apply filters ─────────────────────────────────────────────
  useEffect(() => {
    setEvents(allEvents.filter(e => {
      const type = e.resource?.type === 'booking' ? 'booking' : e.resource?.event_type;
      return activeFilters.has(type);
    }));
  }, [allEvents, activeFilters]);

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);
  const todayEvents = allEvents.filter(e => e.start >= todayStart && e.start < new Date(todayStart.getTime() + 86400000));
  const weekEvents = allEvents.filter(e => e.start >= todayStart && e.start < weekEnd);
  const bookingsCount = allEvents.filter(e => e.resource?.type === 'booking').length;
  const calCount = allEvents.filter(e => e.resource?.type === 'calendar').length;

  // ── Feature 3: upcoming events (next 7) ─────────────────────────────────
  const upcomingEvents = [...allEvents]
    .filter(e => e.start >= now)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 7);

  // ── Feature 7: conflict detection ────────────────────────────────────────
  function checkConflicts(start: string, end: string, location: string, excludeId?: number): CalEvent[] {
    if (!location) return [];
    const s = new Date(start);
    const e = new Date(end);
    return allEvents.filter(ev => {
      if (ev.id === excludeId) return false;
      if (ev.resource?.type === 'booking') return false;
      const evLoc = ev.resource?.location || '';
      if (evLoc !== location) return false;
      return ev.start < e && ev.end > s;
    });
  }

  function handleSelectSlot({ start, end }: { start: Date; end: Date }) {
    setEditing(null);
    resetForm(start, end);
    setModalOpen(true);
  }

  function handleSelectEvent(event: CalEvent) {
    if (event.resource?.type === 'calendar') {
      setEditing(event.resource);
      loadForm(event.resource);
      setModalOpen(true);
    }
  }

  // ── Feature 5: quick reschedule ──────────────────────────────────────────
  const [rescheduling, setRescheduling] = useState(false);

  async function handleQuickReschedule(newStart: string, newEnd: string) {
    if (!editing) return;
    setRescheduling(true);
    try {
      await schedulingApi.updateCalendarEvent(editing.id, {
        start_time: newStart + ':00',
        end_time: newEnd + ':00',
      });
      setStartTime(newStart);
      setEndTime(newEnd);
      toast.success('Event rescheduled');
      loadAll();
    } catch {
      toast.error('Reschedule failed');
    } finally {
      setRescheduling(false);
    }
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const finalTitle = selectedTitle === '__custom__' ? customTitle : selectedTitle;
    const finalLocation = selectedLocation === '__custom__' ? customLocation : selectedLocation;

    if (!finalTitle || !startTime || !endTime) {
      toast.error('Please fill in all required fields');
      setSaving(false);
      return;
    }

    // ── Feature 7: conflict check ─────────────────────────────────────────
    if (finalLocation) {
      const conflicts = checkConflicts(startTime, endTime, finalLocation, editing?.id);
      if (conflicts.length > 0) {
        const names = conflicts.map(c => c.title).join(', ');
        if (!window.confirm(`Location conflict with: "${names}". Save anyway?`)) {
          setSaving(false);
          return;
        }
      }
    }

    try {
      const payload: any = {
        title: finalTitle,
        event_type: selectedEventType,
        location: finalLocation,
        description,
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        recurrence_rule: recurrenceRule,
        recurrence_end: recurrenceRule !== 'none' && recurrenceEnd ? recurrenceEnd : undefined,
        attendee_ids: selectedAttendees.join(','),
        reminder_minutes: reminderMinutes ? parseInt(reminderMinutes) : undefined,
      };
      editing
        ? await schedulingApi.updateCalendarEvent(editing.id, payload)
        : await schedulingApi.createCalendarEvent(payload);
      toast.success(editing ? 'Event updated' : 'Event created');
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await schedulingApi.deleteCalendarEvent(deleting.id);
      toast.success('Event deleted');
      setDeleting(null);
      loadAll();
    } catch {
      toast.error('Delete failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSeries() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api.delete(`/scheduling/calendar/${deleting.id}/series`);
      toast.success('Entire series deleted');
      setDeleting(null);
      loadAll();
    } catch {
      toast.error('Delete series failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportIcs() {
    try {
      const resp = await schedulingApi.exportIcs();
      downloadBlob(resp.data as Blob, 'labos-calendar.ics');
      toast.success('Calendar exported');
    } catch {
      toast.error('Export failed');
    }
  }

  const eventStyleGetter = (event: CalEvent) => ({
    style: {
      backgroundColor: event.color,
      border: 'none',
      borderRadius: 4,
      color: '#fff',
      fontSize: 12,
      padding: '1px 6px',
      cursor: event.resource?.type === 'calendar' ? 'pointer' : 'default',
    },
  });

  const inp: React.CSSProperties = {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    padding: '8px 10px',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };
  const lbl: React.CSSProperties = {
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 600,
    display: 'block',
    marginBottom: 4,
  };

  const toggleAttendee = (id: number) => {
    setSelectedAttendees(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 800, margin: 0 }}>Calendar</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
              {allEvents.length} total · {todayEvents.length} today · {weekEvents.length} this week
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleExportIcs} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>
              ⬇ Export ICS
            </button>
            <button
              onClick={() => { setEditing(null); resetForm(); setModalOpen(true); }}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              + New Event
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Calendar Events', value: calCount, color: '#22c55e' },
            { label: 'Bookings', value: bookingsCount, color: '#06b6d4' },
            { label: 'Today', value: todayEvents.length, color: 'var(--accent)' },
            { label: 'This Week', value: weekEvents.length, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `4px solid ${s.color}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Feature 6: Filter bar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, marginRight: 4 }}>SHOW:</span>
          {[...EVENT_TYPE_OPTIONS, 'booking'].map(type => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${EVENT_TYPE_COLORS[type]}`,
                background: activeFilters.has(type) ? EVENT_TYPE_COLORS[type] : 'transparent',
                color: activeFilters.has(type) ? '#fff' : EVENT_TYPE_COLORS[type],
                fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {type === 'booking' ? 'Booking' : type.replace('_', ' ')}
            </button>
          ))}
          <button
            onClick={() => setActiveFilters(new Set([...EVENT_TYPE_OPTIONS, 'booking']))}
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Show all
          </button>
        </div>

        {/* Main layout: calendar + sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          {/* Calendar */}
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading calendar…</div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
                defaultView={Views.MONTH}
                view={calView}
                onView={setCalView}
                views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                selectable
                eventPropGetter={eventStyleGetter}
                style={{ height: 620 }}
              />
            </div>
          )}

          {/* Feature 3: Upcoming events sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🗓</span> Upcoming Events
              </div>
              {upcomingEvents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>No upcoming events</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcomingEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => ev.resource?.type === 'calendar' && (setEditing(ev.resource), loadForm(ev.resource), setModalOpen(true))}
                      style={{
                        borderLeft: `3px solid ${ev.color}`,
                        paddingLeft: 10,
                        cursor: ev.resource?.type === 'calendar' ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {moment(ev.start).format('MMM D, h:mm a')}
                      </div>
                      {ev.resource?.location && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {ev.resource.location}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12, marginBottom: 10 }}>LEGEND</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(EVENT_TYPE_COLORS).map(([type, color]) => (
                  <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                    {type === 'booking' ? 'Booking' : type.replace('_', ' ')}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                💡 Click any event to edit or reschedule it.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New/Edit Event Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Event' : 'New Calendar Event'} size="lg">
        <form onSubmit={handleFormSubmit} className="modal-form">
          {/* Event Type */}
          <div className="form-group">
            <label style={lbl}>Event Type *</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={selectedEventType}
              onChange={e => { setSelectedEventType(e.target.value); setSelectedTitle(''); }}>
              {EVENT_TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="form-group">
            <label style={lbl}>Title *</label>
            <select style={{ ...inp, cursor: 'pointer', marginBottom: selectedTitle === '__custom__' ? 8 : 0 }}
              value={selectedTitle} onChange={e => setSelectedTitle(e.target.value)}>
              <option value="">-- Select Title --</option>
              {getTitleOptions().map(t => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Enter Custom Title</option>
            </select>
            {selectedTitle === '__custom__' && (
              <input style={inp} type="text" placeholder="Enter custom event title..." value={customTitle}
                onChange={e => setCustomTitle(e.target.value)} />
            )}
          </div>

          {/* Location */}
          <div className="form-group">
            <label style={lbl}>Location</label>
            <select style={{ ...inp, cursor: 'pointer', marginBottom: selectedLocation === '__custom__' ? 8 : 0 }}
              value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
              <option value="">-- Select Location --</option>
              {LOCATION_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              <option value="__custom__">+ Enter Custom Location</option>
            </select>
            {selectedLocation === '__custom__' && (
              <input style={inp} type="text" placeholder="Enter custom location..." value={customLocation}
                onChange={e => setCustomLocation(e.target.value)} />
            )}
          </div>

          {/* Start time */}
          <div className="form-group">
            <label style={lbl}>Start Date & Time *</label>
            <input type="datetime-local" style={inp} value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>

          {/* Duration presets */}
          <div className="form-group">
            <label style={lbl}>Quick Duration</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {DURATION_PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => applyDuration(p.minutes)}
                  style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* End time */}
          <div className="form-group">
            <label style={lbl}>End Date & Time *</label>
            <input type="datetime-local" style={inp} value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>

          {/* Feature 5: Quick Reschedule (edit only) */}
          {editing && (
            <div className="form-group" style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
              <label style={{ ...lbl, marginBottom: 8 }}>⚡ Quick Reschedule</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: '+1 Day', days: 1 }, { label: '+3 Days', days: 3 },
                  { label: '+1 Week', days: 7 }, { label: '+2 Weeks', days: 14 },
                  { label: '-1 Day', days: -1 }, { label: '-1 Week', days: -7 },
                ].map(opt => (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={rescheduling}
                    onClick={() => {
                      const s = new Date(startTime);
                      const e = new Date(endTime);
                      s.setDate(s.getDate() + opt.days);
                      e.setDate(e.getDate() + opt.days);
                      handleQuickReschedule(s.toISOString().slice(0, 16), e.toISOString().slice(0, 16));
                    }}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feature 1: Recurrence */}
          <div className="form-group">
            <label style={lbl}>Recurrence</label>
            <div style={{ display: 'grid', gridTemplateColumns: recurrenceRule !== 'none' ? '1fr 1fr' : '1fr', gap: 8 }}>
              <select style={{ ...inp, cursor: 'pointer' }} value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {recurrenceRule !== 'none' && (
                <div>
                  <label style={{ ...lbl, marginBottom: 2 }}>End Date</label>
                  <input type="date" style={inp} value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)}
                    placeholder="Repeat until..." />
                </div>
              )}
            </div>
            {recurrenceRule !== 'none' && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>
                ⚠ Recurring events will be created from start date to end date
              </div>
            )}
          </div>

          {/* Feature 2: Attendees */}
          {labUsers.length > 0 && (
            <div className="form-group">
              <label style={lbl}>Attendees</label>
              <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 8px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {labUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={selectedAttendees.includes(u.id)} onChange={() => toggleAttendee(u.id)} />
                    <span style={{ color: 'var(--text)' }}>{u.full_name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{u.email}</span>
                  </label>
                ))}
              </div>
              {selectedAttendees.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {selectedAttendees.length} attendee{selectedAttendees.length !== 1 ? 's' : ''} selected
                </div>
              )}
            </div>
          )}

          {/* Feature 4: Reminder */}
          <div className="form-group">
            <label style={lbl}>Reminder</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={reminderMinutes} onChange={e => setReminderMinutes(e.target.value)}>
              {REMINDER_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div className="form-group">
            <label style={lbl}>Description</label>
            <textarea style={{ ...inp, resize: 'vertical' }} rows={2}
              placeholder="Add notes or details about this event..."
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="form-actions">
            {editing && (
              <>
                <button type="button" className="btn btn-danger" onClick={() => {
                  setDeleting({ id: editing.id, title: editing.title, start: new Date(), end: new Date(), resource: editing, color: '' });
                  setModalOpen(false);
                }}>Delete</button>
                {editing.recurrence_rule && editing.recurrence_rule !== 'none' && (
                  <button type="button" className="btn btn-danger" style={{ opacity: 0.8 }} onClick={() => {
                    setDeleting({ id: editing.id, title: editing.title, start: new Date(), end: new Date(), resource: { ...editing, deleteSeries: true }, color: '' });
                    setModalOpen(false);
                  }}>Delete Series</button>
                )}
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleting?.resource?.deleteSeries ? handleDeleteSeries : handleDelete}
        loading={saving}
        message={
          deleting?.resource?.deleteSeries
            ? `Delete all events in the "${deleting?.title}" series?`
            : `Delete this calendar event: "${deleting?.title}"?`
        }
      />
    </div>
  );
}
