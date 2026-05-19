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

// Wrap a fetch to /api/score-deal so callers keep the {data, error} shape.
// The endpoint writes the deal, the audit row, and fires deal.created /
// deal.scored webhooks server-side. Browser-side score writes go through here
// instead of Supabase direct so the dispatch path can't be skipped.
async function callScoreDeal(method, path, body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { data: null, error: { message: 'Not authenticated' } };

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }

  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }

  if (!res.ok) {
    return { data: null, error: { message: payload?.error || `HTTP ${res.status}`, details: payload?.details } };
  }
  return { data: payload?.deal || null, error: null };
}

/**
 * Create a new pipeline deal in the initial 'Screening' stage.
 * Server derives user_id and org_id from the JWT.
 */
export async function createPipelineDeal(name, inputs, score) {
  if (isDemoMode()) {
    const deal = createDemoPipelineDeal({ name, inputs, score });
    return { data: deal, error: null };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('POST', '/api/score-deal', { name, inputs, score, notes: '' });
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
 * Server derives user_id and org_id from the JWT.
 */
export async function updatePipelineDeal(dealId, inputs, score) {
  if (isDemoMode()) {
    const deal = updateDemoPipelineInputs(dealId, inputs, score);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('PATCH', `/api/score-deal?id=${encodeURIComponent(dealId)}`, { inputs, score });
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
