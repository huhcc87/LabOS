import MaintenancePanel from '../features/instruments/MaintenancePanel';
import LabBanner from '../components/LabBanner';

/** Equipment list and problem reports (opened from the sidebar). */
export default function EquipmentMaintenancePage() {
  return (
    <div className="page" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <LabBanner art="lab" title="Equipment & Maintenance" subtitle="Add equipment, report a problem, and follow repairs." style={{ flex: 1, minWidth: 0 }} />
      <MaintenancePanel />
    </div>
  );
}
