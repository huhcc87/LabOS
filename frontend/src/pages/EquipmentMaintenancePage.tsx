import MaintenancePanel from '../features/instruments/MaintenancePanel';

/** Equipment list and problem reports (opened from the sidebar). */
export default function EquipmentMaintenancePage() {
  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>Equipment &amp; Maintenance</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 20px' }}>Add equipment, report a problem, and follow repairs.</p>
      <MaintenancePanel />
    </div>
  );
}
