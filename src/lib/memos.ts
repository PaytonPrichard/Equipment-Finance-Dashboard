import { supabase } from './supabase';
import { logAudit } from './audit';
import { isDemoMode } from './demoMode';
import type { AssetClass } from '../types';

/**
 * A committee memo, frozen.
 *
 * The screening model is live: SOFR moves, criteria get retuned, scoring
 * gets corrected. That is right for screening and wrong for the record. A
 * memo taken to committee has to stay the memo taken to committee, so it is
 * stored two ways. `model` is everything needed to render it again, which
 * makes it comparable against the live deal. `html` is the artifact itself,
 * which makes it reproducible byte for byte no matter what the template
 * does later.
 */

export interface MemoModel {
  // The generateBrandedPdfHtml() argument bundle.
  summaryText?: string;
  inputs?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  riskScore?: { composite?: number } & Record<string, unknown>;
  recommendation?: unknown;
  screeningResult?: { verdict?: string } & Record<string, unknown>;
  orgName?: string;
  analystName?: string;
  moduleLabel?: string;
  moduleKey?: string;
  branding?: Record<string, unknown>;
  factors?: unknown[];
  structure?: unknown;
  stressResults?: unknown[];
  borrowerExtras?: unknown;
  criteria?: Record<string, unknown> | null;
  commentary?: unknown;
  sourceDocuments?: unknown[];

  // Ambient values the renderer used to read from live state. Without these
  // a re-render silently picks up today's rate and today's date.
  sofr?: number | null;
  sofrDate?: string | null;
  generatedAt?: string;
}

export interface DealMemoRow {
  id: string;
  org_id: string;
  deal_id: string;
  created_by: string;
  created_at: string;
  asset_class: AssetClass;
  model: MemoModel;
  html?: string;
  html_sha256: string | null;
  score: number | null;
  verdict: string | null;
  sofr: number | null;
  app_version: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

// Columns for list views. `html` is 50-150KB a row and is only needed when
// someone actually opens a memo, so it is fetched separately.
const LIST_COLUMNS =
  'id, org_id, deal_id, created_by, created_at, asset_class, model, html_sha256, score, verdict, sofr, app_version, profiles(full_name, email)';

/**
 * Best effort. crypto.subtle is unavailable outside a secure context and in
 * some test environments; a missing hash costs the drift badge, not the
 * memo, so it must not throw.
 */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const bytes = new TextEncoder().encode(text);
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

export interface CreateMemoParams {
  dealId: string;
  orgId: string;
  userId: string;
  assetClass: AssetClass;
  model: MemoModel;
  html: string;
  appVersion?: string;
}

export interface CreateMemoResult {
  data: DealMemoRow | null;
  /** True when an identical memo was already the latest, so nothing was written. */
  duplicate: boolean;
  error: unknown;
}

/**
 * Freeze the memo that was just generated.
 *
 * Deduped by content hash against the most recent memo for the deal:
 * downloading the same unchanged PDF three times before a meeting is one
 * memo, not three. A download after anything moved is a new one.
 *
 * Demo mode has no memo table and no persistence worth the name, so it
 * returns cleanly rather than erroring behind a PDF that downloaded fine.
 */
export async function createMemoSnapshot({
  dealId, orgId, userId, assetClass, model, html, appVersion,
}: CreateMemoParams): Promise<CreateMemoResult> {
  if (isDemoMode()) return { data: null, duplicate: false, error: null };
  if (!supabase) return { data: null, duplicate: false, error: null };
  if (!dealId || !orgId || !userId) return { data: null, duplicate: false, error: null };

  const hash = await sha256Hex(html);

  if (hash) {
    const { data: latest } = await supabase
      .from('deal_memos')
      .select('id, html_sha256')
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest && (latest as { html_sha256: string | null }).html_sha256 === hash) {
      return { data: null, duplicate: true, error: null };
    }
  }

  const score = typeof model.riskScore?.composite === 'number' ? model.riskScore.composite : null;
  const verdict = model.screeningResult?.verdict ? String(model.screeningResult.verdict).toUpperCase() : null;

  const { data, error } = await supabase
    .from('deal_memos')
    .insert({
      org_id: orgId,
      deal_id: dealId,
      created_by: userId,
      asset_class: assetClass,
      model,
      html,
      html_sha256: hash,
      score,
      verdict,
      sofr: model.sofr ?? null,
      app_version: appVersion || null,
    })
    .select(LIST_COLUMNS)
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'generate_memo', 'deal_memo', String((data as unknown as DealMemoRow).id), null, {
      deal_id: dealId, score, verdict, sofr: model.sofr ?? null,
    });
  }

  return { data: (data as unknown as DealMemoRow) || null, duplicate: false, error };
}

/** Memos for one deal, newest first. Without the HTML body. */
export async function fetchMemosForDeal(dealId: string): Promise<{ data: DealMemoRow[]; error: unknown }> {
  if (isDemoMode()) return { data: [], error: null };
  if (!supabase || !dealId) return { data: [], error: null };

  const { data, error } = await supabase
    .from('deal_memos')
    .select(LIST_COLUMNS)
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });

  return { data: (data as unknown as DealMemoRow[]) || [], error };
}

/** The stored artifact for one memo. */
export async function fetchMemoHtml(memoId: string): Promise<{ data: string | null; error: unknown }> {
  if (isDemoMode()) return { data: null, error: null };
  if (!supabase || !memoId) return { data: null, error: null };

  const { data, error } = await supabase
    .from('deal_memos')
    .select('html')
    .eq('id', memoId)
    .single();

  return { data: (data as { html: string } | null)?.html ?? null, error };
}

export interface MemoDrift {
  hasDrift: boolean;
  score: { then: number | null; now: number | null; changed: boolean };
  verdict: { then: string | null; now: string | null; changed: boolean };
  sofr: { then: number | null; now: number | null; changed: boolean };
}

/**
 * What has moved under a deal since its last memo.
 *
 * Scores are compared at whole points because that is the precision the
 * memo prints. SOFR is compared at a basis point: below that is noise, and
 * flagging it would train people to ignore the badge.
 *
 * Returns categories, not copy and not classes. The caller writes the
 * sentence.
 */
export function describeMemoDrift(
  memo: Pick<DealMemoRow, 'score' | 'verdict' | 'sofr'> | null | undefined,
  current: { score?: number | null; verdict?: string | null; sofr?: number | null },
): MemoDrift | null {
  if (!memo) return null;

  const round = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

  const thenScore = round(memo.score);
  const nowScore = round(current.score);
  const thenVerdict = memo.verdict ? memo.verdict.toUpperCase() : null;
  const nowVerdict = current.verdict ? String(current.verdict).toUpperCase() : null;
  const thenSofr = typeof memo.sofr === 'number' ? memo.sofr : null;
  const nowSofr = typeof current.sofr === 'number' ? current.sofr : null;

  const scoreChanged = thenScore !== null && nowScore !== null && thenScore !== nowScore;
  const verdictChanged = !!thenVerdict && !!nowVerdict && thenVerdict !== nowVerdict;
  const sofrChanged =
    thenSofr !== null && nowSofr !== null && Math.abs(thenSofr - nowSofr) >= 0.0001;

  return {
    hasDrift: scoreChanged || verdictChanged || sofrChanged,
    score: { then: thenScore, now: nowScore, changed: scoreChanged },
    verdict: { then: thenVerdict, now: nowVerdict, changed: verdictChanged },
    sofr: { then: thenSofr, now: nowSofr, changed: sofrChanged },
  };
}
