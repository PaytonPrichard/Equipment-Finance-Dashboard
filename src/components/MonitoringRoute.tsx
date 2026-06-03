// ============================================================
// Monitoring Route — post-close facility monitoring (lender-side).
//
// Three internal views: a portfolio list, a covenant setup screen off a funded
// deal, and a facility detail view. Covenants are seeded from the screening
// assumptions via the active module's getDefaultCovenants, then edited against
// the signed agreement before they are written. See Monitoring_Phase1_Design.md.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { getModule } from '../modules';
import { DEFAULT_CRITERIA } from '../lib/screeningCriteria';
import { fetchPipelineDeals } from '../lib/pipeline';
import type { PipelineDealRow } from '../lib/pipeline';
import {
  fetchFacilities,
  fetchFacility,
  createFacility,
  seedFacilityCovenants,
  recordCovenantTest,
  fetchPortfolioStatuses,
  fetchPortfolioDrift,
  updateFacilityStatus,
} from '../lib/facilities';
import type { DriftRow } from '../lib/facilities';
import { fetchFacilityAttachments } from '../lib/facilityAttachments';
import type { FacilityAttachmentRow } from '../lib/facilityAttachments';
import FacilityAttachments from './FacilityAttachments';
import { formatCurrencyFull } from '../utils/format';
import type {
  FacilityRow,
  FacilityDetail,
  CovenantSeed,
  CovenantRow,
  CovenantTestRow,
  TestFrequency,
  CovenantUnit,
  CovenantDirection,
} from '../types';

// ---- Presentation maps (component layer; logic stays category-only) ----

const STATUS: Record<string, { label: string; cls: string }> = {
  pass:     { label: 'Pass',     cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' },
  flag:     { label: 'Flag',     cls: 'bg-amber-500/10 border-amber-500/30 text-amber-600' },
  fail:     { label: 'Fail',     cls: 'bg-rose-500/10 border-rose-500/30 text-rose-600' },
  overdue:  { label: 'Overdue',  cls: 'bg-orange-50 border-orange-300 text-orange-700' },
  waived:   { label: 'Waived',   cls: 'bg-gray-100 border-gray-200 text-gray-500' },
  awaiting: { label: 'Awaiting', cls: 'bg-gray-100 border-gray-200 text-gray-500' },
};

const ASSET_LABEL: Record<string, string> = {
  equipment_finance: 'Equipment finance',
  accounts_receivable: 'Accounts receivable',
  inventory_finance: 'Inventory finance',
};

const FREQ_LABEL: Record<TestFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semiannual',
  annual: 'Annual',
};

const FREQ_OPTIONS: TestFrequency[] = ['monthly', 'quarterly', 'semiannual', 'annual'];

function StatusBadge({ status }: { status: string }): React.ReactElement {
  const s = STATUS[status] || STATUS.awaiting;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// Format a covenant's target for display (e.g. "≥ 1.25x", "≤ 25%", "Monthly").
function formatTarget(c: CovenantSeed | CovenantRow): string {
  if (c.kind === 'reporting') return FREQ_LABEL[c.test_frequency];
  if (c.flag_value == null) return '—';
  const v =
    c.unit === 'percent' ? `${c.flag_value}%`
    : c.unit === 'ratio' ? `${c.flag_value}x`
    : c.unit === 'currency' ? formatCurrencyFull(c.flag_value)
    : String(c.flag_value);
  return `${c.direction === 'min' ? '≥' : '≤'} ${v}`;
}

// Format a recorded reported value with the covenant's unit (e.g. "1.18x", "27%").
function formatValue(c: CovenantRow, v: number): string {
  return c.unit === 'percent' ? `${v}%`
    : c.unit === 'ratio' ? `${v}x`
    : c.unit === 'currency' ? formatCurrencyFull(v)
    : String(v);
}

const today = (): string => new Date().toISOString().slice(0, 10);

// ============================================================
// Top-level route
// ============================================================

type View =
  | { name: 'list' }
  | { name: 'setup'; deal: PipelineDealRow }
  | { name: 'detail'; id: string };

interface MonitoringRouteProps {
  sofr: number;
}

export default function MonitoringRoute({ sofr }: MonitoringRouteProps): React.ReactElement {
  const { user, profile } = useAuth();
  const orgId = profile?.org_id || '';
  const userId = user?.id || '';

  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [fundedDeals, setFundedDeals] = useState<PipelineDealRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [drift, setDrift] = useState<DriftRow[]>([]);
  const [listTab, setListTab] = useState<'facilities' | 'performance'>('facilities');
  const [view, setView] = useState<View>({ name: 'list' });

  const reload = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const [{ data: facs }, { data: deals }, { data: stat }, { data: dr }] = await Promise.all([
      fetchFacilities(orgId),
      fetchPipelineDeals(orgId),
      fetchPortfolioStatuses(orgId),
      fetchPortfolioDrift(orgId),
    ]);
    setFacilities(facs);
    setFundedDeals(deals.filter((d) => d.stage === 'Funded'));
    setStatuses(stat);
    setDrift(dr);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { reload(); }, [reload]);

  if (!orgId) {
    return <p className="text-sm text-gray-500 py-12 text-center">Sign in to an organization to monitor facilities.</p>;
  }

  if (view.name === 'setup') {
    return (
      <SetupView
        deal={view.deal}
        sofr={sofr}
        orgId={orgId}
        userId={userId}
        onCancel={() => setView({ name: 'list' })}
        onCreated={async (facilityId) => { await reload(); setView({ name: 'detail', id: facilityId }); }}
      />
    );
  }

  if (view.name === 'detail') {
    return <DetailView id={view.id} orgId={orgId} userId={userId} onBack={() => setView({ name: 'list' })} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Monitoring</h2>
        <p className="text-sm text-gray-500 mt-0.5">Covenants and reporting for funded facilities.</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200 w-fit">
        {([['facilities', 'Facilities'], ['performance', 'Performance']] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setListTab(id)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
              listTab === id ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {listTab === 'facilities' ? (
        <ListView
          loading={loading}
          facilities={facilities}
          fundedDeals={fundedDeals}
          statuses={statuses}
          onSetup={(deal) => setView({ name: 'setup', deal })}
          onOpen={(id) => setView({ name: 'detail', id })}
        />
      ) : (
        <DriftView loading={loading} rows={drift} onOpen={(id) => setView({ name: 'detail', id })} />
      )}
    </div>
  );
}

// ============================================================
// List view — portfolio + funded deals awaiting setup
// ============================================================

interface ListViewProps {
  loading: boolean;
  facilities: FacilityRow[];
  fundedDeals: PipelineDealRow[];
  statuses: Record<string, string>;
  onSetup: (deal: PipelineDealRow) => void;
  onOpen: (id: string) => void;
}

function ListView({ loading, facilities, fundedDeals, statuses, onSetup, onOpen }: ListViewProps): React.ReactElement {
  const monitoredDealIds = new Set(
    facilities.map((f) => (f.pipeline_deal_id != null ? String(f.pipeline_deal_id) : null)).filter(Boolean),
  );
  const awaiting = fundedDeals.filter((d) => !monitoredDealIds.has(String(d.id)));

  if (loading) {
    return <p className="text-sm text-gray-500 py-12 text-center">Loading facilities...</p>;
  }

  return (
    <div className="space-y-8">
      {awaiting.length > 0 && (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
            Funded deals awaiting setup
          </h3>
          <div className="space-y-2">
            {awaiting.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.inputs.companyName || d.name}</p>
                  <p className="text-[11px] text-gray-400">{ASSET_LABEL[d.asset_class] || d.asset_class}</p>
                </div>
                <button
                  onClick={() => onSetup(d)}
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-lg bg-gold-500 text-white text-xs font-semibold hover:bg-gold-600 transition-colors"
                >
                  Set up monitoring
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Active facilities
        </h3>
        {facilities.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
            <p className="text-sm text-gray-500">No facilities yet.</p>
            <p className="text-[11px] text-gray-400 mt-1">Fund a deal in the pipeline, then set up monitoring here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {facilities.map((f) => (
              <button
                key={f.id}
                onClick={() => onOpen(f.id)}
                className="w-full flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-gray-300 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{f.borrower_name}</p>
                  <p className="text-[11px] text-gray-400">
                    {ASSET_LABEL[f.asset_class] || f.asset_class}
                    {f.funded_at ? ` · funded ${f.funded_at}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm text-gray-700 tabular-nums">
                    {f.commitment_amount != null ? formatCurrencyFull(f.commitment_amount) : '—'}
                  </span>
                  <StatusBadge status={statuses[String(f.id)] || 'awaiting'} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// Drift view — current covenant readings vs what we underwrote
// ============================================================

function formatByUnit(v: number, unit: string | null): string {
  if (unit === 'percent') return `${v.toFixed(0)}%`;
  if (unit === 'ratio') return `${v.toFixed(2)}x`;
  if (unit === 'currency') return formatCurrencyFull(v);
  return String(v);
}

const DRIFT_COLS = 'grid grid-cols-[1.5fr_0.9fr_0.9fr_0.9fr_1fr] gap-2';

interface DriftViewProps {
  loading: boolean;
  rows: DriftRow[];
  onOpen: (id: string) => void;
}

function DriftView({ loading, rows, onOpen }: DriftViewProps): React.ReactElement {
  if (loading) return <p className="text-sm text-gray-500 py-12 text-center">Loading performance...</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center">
        <p className="text-sm text-gray-500">Nothing to compare yet.</p>
        <p className="text-[11px] text-gray-400 mt-1">Record covenant tests to see how facilities are tracking against the underwrite.</p>
      </div>
    );
  }

  // Score by drift in the breaching direction: deteriorations to the top,
  // improvements below, rows missing data last.
  const scored = rows.map((r) => {
    let score = -Infinity;
    if (r.current != null && r.underwritten != null && r.underwritten !== 0 && r.direction) {
      const rel = (r.current - r.underwritten) / Math.abs(r.underwritten);
      const worsened = r.direction === 'min' ? rel < 0 : rel > 0;
      score = worsened ? Math.abs(rel) : -Math.abs(rel);
    }
    return { r, score };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className={`${DRIFT_COLS} px-4 py-2.5 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400`}>
        <span>Facility / covenant</span>
        <span className="text-right">Underwrote</span>
        <span className="text-right">Current</span>
        <span className="text-right">Covenant</span>
        <span className="text-right">Drift</span>
      </div>
      {scored.map(({ r, score }, i) => {
        const hasBoth = r.current != null && r.underwritten != null;
        const driftCls = !hasBoth ? 'text-gray-400' : score > 0 ? 'text-rose-600' : score < 0 ? 'text-emerald-600' : 'text-gray-500';
        const delta = hasBoth ? r.current! - r.underwritten! : null;
        const driftLabel = delta == null ? '—' : `${delta > 0 ? '+' : ''}${formatByUnit(delta, r.unit)}`;
        return (
          <button
            key={i}
            onClick={() => onOpen(r.facilityId)}
            className={`${DRIFT_COLS} w-full px-4 py-2.5 border-b border-gray-50 last:border-b-0 text-left items-center hover:bg-gray-50/50 transition-colors`}
          >
            <span className="min-w-0">
              <span className="block text-sm text-gray-900 truncate">{r.borrowerName}</span>
              <span className="block text-[11px] text-gray-400 truncate">{r.covenantName}</span>
            </span>
            <span className="text-right text-sm text-gray-500 tabular-nums">{r.underwritten != null ? formatByUnit(r.underwritten, r.unit) : '—'}</span>
            <span className="text-right text-sm text-gray-900 tabular-nums">{r.current != null ? formatByUnit(r.current, r.unit) : '—'}</span>
            <span className="text-right text-[11px] text-gray-400 tabular-nums">{r.threshold != null ? formatByUnit(r.threshold, r.unit) : '—'}</span>
            <span className={`text-right text-sm tabular-nums ${driftCls}`}>{driftLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Setup view — seed covenants from the underwrite, edit, confirm
// ============================================================

interface SetupViewProps {
  deal: PipelineDealRow;
  sofr: number;
  orgId: string;
  userId: string;
  onCancel: () => void;
  onCreated: (facilityId: string) => void;
}

function SetupView({ deal, sofr, orgId, userId, onCancel, onCreated }: SetupViewProps): React.ReactElement {
  const { addToast } = useToast();

  // Compute the underwrite snapshot and seed covenants from the active module.
  const mod = getModule(deal.asset_class);
  const metrics = mod.calculateMetrics(deal.inputs, sofr);
  const riskScore = mod.calculateRiskScore(deal.inputs, metrics);
  const derivedCommitment: number | null =
    (metrics.netFinanced ?? metrics.borrowingBase ?? null);

  const [seeds, setSeeds] = useState<CovenantSeed[]>(
    () => mod.getDefaultCovenants(deal.inputs, metrics, DEFAULT_CRITERIA),
  );
  const [commitment, setCommitment] = useState<string>(
    derivedCommitment != null ? String(Math.round(derivedCommitment)) : '',
  );
  const [saving, setSaving] = useState(false);

  const borrowerName = deal.inputs.companyName || deal.name;

  const patchSeed = (i: number, patch: Partial<CovenantSeed>) =>
    setSeeds((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const removeSeed = (i: number) => setSeeds((prev) => prev.filter((_, idx) => idx !== i));

  async function handleConfirm(): Promise<void> {
    if (seeds.length === 0) { addToast('Add at least one covenant', 'warning'); return; }
    setSaving(true);

    const snapshot = {
      inputs: deal.inputs,
      metrics,
      score: riskScore.composite,
      criteria: DEFAULT_CRITERIA,
      captured_at: new Date().toISOString(),
    };

    const { data: facility, error } = await createFacility(orgId, userId, {
      pipelineDealId: deal.id,
      borrowerName,
      assetClass: deal.asset_class,
      commitmentAmount: commitment ? Number(commitment) : null,
      fundedAt: today(),
      maturityDate: null,
      underwrittenSnapshot: snapshot,
    });

    if (error || !facility) {
      addToast('Could not create the facility', 'error');
      setSaving(false);
      return;
    }

    const { error: seedErr } = await seedFacilityCovenants(orgId, userId, facility.id, seeds);
    if (seedErr) {
      addToast('Facility created, but covenants failed to save', 'warning');
    } else {
      addToast(`Monitoring started for ${borrowerName}`, 'success');
    }
    setSaving(false);
    onCreated(facility.id);
  }

  const financial = seeds.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'financial');
  const reporting = seeds.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'reporting');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button onClick={onCancel} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors mb-2">
          ← Back to monitoring
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Set up monitoring</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {borrowerName}. Covenants are pre-filled from what you screened. Confirm them against the signed agreement.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">
          Facility commitment
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">$</span>
          <input
            type="number"
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="Commitment amount"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gold-500 focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Pre-filled from the underwrite. Edit to match the agreement.</p>
      </div>

      <CovenantEditor title="Financial covenants" rows={financial} onPatch={patchSeed} onRemove={removeSeed} />
      <CovenantEditor title="Reporting covenants" rows={reporting} onPatch={patchSeed} onRemove={removeSeed} />
      <AddCovenantForm onAdd={(seed) => setSeeds((prev) => [...prev, seed])} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-gold-500 text-white text-sm font-semibold hover:bg-gold-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Creating...' : 'Start monitoring'}
        </button>
      </div>
    </div>
  );
}

interface CovenantEditorProps {
  title: string;
  rows: { s: CovenantSeed; i: number }[];
  onPatch: (i: number, patch: Partial<CovenantSeed>) => void;
  onRemove: (i: number) => void;
}

function CovenantEditor({ title, rows, onPatch, onRemove }: CovenantEditorProps): React.ReactElement | null {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.map(({ s, i }) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
              {s.kind === 'financial' && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-gray-400">{s.direction === 'min' ? '≥' : '≤'}</span>
                  <input
                    type="number"
                    value={s.flag_value ?? ''}
                    onChange={(e) => onPatch(i, { flag_value: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-900 tabular-nums focus:border-gold-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-gray-400">
                    {s.unit === 'percent' ? '%' : s.unit === 'ratio' ? 'x' : s.unit === 'currency' ? '$' : ''}
                  </span>
                </div>
              )}
            </div>
            <select
              value={s.test_frequency}
              onChange={(e) => onPatch(i, { test_frequency: e.target.value as TestFrequency })}
              className="rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 focus:border-gold-500 focus:outline-none"
            >
              {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
            </select>
            <button
              onClick={() => onRemove(i)}
              className="text-[11px] text-gray-300 hover:text-rose-500 transition-colors flex-shrink-0"
              title="Remove covenant"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

// Add a lender-defined covenant beyond the underwrite-derived seed. Custom
// covenants carry no metric_key and source 'manual'. They evaluate the same way
// as seeded ones (direction + bands for financial, cadence for reporting).
function AddCovenantForm({ onAdd }: { onAdd: (seed: CovenantSeed) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'financial' | 'reporting'>('financial');
  const [direction, setDirection] = useState<CovenantDirection>('min');
  const [unit, setUnit] = useState<CovenantUnit>('ratio');
  const [value, setValue] = useState('');
  const [freq, setFreq] = useState<TestFrequency>('quarterly');

  const reset = () => { setName(''); setValue(''); setKind('financial'); setDirection('min'); setUnit('ratio'); setFreq('quarterly'); };

  function submit(): void {
    if (!name.trim()) return;
    const seed: CovenantSeed = kind === 'financial'
      ? {
          name: name.trim(), kind: 'financial', metric_key: null, direction,
          flag_value: value === '' ? null : Number(value), fail_value: null,
          unit, test_frequency: freq, cure_days: 0, source: 'manual',
        }
      : {
          name: name.trim(), kind: 'reporting', metric_key: null, direction: null,
          flag_value: null, fail_value: null, unit: null,
          test_frequency: freq, cure_days: 5, source: 'manual',
        };
    onAdd(seed);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors">
        + Add covenant
      </button>
    );
  }

  const selectCls = 'rounded-lg border border-gray-200 px-2 py-1.5 text-[11px] text-gray-700 focus:border-gold-500 focus:outline-none';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Covenant name (e.g. Minimum liquidity)"
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gold-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as 'financial' | 'reporting')} className={selectCls}>
          <option value="financial">Financial</option>
          <option value="reporting">Reporting</option>
        </select>
        {kind === 'financial' && (
          <>
            <select value={direction} onChange={(e) => setDirection(e.target.value as CovenantDirection)} className={selectCls}>
              <option value="min">Minimum (≥)</option>
              <option value="max">Maximum (≤)</option>
            </select>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Threshold"
              className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 tabular-nums focus:border-gold-500 focus:outline-none"
            />
            <select value={unit} onChange={(e) => setUnit(e.target.value as CovenantUnit)} className={selectCls}>
              <option value="ratio">x (ratio)</option>
              <option value="percent">%</option>
              <option value="currency">$</option>
              <option value="count">count</option>
            </select>
          </>
        )}
        <select value={freq} onChange={(e) => setFreq(e.target.value as TestFrequency)} className={selectCls}>
          {FREQ_OPTIONS.map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => { reset(); setOpen(false); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-800 transition-colors">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="px-3.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Detail view — facility header + covenants (read-only in slice 1)
// ============================================================

interface DetailViewProps {
  id: string;
  orgId: string;
  userId: string;
  onBack: () => void;
}

function DetailView({ id, orgId, userId, onBack }: DetailViewProps): React.ReactElement {
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [attachments, setAttachments] = useState<FacilityAttachmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [{ data }, { data: atts }] = await Promise.all([
      fetchFacility(id),
      fetchFacilityAttachments(id),
    ]);
    setDetail(data);
    setAttachments(atts);
    setLoading(false);
  }, [id]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  if (loading) return <p className="text-sm text-gray-500 py-12 text-center">Loading facility...</p>;
  if (!detail) return <p className="text-sm text-gray-500 py-12 text-center">Facility not found.</p>;

  const { facility, covenants, tests } = detail;

  // Group tests by covenant; the query already returns them most recent first.
  const testsByCovenant: Record<string, CovenantTestRow[]> = {};
  for (const t of tests) {
    const k = String(t.covenant_id);
    (testsByCovenant[k] = testsByCovenant[k] || []).push(t);
  }

  const financial = covenants.filter((c) => c.kind === 'financial');
  const reporting = covenants.filter((c) => c.kind === 'reporting');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button onClick={onBack} className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors mb-2">
          ← Back to monitoring
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{facility.borrower_name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {ASSET_LABEL[facility.asset_class] || facility.asset_class}
          {facility.commitment_amount != null ? ` · ${formatCurrencyFull(facility.commitment_amount)} commitment` : ''}
          {facility.funded_at ? ` · funded ${facility.funded_at}` : ''}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">Status: {facility.status}</span>
          {facility.status === 'active' ? (
            <>
              <button
                onClick={async () => { await updateFacilityStatus(orgId, userId, String(facility.id), 'closed'); reload(); }}
                className="text-[11px] text-gray-500 hover:text-gray-900 transition-colors"
              >
                Mark closed
              </button>
              <span className="text-gray-300">·</span>
              <button
                onClick={async () => { await updateFacilityStatus(orgId, userId, String(facility.id), 'defaulted'); reload(); }}
                className="text-[11px] text-gray-500 hover:text-rose-600 transition-colors"
              >
                Mark defaulted
              </button>
            </>
          ) : (
            <button
              onClick={async () => { await updateFacilityStatus(orgId, userId, String(facility.id), 'active'); reload(); }}
              className="text-[11px] text-gray-500 hover:text-gray-900 transition-colors"
            >
              Reopen
            </button>
          )}
        </div>
      </div>

      <CovenantSection title="Financial covenants" covenants={financial} testsByCovenant={testsByCovenant} attachments={attachments} orgId={orgId} userId={userId} onRecorded={reload} />
      <CovenantSection title="Reporting covenants" covenants={reporting} testsByCovenant={testsByCovenant} attachments={attachments} orgId={orgId} userId={userId} onRecorded={reload} />

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">Documents</h3>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <FacilityAttachments
            facilityId={String(facility.id)}
            covenantTestId={null}
            orgId={orgId}
            userId={userId}
            attachments={attachments.filter((a) => a.covenant_test_id == null)}
            onChange={reload}
            emptyHint="No facility documents yet (credit agreement, appraisals)."
          />
        </div>
      </section>
    </div>
  );
}

interface CovenantSectionProps {
  title: string;
  covenants: CovenantRow[];
  testsByCovenant: Record<string, CovenantTestRow[]>;
  attachments: FacilityAttachmentRow[];
  orgId: string;
  userId: string;
  onRecorded: () => void;
}

function CovenantSection({ title, covenants, testsByCovenant, attachments, orgId, userId, onRecorded }: CovenantSectionProps): React.ReactElement | null {
  if (covenants.length === 0) return null;
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</h3>
      <div className="space-y-2">
        {covenants.map((c) => (
          <CovenantDetailRow
            key={c.id}
            covenant={c}
            tests={testsByCovenant[String(c.id)] || []}
            attachments={attachments}
            orgId={orgId}
            userId={userId}
            onRecorded={onRecorded}
          />
        ))}
      </div>
    </section>
  );
}

interface CovenantDetailRowProps {
  covenant: CovenantRow;
  tests: CovenantTestRow[];
  attachments: FacilityAttachmentRow[];
  orgId: string;
  userId: string;
  onRecorded: () => void;
}

function CovenantDetailRow({ covenant, tests, attachments, orgId, userId, onRecorded }: CovenantDetailRowProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const latestTest = tests[0];
  // Overdue once the due date passes with no test recorded since (recording a
  // test advances next_test_date into the future). An open breach still wins.
  const overdue = !!covenant.next_test_date && covenant.next_test_date < today();
  const status =
    latestTest && (latestTest.status === 'fail' || latestTest.status === 'flag')
      ? latestTest.status
      : overdue ? 'overdue' : (latestTest?.status || 'awaiting');

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{covenant.name}</p>
          <p className="text-[11px] text-gray-400">
            {formatTarget(covenant)} · {FREQ_LABEL[covenant.test_frequency]}
            {covenant.next_test_date ? ` · next ${covenant.next_test_date}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge status={status} />
          <span className="text-gray-300 text-[10px]">{open ? '▲' : '▼'}</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/30">
          <RecordTestForm covenant={covenant} orgId={orgId} userId={userId} onRecorded={onRecorded} />
          <TestHistory covenant={covenant} tests={tests} />
          {latestTest && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Supporting documents (latest test)
              </p>
              <FacilityAttachments
                facilityId={String(covenant.facility_id)}
                covenantTestId={String(latestTest.id)}
                orgId={orgId}
                userId={userId}
                attachments={attachments.filter((a) => String(a.covenant_test_id) === String(latestTest.id))}
                onChange={onRecorded}
                emptyHint="Attach the BBC or certificate that backs this result."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface RecordTestFormProps {
  covenant: CovenantRow;
  orgId: string;
  userId: string;
  onRecorded: () => void;
}

function RecordTestForm({ covenant, orgId, userId, onRecorded }: RecordTestFormProps): React.ReactElement {
  const { addToast } = useToast();
  const isFinancial = covenant.kind === 'financial';
  const [testDate, setTestDate] = useState(today());
  const [reportedValue, setReportedValue] = useState('');
  const [dueDate, setDueDate] = useState(covenant.next_test_date || today());
  const [receivedDate, setReceivedDate] = useState('');
  const [note, setNote] = useState('');
  const [waived, setWaived] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = waived || (isFinancial ? reportedValue !== '' : dueDate !== '');

  async function submit(): Promise<void> {
    if (!canSubmit) return;
    setSaving(true);
    const params = isFinancial
      ? { testDate, reportedValue: waived ? null : Number(reportedValue), note, waived }
      : { testDate, dueDate, submittedAt: receivedDate || null, note, waived };
    const { error } = await recordCovenantTest(orgId, userId, covenant, params);
    setSaving(false);
    if (error) { addToast('Could not record the test', 'error'); return; }
    addToast('Test recorded', 'success');
    setReportedValue(''); setReceivedDate(''); setNote(''); setWaived(false);
    onRecorded();
  }

  const inputCls = 'rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-gold-500 focus:outline-none bg-white';

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Record test</p>
      <div className="flex flex-wrap items-center gap-2">
        {isFinancial ? (
          <>
            <label className="text-[11px] text-gray-500">As of</label>
            <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className={inputCls} />
            <label className="text-[11px] text-gray-500">Reported</label>
            <input
              type="number"
              value={reportedValue}
              onChange={(e) => setReportedValue(e.target.value)}
              disabled={waived}
              placeholder={covenant.unit === 'percent' ? '%' : covenant.unit === 'ratio' ? 'x' : ''}
              className={`${inputCls} w-24 tabular-nums disabled:opacity-40`}
            />
          </>
        ) : (
          <>
            <label className="text-[11px] text-gray-500">Due</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={waived} className={`${inputCls} disabled:opacity-40`} />
            <label className="text-[11px] text-gray-500">Received</label>
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} disabled={waived} className={`${inputCls} disabled:opacity-40`} />
          </>
        )}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className={`${inputCls} w-full`}
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
          <input type="checkbox" checked={waived} onChange={(e) => setWaived(e.target.checked)} className="accent-gold-500" />
          Waive this period
        </label>
        <button
          onClick={submit}
          disabled={!canSubmit || saving}
          className="px-3.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          {saving ? 'Recording...' : 'Record'}
        </button>
      </div>
      {!isFinancial && (
        <p className="text-[10px] text-gray-400">Leave Received blank to record the deliverable as not received.</p>
      )}
    </div>
  );
}

interface TestHistoryProps {
  covenant: CovenantRow;
  tests: CovenantTestRow[];
}

function TestHistory({ covenant, tests }: TestHistoryProps): React.ReactElement {
  if (tests.length === 0) {
    return <p className="text-[11px] text-gray-400">No tests recorded yet.</p>;
  }
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">History</p>
      <div className="space-y-1.5">
        {tests.map((t) => (
          <div key={t.id} className="flex items-center gap-3 text-[11px]">
            <span className="text-gray-500 tabular-nums w-[88px] flex-shrink-0">{t.test_date}</span>
            <span className="flex-1 text-gray-700 truncate">
              {covenant.kind === 'financial'
                ? (t.reported_value != null ? formatValue(covenant, t.reported_value) : '—')
                : (t.submitted_at ? `Received ${t.submitted_at.slice(0, 10)}` : 'Not received')}
              {t.note ? ` · ${t.note}` : ''}
            </span>
            <StatusBadge status={t.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
