import { useState } from 'react';

// Types
interface Equipment {
  id: number;
  name: string;
  model: string;
  serialNumber: string;
  category: string;
  location: string;
  status: 'available' | 'in-use' | 'maintenance' | 'out-of-service';
  purchaseDate: string;
  warrantyExpiry: string;
  lastMaintenance: string;
  nextMaintenance: string;
  calibrationDue: string;
  assignedTo?: string;
  notes: string;
}

interface Maintenance {
  id: number;
  equipmentId: number;
  equipmentName: string;
  type: 'preventive' | 'corrective' | 'calibration';
  description: string;
  scheduledDate: string;
  completedDate?: string;
  technician: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  cost: number;
  notes: string;
}

interface Booking {
  id: number;
  equipmentId: number;
  equipmentName: string;
  user: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  purpose: string;
  status: 'pending' | 'approved' | 'in-use' | 'completed' | 'cancelled';
}

interface UsageLog {
  id: number;
  equipmentId: number;
  equipmentName: string;
  user: string;
  action: string;
  timestamp: string;
  duration?: string;
  notes?: string;
}

// Constants
const CATEGORIES = ['Centrifuge', 'Microscope', 'Spectrometer', 'PCR Machine', 'Incubator', 'Freezer', 'Fridge', 'Balance', 'pH Meter', 'Autoclave', 'Fume Hood', 'Other'];
const LOCATIONS = ['Lab 101', 'Lab 102', 'Lab 103', 'Lab 104', 'Cold Room', 'Equipment Room', 'Shared Space', 'Storage', 'Other'];

export default function EquipmentHubPage() {
  const [activeTab, setActiveTab] = useState<'equipment' | 'maintenance' | 'bookings' | 'usage'>('equipment');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Equipment state
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [viewingEquipment, setViewingEquipment] = useState<Equipment | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState({ category: '', status: '', location: '' });
  const [newEquipment, setNewEquipment] = useState({
    name: '', model: '', serialNumber: '', category: 'Centrifuge', location: 'Lab 101',
    purchaseDate: '', warrantyExpiry: '', nextMaintenance: '', calibrationDue: '', notes: ''
  });

  // Maintenance state
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<Maintenance | null>(null);
  const [newMaintenance, setNewMaintenance] = useState<{ equipmentId: number; type: Maintenance['type']; description: string; scheduledDate: string; technician: string; cost: number; notes: string }>({
    equipmentId: 0, type: 'preventive', description: '', scheduledDate: '', technician: '', cost: 0, notes: ''
  });

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [newBooking, setNewBooking] = useState({
    equipmentId: 0, startDate: '', startTime: '09:00', endDate: '', endTime: '17:00', purpose: ''
  });

  // Usage logs state
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);

  // Add usage log
  const addUsageLog = (equipmentId: number, equipmentName: string, action: string, notes?: string) => {
    const log: UsageLog = {
      id: Date.now(),
      equipmentId,
      equipmentName,
      user: 'Current User',
      action,
      timestamp: new Date().toLocaleString(),
      notes
    };
    setUsageLogs(prev => [log, ...prev]);
  };

  // Equipment handlers
  const handleCreateEquipment = () => {
    if (!newEquipment.name || !newEquipment.serialNumber) {
      showToast('Please fill required fields', 'error');
      return;
    }
    const eq: Equipment = {
      id: Date.now(),
      ...newEquipment,
      status: 'available',
      lastMaintenance: 'Never'
    };
    setEquipment(prev => [...prev, eq]);
    addUsageLog(eq.id, eq.name, 'Equipment added to inventory');
    setNewEquipment({ name: '', model: '', serialNumber: '', category: 'Centrifuge', location: 'Lab 101', purchaseDate: '', warrantyExpiry: '', nextMaintenance: '', calibrationDue: '', notes: '' });
    setShowEquipmentModal(false);
    showToast('Equipment added!');
  };

  const handleUpdateEquipment = () => {
    if (!editingEquipment) return;
    setEquipment(prev => prev.map(e => e.id === editingEquipment.id ? editingEquipment : e));
    addUsageLog(editingEquipment.id, editingEquipment.name, 'Equipment details updated');
    setEditingEquipment(null);
    showToast('Equipment updated!');
  };

  const handleDeleteEquipment = (eq: Equipment) => {
    setEquipment(prev => prev.filter(e => e.id !== eq.id));
    addUsageLog(eq.id, eq.name, 'Equipment removed from inventory');
    showToast('Equipment deleted');
  };

  const handleEquipmentStatus = (eq: Equipment, status: Equipment['status']) => {
    setEquipment(prev => prev.map(e => e.id === eq.id ? { ...e, status } : e));
    addUsageLog(eq.id, eq.name, `Status changed to ${status}`);
    showToast(`Status updated to ${status}`);
  };

  // Maintenance handlers
  const handleCreateMaintenance = () => {
    if (!newMaintenance.equipmentId || !newMaintenance.scheduledDate) {
      showToast('Please fill required fields', 'error');
      return;
    }
    const eq = equipment.find(e => e.id === newMaintenance.equipmentId);
    const maint: Maintenance = {
      id: Date.now(),
      ...newMaintenance,
      equipmentName: eq?.name || 'Unknown',
      status: 'scheduled'
    };
    setMaintenances(prev => [...prev, maint]);
    addUsageLog(maint.equipmentId, maint.equipmentName, `Maintenance scheduled: ${maint.type}`);
    setNewMaintenance({ equipmentId: 0, type: 'preventive', description: '', scheduledDate: '', technician: '', cost: 0, notes: '' });
    setShowMaintenanceModal(false);
    showToast('Maintenance scheduled!');
  };

  const handleMaintenanceStatus = (maint: Maintenance, status: Maintenance['status']) => {
    const updates: Partial<Maintenance> = { status };
    if (status === 'completed') {
      updates.completedDate = new Date().toISOString().slice(0, 10);
      // Update equipment last maintenance
      setEquipment(prev => prev.map(e => e.id === maint.equipmentId ? {
        ...e,
        lastMaintenance: new Date().toISOString().slice(0, 10),
        status: 'available'
      } : e));
    }
    if (status === 'in-progress') {
      setEquipment(prev => prev.map(e => e.id === maint.equipmentId ? { ...e, status: 'maintenance' } : e));
    }
    setMaintenances(prev => prev.map(m => m.id === maint.id ? { ...m, ...updates } : m));
    addUsageLog(maint.equipmentId, maint.equipmentName, `Maintenance ${status}`);
    showToast(`Maintenance ${status}`);
  };

  const handleDeleteMaintenance = (maint: Maintenance) => {
    setMaintenances(prev => prev.filter(m => m.id !== maint.id));
    showToast('Maintenance deleted');
  };

  // Booking handlers
  const handleCreateBooking = () => {
    if (!newBooking.equipmentId || !newBooking.startDate) {
      showToast('Please fill required fields', 'error');
      return;
    }
    const eq = equipment.find(e => e.id === newBooking.equipmentId);
    const booking: Booking = {
      id: Date.now(),
      ...newBooking,
      equipmentName: eq?.name || 'Unknown',
      user: 'Current User',
      status: 'pending'
    };
    setBookings(prev => [...prev, booking]);
    addUsageLog(booking.equipmentId, booking.equipmentName, 'Booking requested');
    setNewBooking({ equipmentId: 0, startDate: '', startTime: '09:00', endDate: '', endTime: '17:00', purpose: '' });
    setShowBookingModal(false);
    showToast('Booking requested!');
  };

  const handleBookingStatus = (booking: Booking, status: Booking['status']) => {
    setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status } : b));
    if (status === 'approved' || status === 'in-use') {
      setEquipment(prev => prev.map(e => e.id === booking.equipmentId ? { ...e, status: 'in-use', assignedTo: booking.user } : e));
    }
    if (status === 'completed' || status === 'cancelled') {
      setEquipment(prev => prev.map(e => e.id === booking.equipmentId ? { ...e, status: 'available', assignedTo: undefined } : e));
    }
    addUsageLog(booking.equipmentId, booking.equipmentName, `Booking ${status}`);
    showToast(`Booking ${status}`);
  };

  const handleDeleteBooking = (booking: Booking) => {
    setBookings(prev => prev.filter(b => b.id !== booking.id));
    showToast('Booking deleted');
  };

  // Filtered data
  const filteredEquipment = equipment.filter(e => {
    if (equipmentFilter.category && e.category !== equipmentFilter.category) return false;
    if (equipmentFilter.status && e.status !== equipmentFilter.status) return false;
    if (equipmentFilter.location && e.location !== equipmentFilter.location) return false;
    return true;
  });

  // Stats
  const upcomingMaintenance = maintenances.filter(m => m.status === 'scheduled' || m.status === 'overdue').length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;

  const statusColors: Record<string, { bg: string; text: string }> = {
    available: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    'in-use': { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    maintenance: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    'out-of-service': { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    scheduled: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
    'in-progress': { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    completed: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    overdue: { bg: 'rgba(239,68,68,0.15)', text: '#f87171' },
    pending: { bg: 'rgba(234,179,8,0.15)', text: '#fbbf24' },
    approved: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
    cancelled: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
  };

  const tabs = [
    { key: 'equipment', label: 'Equipment', icon: '🔬', count: equipment.length },
    { key: 'maintenance', label: 'Maintenance', icon: '🔧', count: upcomingMaintenance },
    { key: 'bookings', label: 'Bookings', icon: '📅', count: pendingBookings },
    { key: 'usage', label: 'Usage Log', icon: '📊', count: usageLogs.length },
  ];

  const modalStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 16, padding: 24, width: 550, maxHeight: '90vh', overflow: 'auto'
  };

  // Generate QR Code data
  const generateQRData = (eq: Equipment) => {
    return `LABOS-EQ|${eq.id}|${eq.name}|${eq.serialNumber}|${eq.location}`;
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
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Equipment Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track equipment, maintenance, and bookings</p>
        </div>
        <button onClick={() => setShowHelpModal(true)} className="btn btn-secondary">
          ❓ How to Use
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Equipment', value: equipment.length, icon: '🔬', color: 'var(--text)' },
          { label: 'Available', value: equipment.filter(e => e.status === 'available').length, icon: '✅', color: '#4ade80' },
          { label: 'In Use', value: equipment.filter(e => e.status === 'in-use').length, icon: '🔄', color: '#60a5fa' },
          { label: 'Maintenance Due', value: upcomingMaintenance, icon: '🔧', color: '#fbbf24' },
          { label: 'Pending Bookings', value: pendingBookings, icon: '📅', color: '#a855f7' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: 14 }}>
            <div style={{ fontSize: 22, marginBottom: 2 }}>{stat.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{stat.label}</div>
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

      {/* Equipment Tab */}
      {activeTab === 'equipment' && (
        <div>
          {/* Filters & Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <select className="form-select" value={equipmentFilter.category} onChange={e => setEquipmentFilter({ ...equipmentFilter, category: e.target.value })} style={{ minWidth: 130 }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="form-select" value={equipmentFilter.status} onChange={e => setEquipmentFilter({ ...equipmentFilter, status: e.target.value })} style={{ minWidth: 120 }}>
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="in-use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="out-of-service">Out of Service</option>
              </select>
              <select className="form-select" value={equipmentFilter.location} onChange={e => setEquipmentFilter({ ...equipmentFilter, location: e.target.value })} style={{ minWidth: 120 }}>
                <option value="">All Locations</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {(equipmentFilter.category || equipmentFilter.status || equipmentFilter.location) && (
                <button className="btn btn-secondary" onClick={() => setEquipmentFilter({ category: '', status: '', location: '' })}>Clear</button>
              )}
            </div>
            <button className="btn btn-primary" onClick={() => setShowEquipmentModal(true)}>+ Add Equipment</button>
          </div>

          {equipment.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Equipment Yet</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Add lab equipment to track and manage</p>
              <button className="btn btn-primary" onClick={() => setShowEquipmentModal(true)}>+ Add First Equipment</button>
            </div>
          ) : filteredEquipment.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No equipment matches current filters</p>
              <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setEquipmentFilter({ category: '', status: '', location: '' })}>Clear Filters</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {filteredEquipment.map(eq => (
                <div key={eq.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                        {eq.category === 'Microscope' ? '🔬' : eq.category === 'Centrifuge' ? '🌀' : eq.category === 'PCR Machine' ? '🧬' : eq.category === 'Freezer' ? '❄️' : eq.category === 'Incubator' ? '🌡️' : '⚗️'}
                      </div>
                      <div>
                        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{eq.name}</h3>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{eq.model} • {eq.serialNumber}</div>
                      </div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 500, background: statusColors[eq.status]?.bg, color: statusColors[eq.status]?.text }}>
                      {eq.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>📍 {eq.location}</span>
                      <span>🏷️ {eq.category}</span>
                    </div>
                    {eq.assignedTo && <div>👤 Assigned to: {eq.assignedTo}</div>}
                    {eq.nextMaintenance && <div>🔧 Next maintenance: {eq.nextMaintenance}</div>}
                    {eq.calibrationDue && <div>📏 Calibration due: {eq.calibrationDue}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => setViewingEquipment(eq)}>👁️ View</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingEquipment(eq)}>✏️</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteEquipment(eq)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowMaintenanceModal(true)}>+ Schedule Maintenance</button>
          </div>

          {maintenances.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔧</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Maintenance Scheduled</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Schedule preventive and corrective maintenance</p>
              <button className="btn btn-primary" onClick={() => setShowMaintenanceModal(true)}>+ Schedule First Maintenance</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {maintenances.map(m => (
                <div key={m.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: statusColors[m.status]?.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                      {m.type === 'calibration' ? '📏' : m.type === 'preventive' ? '🛡️' : '🔧'}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600 }}>{m.equipmentName}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[m.status]?.bg, color: statusColors[m.status]?.text }}>{m.status}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{m.type}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {m.description || 'No description'} • Scheduled: {m.scheduledDate} • Technician: {m.technician || 'TBD'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {m.status === 'scheduled' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'none' }} onClick={() => handleMaintenanceStatus(m, 'in-progress')}>▶️ Start</button>
                    )}
                    {m.status === 'in-progress' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none' }} onClick={() => handleMaintenanceStatus(m, 'completed')}>✓ Complete</button>
                    )}
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteMaintenance(m)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>+ New Booking</button>
          </div>

          {bookings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Bookings</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Reserve equipment for your experiments</p>
              <button className="btn btn-primary" onClick={() => setShowBookingModal(true)}>+ Make First Booking</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bookings.map(b => (
                <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📅</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <h4 style={{ fontSize: 14, fontWeight: 600 }}>{b.equipmentName}</h4>
                        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: statusColors[b.status]?.bg, color: statusColors[b.status]?.text }}>{b.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        👤 {b.user} • {b.startDate} {b.startTime} - {b.endDate} {b.endTime}
                      </div>
                      {b.purpose && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Purpose: {b.purpose}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {b.status === 'pending' && (
                      <>
                        <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none' }} onClick={() => handleBookingStatus(b, 'approved')}>✓ Approve</button>
                        <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleBookingStatus(b, 'cancelled')}>✕ Reject</button>
                      </>
                    )}
                    {b.status === 'approved' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleBookingStatus(b, 'in-use')}>▶️ Start Use</button>
                    )}
                    {b.status === 'in-use' && (
                      <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: 'none' }} onClick={() => handleBookingStatus(b, 'completed')}>✓ Complete</button>
                    )}
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none' }} onClick={() => handleDeleteBooking(b)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Usage Log Tab */}
      {activeTab === 'usage' && (
        <div>
          {usageLogs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No Usage Logs</h3>
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Equipment actions will be logged automatically</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {usageLogs.map(log => (
                <div key={log.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📋</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>{log.user}</strong> {log.action} on <span style={{ color: 'var(--accent)' }}>{log.equipmentName}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{log.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Equipment Modal */}
      {(showEquipmentModal || editingEquipment) && (
        <div style={modalStyle} onClick={() => { setShowEquipmentModal(false); setEditingEquipment(null); }}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</h3>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Equipment Name *</label>
                <input type="text" className="form-input" placeholder="e.g., Centrifuge XR-500"
                  value={editingEquipment ? editingEquipment.name : newEquipment.name}
                  onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, name: e.target.value }) : setNewEquipment({ ...newEquipment, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Model</label>
                  <input type="text" className="form-input" placeholder="Model number"
                    value={editingEquipment ? editingEquipment.model : newEquipment.model}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, model: e.target.value }) : setNewEquipment({ ...newEquipment, model: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Serial Number *</label>
                  <input type="text" className="form-input" placeholder="S/N"
                    value={editingEquipment ? editingEquipment.serialNumber : newEquipment.serialNumber}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, serialNumber: e.target.value }) : setNewEquipment({ ...newEquipment, serialNumber: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingEquipment ? editingEquipment.category : newEquipment.category}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, category: e.target.value }) : setNewEquipment({ ...newEquipment, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Location</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingEquipment ? editingEquipment.location : newEquipment.location}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, location: e.target.value }) : setNewEquipment({ ...newEquipment, location: e.target.value })}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Purchase Date</label>
                  <input type="date" className="form-input"
                    value={editingEquipment ? editingEquipment.purchaseDate : newEquipment.purchaseDate}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, purchaseDate: e.target.value }) : setNewEquipment({ ...newEquipment, purchaseDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Warranty Expiry</label>
                  <input type="date" className="form-input"
                    value={editingEquipment ? editingEquipment.warrantyExpiry : newEquipment.warrantyExpiry}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, warrantyExpiry: e.target.value }) : setNewEquipment({ ...newEquipment, warrantyExpiry: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Next Maintenance</label>
                  <input type="date" className="form-input"
                    value={editingEquipment ? editingEquipment.nextMaintenance : newEquipment.nextMaintenance}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, nextMaintenance: e.target.value }) : setNewEquipment({ ...newEquipment, nextMaintenance: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Calibration Due</label>
                  <input type="date" className="form-input"
                    value={editingEquipment ? editingEquipment.calibrationDue : newEquipment.calibrationDue}
                    onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, calibrationDue: e.target.value }) : setNewEquipment({ ...newEquipment, calibrationDue: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <textarea className="form-input" rows={2} placeholder="Additional notes..."
                  value={editingEquipment ? editingEquipment.notes : newEquipment.notes}
                  onChange={e => editingEquipment ? setEditingEquipment({ ...editingEquipment, notes: e.target.value }) : setNewEquipment({ ...newEquipment, notes: e.target.value })} />
              </div>
              {editingEquipment && (
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Status</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={editingEquipment.status}
                    onChange={e => setEditingEquipment({ ...editingEquipment, status: e.target.value as Equipment['status'] })}>
                    <option value="available">Available</option>
                    <option value="in-use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out-of-service">Out of Service</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => { setShowEquipmentModal(false); setEditingEquipment(null); }} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={editingEquipment ? handleUpdateEquipment : handleCreateEquipment} style={{ flex: 1 }}>
                {editingEquipment ? 'Save Changes' : 'Add Equipment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Equipment Modal */}
      {viewingEquipment && (
        <div style={modalStyle} onClick={() => setViewingEquipment(null)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{viewingEquipment.name}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, background: statusColors[viewingEquipment.status]?.bg, color: statusColors[viewingEquipment.status]?.text }}>{viewingEquipment.status}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, background: 'var(--surface2)', color: 'var(--text-muted)' }}>{viewingEquipment.category}</span>
                </div>
              </div>
              <button onClick={() => setViewingEquipment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Model</div><div style={{ fontWeight: 500 }}>{viewingEquipment.model || '-'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Serial Number</div><div style={{ fontWeight: 500 }}>{viewingEquipment.serialNumber}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Location</div><div style={{ fontWeight: 500 }}>{viewingEquipment.location}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Purchase Date</div><div style={{ fontWeight: 500 }}>{viewingEquipment.purchaseDate || '-'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Warranty Expiry</div><div style={{ fontWeight: 500 }}>{viewingEquipment.warrantyExpiry || '-'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Last Maintenance</div><div style={{ fontWeight: 500 }}>{viewingEquipment.lastMaintenance}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Next Maintenance</div><div style={{ fontWeight: 500 }}>{viewingEquipment.nextMaintenance || '-'}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Calibration Due</div><div style={{ fontWeight: 500 }}>{viewingEquipment.calibrationDue || '-'}</div></div>
            </div>
            {viewingEquipment.notes && (
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Notes</div>
                <div style={{ fontSize: 13 }}>{viewingEquipment.notes}</div>
              </div>
            )}
            {/* QR Code placeholder */}
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: 16, textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 64, marginBottom: 8 }}>📱</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>QR Code for quick lookup</div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{generateQRData(viewingEquipment)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setViewingEquipment(null)} style={{ flex: 1 }}>Close</button>
              <button className="btn btn-primary" onClick={() => { setEditingEquipment(viewingEquipment); setViewingEquipment(null); }} style={{ flex: 1 }}>✏️ Edit</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Maintenance Modal */}
      {showMaintenanceModal && (
        <div style={modalStyle} onClick={() => setShowMaintenanceModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Schedule Maintenance</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Equipment *</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={newMaintenance.equipmentId}
                  onChange={e => setNewMaintenance({ ...newMaintenance, equipmentId: Number(e.target.value) })}>
                  <option value={0}>Select equipment...</option>
                  {equipment.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.serialNumber})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Type</label>
                  <select className="form-select" style={{ width: '100%' }}
                    value={newMaintenance.type}
                    onChange={e => setNewMaintenance({ ...newMaintenance, type: e.target.value as Maintenance['type'] })}>
                    <option value="preventive">Preventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="calibration">Calibration</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Scheduled Date *</label>
                  <input type="date" className="form-input"
                    value={newMaintenance.scheduledDate}
                    onChange={e => setNewMaintenance({ ...newMaintenance, scheduledDate: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Technician</label>
                  <input type="text" className="form-input" placeholder="Technician name"
                    value={newMaintenance.technician}
                    onChange={e => setNewMaintenance({ ...newMaintenance, technician: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Estimated Cost ($)</label>
                  <input type="number" className="form-input" min={0}
                    value={newMaintenance.cost}
                    onChange={e => setNewMaintenance({ ...newMaintenance, cost: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea className="form-input" rows={2} placeholder="Maintenance description..."
                  value={newMaintenance.description}
                  onChange={e => setNewMaintenance({ ...newMaintenance, description: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowMaintenanceModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateMaintenance} style={{ flex: 1 }}>Schedule Maintenance</button>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {showBookingModal && (
        <div style={modalStyle} onClick={() => setShowBookingModal(false)}>
          <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Book Equipment</h3>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Equipment *</label>
                <select className="form-select" style={{ width: '100%' }}
                  value={newBooking.equipmentId}
                  onChange={e => setNewBooking({ ...newBooking, equipmentId: Number(e.target.value) })}>
                  <option value={0}>Select equipment...</option>
                  {equipment.filter(eq => eq.status === 'available').map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.location})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Start Date *</label>
                  <input type="date" className="form-input"
                    value={newBooking.startDate}
                    onChange={e => setNewBooking({ ...newBooking, startDate: e.target.value, endDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Start Time</label>
                  <input type="time" className="form-input"
                    value={newBooking.startTime}
                    onChange={e => setNewBooking({ ...newBooking, startTime: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>End Date</label>
                  <input type="date" className="form-input"
                    value={newBooking.endDate}
                    onChange={e => setNewBooking({ ...newBooking, endDate: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>End Time</label>
                  <input type="time" className="form-input"
                    value={newBooking.endTime}
                    onChange={e => setNewBooking({ ...newBooking, endTime: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Purpose</label>
                <textarea className="form-input" rows={2} placeholder="What will you use this equipment for?"
                  value={newBooking.purpose}
                  onChange={e => setNewBooking({ ...newBooking, purpose: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setShowBookingModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateBooking} style={{ flex: 1 }}>Request Booking</button>
            </div>
          </div>
        </div>
      )}

      {/* How to Use Modal */}
      {showHelpModal && (
        <div style={modalStyle} onClick={() => setShowHelpModal(false)}>
          <div style={{ ...modalContentStyle, width: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>How to Use Equipment Management</h3>
              <button onClick={() => setShowHelpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🔬 Equipment</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Add equipment with name, model, serial number, and location</li>
                  <li>Track purchase date, warranty, and calibration dates</li>
                  <li>Filter by category, status, or location</li>
                  <li>View detailed info and QR code for quick lookup</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🔧 Maintenance</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Schedule preventive, corrective, or calibration maintenance</li>
                  <li>Track maintenance status: Scheduled → In Progress → Completed</li>
                  <li>Equipment status auto-updates during maintenance</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>📅 Bookings</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>Reserve equipment for specific dates and times</li>
                  <li>Booking workflow: Pending → Approved → In Use → Completed</li>
                  <li>Only available equipment can be booked</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>📊 Usage Log</h4>
                <ul style={{ fontSize: 13, color: 'var(--text-muted)', paddingLeft: 20, margin: 0, lineHeight: 1.7 }}>
                  <li>All equipment actions are automatically logged</li>
                  <li>Track who did what and when</li>
                  <li>Audit trail for compliance</li>
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
