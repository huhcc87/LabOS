import type { UserRole } from './types';

const ROLE_ORDER: UserRole[] = ['trainee', 'staff', 'manager', 'pi', 'admin', 'superadmin'];

export function roleLevel(role: UserRole): number {
  return ROLE_ORDER.indexOf(role);
}

export function atLeast(userRole: UserRole, minRole: UserRole): boolean {
  return roleLevel(userRole) >= roleLevel(minRole);
}

// ── Permission matrix ──────────────────────────────────────────────────────
// Each permission maps to the minimum role required.

export const PERMISSIONS = {
  // Samples
  'samples.view':   'trainee',
  'samples.create': 'trainee',
  'samples.edit':   'staff',
  'samples.delete': 'manager',

  // Inventory
  'inventory.view':   'trainee',
  'inventory.create': 'staff',
  'inventory.edit':   'staff',
  'inventory.delete': 'manager',

  // Protocols
  'protocols.view':    'trainee',
  'protocols.create':  'staff',
  'protocols.edit':    'staff',
  'protocols.delete':  'pi',
  'protocols.approve': 'pi',

  // Instruments / Equipment
  'instruments.view':   'trainee',
  'instruments.create': 'staff',
  'instruments.edit':   'manager',
  'instruments.delete': 'admin',
  'instruments.book':   'trainee',

  // Tasks
  'tasks.view':   'trainee',
  'tasks.create': 'trainee',
  'tasks.edit':   'staff',
  'tasks.delete': 'manager',

  // Incidents / Safety
  'incidents.view':   'trainee',
  'incidents.create': 'trainee',
  'incidents.edit':   'staff',
  'incidents.delete': 'admin',

  // Grants
  'grants.view':   'trainee',
  'grants.create': 'staff',
  'grants.edit':   'staff',
  'grants.delete': 'pi',

  // SOPs
  'sops.view':    'trainee',
  'sops.create':  'staff',
  'sops.edit':    'staff',
  'sops.delete':  'pi',
  'sops.approve': 'pi',

  // Lab Notebook
  'notebook.view':   'trainee',
  'notebook.create': 'trainee',
  'notebook.edit':   'staff',
  'notebook.delete': 'manager',
  'notebook.sign':   'pi',

  // Suppliers / Procurement
  'suppliers.view':   'staff',
  'suppliers.create': 'manager',
  'suppliers.edit':   'manager',
  'suppliers.delete': 'admin',

  // Cost Tracking
  'costs.view':    'staff',
  'costs.create':  'staff',
  'costs.edit':    'manager',
  'costs.delete':  'admin',
  'costs.approve': 'pi',

  // Maintenance
  'maintenance.view':   'trainee',
  'maintenance.create': 'staff',
  'maintenance.edit':   'staff',
  'maintenance.delete': 'admin',

  // Users / Admin
  'users.view':         'admin',
  'users.create':       'admin',
  'users.edit':         'admin',
  'users.delete':       'superadmin',
  'users.change_role':  'admin',

  // Settings
  'settings.view':        'pi',
  'settings.edit':        'admin',
  'settings.smtp':        'admin',
  'settings.integrations': 'admin',

  // Reports / Audit
  'reports.view': 'staff',
  'audit.view':   'manager',

  // Compliance
  'compliance.view':   'trainee',
  'compliance.create': 'staff',
  'compliance.edit':   'manager',

  // Meetings
  'meetings.view':   'trainee',
  'meetings.create': 'staff',
  'meetings.edit':   'staff',
  'meetings.delete': 'manager',

  // Migrations (DB admin)
  'migrations.view':    'admin',
  'migrations.execute': 'superadmin',
} as const satisfies Record<string, UserRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(userRole: UserRole, permission: Permission): boolean {
  const minRole = PERMISSIONS[permission] as UserRole;
  return atLeast(userRole, minRole);
}

// Convenience: check multiple — returns true if ALL pass
export function canAll(userRole: UserRole, ...permissions: Permission[]): boolean {
  return permissions.every((p) => can(userRole, p));
}

// Convenience: check multiple — returns true if ANY pass
export function canAny(userRole: UserRole, ...permissions: Permission[]): boolean {
  return permissions.some((p) => can(userRole, p));
}

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  admin:      'Administrator',
  pi:         'Principal Investigator',
  manager:    'Lab Manager',
  staff:      'Research Staff',
  trainee:    'Trainee / Student',
};

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  superadmin: { bg: 'rgba(239,68,68,0.15)',  text: '#ef4444', border: 'rgba(239,68,68,0.4)' },
  admin:      { bg: 'rgba(249,115,22,0.15)', text: '#f97316', border: 'rgba(249,115,22,0.4)' },
  pi:         { bg: 'rgba(168,85,247,0.15)', text: '#a855f7', border: 'rgba(168,85,247,0.4)' },
  manager:    { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', border: 'rgba(59,130,246,0.4)' },
  staff:      { bg: 'rgba(34,197,94,0.15)',  text: '#22c55e', border: 'rgba(34,197,94,0.4)' },
  trainee:    { bg: 'rgba(148,163,184,0.15)',text: '#94a3b8', border: 'rgba(148,163,184,0.4)' },
};
