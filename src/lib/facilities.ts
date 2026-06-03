// ============================================================
// Facilities — data access for post-close monitoring.
//
// Mirrors src/lib/pipeline.ts. A funded pipeline deal becomes a facility with
// covenants seeded from the underwrite. Covenant test status is deterministic
// (evaluateCovenantTest), so writes go direct through RLS plus logAudit — no
// serverless round-trip needed in Phase 1. See Monitoring_Phase1_Design.md.
// ============================================================

import { supabase } from './supabase';
import { logAudit } from './audit';
import { evaluateCovenantTest, addFrequency } from './covenants';
import {
  isDemoMode,
  createDemoFacility,
  seedDemoCovenants,
  listDemoFacilities,
  getDemoFacilityDetail,
  recordDemoCovenantTest,
  updateDemoCovenant,
  addDemoCovenant,
  updateDemoFacility,
  listDemoCovenants,
  listDemoTests,
} from './demoMode';
import type {
  CovenantSeed,
  CovenantRow,
  CovenantTestRow,
  CovenantTestStatus,
  FacilityRow,
  FacilityDetail,
  FacilityStatus,
  CreateFacilityParams,
  RecordTestParams,
} from '../types';

interface Result<T> {
  data: T;
  error: unknown;
}

// Create a facility from a funded deal. The caller builds the underwritten
// snapshot (inputs + metrics + criteria) since that requires the active module.
export async function createFacility(
  orgId: string,
  userId: string,
  params: CreateFacilityParams,
): Promise<Result<FacilityRow | null>> {
  if (isDemoMode()) return { data: createDemoFacility(orgId, userId, params), error: null };
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('facilities')
    .insert({
      org_id: orgId,
      user_id: userId,
      pipeline_deal_id: params.pipelineDealId,
      borrower_name: params.borrowerName,
      asset_class: params.assetClass,
      commitment_amount: params.commitmentAmount,
      funded_at: params.fundedAt,
      maturity_date: params.maturityDate,
      underwritten_snapshot: params.underwrittenSnapshot,
    })
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'create_facility', 'facility', String((data as FacilityRow).id), null, data);
  }
  return { data: (data as FacilityRow) || null, error };
}

// Write the confirmed covenant set for a facility (bulk insert from the setup screen).
export async function seedFacilityCovenants(
  orgId: string,
  userId: string,
  facilityId: string,
  seeds: CovenantSeed[],
): Promise<Result<CovenantRow[]>> {
  if (isDemoMode()) return { data: seedDemoCovenants(orgId, facilityId, seeds), error: null };
  if (!supabase) return { data: [], error: null };

  // First test is due one period out, so a covenant reads "overdue" if that
  // date passes with no test recorded.
  const start = new Date().toISOString().slice(0, 10);
  const rows = seeds.map((s) => ({
    ...s, org_id: orgId, facility_id: facilityId, next_test_date: addFrequency(start, s.test_frequency),
  }));
  const { data, error } = await supabase.from('covenants').insert(rows).select();

  if (!error && data) {
    logAudit(userId, orgId, 'seed_covenants', 'facility', String(facilityId), null, { count: (data as CovenantRow[]).length });
  }
  return { data: (data as CovenantRow[]) || [], error };
}

// All facilities for an org, most recently updated first.
export async function fetchFacilities(orgId: string): Promise<Result<FacilityRow[]>> {
  if (isDemoMode()) return { data: listDemoFacilities(orgId), error: null };
  if (!supabase) return { data: [], error: null };

  const { data, error } = await supabase
    .from('facilities')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  return { data: (data as FacilityRow[]) || [], error };
}

// A facility plus its covenants and recorded tests, for the monitor view.
export async function fetchFacility(id: string): Promise<Result<FacilityDetail | null>> {
  if (isDemoMode()) return { data: getDemoFacilityDetail(id), error: null };
  if (!supabase) return { data: null, error: null };

  const { data: facility, error: fErr } = await supabase.from('facilities').select('*').eq('id', id).single();
  if (fErr || !facility) return { data: null, error: fErr };

  const { data: covenants, error: cErr } = await supabase
    .from('covenants').select('*').eq('facility_id', id).order('id', { ascending: true });
  if (cErr) return { data: null, error: cErr };

  const { data: tests, error: tErr } = await supabase
    .from('covenant_tests').select('*').eq('facility_id', id).order('test_date', { ascending: false });
  if (tErr) return { data: null, error: tErr };

  return {
    data: {
      facility: facility as FacilityRow,
      covenants: (covenants as CovenantRow[]) || [],
      tests: (tests as CovenantTestRow[]) || [],
    },
    error: null,
  };
}

// Record a covenant test. Status is computed from the reported value or the
// deliverable's timeliness, unless the lender is recording a waiver. Recording
// rolls the covenant's next test date forward by its frequency.
export async function recordCovenantTest(
  orgId: string,
  userId: string,
  covenant: CovenantRow,
  params: RecordTestParams,
): Promise<Result<CovenantTestRow | null>> {
  const status: CovenantTestStatus = params.waived
    ? 'waived'
    : evaluateCovenantTest(covenant, {
        reportedValue: params.reportedValue ?? null,
        submittedAt: params.submittedAt ?? null,
        dueDate: params.dueDate ?? null,
        asOf: params.asOf ?? params.testDate,
      });

  const nextDate = addFrequency(params.testDate, covenant.test_frequency);

  if (isDemoMode()) {
    return { data: recordDemoCovenantTest(orgId, userId, covenant, params, status, nextDate), error: null };
  }
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('covenant_tests')
    .insert({
      org_id: orgId,
      facility_id: covenant.facility_id,
      covenant_id: covenant.id,
      test_date: params.testDate,
      due_date: params.dueDate ?? null,
      reported_value: params.reportedValue ?? null,
      submitted_at: params.submittedAt ?? null,
      status,
      note: params.note ?? '',
      created_by: userId,
    })
    .select()
    .single();

  if (!error && data) {
    await supabase
      .from('covenants')
      .update({ next_test_date: nextDate, updated_at: new Date().toISOString() })
      .eq('id', covenant.id);
    logAudit(
      userId, orgId,
      params.waived ? 'waive_covenant' : 'record_test',
      'covenant_test', String((data as CovenantTestRow).id), null, data,
    );
  }
  return { data: (data as CovenantTestRow) || null, error };
}

// Edit a covenant (threshold, frequency, cure days, active flag) against the
// signed agreement. History is immutable, so this does not re-evaluate past tests.
export async function updateCovenant(
  orgId: string,
  userId: string,
  covenantId: string,
  patch: Partial<CovenantRow>,
): Promise<Result<CovenantRow | null>> {
  if (isDemoMode()) return { data: updateDemoCovenant(covenantId, patch), error: null };
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('covenants')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', covenantId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'update_covenant', 'covenant', String(covenantId), null, patch);
  }
  return { data: (data as CovenantRow) || null, error };
}

// Add a single lender-defined covenant to an existing facility.
export async function addCovenant(
  orgId: string,
  userId: string,
  facilityId: string,
  seed: CovenantSeed,
): Promise<Result<CovenantRow | null>> {
  if (isDemoMode()) return { data: addDemoCovenant(orgId, facilityId, seed), error: null };
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('covenants')
    .insert({ ...seed, source: 'manual', org_id: orgId, facility_id: facilityId })
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'update_covenant', 'covenant', String((data as CovenantRow).id), null, data);
  }
  return { data: (data as CovenantRow) || null, error };
}

// Deactivate a covenant (stops prompting for tests) without deleting its history.
export function deactivateCovenant(orgId: string, userId: string, covenantId: string): Promise<Result<CovenantRow | null>> {
  return updateCovenant(orgId, userId, covenantId, { active: false });
}

// Change a facility's lifecycle status (active / closed / defaulted).
export async function updateFacilityStatus(
  orgId: string,
  userId: string,
  facilityId: string,
  status: FacilityStatus,
): Promise<Result<FacilityRow | null>> {
  if (isDemoMode()) return { data: updateDemoFacility(facilityId, { status }), error: null };
  if (!supabase) return { data: null, error: null };

  const { data, error } = await supabase
    .from('facilities')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', facilityId)
    .select()
    .single();

  if (!error && data) {
    logAudit(userId, orgId, 'close_facility', 'facility', String(facilityId), null, { status });
  }
  return { data: (data as FacilityRow) || null, error };
}

// Worst active-covenant status per facility, for the portfolio rollup.
// Returns a map of facility id -> 'fail' | 'flag' | 'pass' | 'awaiting'.
// Worst wins: any fail outranks any flag outranks any pass; a facility whose
// covenants have no tests yet shows 'awaiting'. Waived covenants don't count.
export async function fetchPortfolioStatuses(orgId: string): Promise<Result<Record<string, string>>> {
  let covenants: { id: string | number; facility_id: string | number; next_test_date: string | null }[];
  let tests: { covenant_id: string | number; status: string; test_date: string }[];

  if (isDemoMode()) {
    covenants = listDemoCovenants(orgId).filter((c) => c.active);
    tests = listDemoTests(orgId);
  } else {
    if (!supabase) return { data: {}, error: null };
    const { data: cov, error: cErr } = await supabase
      .from('covenants').select('id, facility_id, next_test_date').eq('org_id', orgId).eq('active', true);
    if (cErr) return { data: {}, error: cErr };
    const { data: tst, error: tErr } = await supabase
      .from('covenant_tests').select('covenant_id, status, test_date').eq('org_id', orgId).order('test_date', { ascending: false });
    if (tErr) return { data: {}, error: tErr };
    covenants = (cov as typeof covenants) || [];
    tests = (tst as typeof tests) || [];
  }

  // Latest status per covenant (tests already sorted most recent first).
  const latest: Record<string, string> = {};
  for (const t of tests) {
    const k = String(t.covenant_id);
    if (!(k in latest)) latest[k] = t.status;
  }

  // An open breach outranks an overdue test, which outranks a clean reading.
  const todayStr = new Date().toISOString().slice(0, 10);
  const rank: Record<string, number> = { fail: 4, flag: 3, overdue: 2, pass: 1 };
  const worst: Record<string, { r: number; st: string }> = {};
  for (const c of covenants) {
    const t = latest[String(c.id)];
    let st: string;
    if (t === 'fail' || t === 'flag') st = t;
    else if (c.next_test_date && c.next_test_date < todayStr) st = 'overdue';
    else st = t || 'awaiting';

    const r = rank[st] || 0;
    const fid = String(c.facility_id);
    if (!worst[fid] || r > worst[fid].r) worst[fid] = { r, st };
  }

  const map: Record<string, string> = {};
  for (const fid of Object.keys(worst)) {
    map[fid] = worst[fid].r > 0 ? worst[fid].st : 'awaiting';
  }
  return { data: map, error: null };
}

// Maps a covenant metric_key to its field in the underwrite snapshot's metrics,
// with the unit conversion to reach the covenant's display unit (LTV, dilution,
// etc. are stored as fractions in the metrics but as percents on the covenant).
const UNDERWRITTEN_METRIC: Record<string, { field: string; toPercent?: boolean }> = {
  dscr: { field: 'dscr' },
  leverage: { field: 'leverage' },
  ltv: { field: 'ltv', toPercent: true },
  termCoverage: { field: 'termCoverage' },
  concentration: { field: 'concentrationRisk', toPercent: true },
  dilution: { field: 'dilutionRate', toPercent: true },
  turnover: { field: 'turnoverRatio' },
  obsolescence: { field: 'obsolescenceRate', toPercent: true },
};

function extractUnderwritten(metricKey: string | null, snapshot: Record<string, unknown> | null | undefined): number | null {
  if (!metricKey) return null;
  const m = UNDERWRITTEN_METRIC[metricKey];
  if (!m || !snapshot) return null;
  const metrics = snapshot.metrics as Record<string, unknown> | undefined;
  const v = metrics ? metrics[m.field] : undefined;
  if (typeof v !== 'number' || !isFinite(v)) return null;
  return m.toPercent ? v * 100 : v;
}

export interface DriftRow {
  facilityId: string;
  borrowerName: string;
  covenantName: string;
  direction: 'min' | 'max' | null;
  unit: string | null;
  underwritten: number | null;   // in the covenant's unit
  current: number | null;        // latest reported value
  threshold: number | null;      // covenant flag boundary
}

// One row per active financial covenant: what we underwrote vs the latest
// reported value vs the covenant threshold. Powers the drift dashboard.
export async function fetchPortfolioDrift(orgId: string): Promise<Result<DriftRow[]>> {
  let facilities: { id: string | number; borrower_name: string; underwritten_snapshot: Record<string, unknown> }[];
  let covenants: { id: string | number; facility_id: string | number; name: string; metric_key: string | null; direction: 'min' | 'max' | null; unit: string | null; flag_value: number | null; kind: string }[];
  let tests: { covenant_id: string | number; reported_value: number | null; test_date: string }[];

  if (isDemoMode()) {
    facilities = listDemoFacilities(orgId);
    covenants = listDemoCovenants(orgId).filter((c) => c.active && c.kind === 'financial');
    tests = listDemoTests(orgId);
  } else {
    if (!supabase) return { data: [], error: null };
    const { data: f, error: fErr } = await supabase
      .from('facilities').select('id, borrower_name, underwritten_snapshot').eq('org_id', orgId);
    if (fErr) return { data: [], error: fErr };
    const { data: c, error: cErr } = await supabase
      .from('covenants').select('id, facility_id, name, metric_key, direction, unit, flag_value, kind')
      .eq('org_id', orgId).eq('active', true).eq('kind', 'financial');
    if (cErr) return { data: [], error: cErr };
    const { data: t, error: tErr } = await supabase
      .from('covenant_tests').select('covenant_id, reported_value, test_date').eq('org_id', orgId).order('test_date', { ascending: false });
    if (tErr) return { data: [], error: tErr };
    facilities = (f as typeof facilities) || [];
    covenants = (c as typeof covenants) || [];
    tests = (t as typeof tests) || [];
  }

  const facById: Record<string, typeof facilities[number]> = {};
  for (const f of facilities) facById[String(f.id)] = f;

  const latestVal: Record<string, number | null> = {};
  for (const t of tests) {
    const k = String(t.covenant_id);
    if (!(k in latestVal)) latestVal[k] = t.reported_value;
  }

  const rows: DriftRow[] = [];
  for (const c of covenants) {
    if (!c.metric_key) continue;
    const f = facById[String(c.facility_id)];
    if (!f) continue;
    rows.push({
      facilityId: String(c.facility_id),
      borrowerName: f.borrower_name,
      covenantName: c.name,
      direction: c.direction,
      unit: c.unit,
      underwritten: extractUnderwritten(c.metric_key, f.underwritten_snapshot),
      current: latestVal[String(c.id)] ?? null,
      threshold: c.flag_value,
    });
  }
  return { data: rows, error: null };
}
