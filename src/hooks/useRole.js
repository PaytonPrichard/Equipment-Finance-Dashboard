import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../lib/permissions';

export function useRole() {
  const { profile, permissions } = useAuth();

  const role = profile?.role || null;

  const can = useMemo(() => {
    return (permissionKey) => hasPermission(permissions, permissionKey);
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
