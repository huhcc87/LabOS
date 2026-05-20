import type { UserRole } from '../lib/types';

const COLORS: Record<UserRole, string> = {
  superadmin: '#dc2626',
  admin: '#ef4444',
  pi: '#8b5cf6',
  manager: '#6366f1',
  staff: '#22c55e',
  trainee: '#94a3b8',
};

const LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  pi: 'PI',
  manager: 'Manager',
  staff: 'Staff',
  trainee: 'Trainee',
};

export function RoleBadge({ role }: { role: UserRole }) {
  const color = COLORS[role] || '#94a3b8';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600,
      background: `${color}22`, color, border: `1px solid ${color}44`,
    }}>
      {LABELS[role] || role}
    </span>
  );
}
