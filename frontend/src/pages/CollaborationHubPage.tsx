import { useState, useEffect, useCallback } from 'react';
import { workspacesApi, meetingsApi, feedbackApi } from '../lib/api';

// Types
interface Workspace {
  id: number;
  name: string;
  description: string;
  members: string[];
  projects: number;
  color: string;
  createdAt: string;
  status: 'active' | 'archived';
}

interface Meeting {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: string;
  location: string;
  attendees: string[];
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  recurring: boolean;
}

interface Feedback {
  id: number;
  type: 'suggestion' | 'issue' | 'praise' | 'question';
  title: string;
  message: string;
  author: string;
  date: string;
  status: 'pending' | 'reviewed' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  response?: string;
}

interface Activity {
  id: number;
  user: string;
  action: string;
  target: string;
  targetType: string;
  timestamp: string;
  details?: string;
}

// Constants
const WORKSPACE_COLORS = [
  '#60a5fa', '#a855f7', '#4ade80', '#f472b6', '#facc15', '#fb923c', '#38bdf8', '#f87171'
];

const MEETING_LOCATIONS = [
  'Conference Room A', 'Conference Room B', 'Lab Meeting Room', 'Virtual (Zoom)',
  'Virtual (Teams)', 'Seminar Hall', 'Office', 'Other'
];

const DURATION_OPTIONS = [
  '15 min', '30 min', '45 min', '1 hour', '1.5 hours', '2 hours', '3 hours', 'All day'
];

const FEEDBACK_TYPES = [
  { id: 'suggestion', label: 'Suggestion', icon: '💡', color: '#60a5fa' },
  { id: 'issue', label: 'Issue/Bug', icon: '🐛', color: '#ef4444' },
  { id: 'praise', label: 'Praise', icon: '⭐', color: '#facc15' },
  { id: 'question', label: 'Question', icon: '❓', color: '#a855f7' },
];

export default function CollaborationHubPage() {
  const [activeTab, setActiveTab] = useState<'workspaces' | 'meetings' | 'feedback' | 'activity'>('workspaces');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Workspaces state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '', color: WORKSPACE_COLORS[0] });

  // Meetings state
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [newMeeting, setNewMeeting] = useState({
    title: '', description: '', date: '', time: '', duration: '1 hour', location: '', attendees: '', recurring: false
  });

  // Feedback state
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState<Feedback | null>(null);
  const [newFeedback, setNewFeedback] = useState<{ type: Feedback['type']; title: string; message: string; priority: Feedback['priority'] }>({ type: 'suggestion', title: '', message: '', priority: 'medium' });

  // Activity state
  const [activities, setActivities] = useState<Activity[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, mRes, fRes] = await Promise.allSettled([
        workspacesApi.list(1, 100, ''),
        meetingsApi.list(1, 100, ''),
        feedbackApi.list(1, 100, ''),
      ]);
      if (wRes.status === 'fulfilled') {
        const items = (wRes.value.data as any).items || [];
        setWorkspaces(items.map((w: any) => ({
          id: w.id, name: w.name, description: w.description || '', color: WORKSPACE_COLORS[w.id % WORKSPACE_COLORS.length],
          members: [w.lead_name || 'Unassigned'], projects: 0,
          createdAt: w.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          status: w.status === 'active' ? 'active' : 'archived',
        })));
      }
      if (mRes.status === 'fulfilled') {
        const items = (mRes.value.data as any).items || [];
        setMeetings(items.map((m: any) => ({
          id: m.id, title: m.title, description: m.agenda || '', date: m.scheduled_at?.slice(0, 10) || '',
          time: m.scheduled_at?.slice(11, 16) || '', duration: `${m.duration_minutes || 60} min`,
          location: m.location || '', attendees: [], status: m.status || 'scheduled', recurring: false,
        })));
      }
      if (fRes.status === 'fulfilled') {
        const items = (fRes.value.data as any).items || [];
        setFeedbacks(items.map((f: any) => ({
          id: f.id, type: f.category || 'suggestion', title: f.title, message: f.message,
          author: f.author_name || 'Anonymous', date: f.created_at?.slice(0, 10) || '',
          status: f.status || 'pending', priority: f.priority || 'medium', response: f.response,
        })));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Add activity
  const addActivity = (action: string, target: string, targetType: string, details?: string) => {
    const activity: Activity = {
      id: Date.now(),
      user: 'Current User',
      action,
      target,
      targetType,
      timestamp: new Date().toLocaleString(),
      details
    };
    setActivities(prev => [activity, ...prev]);
  };

  // Workspace handlers
  const handleCreateWorkspace = async () => {
    if (!newWorkspace.name) { showToast('Please enter workspace name', 'error'); return; }
    try {
      await workspacesApi.create({ name: newWorkspace.name, description: newWorkspace.description, field: 'General', milestone: '', status: 'active' });
      await fetchAll();
      addActivity('created', newWorkspace.name, 'workspace');
      setNewWorkspace({ name: '', description: '', color: WORKSPACE_COLORS[0] });
      setShowWorkspaceModal(false);
      showToast('Workspace created!');
    } catch { showToast('Failed to create workspace', 'error'); }
  };

  const handleUpdateWorkspace = async () => {
    if (!editingWorkspace) return;
    try {
      await workspacesApi.update(editingWorkspace.id, { name: editingWorkspace.name, description: editingWorkspace.description, status: editingWorkspace.status });
      await fetchAll();
      addActivity('updated', editingWorkspace.name, 'workspace');
      setEditingWorkspace(null);
      showToast('Workspace updated!', 'success');
    } catch { showToast('Failed to update workspace', 'error'); }
  };

  const handleDeleteWorkspace = (ws: Workspace) => {
    setWorkspaces(prev => prev.filter(w => w.id !== ws.id));
    addActivity('deleted', ws.name, 'workspace');
    showToast('Workspace deleted', 'success');
  };

  // Meeting handlers
  const handleCreateMeeting = async () => {
    if (!newMeeting.title || !newMeeting.date || !newMeeting.time) { showToast('Please fill required fields', 'error'); return; }
    try {
      const scheduledAt = `${newMeeting.date}T${newMeeting.time}:00`;
      const durationMin = parseInt(newMeeting.duration) || 60;
      await meetingsApi.create({ title: newMeeting.title, agenda: newMeeting.description, scheduled_at: scheduledAt, duration_minutes: durationMin, location: newMeeting.location, status: 'scheduled' });
      await fetchAll();
      addActivity('scheduled', newMeeting.title, 'meeting');
      setNewMeeting({ title: '', description: '', date: '', time: '', duration: '1 hour', location: '', attendees: '', recurring: false });
      setShowMeetingModal(false);
      showToast('Meeting scheduled!');
    } catch { showToast('Failed to schedule meeting', 'error'); }
  };

  const handleUpdateMeeting = async () => {
    if (!editingMeeting) return;
    try {
      await meetingsApi.update(editingMeeting.id, { title: editingMeeting.title, agenda: editingMeeting.description, location: editingMeeting.location });
      await fetchAll();
      addActivity('updated', editingMeeting.title, 'meeting');
      setEditingMeeting(null);
      showToast('Meeting updated!');
    } catch { showToast('Failed to update', 'error'); }
  };

  const handleDeleteMeeting = async (meeting: Meeting) => {
    try {
      await meetingsApi.delete(meeting.id);
      await fetchAll();
      addActivity('cancelled', meeting.title, 'meeting');
      showToast('Meeting deleted');
    } catch { showToast('Failed to delete', 'error'); }
  };

  const handleMeetingStatusChange = async (meeting: Meeting, status: Meeting['status']) => {
    try {
      if (status === 'cancelled') await meetingsApi.cancel(meeting.id);
      else if (status === 'completed') await meetingsApi.complete(meeting.id);
      await fetchAll();
      addActivity(`marked as ${status}`, meeting.title, 'meeting');
      showToast(`Meeting ${status}`);
    } catch { showToast('Failed to update status', 'error'); }
  };

  // Feedback handlers
  const handleSubmitFeedback = async () => {
    if (!newFeedback.title || !newFeedback.message) { showToast('Please fill all fields', 'error'); return; }
    try {
      await feedbackApi.create({ title: newFeedback.title, message: newFeedback.message, category: newFeedback.type, priority: newFeedback.priority });
      await fetchAll();
      addActivity('submitted', newFeedback.title, 'feedback');
      setNewFeedback({ type: 'suggestion', title: '', message: '', priority: 'medium' });
      setShowFeedbackModal(false);
      showToast('Feedback submitted!', 'success');
    } catch { showToast('Failed to submit feedback', 'error'); }
  };

  const handleResolveFeedback = (feedback: Feedback, response: string) => {
    setFeedbacks(prev => prev.map(f =>
      f.id === feedback.id ? { ...f, status: 'resolved' as const, response } : f
    ));
    addActivity('resolved', feedback.title, 'feedback');
    setViewingFeedback(null);
    showToast('Feedback resolved!', 'success');
  };

  const handleDeleteFeedback = (feedback: Feedback) => {
    setFeedbacks(prev => prev.filter(f => f.id !== feedback.id));
    showToast('Feedback deleted', 'success');
  };

  const tabs = [
    { key: 'workspaces', label: 'Workspaces', icon: '🏗', count: workspaces.length },
    { key: 'meetings', label: 'Meetings', icon: '🗣', count: meetings.length },
    { key: 'feedback', label: 'Feedback', icon: '💬', count: feedbacks.length },
    { key: 'activity', label: 'Activity', icon: '📈', count: activities.length },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto'
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    scheduled: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    'in-progress': { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
    completed: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    cancelled: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#eab308' },
    reviewed: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
    resolved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    active: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e' },
    archived: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
  };

  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, padding: '12px 20px', borderRadius: 8,
          background: toast.type === 'success' ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
          color: 'white', fontWeight: 500, fontSize: 14, zIndex: 2000
        }}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Collaboration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Team workspaces, meetings, and activity</p>
        </div>
        <button onClick={() => setShowHelpModal(true)} className="btn btn-secondary">
          ❓ How to Use
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Workspaces', value: workspaces.length, icon: '🏗', color: '#60a5fa' },
          { label: 'Meetings', value: meetings.length, icon: '🗣', color: '#a855f7' },
          { label: 'Feedback', value: feedbacks.length, icon: '💬', color: '#4ade80' },
          { label: 'Activities', value: activities.length, icon: '📈', color: '#f472b6' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: -1
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'var(--surface2)',
                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                padding: '2px 8px', borderRadius: 10, fontSize: 11
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Workspaces Tab */}
      {activeTab === 'workspaces' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowWorkspaceModal(true)}>+ New Workspace</button>
          </div>

          {workspaces.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏗</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Workspaces Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Create a workspace to organize your team's projects</p>
              <button className="btn btn-primary" onClick={() => setShowWorkspaceModal(true)}>+ Create First Workspace</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {workspaces.map(ws => (
                <div key={ws.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: ws.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>
                      {ws.name.charAt(0)}
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: statusColors[ws.status]?.bg, color: statusColors[ws.status]?.text }}>
                      {ws.status}
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{ws.name}</h3>
                  {ws.description && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{ws.description}</p>}
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                    {ws.members.length} member{ws.members.length !== 1 ? 's' : ''} • {ws.projects} project{ws.projects !== 1 ? 's' : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => setEditingWorkspace(ws)}>✏️ Edit</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteWorkspace(ws)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meetings Tab */}
      {activeTab === 'meetings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowMeetingModal(true)}>+ Schedule Meeting</button>
          </div>

          {meetings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗣</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Meetings Scheduled</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Schedule a meeting to collaborate with your team</p>
              <button className="btn btn-primary" onClick={() => setShowMeetingModal(true)}>+ Schedule First Meeting</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {meetings.map(m => (
                <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{new Date(m.date).toLocaleDateString('en', { month: 'short' })}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{new Date(m.date).getDate()}</div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 600 }}>{m.title}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[m.status]?.bg, color: statusColors[m.status]?.text }}>
                          {m.status}
                        </span>
                        {m.recurring && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔄 Recurring</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {m.time} • {m.duration} • {m.location || 'No location'}
                      </div>
                      {m.attendees.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          👥 {m.attendees.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {m.status === 'scheduled' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleMeetingStatusChange(m, 'in-progress')}>▶️ Start</button>
                    )}
                    {m.status === 'in-progress' && (
                      <button className="btn btn-sm" style={{ background: '#22c55e', color: 'white', border: 'none' }} onClick={() => handleMeetingStatusChange(m, 'completed')}>✓ End</button>
                    )}
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingMeeting(m)}>✏️ Edit</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteMeeting(m)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowFeedbackModal(true)}>+ Submit Feedback</button>
          </div>

          {feedbacks.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Feedback Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Share your thoughts, suggestions, or report issues</p>
              <button className="btn btn-primary" onClick={() => setShowFeedbackModal(true)}>+ Submit First Feedback</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedbacks.map(f => {
                const typeInfo = FEEDBACK_TYPES.find(t => t.id === f.type);
                return (
                  <div key={f.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: typeInfo?.color || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                        {typeInfo?.icon}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <h4 style={{ fontSize: 15, fontWeight: 600 }}>{f.title}</h4>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[f.status]?.bg, color: statusColors[f.status]?.text }}>
                            {f.status}
                          </span>
                          <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: f.priority === 'high' ? 'rgba(239,68,68,0.15)' : f.priority === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(107,114,128,0.15)', color: f.priority === 'high' ? '#ef4444' : f.priority === 'medium' ? '#eab308' : '#6b7280' }}>
                            {f.priority}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f.message.slice(0, 100)}{f.message.length > 100 ? '...' : ''}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          By {f.author} • {f.date}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setViewingFeedback(f)}>👁️ View</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteFeedback(f)}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div>
          {activities.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Activity Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Activities will appear here as you use the collaboration features</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activities.map(a => (
                <div key={a.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                    {a.user.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>
                      <strong>{a.user}</strong> {a.action} <span style={{ color: 'var(--accent)' }}>{a.target}</span>
                      <span style={{ padding: '2px 6px', marginLeft: 8, borderRadius: 4, fontSize: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{a.targetType}</span>
                    </div>
                    {a.details && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.details}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Workspace Modal */}
      {showWorkspaceModal && (
        <div style={modalStyle} onClick={() => setShowWorkspaceModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Create Workspace</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Workspace Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Research Team A"
                  value={newWorkspace.name} onChange={e => setNewWorkspace({ ...newWorkspace, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" placeholder="What is this workspace for?" rows={3}
                  value={newWorkspace.description} onChange={e => setNewWorkspace({ ...newWorkspace, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Color</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {WORKSPACE_COLORS.map(color => (
                    <button key={color} onClick={() => setNewWorkspace({ ...newWorkspace, color })}
                      style={{ width: 32, height: 32, borderRadius: 8, background: color, border: newWorkspace.color === color ? '3px solid var(--text)' : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowWorkspaceModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateWorkspace} style={{ flex: 1 }}>Create Workspace</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Workspace Modal */}
      {editingWorkspace && (
        <div style={modalStyle} onClick={() => setEditingWorkspace(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Edit Workspace</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Workspace Name</label>
                <input type="text" className="form-input" value={editingWorkspace.name}
                  onChange={e => setEditingWorkspace({ ...editingWorkspace, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" rows={3} value={editingWorkspace.description}
                  onChange={e => setEditingWorkspace({ ...editingWorkspace, description: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                <select className="form-select" value={editingWorkspace.status} onChange={e => setEditingWorkspace({ ...editingWorkspace, status: e.target.value as 'active' | 'archived' })} style={{ width: '100%' }}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Color</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {WORKSPACE_COLORS.map(color => (
                    <button key={color} onClick={() => setEditingWorkspace({ ...editingWorkspace, color })}
                      style={{ width: 32, height: 32, borderRadius: 8, background: color, border: editingWorkspace.color === color ? '3px solid var(--text)' : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setEditingWorkspace(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateWorkspace} style={{ flex: 1 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Meeting Modal */}
      {showMeetingModal && (
        <div style={modalStyle} onClick={() => setShowMeetingModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Schedule Meeting</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Meeting Title *</label>
                <input type="text" className="form-input" placeholder="e.g., Weekly Team Sync"
                  value={newMeeting.title} onChange={e => setNewMeeting({ ...newMeeting, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date *</label>
                  <input type="date" className="form-input" value={newMeeting.date}
                    onChange={e => setNewMeeting({ ...newMeeting, date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Time *</label>
                  <input type="time" className="form-input" value={newMeeting.time}
                    onChange={e => setNewMeeting({ ...newMeeting, time: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Duration</label>
                  <select className="form-select" value={newMeeting.duration} onChange={e => setNewMeeting({ ...newMeeting, duration: e.target.value })} style={{ width: '100%' }}>
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
                  <select className="form-select" value={newMeeting.location} onChange={e => setNewMeeting({ ...newMeeting, location: e.target.value })} style={{ width: '100%' }}>
                    <option value="">Select location...</option>
                    {MEETING_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Attendees (comma-separated)</label>
                <input type="text" className="form-input" placeholder="e.g., John, Sarah, Mike"
                  value={newMeeting.attendees} onChange={e => setNewMeeting({ ...newMeeting, attendees: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" placeholder="Meeting agenda..." rows={2}
                  value={newMeeting.description} onChange={e => setNewMeeting({ ...newMeeting, description: e.target.value })} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={newMeeting.recurring} onChange={e => setNewMeeting({ ...newMeeting, recurring: e.target.checked })} />
                <span style={{ fontSize: 13 }}>Recurring meeting</span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowMeetingModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateMeeting} style={{ flex: 1 }}>Schedule Meeting</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meeting Modal */}
      {editingMeeting && (
        <div style={modalStyle} onClick={() => setEditingMeeting(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Edit Meeting</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Meeting Title</label>
                <input type="text" className="form-input" value={editingMeeting.title}
                  onChange={e => setEditingMeeting({ ...editingMeeting, title: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                  <input type="date" className="form-input" value={editingMeeting.date}
                    onChange={e => setEditingMeeting({ ...editingMeeting, date: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Time</label>
                  <input type="time" className="form-input" value={editingMeeting.time}
                    onChange={e => setEditingMeeting({ ...editingMeeting, time: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                <select className="form-select" value={editingMeeting.status} onChange={e => setEditingMeeting({ ...editingMeeting, status: e.target.value as Meeting['status'] })} style={{ width: '100%' }}>
                  <option value="scheduled">Scheduled</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setEditingMeeting(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateMeeting} style={{ flex: 1 }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Feedback Modal */}
      {showFeedbackModal && (
        <div style={modalStyle} onClick={() => setShowFeedbackModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Submit Feedback</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Feedback Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {FEEDBACK_TYPES.map(type => (
                    <button key={type.id} onClick={() => setNewFeedback({ ...newFeedback, type: type.id as Feedback['type'] })}
                      style={{
                        padding: '12px 8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                        background: newFeedback.type === type.id ? type.color : 'var(--surface2)',
                        color: newFeedback.type === type.id ? 'white' : 'var(--text)',
                        border: 'none', fontSize: 12, fontWeight: 500
                      }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{type.icon}</div>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Title *</label>
                <input type="text" className="form-input" placeholder="Brief summary..."
                  value={newFeedback.title} onChange={e => setNewFeedback({ ...newFeedback, title: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Message *</label>
                <textarea className="form-input" placeholder="Describe in detail..." rows={4}
                  value={newFeedback.message} onChange={e => setNewFeedback({ ...newFeedback, message: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Priority</label>
                <select className="form-select" value={newFeedback.priority} onChange={e => setNewFeedback({ ...newFeedback, priority: e.target.value as Feedback['priority'] })} style={{ width: '100%' }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFeedbackModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmitFeedback} style={{ flex: 1 }}>Submit Feedback</button>
            </div>
          </div>
        </div>
      )}

      {/* View Feedback Modal */}
      {viewingFeedback && (
        <div style={modalStyle} onClick={() => setViewingFeedback(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewingFeedback.title}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: statusColors[viewingFeedback.status]?.bg, color: statusColors[viewingFeedback.status]?.text }}>{viewingFeedback.status}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{viewingFeedback.type}</span>
                </div>
              </div>
              <button onClick={() => setViewingFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{viewingFeedback.message}</p>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Submitted by {viewingFeedback.author} on {viewingFeedback.date}
            </div>
            {viewingFeedback.response && (
              <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginBottom: 4 }}>Response:</div>
                <p style={{ fontSize: 14 }}>{viewingFeedback.response}</p>
              </div>
            )}
            {viewingFeedback.status !== 'resolved' && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Add Response & Resolve</label>
                <textarea id="feedback-response" className="form-input" placeholder="Your response..." rows={3} />
                <button className="btn btn-primary" style={{ marginTop: 12, width: '100%' }} onClick={() => {
                  const response = (document.getElementById('feedback-response') as HTMLTextAreaElement).value;
                  if (response) handleResolveFeedback(viewingFeedback, response);
                }}>✓ Mark as Resolved</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* How to Use Modal */}
      {showHelpModal && (
        <div style={modalStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>How to Use Collaboration</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 20 }}>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>🏗 Workspaces</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Create workspaces to organize teams and projects</li>
                  <li>Click <strong>+ New Workspace</strong> to create one</li>
                  <li>Choose a color to identify your workspace</li>
                  <li>Edit or archive workspaces as needed</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>🗣 Meetings</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Schedule meetings with your team</li>
                  <li>Set date, time, duration, and location</li>
                  <li>Add attendees (comma-separated names)</li>
                  <li>Mark meetings as recurring for weekly/daily syncs</li>
                  <li>Start meetings and mark them complete when done</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>💬 Feedback</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>Submit suggestions, report issues, or share praise</li>
                  <li>Choose feedback type: Suggestion, Issue, Praise, or Question</li>
                  <li>Set priority level (Low, Medium, High)</li>
                  <li>View feedback and add responses to resolve</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>📈 Activity</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.8 }}>
                  <li>View all collaboration activities in one place</li>
                  <li>Track who created, updated, or deleted items</li>
                  <li>Activities are logged automatically</li>
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowHelpModal(false)} style={{ marginTop: 24, width: '100%' }}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
