// Demo mode lives entirely in memory. Activated by ?demo=1 in the URL or
// by calling enableDemoMode() (used by the View Demo button on the landing page
// when the URL doesn't carry the param yet).

import { getInitialDemoPipeline } from '../data/demoPipeline';

let _enabled = null;
let _pipeline = null;

function readFromUrl() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === '1';
  } catch {
    return false;
  }
}

export function isDemoMode() {
  if (_enabled !== null) return _enabled;
  _enabled = readFromUrl();
  return _enabled;
}

export function enableDemoMode() {
  _enabled = true;
}

function store() {
  if (_pipeline === null) _pipeline = getInitialDemoPipeline();
  return _pipeline;
}

// Return a sorted copy. Pipeline UI expects most recently updated first.
export function listDemoPipeline() {
  return [...store()].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export function createDemoPipelineDeal({ name, inputs, score, notes = '' }) {
  const now = new Date().toISOString();
  const deal = {
    id: `demo-${Date.now()}`,
    org_id: 'demo-org',
    user_id: 'demo-user',
    name,
    stage: 'Screening',
    inputs,
    score,
    notes,
    created_at: now,
    updated_at: now,
  };
  store().unshift(deal);
  return { ...deal };
}

function patch(id, updates) {
  const deal = store().find((d) => d.id === id);
  if (!deal) return null;
  Object.assign(deal, updates, { updated_at: new Date().toISOString() });
  return { ...deal };
}

export function updateDemoPipelineStage(id, stage) {
  return patch(id, { stage });
}

export function updateDemoPipelineName(id, name) {
  return patch(id, { name });
}

export function updateDemoPipelineNotes(id, notes) {
  return patch(id, { notes });
}

export function updateDemoPipelineInputs(id, inputs, score) {
  return patch(id, { inputs, score });
}

export function deleteDemoPipelineDeal(id) {
  const arr = store();
  const idx = arr.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const [removed] = arr.splice(idx, 1);
  return removed;
}
