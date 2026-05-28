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
import type { DealInputs, AssetClass } from '../types';

export interface PipelineDealRow {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  stage: string;
  inputs: DealInputs;
  asset_class: AssetClass;
  score: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface FetchResult {
  data: PipelineDealRow[];
  error: unknown;
}

interface SingleResult {
  data: PipelineDealRow | null;
  error: { message: string; details?: string } | unknown;
}

async function callScoreDeal(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<SingleResult> {
  const { data: sessionData } = await supabase!.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { data: null, error: { message: 'Not authenticated' } };

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    return { data: null, error: { message: (err as Error).message || 'Network error' } };
  }

  let payload: { deal?: PipelineDealRow; error?: string; details?: string } | null = null;
  try { payload = await res.json(); } catch { payload = null; }

  if (!res.ok) {
    return { data: null, error: { message: payload?.error || `HTTP ${res.status}`, details: payload?.details } };
  }
  return { data: payload?.deal || null, error: null };
}

// Fetch all pipeline deals for an organization, most recently updated first.
export async function fetchPipelineDeals(orgId: string): Promise<FetchResult> {
  if (isDemoMode()) return { data: listDemoPipeline(), error: null };
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('pipeline_deals')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  return { data: (data as PipelineDealRow[]) || [], error };
}

// Create a new pipeline deal in the initial 'Screening' stage.
// Server derives user_id and org_id from the JWT and recomputes the
// authoritative score from inputs + assetClass. The score arg is
// used only for demo mode (which doesn't round-trip through the server).
export async function createPipelineDeal(
  name: string,
  inputs: DealInputs,
  score: number | null,
  assetClass: AssetClass = 'equipment_finance',
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = createDemoPipelineDeal({ name, inputs, score, assetClass });
    return { data: deal, error: null };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('POST', '/api/score-deal', { name, inputs, asset_class: assetClass, notes: '' });
}

// Move a pipeline deal to a new stage.
// Fetches the current stage first so we can log old_values / new_values.
export async function updatePipelineStage(
  dealId: string,
  newStage: string,
  userId: string,
  orgId: string,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = updateDemoPipelineStage(dealId, newStage);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  const { data: existing, error: fetchError } = await supabase
    .from('pipeline_deals')
    .select('stage')
    .eq('id', dealId)
    .single();

  if (fetchError) return { data: null, error: fetchError };

  const oldStage = (existing as { stage: string }).stage;

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ stage: newStage, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'update_stage', 'pipeline_deal', dealId, { stage: oldStage }, { stage: newStage });
  }

  return { data: data as PipelineDealRow | null, error };
}

// Rename a pipeline deal.
export async function updatePipelineName(dealId: string, name: string): Promise<SingleResult> {
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

  return { data: data as PipelineDealRow | null, error };
}

// Update notes on a pipeline deal (no audit logging for notes).
export async function updatePipelineNotes(dealId: string, notes: string): Promise<SingleResult> {
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

  return { data: data as PipelineDealRow | null, error };
}

// Update inputs and score on a pipeline deal (e.g. after re-screening).
// Server derives user_id and org_id from the JWT.
export async function updatePipelineDeal(
  dealId: string,
  inputs: DealInputs,
  score: number | null,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = updateDemoPipelineInputs(dealId, inputs, score);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('PATCH', `/api/score-deal?id=${encodeURIComponent(dealId)}`, { inputs, score });
}

// Delete a pipeline deal by ID.
export async function deletePipelineDeal(
  dealId: string,
  userId: string,
  orgId: string,
): Promise<SingleResult> {
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

  return { data: data as PipelineDealRow | null, error };
}
