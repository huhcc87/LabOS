import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import type { Permission } from '../lib/permissions';

interface CanProps {
  do: Permission | Permission[];
  any?: boolean;       // if true, passes if ANY permission matches (default: ALL must match)
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Conditionally renders children based on the current user's permissions.
 *
 * @example
 * <Can do="samples.delete">
 *   <button onClick={handleDelete}>Delete</button>
 * </Can>
 *
 * <Can do={["inventory.edit","inventory.delete"]} any>
 *   <ActionMenu />
 * </Can>
 */
export function Can({ do: permission, any: anyMode = false, fallback = null, children }: CanProps) {
  const { can, canAll, canAny } = usePermissions();

  const allowed = Array.isArray(permission)
    ? anyMode ? canAny(...permission) : canAll(...permission)
    : can(permission);

  return allowed ? <>{children}</> : <>{fallback}</>;
}
