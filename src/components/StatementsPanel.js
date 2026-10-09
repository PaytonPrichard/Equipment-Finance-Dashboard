import React from 'react';
import NullableNumberInput from './NullableNumberInput';
import { LINE_ITEM_LABELS } from '../lib/borrowerBuild';
import { BUILT_FIELDS } from '../lib/statementBuild';
import StatementJudgments from './StatementJudgments';

// Statement line items on the New Deal form. Whatever they are enough to
// build fills the Borrower Profile fields above (src/lib/statementBuild.ts).

export const BUILT_FIELD_LABELS = {
  annualRevenue: 'Revenue',
  ebitda: 'EBITDA',
  totalExistingDebt: 'Total debt',
  actualAnnualDebtService: 'Annual debt service',
  maintenanceCapex: 'Maintenance capex',
  cashTaxes: 'Cash taxes',
  workingCapitalIncrease: 'Working capital increase',
  leasePayments: 'Rent',
};

// Sections the analyst opens when the borrower has the item. A line with a
// value always shows, whether or not its section is open.
const SECTIONS = [
  { key: 'noOperatingIncome', label: 'No operating income line' },
  { key: 'floorplan', label: 'Floorplan' },
  { key: 'captiveFleet', label: 'Captive fleet' },
  { key: 'financeLeases', label: 'Finance leases' },
];

const GROUPS = [
  {
    title: 'Income statement',
    lines: [
      { key: 'revenue' },
      { key: 'operatingIncome', negative: true },
      { key: 'pretaxIncome', negative: true, section: 'noOperatingIncome' },
      { key: 'interestExpense', section: 'noOperatingIncome' },
      { key: 'rentExpense' },
      { key: 'floorplanInterest', section: 'floorplan' },
      { key: 'vehicleDepreciation', section: 'captiveFleet' },
      { key: 'vehicleInterest', section: 'captiveFleet' },
      { key: 'financeLeaseInterest', section: 'financeLeases' },
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
      { key: 'financeLeaseAmortization', section: 'financeLeases' },
    ],
  },
  {
    title: 'Balance sheet and debt note',
    lines: [
      { key: 'revolver' },
      { key: 'termLoansAndNotes' },
      { key: 'currentMaturities' },
      { key: 'financeLeaseLiabilities', section: 'financeLeases' },
      { key: 'currentFinanceLeaseLiabilities', section: 'financeLeases' },
      { key: 'floorplanPayable', section: 'floorplan' },
      { key: 'vehicleDebt', section: 'captiveFleet' },
      { key: 'currentVehicleDebtMaturities', section: 'captiveFleet' },
      { key: 'operatingLeaseLiabilities', section: 'operatingLeasesIn' },
    ],
  },
  {
    title: 'Other',
    lines: [{ key: 'statedMaintenanceCapex', hint: 'Only if a document states it.' }],
  },
];

export function money(v) {
  if (v === null || v === undefined) return '';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

function sourceText(source) {
  if (!source) return '';
  const parts = [source.document, source.page != null && source.page !== '' ? `p. ${source.page}` : null].filter(Boolean);
  return parts.join(', ');
}

/** "Operating income $10.0M (10-K, p. 54) + D&A $5.0M" */
export function formulaWithValues(derivation) {
  if (!derivation?.terms?.length) return '';
  return derivation.terms.map((t, i) => {
    const src = sourceText(t.source);
    const piece = `${t.label} ${money(t.value)}${src ? ` (${src})` : ''}`;
    return i === 0 && t.sign === '+' ? piece : `${t.sign} ${piece}`;
  }).join(' ');
}

function LineRow({ line, item, onChange }) {
  const label = LINE_ITEM_LABELS[line.key];
  const source = item?.source || {};
  const set = (patch) => onChange({ ...(item || { value: null }), origin: 'typed', ...patch });
  const setSource = (patch) => set({ source: { ...source, ...patch } });
  return (
    <div className="grid grid-cols-12 gap-2 items-start" data-testid={`line-${line.key}`}>
      <div className="col-span-4 pt-2.5">
        <span className="text-[12px] text-gray-700">{label}</span>
        {line.hint && <span className="block text-[10px] text-gray-400">{line.hint}</span>}
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
      <input
        type="text"
        value={source.document || ''}
        onChange={(e) => setSource({ document: e.target.value })}
        placeholder="Doc"
        aria-label={`${label} document`}
        className="form-input col-span-2 text-[12px] px-2"
      />
      <input
        type="text"
        value={source.page ?? ''}
        onChange={(e) => setSource({ page: e.target.value })}
        placeholder="p."
        aria-label={`${label} page`}
        className="form-input col-span-2 text-[12px] px-2"
      />
    </div>
  );
}

export default function StatementsPanel({ financials, state, inputs, onChange, onClear, firmRules, rulesChanged, onConfirm, onTreatment }) {
  if (!financials) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-gray-800">Financial statements</p>
          <p className="text-[11px] text-gray-500">Build revenue, EBITDA, debt and debt service from the statement line items.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ fiscalYearEnd: '', lineItems: {} })}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-[11px] font-semibold hover:bg-gray-200 transition-all flex-shrink-0"
        >
          Add statements
        </button>
      </div>
    );
  }

  const items = financials.lineItems || {};
  const show = financials.show || {};
  const build = state?.build;
  const opLeasesIn = build?.treatment?.operatingLeases === 'in';
  const visible = (line) => !line.section || show[line.section]
    || (line.section === 'operatingLeasesIn' && opLeasesIn)
    || (items[line.key]?.value !== null && items[line.key]?.value !== undefined);

  const setLine = (key, item) => onChange({ ...financials, lineItems: { ...items, [key]: item } });
  const toggle = (key) => onChange({ ...financials, show: { ...show, [key]: !show[key] } });

  const overrides = financials.fieldOverrides || {};
  const notes = build
    ? [...build.caveats.filter((c) => !c.startsWith('Proposed, not confirmed')), ...(state.pairingCaveats || [])]
    : [];

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-5" aria-label="Financial statements">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-gray-800">Financial statements</p>
          <p className="text-[11px] text-gray-500">Values as reported. Fields above fill in as the build completes.</p>
        </div>
        <button type="button" onClick={onClear} className="text-[11px] text-gray-400 hover:text-gray-700 flex-shrink-0">
          Clear statements
        </button>
      </div>

      <div className="grid grid-cols-12 gap-2 items-center">
        <label htmlFor="stmt-fye" className="col-span-4 text-[12px] text-gray-700">Fiscal year end</label>
        <input
          id="stmt-fye"
          type="date"
          value={financials.fiscalYearEnd || ''}
          onChange={(e) => onChange({ ...financials, fiscalYearEnd: e.target.value })}
          className="form-input col-span-4 text-[12px]"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Borrower has</p>
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={!!show[s.key]}
              onClick={() => toggle(s.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                show[s.key] ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{g.title}</p>
          <div className="space-y-2">
            {g.lines.filter(visible).map((line) => (
              <LineRow key={line.key} line={line} item={items[line.key]} onChange={(item) => setLine(line.key, item)} />
            ))}
          </div>
        </div>
      ))}

      {build && (
        <div className="border-t border-gray-200 pt-4">
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
                    <span className="text-gray-600">
                      {money(d.value)}{d.estimate ? ' (estimate)' : ''} = {formulaWithValues(d)}
                    </span>
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

      {build && (
        <StatementJudgments
          build={build}
          firmRules={firmRules}
          overrides={financials.treatmentOverrides}
          onConfirm={onConfirm}
          onTreatment={onTreatment}
        />
      )}

      {rulesChanged && (
        <p className="text-[11px] text-gray-500">
          This deal keeps the treatment rules it was saved with. Your firm's rules have changed since.
        </p>
      )}
    </div>
  );
}
