import { useState, useEffect, useCallback } from 'react';
import { usersAdminApi, auditApi } from '../lib/api';

// Types
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive';
  joinDate: string;
  lastActive: string;
}

interface AuditLog {
  id: number;
  user: string;
  action: string;
  target: string;
  targetType: string;
  timestamp: string;
  details?: string;
}

interface LabFile {
  id: number;
  name: string;
  type: string;
  size: string;
  uploadedBy: string;
  uploadDate: string;
  category: string;
}

interface Integration {
  id: number;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  lastSync?: string;
  config?: Record<string, string>;
}

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface SystemSetting {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'select';
  options?: string[];
}

// Constants
const ROLES = ['Admin', 'Manager', 'Staff', 'Trainee', 'Guest'];
const DEPARTMENTS = ['Research', 'Lab Operations', 'Quality Control', 'IT', 'Administration', 'Other'];
const FILE_CATEGORIES = ['Manual', 'Protocol', 'Report', 'Form', 'Policy', 'Training', 'Other'];

export default function AdminHubPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'files' | 'audit' | 'integrations' | 'settings'>('users');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFilter, setUserFilter] = useState({ role: '', status: '' });
  const [newUser, setNewUser] = useState({
    name: '', email: '', role: 'Staff', department: 'Research'
  });

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Files state
  const [files, setFiles] = useState<LabFile[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const [newFile, setNewFile] = useState({ name: '', type: 'PDF', category: 'Manual' });

  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: 1, name: 'Slack', description: 'Team communication', icon: '💬', connected: false },
    { id: 2, name: 'Google Calendar', description: 'Schedule sync', icon: '📅', connected: false },
    { id: 3, name: 'Dropbox', description: 'File storage', icon: '📦', connected: false },
    { id: 4, name: 'Zapier', description: 'Workflow automation', icon: '⚡', connected: false },
    { id: 5, name: 'Microsoft Teams', description: 'Team collaboration', icon: '👥', connected: false },
    { id: 6, name: 'GitHub', description: 'Code repository', icon: '🐙', connected: false },
  ]);

  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([
    { id: 'email', label: 'Email notifications', description: 'Receive important updates via email', enabled: true },
    { id: 'lowstock', label: 'Low stock alerts', description: 'Get notified when inventory is low', enabled: true },
    { id: 'maintenance', label: 'Maintenance reminders', description: 'Equipment maintenance notifications', enabled: true },
    { id: 'training', label: 'Training deadlines', description: 'Reminders for upcoming training', enabled: false },
    { id: 'incidents', label: 'Incident alerts', description: 'Immediate notification for safety incidents', enabled: true },
    { id: 'compliance', label: 'Compliance updates', description: 'Audit and compliance reminders', enabled: true },
  ]);

  // System settings state
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([
    { id: 'labName', label: 'Lab Name', value: 'Cancer Research Laboratory', type: 'text' },
    { id: 'timezone', label: 'Time Zone', value: 'America/New_York', type: 'select', options: ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Asia/Tokyo'] },
    { id: 'dateFormat', label: 'Date Format', value: 'MM/DD/YYYY', type: 'select', options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] },
    { id: 'language', label: 'Default Language', value: 'English', type: 'select', options: ['English', 'Spanish', 'French', 'German', 'Chinese'] },
    { id: 'sessionTimeout', label: 'Session Timeout (minutes)', value: '30', type: 'select', options: ['15', '30', '60', '120', 'Never'] },
  ]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await usersAdminApi.list(1, 100, '');
      const items = (res.data as any).items || [];
      setUsers(items.map((u: any) => ({
        id: u.id, name: u.full_name, email: u.email,
        role: u.role?.charAt(0).toUpperCase() + u.role?.slice(1) || 'Staff',
        department: u.department || 'Research',
        status: u.is_active ? 'active' : 'inactive',
        joinDate: u.created_at?.slice(0, 10) || '',
        lastActive: u.last_login?.slice(0, 10) || 'Never',
      })));
    } catch { /* no-op */ }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await auditApi.list(1, 50, '');
      const items = (res.data as any).items || [];
      setAuditLogs(items.map((l: any) => ({
        id: l.id, user: l.user_email, action: l.action,
        target: `${l.entity_type} #${l.entity_id}`, targetType: l.entity_type,
        timestamp: l.timestamp, details: l.changes_json,
      })));
    } catch { /* no-op */ }
  }, []);

  useEffect(() => { fetchUsers(); fetchAuditLogs(); }, [fetchUsers, fetchAuditLogs]);

  // Add audit log
  const addAuditLog = (action: string, target: string, targetType: string, details?: string) => {
    const log: AuditLog = {
      id: Date.now(),
      user: 'Current User',
      action,
      target,
      targetType,
      timestamp: new Date().toLocaleString(),
      details
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // User handlers
  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) { showToast('Please fill required fields', 'error'); return; }
    try {
      await usersAdminApi.create({ full_name: newUser.name, email: newUser.email, role: newUser.role.toLowerCase(), password: 'LabOS2024!', is_active: true });
      await fetchUsers();
      addAuditLog('created user', newUser.name, 'user', `Role: ${newUser.role}`);
      setNewUser({ name: '', email: '', role: 'Staff', department: 'Research' });
      setShowUserModal(false);
      showToast('User added!');
    } catch (e: any) { showToast(e?.response?.data?.detail || 'Failed to create user', 'error'); }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await usersAdminApi.update(editingUser.id, { full_name: editingUser.name, email: editingUser.email, role: editingUser.role.toLowerCase() });
      await fetchUsers();
      addAuditLog('updated user', editingUser.name, 'user');
      setEditingUser(null);
      showToast('User updated!');
    } catch { showToast('Failed to update user', 'error'); }
  };

  const handleDeleteUser = async (user: User) => {
    try {
      await usersAdminApi.delete(user.id);
      await fetchUsers();
      addAuditLog('deleted user', user.name, 'user');
      showToast('User deleted');
    } catch { showToast('Failed to delete user', 'error'); }
  };

  const handleToggleUserStatus = async (user: User) => {
    const isActive = user.status !== 'active';
    try {
      await usersAdminApi.update(user.id, { is_active: isActive });
      await fetchUsers();
      addAuditLog(`${isActive ? 'activated' : 'deactivated'} user`, user.name, 'user');
      showToast(`User ${isActive ? 'activated' : 'deactivated'}`);
    } catch { showToast('Failed to update status', 'error'); }
  };

  // File handlers
  const handleCreateFile = () => {
    if (!newFile.name) {
      showToast('Please enter file name', 'error');
      return;
    }
    const file: LabFile = {
      id: Date.now(),
      name: newFile.name,
      type: newFile.type,
      size: `${(Math.random() * 5 + 0.5).toFixed(1)} MB`,
      uploadedBy: 'Current User',
      uploadDate: new Date().toISOString().slice(0, 10),
      category: newFile.category
    };
    setFiles(prev => [...prev, file]);
    addAuditLog('uploaded file', file.name, 'file');
    setNewFile({ name: '', type: 'PDF', category: 'Manual' });
    setShowFileModal(false);
    showToast('File uploaded!');
  };

  const handleDeleteFile = (file: LabFile) => {
    setFiles(prev => prev.filter(f => f.id !== file.id));
    addAuditLog('deleted file', file.name, 'file');
    showToast('File deleted');
  };

  const handleDownloadFile = (file: LabFile) => {
    addAuditLog('downloaded file', file.name, 'file');
    showToast('Download started');
  };

  // Integration handlers
  const handleToggleIntegration = (integration: Integration) => {
    setIntegrations(prev => prev.map(i => i.id === integration.id ? {
      ...i,
      connected: !i.connected,
      lastSync: !i.connected ? new Date().toLocaleString() : undefined
    } : i));
    addAuditLog(integration.connected ? 'disconnected' : 'connected', integration.name, 'integration');
    showToast(integration.connected ? 'Disconnected' : 'Connected!');
  };

  // Notification handlers
  const handleToggleNotification = (setting: NotificationSetting) => {
    setNotificationSettings(prev => prev.map(s => s.id === setting.id ? { ...s, enabled: !s.enabled } : s));
    addAuditLog(`${setting.enabled ? 'disabled' : 'enabled'} notification`, setting.label, 'setting');
    showToast(`${setting.label} ${setting.enabled ? 'disabled' : 'enabled'}`);
  };

  // Settings handlers
  const handleUpdateSetting = (settingId: string, value: string) => {
    setSystemSettings(prev => prev.map(s => s.id === settingId ? { ...s, value } : s));
  };

  const handleSaveSettings = () => {
    addAuditLog('updated system settings', 'System Configuration', 'settings');
    showToast('Settings saved!');
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    if (userFilter.role && u.role !== userFilter.role) return false;
    if (userFilter.status && u.status !== userFilter.status) return false;
    return true;
  });

  const roleColors: Record<string, { bg: string; text: string }> = {
    Admin: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    Manager: { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
    Staff: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    Trainee: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    Guest: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
  };

  const tabs = [
    { key: 'users', label: 'Users', icon: '👥', count: users.length },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'files', label: 'Files', icon: '📎', count: files.length },
    { key: 'audit', label: 'Audit Log', icon: '📜', count: auditLogs.length },
    { key: 'integrations', label: 'Integrations', icon: '🔗', count: integrations.filter(i => i.connected).length },
    { key: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 500, maxHeight: '90vh', overflow: 'auto'
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
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Administration</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Manage users, settings, and system configuration</p>
        </div>
        <button onClick={() => setShowHelpModal(true)} className="btn btn-secondary">
          ❓ How to Use
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Users', value: users.length, icon: '👥', color: '#60a5fa' },
          { label: 'Active Users', value: users.filter(u => u.status === 'active').length, icon: '✅', color: '#4ade80' },
          { label: 'Files', value: files.length, icon: '📎', color: '#a855f7' },
          { label: 'Integrations', value: integrations.filter(i => i.connected).length, icon: '🔗', color: '#f472b6' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            style={{
              padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--accent)' : 'var(--surface2)',
                color: activeTab === tab.key ? 'white' : 'var(--text-muted)',
                padding: '2px 8px', borderRadius: 10, fontSize: 11
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          {/* Filters & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <select
                className="form-select"
                value={userFilter.role}
                onChange={e => setUserFilter({ ...userFilter, role: e.target.value })}
                style={{ minWidth: 120 }}
              >
                <option value="">All Roles</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select
                className="form-select"
                value={userFilter.status}
                onChange={e => setUserFilter({ ...userFilter, status: e.target.value })}
                style={{ minWidth: 120 }}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {(userFilter.role || userFilter.status) && (
                <button className="btn btn-secondary" onClick={() => setUserFilter({ role: '', status: '' })}>
                  Clear Filters
                </button>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>+ Add User</button>
          </div>

          {users.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Users Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Add team members to manage access</p>
              <button className="btn btn-primary" onClick={() => setShowUserModal(true)}>+ Add First User</button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No users match current filters</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setUserFilter({ role: '', status: '' })}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Name</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Email</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Role</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Department</th>
                    <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Status</th>
                    <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(user => (
                    <tr key={user.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 18, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 14 }}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{user.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Joined {user.joinDate}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{user.email}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: roleColors[user.role]?.bg, color: roleColors[user.role]?.text }}>{user.role}</span>
                      </td>
                      <td style={{ padding: 12, fontSize: 13, color: 'var(--text-muted)' }}>{user.department}</td>
                      <td style={{ padding: 12 }}>
                        <button
                          onClick={() => handleToggleUserStatus(user)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <span style={{ color: user.status === 'active' ? '#4ade80' : '#9ca3af' }}>●</span>
                          <span style={{ fontSize: 13 }}>{user.status}</span>
                        </button>
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingUser(user)}>✏️ Edit</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteUser(user)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Notification Settings</h3>
          {notificationSettings.map(setting => (
            <div key={setting.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500, marginBottom: 2 }}>{setting.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{setting.description}</div>
              </div>
              <button
                onClick={() => handleToggleNotification(setting)}
                style={{
                  width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                  background: setting.enabled ? 'var(--accent)' : 'var(--surface2)',
                  position: 'relative', transition: 'background 0.2s'
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 11, background: 'white',
                  position: 'absolute', top: 2, left: setting.enabled ? 24 : 2,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowFileModal(true)}>+ Upload File</button>
          </div>

          {files.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📎</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Files Uploaded</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Upload lab manuals, protocols, and documents</p>
              <button className="btn btn-primary" onClick={() => setShowFileModal(true)}>+ Upload First File</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {files.map(file => (
                <div key={file.id} className="card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>
                    {file.type === 'PDF' ? '📕' : file.type === 'DOC' ? '📘' : file.type === 'XLS' ? '📗' : file.type === 'PPT' ? '📙' : '📄'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, wordBreak: 'break-word' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{file.size} • {file.type}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                    <span style={{ padding: '2px 6px', background: 'var(--surface2)', borderRadius: 4 }}>{file.category}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => handleDownloadFile(file)}>⬇️ Download</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteFile(file)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div>
          {auditLogs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📜</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Audit Logs</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Actions will be logged here automatically</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {auditLogs.map(log => (
                <div key={log.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {log.targetType === 'user' ? '👤' : log.targetType === 'file' ? '📄' : log.targetType === 'integration' ? '🔗' : log.targetType === 'setting' ? '⚙️' : '📜'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>
                      <strong>{log.user}</strong> {log.action} <span style={{ color: 'var(--accent)' }}>{log.target}</span>
                      <span style={{ padding: '2px 6px', marginLeft: 8, borderRadius: 4, fontSize: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{log.targetType}</span>
                    </div>
                    {log.details && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.details}</div>}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {integrations.map(integration => (
            <div key={integration.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{integration.icon}</span>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{integration.name}</h3>
                    <span style={{ fontSize: 11, color: integration.connected ? '#4ade80' : 'var(--text-muted)' }}>
                      {integration.connected ? '● Connected' : '○ Not connected'}
                    </span>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{integration.description}</p>
              {integration.connected && integration.lastSync && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Last sync: {integration.lastSync}
                </div>
              )}
              <button
                className={`btn btn-sm ${integration.connected ? 'btn-secondary' : 'btn-primary'}`}
                style={{ width: '100%' }}
                onClick={() => handleToggleIntegration(integration)}
              >
                {integration.connected ? '🔌 Disconnect' : '🔗 Connect'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>System Settings</h3>
          {systemSettings.map(setting => (
            <div key={setting.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 500 }}>{setting.label}</div>
              {setting.type === 'text' ? (
                <input
                  type="text"
                  className="form-input"
                  style={{ width: 250 }}
                  value={setting.value}
                  onChange={e => handleUpdateSetting(setting.id, e.target.value)}
                />
              ) : (
                <select
                  className="form-select"
                  style={{ width: 250 }}
                  value={setting.value}
                  onChange={e => handleUpdateSetting(setting.id, e.target.value)}
                >
                  {setting.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
            </div>
          ))}
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={handleSaveSettings}>
            Save Settings
          </button>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {(showUserModal || editingUser) && (
        <div style={modalStyle} onClick={() => { setShowUserModal(false); setEditingUser(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingUser ? 'Edit User' : 'Add User'}</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input type="text" className="form-input" placeholder="John Doe"
                  value={editingUser ? editingUser.name : newUser.name}
                  onChange={e => editingUser ? setEditingUser({ ...editingUser, name: e.target.value }) : setNewUser({ ...newUser, name: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email *</label>
                <input type="email" className="form-input" placeholder="john@lab.edu"
                  value={editingUser ? editingUser.email : newUser.email}
                  onChange={e => editingUser ? setEditingUser({ ...editingUser, email: e.target.value }) : setNewUser({ ...newUser, email: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Role</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingUser ? editingUser.role : newUser.role}
                    onChange={e => editingUser ? setEditingUser({ ...editingUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Department</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingUser ? editingUser.department : newUser.department}
                    onChange={e => editingUser ? setEditingUser({ ...editingUser, department: e.target.value }) : setNewUser({ ...newUser, department: e.target.value })}>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              {editingUser && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingUser.status}
                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value as User['status'] })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowUserModal(false); setEditingUser(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingUser ? handleUpdateUser : handleCreateUser} style={{ flex: 1 }}>
                {editingUser ? 'Save Changes' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showFileModal && (
        <div style={modalStyle} onClick={() => setShowFileModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Upload File</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>File Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Lab Manual 2024"
                  value={newFile.name}
                  onChange={e => setNewFile({ ...newFile, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>File Type</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newFile.type}
                    onChange={e => setNewFile({ ...newFile, type: e.target.value })}>
                    <option value="PDF">PDF</option>
                    <option value="DOC">Word Document</option>
                    <option value="XLS">Excel Spreadsheet</option>
                    <option value="PPT">PowerPoint</option>
                    <option value="IMG">Image</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newFile.category}
                    onChange={e => setNewFile({ ...newFile, category: e.target.value })}>
                    {FILE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Drag & drop files here or click to browse</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Supported: PDF, DOC, XLS, PPT, Images</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowFileModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFile} style={{ flex: 1 }}>Upload File</button>
            </div>
          </div>
        </div>
      )}

      {/* How to Use Modal */}
      {showHelpModal && (
        <div style={modalStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>How to Use Administration</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>👥 Users</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Add team members with roles (Admin, Manager, Staff, Trainee)</li>
                  <li>Toggle user status between Active and Inactive</li>
                  <li>Filter users by role or status</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🔔 Notifications</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Toggle notification types on/off</li>
                  <li>Control email, stock, maintenance, and incident alerts</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>📎 Files</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Upload lab manuals, protocols, and documents</li>
                  <li>Categorize files for easy organization</li>
                  <li>Download or delete files as needed</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>📜 Audit Log</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>View all system actions automatically logged</li>
                  <li>Track who did what and when</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🔗 Integrations</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Connect external services (Slack, Calendar, etc.)</li>
                  <li>Click Connect/Disconnect to toggle</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ Settings</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Configure lab name, timezone, and date format</li>
                  <li>Click "Save Settings" to apply changes</li>
                </ul>
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowHelpModal(false)} style={{ marginTop: 20, width: '100%' }}>Got it!</button>
          </div>
        </div>
      )}
    </div>
  );
}
