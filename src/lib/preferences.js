import { supabase } from './supabase';

/**
 * Fetch user preferences for the given user.
 */
export async function fetchPreferences(userId) {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return { data: data || null, error: error?.code === 'PGRST116' ? null : error };
}

/**
 * Upsert user preferences (scoring_weights, draft_inputs, etc.).
 * Uses user_id as the conflict target so repeated calls update in place.
 */
export async function upsertPreferences(userId, data) {
  if (!supabase) return { data: null, error: null };

  const { data: result, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, ...data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  return { data: result, error };
}
