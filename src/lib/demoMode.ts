// Demo mode lives entirely in memory. Activated by ?demo=1 in the URL or
// by calling enableDemoMode() (used by the View Demo button on the landing page
// when the URL doesn't carry the param yet).

import { getInitialDemoPipeline } from '../data/demoPipeline';
import type { DealInputs, AssetClass } from '../types';

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
