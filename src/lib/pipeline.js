import { supabase } from './supabase';
import { logAudit } from './audit';

/**
 * Fetch all pipeline deals for an organization, most recently updated first.
 */
export async function fetchPipelineDeals(orgId) {
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  return { data: data || [], error };
}

/**
 * Create a new pipeline deal in the initial 'Screening' stage.
 */
export async function createPipelineDeal(userId, orgId, name, inputs, score) {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .insert({
      user_id: userId,
      org_id: orgId,
      name,
      stage: 'Screening',
      inputs,
      score,
      notes: '',
    })
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'create', 'pipeline_deal', data.id, null, { name, stage: 'Screening', inputs, score });
  }

  return { data, error };
}

/**
 * Move a pipeline deal to a new stage.
 * Fetches the current stage first so we can log old_values / new_values.
 */
export async function updatePipelineStage(dealId, newStage, userId, orgId) {
  if (!supabase) return { data: null, error: null };

  // Fetch current record to capture old stage
  const { data: existing, error: fetchError } = await supabase
    .from('pipeline_deals')
    .select('stage')
    .eq('id', dealId)
    .single();

  if (fetchError) return { data: null, error: fetchError };

  const oldStage = existing.stage;

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'update_stage', 'pipeline_deal', dealId, { stage: oldStage }, { stage: newStage });
  }

  return { data, error };
}

/**
 * Update notes on a pipeline deal (no audit logging for notes).
 */
export async function updatePipelineNotes(dealId, notes) {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a pipeline deal by ID.
 */
export async function deletePipelineDeal(dealId, userId, orgId) {
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .delete()
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'delete', 'pipeline_deal', dealId, data, null);
  }

  return { data, error };
}
