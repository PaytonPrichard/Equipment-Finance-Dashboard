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
  // Set on every stage change. "Days in stage" reads this, not updated_at,
  // so editing a note no longer resets a deal's aging clock.
  stage_entered_at?: string | null;
  /**
   * Which document supplied each field. Null for a deal typed in by hand,
   * which is a meaningful state rather than a missing one.
   */
  extraction_provenance?: unknown;
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
  extractionProvenance: unknown = null,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = createDemoPipelineDeal({ name, inputs, score, assetClass, extractionProvenance });
    return { data: deal, error: null };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('POST', '/api/score-deal', {
    name, inputs, asset_class: assetClass, notes: '',
    extraction_provenance: extractionProvenance,
  });
}

// Move a pipeline deal to a new stage. Goes through the server, which
// checks the stage permission, writes the audit row and fires the
// pipeline.stage_changed webhook. userId and orgId are kept for existing
// callers; the server takes both from the session.
export async function updatePipelineStage(
  dealId: string,
  newStage: string,
  _userId?: string,
  _orgId?: string,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = updateDemoPipelineStage(dealId, newStage);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  return callScoreDeal('PATCH', `/api/score-deal?id=${encodeURIComponent(dealId)}&action=stage`, { stage: newStage });
}

// Rename a pipeline deal.
//
// Audited, unlike before: stage changes and deletes wrote to audit_log but
// renames did not, so a deal could be relabelled between screening and
// committee with nothing recording it. userId and orgId are optional so the
// existing call sites keep working; without them the write still happens and
// only the log is skipped.
export async function updatePipelineName(
  dealId: string,
  name: string,
  userId?: string,
  orgId?: string,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = updateDemoPipelineName(dealId, name);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  const { data: existing } = await supabase
    .from('pipeline_deals')
    .select('name')
    .eq('id', dealId)
    .single();
  const oldName = (existing as { name: string } | null)?.name ?? null;

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data && userId && orgId) {
    logAudit(userId, orgId, 'update', 'pipeline_deal', dealId, { name: oldName }, { name });
  }

  return { data: data as PipelineDealRow | null, error };
}

// Update notes on a pipeline deal.
//
// Each save overwrites the previous note outright. There is no note history,
// so the audit entry carrying the old text is the only record that a note
// ever said something else.
export async function updatePipelineNotes(
  dealId: string,
  notes: string,
  userId?: string,
  orgId?: string,
): Promise<SingleResult> {
  if (isDemoMode()) {
    const deal = updateDemoPipelineNotes(dealId, notes);
    return { data: deal, error: deal ? null : { message: 'Deal not found' } };
  }
  if (!supabase) return { data: null, error: null };

  const { data: existing } = await supabase
    .from('pipeline_deals')
    .select('notes')
    .eq('id', dealId)
    .single();
  const oldNotes = (existing as { notes: string } | null)?.notes ?? '';

  const { data, error } = await supabase
    .from('pipeline_deals')
    .update({ notes, updated_at: new Date().toISOString() })
    .eq('id', dealId)
    .select()
    .single();

  if (!error && data && userId && orgId && oldNotes !== notes) {
    logAudit(userId, orgId, 'update', 'pipeline_deal', dealId, { notes: oldNotes }, { notes });
  }

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

export interface RulesRebuildPreview {
  count: number;
  deals: { id: string; name: string; stage: string }[];
}

export interface RulesRebuildResult {
  rebuilt: { id: string; name: string; oldScore: number | null; newScore: number | null; changed: string[] }[];
  skipped: { id: string; name: string; reason: string }[];
}

/**
 * Bulk rebuild of Screening and Under Review deals with the firm's current
 * treatment rules. Admin only, enforced on the server. `dryRun` returns the
 * deals it would touch, for the confirmation dialog.
 */
export async function rebuildDealsWithFirmRules(dryRun: true): Promise<{ data: RulesRebuildPreview | null; error: { message: string } | null }>;
export async function rebuildDealsWithFirmRules(dryRun: false): Promise<{ data: RulesRebuildResult | null; error: { message: string } | null }>;
export async function rebuildDealsWithFirmRules(dryRun: boolean): Promise<{ data: RulesRebuildPreview | RulesRebuildResult | null; error: { message: string } | null }> {
  if (isDemoMode() || !supabase) return { data: dryRun ? { count: 0, deals: [] } : { rebuilt: [], skipped: [] }, error: null };
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { data: null, error: { message: 'Not authenticated' } };
  try {
    const res = await fetch(`/api/score-deal?action=rebuild-rules${dryRun ? '&dryRun=1' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: '{}',
    });
    let payload: any = null;
    try { payload = await res.json(); } catch { payload = null; }
    if (!res.ok) return { data: null, error: { message: payload?.error || `HTTP ${res.status}` } };
    return { data: payload, error: null };
  } catch (err: unknown) {
    return { data: null, error: { message: (err as Error).message || 'Network error' } };
  }
}
