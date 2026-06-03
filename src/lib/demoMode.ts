// Demo mode lives entirely in memory. Activated by ?demo=1 in the URL or
// by calling enableDemoMode() (used by the View Demo button on the landing page
// when the URL doesn't carry the param yet).

import { getInitialDemoPipeline } from '../data/demoPipeline';
import { addFrequency } from './covenants';
import type {
  DealInputs,
  AssetClass,
  CovenantSeed,
  CovenantRow,
  CovenantTestRow,
  FacilityRow,
  FacilityDetail,
  CovenantTestStatus,
  CreateFacilityParams,
  RecordTestParams,
} from '../types';

export interface DemoDeal {
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

interface CreateDemoDealParams {
  name: string;
  inputs: DealInputs;
  score: number | null;
  notes?: string;
  assetClass?: AssetClass;
}

let _enabled: boolean | null = null;
let _pipeline: DemoDeal[] | null = null;

function readFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1';
  } catch {
    return false;
  }
}

export function isDemoMode(): boolean {
  if (_enabled !== null) return _enabled;
  _enabled = readFromUrl();
  return _enabled;
}

export function enableDemoMode(): void {
  _enabled = true;
}

function store(): DemoDeal[] {
  if (_pipeline === null) _pipeline = getInitialDemoPipeline() as DemoDeal[];
  return _pipeline;
}

// Return a sorted copy. Pipeline UI expects most recently updated first.
export function listDemoPipeline(): DemoDeal[] {
  return [...store()].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function createDemoPipelineDeal({ name, inputs, score, notes = '', assetClass = 'equipment_finance' }: CreateDemoDealParams): DemoDeal {
  const now = new Date().toISOString();
  const deal: DemoDeal = {
    id: `demo-${Date.now()}`,
    org_id: 'demo-org',
    user_id: 'demo-user',
    name,
    stage: 'Screening',
    inputs,
    asset_class: assetClass,
    score,
    notes,
    created_at: now,
    updated_at: now,
  };
  store().unshift(deal);
  return { ...deal };
}

function patch(id: string, updates: Partial<DemoDeal>): DemoDeal | null {
  const deal = store().find((d) => d.id === id);
  if (!deal) return null;
  Object.assign(deal, updates, { updated_at: new Date().toISOString() });
  return { ...deal };
}

export function updateDemoPipelineStage(id: string, stage: string): DemoDeal | null {
  return patch(id, { stage });
}

export function updateDemoPipelineName(id: string, name: string): DemoDeal | null {
  return patch(id, { name });
}

export function updateDemoPipelineNotes(id: string, notes: string): DemoDeal | null {
  return patch(id, { notes });
}

export function updateDemoPipelineInputs(id: string, inputs: DealInputs, score: number | null): DemoDeal | null {
  return patch(id, { inputs, score });
}

export function deleteDemoPipelineDeal(id: string): DemoDeal | null {
  const arr = store();
  const idx = arr.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const [removed] = arr.splice(idx, 1);
  return removed;
}

// ───────────────────────────────────────────────────────────────
// Monitoring — facilities, covenants, covenant tests (in-memory demo)
// Mirrors src/lib/facilities.ts so the demo works without a backend.
// ───────────────────────────────────────────────────────────────

let _facilities: FacilityRow[] | null = null;
let _covenants: CovenantRow[] | null = null;
let _tests: CovenantTestRow[] | null = null;

function facilityStore(): FacilityRow[] { if (_facilities === null) _facilities = []; return _facilities; }
function covenantStore(): CovenantRow[] { if (_covenants === null) _covenants = []; return _covenants; }
function testStore(): CovenantTestRow[] { if (_tests === null) _tests = []; return _tests; }

export function createDemoFacility(orgId: string, userId: string, params: CreateFacilityParams): FacilityRow {
  const now = new Date().toISOString();
  const facility: FacilityRow = {
    id: `demo-fac-${Date.now()}`,
    org_id: orgId,
    pipeline_deal_id: params.pipelineDealId,
    user_id: userId,
    borrower_name: params.borrowerName,
    asset_class: params.assetClass,
    commitment_amount: params.commitmentAmount,
    status: 'active',
    funded_at: params.fundedAt,
    maturity_date: params.maturityDate,
    underwritten_snapshot: params.underwrittenSnapshot,
    created_at: now,
    updated_at: now,
  };
  facilityStore().unshift(facility);
  return { ...facility };
}

export function seedDemoCovenants(orgId: string, facilityId: string, seeds: CovenantSeed[]): CovenantRow[] {
  const now = new Date().toISOString();
  const start = now.slice(0, 10);
  const rows: CovenantRow[] = seeds.map((s, i) => ({
    ...s,
    id: `demo-cov-${Date.now()}-${i}`,
    org_id: orgId,
    facility_id: facilityId,
    next_test_date: addFrequency(start, s.test_frequency),
    active: true,
    created_at: now,
    updated_at: now,
  }));
  covenantStore().push(...rows);
  return rows.map((r) => ({ ...r }));
}

export function listDemoFacilities(orgId: string): FacilityRow[] {
  return facilityStore()
    .filter((f) => f.org_id === orgId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((f) => ({ ...f }));
}

export function getDemoFacilityDetail(id: string): FacilityDetail | null {
  const facility = facilityStore().find((f) => f.id === id);
  if (!facility) return null;
  const covenants = covenantStore().filter((c) => c.facility_id === id).map((c) => ({ ...c }));
  const tests = testStore()
    .filter((t) => t.facility_id === id)
    .sort((a, b) => (a.test_date < b.test_date ? 1 : -1))
    .map((t) => ({ ...t }));
  return { facility: { ...facility }, covenants, tests };
}

export function recordDemoCovenantTest(
  orgId: string,
  userId: string,
  covenant: CovenantRow,
  params: RecordTestParams,
  status: CovenantTestStatus,
  nextDate: string,
): CovenantTestRow {
  const now = new Date().toISOString();
  const test: CovenantTestRow = {
    id: `demo-test-${Date.now()}`,
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
    created_at: now,
  };
  testStore().push(test);
  const cov = covenantStore().find((c) => c.id === covenant.id);
  if (cov) { cov.next_test_date = nextDate; cov.updated_at = now; }
  return { ...test };
}

export function updateDemoCovenant(id: string, patch: Partial<CovenantRow>): CovenantRow | null {
  const cov = covenantStore().find((c) => c.id === id);
  if (!cov) return null;
  Object.assign(cov, patch, { updated_at: new Date().toISOString() });
  return { ...cov };
}

export function addDemoCovenant(orgId: string, facilityId: string, seed: CovenantSeed): CovenantRow {
  const now = new Date().toISOString();
  const row: CovenantRow = {
    ...seed,
    source: 'manual',
    id: `demo-cov-${Date.now()}`,
    org_id: orgId,
    facility_id: facilityId,
    next_test_date: null,
    active: true,
    created_at: now,
    updated_at: now,
  };
  covenantStore().push(row);
  return { ...row };
}

export function updateDemoFacility(id: string, patch: Partial<FacilityRow>): FacilityRow | null {
  const f = facilityStore().find((x) => x.id === id);
  if (!f) return null;
  Object.assign(f, patch, { updated_at: new Date().toISOString() });
  return { ...f };
}

export function listDemoCovenants(orgId: string): CovenantRow[] {
  return covenantStore().filter((c) => c.org_id === orgId).map((c) => ({ ...c }));
}

export function listDemoTests(orgId: string): CovenantTestRow[] {
  return testStore().filter((t) => t.org_id === orgId).map((t) => ({ ...t }));
}
