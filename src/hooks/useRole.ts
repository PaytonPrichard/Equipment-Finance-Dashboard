import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/permissions';
import type { UserRole, PermissionKey } from '../types';

interface RoleResult {
  role: UserRole | null;
  permissions: Record<string, boolean> | null;
  can: (permissionKey: string) => boolean;
  isAdmin: boolean;
  isSeniorOrAbove: boolean;
  isCreditCommittee: boolean;
}

export function useRole(): RoleResult {
  const { profile, permissions } = useAuth();

  const role: UserRole | null = profile?.role || null;

  const can = useMemo(() => {
    return (permissionKey: string): boolean => hasPermission(permissions, permissionKey as PermissionKey);
  }, [permissions]);

  const isAdmin = role === 'admin';
  const isSeniorOrAbove = role === 'senior_analyst' || role === 'credit_committee' || role === 'admin';
  const isCreditCommittee = role === 'credit_committee';

  return {
    role,
    permissions,
    can,
    isAdmin,
    isSeniorOrAbove,
    isCreditCommittee,
  };
}
