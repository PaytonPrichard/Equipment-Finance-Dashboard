import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

/**
 * Hook to fetch and track the current org's plan status.
 * Returns plan info and expiry state.
 */
export function useOrgPlan() {
  const { profile } = useAuth();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  const orgId = profile?.org_id;

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

    if (!error && data) setOrg(data);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchOrg(); }, [fetchOrg]);

  const now = new Date();
  const expiresAt = org?.plan_expires_at ? new Date(org.plan_expires_at) : null;
  const isExpired = expiresAt ? now > expiresAt : false;
  const daysRemaining = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)))
    : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 7 && !isExpired;
  const plan = org?.plan || 'free_trial';

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
