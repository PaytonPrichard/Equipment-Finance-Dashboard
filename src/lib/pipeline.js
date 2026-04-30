import { supabase } from './supabase';
import { logAudit } from './audit';
import {
  isDemoMode,
  listDemoPipeline,
  createDemoPipelineDeal,
  updateDemoPipelineStage,
  updateDemoPipelineName,
  updateDemoPipelineNotes,
  updateDemoPipelineInputs,
  deleteDemoPipelineDeal,
} from './demoMode';

/**
 * Fetch all pipeline deals for an organization, most recently updated first.
 */
export async function fetchPipelineDeals(orgId) {
  if (isDemoMode()) return { data: listDemoPipeline(), error: null };
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
  if (isDemoMode()) {
    const deal = createDemoPipelineDeal({ name, inputs, score });
    return { data: deal, error: null };
  }
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
  if (isDemoMode()) {
    const deal = updateDemoPipelineStage(dealId, newStage);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
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
 * Rename a pipeline deal.
 */
export async function updatePipelineName(dealId, name) {
  if (isDemoMode()) {
    const deal = updateDemoPipelineName(dealId, name);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  return { data, error };
}

/**
 * Update notes on a pipeline deal (no audit logging for notes).
 */
export async function updatePipelineNotes(dealId, notes) {
  if (isDemoMode()) {
    const deal = updateDemoPipelineNotes(dealId, notes);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
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
 * Update inputs and score on a pipeline deal (e.g. after re-screening).
 */
export async function updatePipelineDeal(dealId, inputs, score, userId, orgId) {
  if (isDemoMode()) {
    const deal = updateDemoPipelineInputs(dealId, inputs, score);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  // Fetch current state for audit trail
  const { data: existing } = await supabase
    .from('pipeline_deals')
    .select('inputs, score')
    .eq('id', dealId)
    .single();

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ inputs, score, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'update_inputs', 'pipeline_deal', dealId,
      { score: existing?.score, inputs: existing?.inputs },
      { score, inputs }
    );
  }

  return { data, error };
}

/**
 * Delete a pipeline deal by ID.
 */
export async function deletePipelineDeal(dealId, userId, orgId) {
  if (isDemoMode()) {
    const deal = deleteDemoPipelineDeal(dealId);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
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
