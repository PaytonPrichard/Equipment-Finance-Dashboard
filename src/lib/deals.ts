import { supabase } from './supabase';
import { logAudit } from './audit';
import { isDemoMode } from './demoMode';
import type { DealInputs } from '../types';

interface SavedDealRow {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  inputs: DealInputs;
  score: number | null;
  created_at: string;
}

interface SupabaseListResult {
  data: SavedDealRow[];
  error: { message: string } | null;
}

interface SupabaseSingleResult {
  data: SavedDealRow | null;
  error: { message: string } | null;
}

export async function fetchSavedDeals(orgId: string): Promise<SupabaseListResult> {
  if (isDemoMode()) return { data: [], error: null };
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('saved_deals')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return { data: (data as SavedDealRow[]) || [], error };
}

export async function createSavedDeal(
  userId: string,
  orgId: string,
  name: string,
  inputs: DealInputs,
  score: number | null,
): Promise<SupabaseSingleResult> {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('saved_deals')
    .insert({ user_id: userId, org_id: orgId, name, inputs, score })
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'create', 'saved_deal', (data as SavedDealRow).id, null, { name, inputs, score });
  }

  return { data: data as SavedDealRow | null, error };
}

export async function deleteSavedDeal(
  dealId: string,
  userId: string,
  orgId: string,
): Promise<SupabaseSingleResult> {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('saved_deals')
    .delete()
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'delete', 'saved_deal', dealId, data, null);
  }

  return { data: data as SavedDealRow | null, error };
}
