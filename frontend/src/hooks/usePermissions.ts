import { useAuth } from '../context/AuthContext';
import { can, canAll, canAny, type Permission } from '../lib/permissions';
import type { UserRole } from '../lib/types';

export function usePermissions() {
  const { user } = useAuth();
  const role: UserRole = user?.role ?? 'trainee';

  return {
    role,
    can:    (p: Permission)            => can(role, p),
    canAll: (...ps: Permission[])      => canAll(role, ...ps),
    canAny: (...ps: Permission[])      => canAny(role, ...ps),
    atLeast: (minRole: UserRole)       => {
      const order: UserRole[] = ['trainee','staff','manager','pi','admin','superadmin'];
      return order.indexOf(role) >= order.indexOf(minRole);
    },
  };
}
