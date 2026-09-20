import type { UserRole } from './types';

export function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const ROLE_ORDER: UserRole[] = ['trainee', 'staff', 'manager', 'pi', 'admin', 'superadmin'];

export function hasRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(minRole);
}

export function resolveRole(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    superadmin: 'Super Admin',
    admin: 'Administrator',
    pi: 'Principal Investigator',
    manager: 'Manager',
    staff: 'Staff',
    trainee: 'Trainee',
  };
  return labels[role] || role;
}

export function generateSampleId(): string {
  const prefix = 'SMP';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: '#22c55e',
    available: '#22c55e',
    completed: '#22c55e',
    sent: '#22c55e',
    closed: '#22c55e',
    pending: '#f59e0b',
    in_progress: '#6366f1',
    processing: '#6366f1',
    reserved: '#6366f1',
    received: '#6366f1',
    overdue: '#ef4444',
    expired: '#ef4444',
    failed: '#ef4444',
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#22c55e',
    open: '#f59e0b',
    stored: '#22c55e',
    sequenced: '#a855f7',
    archived: '#94a3b8',
    disposed: '#94a3b8',
    maintenance: '#f97316',
    cancelled: '#94a3b8',
  };
  return map[status] || '#94a3b8';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
