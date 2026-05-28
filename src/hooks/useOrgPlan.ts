import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface OrgRow {
  id: string;
  name: string;
  plan: string;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  max_users: number;
}

interface OrgPlanResult {
  org: OrgRow | null;
  plan: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number | null;
  expiresAt: Date | null;
  loading: boolean;
  refresh: () => void;
}

export function useOrgPlan(): OrgPlanResult {
  const { profile } = useAuth();
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const orgId = profile?.org_id ?? undefined;

  const fetchOrg = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, plan, plan_started_at, plan_expires_at, max_users')
      .eq('id', orgId)
      .single();

    if (!error && data) setOrg(data as OrgRow);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  const now = new Date();
  const expiresAt = org?.plan_expires_at ? new Date(org.plan_expires_at) : null;
  const isExpired = expiresAt ? now > expiresAt : false;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && !isExpired;
  const plan: string = org?.plan || 'free_trial';

  return {
    org,
    plan,
    isExpired,
    isExpiringSoon,
    daysRemaining,
    expiresAt,
    loading,
    refresh: fetchOrg,
  };
}
