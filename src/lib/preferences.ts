import { supabase } from './supabase';
import { isDemoMode } from './demoMode';

export interface UserPreferencesRow {
  user_id: string;
  screening_criteria?: unknown;
  draft_inputs?: unknown;
  tutorial_state?: unknown;
  updated_at?: string;
}

interface PrefsResult {
  data: UserPreferencesRow | null;
  error: { message: string; code?: string } | null;
}

export async function fetchPreferences(userId: string): Promise<PrefsResult> {
  if (isDemoMode()) return { data: null, error: null };
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    data: (data as UserPreferencesRow) || null,
    error: error?.code === 'PGRST116' ? null : error,
  };
}

export async function upsertPreferences(userId: string, prefs: Partial<Omit<UserPreferencesRow, 'user_id' | 'updated_at'>>): Promise<PrefsResult> {
  if (isDemoMode()) return { data: null, error: null };
  if (!supabase) return { data: null, error: null };

  const { data: result, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single();

  return { data: result as UserPreferencesRow | null, error };
}
