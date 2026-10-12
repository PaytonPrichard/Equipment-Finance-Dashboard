import React, { useState, useEffect, startTransition } from 'react';
import NullableNumberInput from './NullableNumberInput';
import { LINE_ITEM_LABELS, validateTreatmentRules } from '../lib/borrowerBuild';
import {
  BUILT_FIELDS, statementState, pendingJudgments, debtGap, clearStatements, confirmJudgment,
  setDealTreatment, firmRulesFor, rulesOutOfDate, changedRules, rebuildWithCurrentRules,
} from '../lib/statementBuild';
import { BUILT_FIELD_LABELS, money, formulaWithValues, describeRuleChanges } from '../utils/statementFormat';
import { JudgmentRow, TreatmentRow } from './StatementJudgments';
import EbitdaSourceSection from './EbitdaSourceSection';
import { useConfirm } from '../contexts/ConfirmContext';

// Financial statements, full width (Joel, 2026-10-12). The panel used to sit
// inside the form column, with the line items, the "Borrower has" chips, the
// judgments, the treatment rows and the rebuild box in five places. Here the
// three statements sit side by side as in a filing, each item the borrower
// has gets one block with its lines, its questions and its treatment, and
// every judgment sits next to the line it is about.

// The three statements. A line with a `section` shows only when the analyst
// turns that section on, or when it holds a value.
const COLUMNS = [
  {
    title: 'Income statement',
    lines: [
      { key: 'revenue' },
      { key: 'operatingIncome', negative: true },
      { key: 'pretaxIncome', negative: true, section: 'noOperatingIncome' },
      { key: 'interestExpense', section: 'noOperatingIncome' },
      { key: 'rentExpense' },
      { key: 'nonCashGainsInOperatingIncome', hint: 'E.g. a reserve reversal. Taken out of EBITDA.' },
    ],
  },
  {
    title: 'Cash flow statement',
    lines: [
      { key: 'depreciationAmortization' },
      { key: 'amortizationOfIntangibles' },
      { key: 'interestPaid' },
      { key: 'incomeTaxesPaid', negative: true },
      { key: 'capitalExpenditures' },
      { key: 'workingCapitalChange', negative: true, hint: 'As reported. Negative means cash used.' },
      { key: 'statedMaintenanceCapex', hint: 'Only if a document states it.' },
    ],
  },
  {
    title: 'Balance sheet and debt note',
    lines: [
      { key: 'revolver' },
      { key: 'termLoansAndNotes' },
      { key: 'currentMaturities' },
      { key: 'renewingInCurrentMaturities', hint: 'Revolver, AR securitization or 364-day line folded into current maturities. Taken back out.' },
      { key: 'operatingLeaseLiabilities', section: 'operatingLeasesIn' },
    ],
  },
];

// What the borrower may have. Each gets a block with all of its lines.
const ITEMS = [
  {
    key: 'floorplan', label: 'Floorplan',
    lines: [{ key: 'floorplanInterest' }, { key: 'floorplanPayable' }],
  },
  {
    key: 'captiveFleet', label: 'Captive fleet',
    lines: [{ key: 'vehicleDepreciation' }, { key: 'vehicleInterest' }, { key: 'vehicleDebt' }, { key: 'currentVehicleDebtMaturities' }],
  },
  {
    key: 'financeLeases', label: 'Finance leases',
    lines: [{ key: 'financeLeaseInterest' }, { key: 'financeLeaseAmortization' }, { key: 'financeLeaseLiabilities' }, { key: 'currentFinanceLeaseLiabilities' }],
  },
];

/**
 * Where each judgment is shown: next to the line it is about, in the block
 * of the item it concerns, or with the EBITDA source. Anything not placed
 * here falls into "Other assumptions", so a new judgment is never lost.
 */
export function anchorFor(id) {
  if (id === 'fiscalYear') return 'header';
  if (id === 'ebitdaStart') return 'line:operatingIncome';
  if (id.endsWith('Present')) return 'has';
  if (id === 'treatment.operatingLeases') return 'line:rentExpense';
  if (id === 'treatment.floorplan' || id.startsWith('floorplanInterest')) return 'item:floorplan';
  if (id === 'treatment.captiveFleet' || id.startsWith('vehicleInterest')) return 'item:captiveFleet';
  if (id === 'treatment.financeLeases') return 'item:financeLeases';
  if (id.startsWith('currentMaturitiesInclude.')) return 'line:currentMaturities';
  if (id === 'maintenanceCapex') return 'line:capitalExpenditures';
  if (id === 'ebitdaSource' || id.startsWith('companyBasis.')) return 'ebitda';
  if (id.startsWith('addBack.')) return null; // EbitdaSourceSection handles add-backs
  return 'other';
}

function LineRow({ line, item, onChange }) {
  const label = LINE_ITEM_LABELS[line.key];
  const source = item?.source || {};
  const set = (patch) => onChange({ ...(item || { value: null }), origin: 'typed', ...patch });
  const setSource = (patch) => set({ source: { ...source, ...patch } });
  return (
    <div className="grid grid-cols-12 gap-2 items-start" data-testid={`line-${line.key}`}>
      <div className="col-span-5 pt-2">
        <span className="text-[12px] text-gray-700 leading-tight block">{label}</span>
        {line.hint && <span className="block text-[10px] text-gray-400 leading-snug">{line.hint}</span>}
      </div>
      <div className="col-span-4">
        <NullableNumberInput
          value={item?.value ?? null}
          onChange={(v) => set({ value: v })}
          prefix="$"
          allowNegative={!!line.negative}
          ariaLabel={label}
        />
      </div>
      <div className="col-span-3 flex gap-1">
        <input
          type="text"
          value={source.document || ''}
          onChange={(e) => setSource({ document: e.target.value })}
          placeholder="Doc"
          aria-label={`${label} document`}
          className="form-input text-[11px] px-1.5 min-w-0 flex-1"
        />
        <input
          type="text"
          value={source.page ?? ''}
          onChange={(e) => setSource({ page: e.target.value })}
          placeholder="p."
          aria-label={`${label} page`}
          className="form-input text-[11px] px-1.5 w-10"
        />
      </div>
    </div>
  );
}

// A judgment shown under the line or in the block it concerns.
function InlineJudgments({ list, render }) {
  if (!list?.length) return null;
  return (
    <div className="ml-2 pl-3 border-l-2 border-amber-200 space-y-1.5 py-1">
      {list.map(render)}
    </div>
  );
}

export default function StatementsWorkspace({ inputs, onChange, treatmentRules, analystName, onClose }) {
  const confirm = useConfirm();
  const financials = inputs.financials;
  const state = statementState(inputs, treatmentRules);
  const build = state.build;
  const by = analystName || undefined;

  // The rebuild reruns the build and the results, which can take a moment.
  // Hide the prompt on the click, then rebuild.
  const rulesChanged = rulesOutOfDate(inputs, treatmentRules)
    ? describeRuleChanges(financials.firmRules, validateTreatmentRules(treatmentRules), changedRules(financials.firmRules, treatmentRules))
    : null;
  const [rebuilding, setRebuilding] = useState(false);
  const changesKey = rulesChanged ? rulesChanged.join('|') : '';
  useEffect(() => { setRebuilding(false); }, [changesKey]);

  if (!financials) return null;

  const items = financials.lineItems || {};
  const show = financials.show || {};
  const firmRules = firmRulesFor(inputs, treatmentRules);
  const opLeasesIn = build?.treatment?.operatingLeases === 'in';
  const hasValue = (key) => items[key]?.value !== null && items[key]?.value !== undefined;
  const visible = (line) => !line.section || show[line.section]
    || (line.section === 'operatingLeasesIn' && opLeasesIn) || hasValue(line.key);

  const setFinancials = (f) => onChange({ ...inputs, financials: f });
  const setLine = (key, item) => setFinancials({ ...financials, lineItems: { ...items, [key]: item } });
  const toggle = (key) => setFinancials({ ...financials, show: { ...show, [key]: !show[key] } });
  const onConfirm = (id, value, proposed) => onChange(confirmJudgment(inputs, id, value, proposed, by));
  const onTreatment = (row, rule, reason) => {
    const r = setDealTreatment(inputs, row, rule, reason, treatmentRules, by);
    if (!r.error) onChange(r.inputs);
    return r.error;
  };
  const rebuild = () => {
    setRebuilding(true);
    startTransition(() => onChange(rebuildWithCurrentRules(inputs, treatmentRules, { by }).inputs));
  };
  const clearAll = async () => {
    const ok = await confirm({
      title: 'Clear the statements?',
      body: 'Built fields keep their current values and become typed.',
      confirmLabel: 'Clear',
    });
    if (ok) { onChange(clearStatements(inputs)); onClose(); }
  };

  // Judgments by where they show.
  const judgments = build?.judgments || [];
  const placed = {};
  judgments.forEach((j) => {
    const a = anchorFor(j.id);
    if (a) (placed[a] = placed[a] || []).push(j);
  });
  const start = judgments.find((j) => j.id === 'ebitdaStart')?.value;
  const treatmentOverrides = financials.treatmentOverrides || {};
  const renderJudgment = (j) => (j.id.startsWith('treatment.')
    ? <TreatmentRow key={j.id} j={j} firmRules={firmRules} override={treatmentOverrides[j.id.slice('treatment.'.length)]} onConfirm={onConfirm} onTreatment={onTreatment} />
    : <JudgmentRow key={j.id} j={j} start={start} onConfirm={onConfirm} />);

  const counted = judgments.filter((j) => !j.id.startsWith('addBack.'));
  const confirmedCount = counted.filter((j) => j.confirmed).length;
  const pending = pendingJudgments(state);
  const gap = debtGap(state, inputs);
  const overrides = financials.fieldOverrides || {};
  const notes = build
    ? [...build.caveats.filter((c) => !c.startsWith('Proposed, not confirmed')), ...(state.pairingCaveats || [])]
    : [];
  const activeItems = ITEMS.filter((it) => show[it.key] || it.lines.some((l) => hasValue(l.key)) || placed[`item:${it.key}`]);

  const renderLine = (line) => (
    <div key={line.key} className="space-y-1">
      <LineRow line={line} item={items[line.key]} onChange={(item) => setLine(line.key, item)} />
      <InlineJudgments list={placed[`line:${line.key}`]} render={renderJudgment} />
    </div>
  );

  return (
    <div className="space-y-4 pb-28" aria-label="Financial statements">
      {/* Header */}
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            Financial statements{inputs.companyName ? ` · ${inputs.companyName}` : ''}
          </h2>
          <p className="text-[11px] text-gray-500">Values as reported. The deal's fields fill in as the build completes.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label htmlFor="stmt-fye" className="text-[12px] text-gray-700">Fiscal year end</label>
          <input
            id="stmt-fye"
            type="date"
            value={financials.fiscalYearEnd || ''}
            onChange={(e) => setFinancials({ ...financials, fiscalYearEnd: e.target.value })}
            className="form-input text-[12px] w-40"
          />
          <button type="button" onClick={clearAll} className="text-[11px] text-gray-400 hover:text-gray-700">Clear statements</button>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-900 text-[12px] font-semibold hover:bg-gray-200">
            Back to deal
          </button>
        </div>
        <div className="w-full">
          <InlineJudgments list={placed.header} render={renderJudgment} />
        </div>
      </div>

      {/* Firm rules changed: at the top, before anything is read */}
      {rulesChanged && rebuilding && (
        <div className="glass-card rounded-2xl p-4 text-[11px] text-gray-500">Rebuilding with current firm rules...</div>
      )}
      {rulesChanged && !rebuilding && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-2" data-testid="rules-changed">
          <p className="text-[12px] text-gray-800 font-semibold">Your firm's treatment rules have changed since this deal was saved.</p>
          <ul className="space-y-0.5">
            {rulesChanged.map((c) => <li key={c} className="text-[11px] text-gray-700">{c}</li>)}
          </ul>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={rebuild}
              className="px-3 py-1.5 rounded-lg bg-gold-500 text-white text-[11px] font-semibold hover:bg-gold-600 transition-all"
            >
              Rebuild with current firm rules
            </button>
            <p className="text-[10px] text-gray-500">Changed treatment rows go back to pending. Confirm them, then update the deal.</p>
          </div>
        </div>
      )}
      {!rulesChanged && financials.rulesRebuilt && (
        <p className="text-[11px] text-gray-500 px-1">
          Rebuilt with firm rules on {String(financials.rulesRebuilt.at || '').slice(0, 10)}
          {financials.rulesRebuilt.by ? ` by ${financials.rulesRebuilt.by}` : ''}.
          {judgments.some((j) => j.id.startsWith('treatment.') && !j.confirmed) ? ' Confirm the changed treatment rows below, then update the deal.' : ''}
        </p>
      )}

      {/* The three statements */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {COLUMNS.map((col) => (
          <div key={col.title} className="glass-card rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{col.title}</p>
              {col.title === 'Income statement' && (
                <button
                  type="button"
                  aria-pressed={!!show.noOperatingIncome}
                  onClick={() => toggle('noOperatingIncome')}
                  className={`text-[10px] px-2 py-0.5 rounded-md border ${show.noOperatingIncome ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:text-gray-800'}`}
                >
                  No operating income line
                </button>
              )}
            </div>
            {col.lines.filter(visible).map(renderLine)}
          </div>
        ))}
      </div>

      {/* What the borrower has: one block per item, lines and questions together */}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Borrower has</p>
          {ITEMS.map((it) => (
            <button
              key={it.key}
              type="button"
              aria-pressed={!!show[it.key]}
              onClick={() => toggle(it.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                show[it.key] ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
        <InlineJudgments list={placed.has} render={renderJudgment} />
        {activeItems.length > 0 && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeItems.map((it) => {
              const list = placed[`item:${it.key}`] || [];
              const treatment = list.filter((j) => j.id.startsWith('treatment.'));
              const rest = list.filter((j) => !j.id.startsWith('treatment.'));
              return (
                <div key={it.key} className="rounded-xl border border-gray-200 p-4 space-y-2.5" data-testid={`item-${it.key}`}>
                  <p className="text-[12px] font-semibold text-gray-900">{it.label}</p>
                  {treatment.map(renderJudgment)}
                  {it.lines.map(renderLine)}
                  <InlineJudgments list={rest} render={renderJudgment} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EBITDA source and the company's own EBITDA */}
      <div className="glass-card rounded-2xl p-4 space-y-3">
        <EbitdaSourceSection financials={financials} build={build} onChange={setFinancials} />
        <InlineJudgments list={placed.ebitda} render={renderJudgment} />
      </div>

      {placed.other?.length > 0 && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <p className="text-[11px] font-semibold text-gray-700">Other assumptions</p>
          {placed.other.map(renderJudgment)}
        </div>
      )}

      {/* What the statements build, with the formulas */}
      {build && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">What the statements build</p>
          <ul className="space-y-1.5">
            {BUILT_FIELDS.map((f) => {
              const d = build.derivations[f];
              const o = overrides[f];
              return (
                <li key={f} className="text-[11px] leading-relaxed" data-testid={`built-${f}`}>
                  <span className="font-semibold text-gray-800">{BUILT_FIELD_LABELS[f]}</span>{' '}
                  {o ? (
                    <span className="text-gray-500">typed by analyst, overriding the build: {o.reason}</span>
                  ) : d.value !== null ? (
                    <span className="text-gray-600">{money(d.value)}{d.estimate ? ' (estimate)' : ''} = {formulaWithValues(d)}</span>
                  ) : (
                    <span className="text-gray-400">
                      {inputs?.[f] !== null && inputs?.[f] !== undefined && inputs?.[f] !== '' && inputs?.[f] !== 0
                        ? `not built, typed value used (${money(Number(inputs[f]))})`
                        : 'not built, not provided'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {gap && (
            <p className="mt-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" data-testid="debt-gap">
              {gap} Saving waits for this.
            </p>
          )}
          {build.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-gray-700">To build the rest</p>
              <ul className="mt-1 space-y-0.5">
                {build.errors.map((e) => <li key={e} className="text-[11px] text-gray-600">{e}</li>)}
              </ul>
            </div>
          )}
          {notes.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-gray-700">Notes</p>
              <ul className="mt-1 space-y-0.5">
                {notes.map((n) => <li key={n} className="text-[11px] text-gray-600">{n}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Always in view: what it builds and what is left */}
      <div className="fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur" data-testid="statements-bar">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
            {build && ['annualRevenue', 'ebitda', 'totalExistingDebt', 'actualAnnualDebtService'].map((f) => (
              <span key={f}>
                <span className="text-gray-400">{BUILT_FIELD_LABELS[f]}</span>{' '}
                <span className="font-semibold text-gray-900">{build.derivations[f].value !== null ? money(build.derivations[f].value) : 'not built'}</span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-[11px] ${pending || gap ? 'text-amber-700' : 'text-gray-500'}`}>
              {counted.length > 0 ? `${confirmedCount} of ${counted.length} confirmed` : 'Nothing to confirm'}
              {gap ? ' · debt lines needed' : ''}
            </span>
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-[12px] font-semibold hover:bg-gray-800">
              Back to deal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
