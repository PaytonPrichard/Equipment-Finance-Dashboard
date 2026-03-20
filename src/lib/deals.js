import { supabase } from './supabase';
import { logAudit } from './audit';

/**
 * Fetch all saved deals for an organization, newest first.
 */
export async function fetchSavedDeals(orgId) {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('saved_deals')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Create a new saved deal.
 */
export async function createSavedDeal(userId, orgId, name, inputs, score) {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('saved_deals')
    .insert({
      user_id: userId,
      org_id: orgId,
      name,
      inputs,
      score,
    })
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'create', 'saved_deal', data.id, null, { name, inputs, score });
  }

  return { data, error };
}

/**
 * Delete a saved deal by ID.
 */
export async function deleteSavedDeal(dealId, userId, orgId) {
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

  return { data, error };
}
