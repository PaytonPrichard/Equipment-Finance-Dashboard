import React, { useState } from 'react';
import { TREATMENT_COPY } from './TreatmentRulesCard';

// The calls a person has to make on a statement build: Tranche proposes,
// the analyst confirms or picks another option. One click each, never all
// at once. Save to Pipeline waits until every one is confirmed.

const GROUPS = [
  { title: 'Statements', match: (id) => ['fiscalYear', 'ebitdaStart', 'ebitdaSource'].includes(id) },
  { title: 'What the borrower has', match: (id) => id.endsWith('Present') },
  { title: 'Treatment', match: (id) => id.startsWith('treatment.') },
  {
    title: 'Where items sit',
    match: (id) => id.endsWith('Placement') || id.endsWith('InInterestPaid') || id.startsWith('currentMaturitiesInclude.'),
  },
  { title: 'Company EBITDA', match: (id) => id.startsWith('companyBasis.') },
  { title: 'Maintenance capex', match: (id) => id === 'maintenanceCapex' },
];

function optionLabel(id, v, start) {
  if (id.endsWith('Present') || id.startsWith('currentMaturitiesInclude.')) return v ? 'Yes' : 'No';
  if (id.endsWith('InInterestPaid')) return v ? 'Included' : 'Not included';
  if (id.endsWith('Placement')) {
    if (v === 'operatingExpenses') return 'Inside operating expenses';
    return start === 'pretaxIncome' ? 'Inside interest expense' : 'Below operating income';
  }
  if (id.startsWith('companyBasis.')) return v ? 'After' : 'Before';
  if (id === 'ebitdaStart') return v === 'operatingIncome' ? 'Operating income' : 'Pretax income + interest expense';
  if (id === 'ebitdaSource') return { built: 'Built', adjusted: 'Adjusted', stated: 'Stated' }[v] || String(v);
  if (id === 'maintenanceCapex') return { stated: 'Borrower-stated', depreciation: 'Depreciation (estimate)', totalCapex: 'Total capex (upper bound)' }[v] || String(v);
  return String(v);
}

function Pill({ selected, confirmed, onClick, children }) {
  const cls = selected
    ? confirmed ? 'bg-gray-900 text-white border-gray-900' : 'bg-amber-50 text-amber-900 border-amber-300'
    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800';
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${cls}`}>
      {children}
    </button>
  );
}

function JudgmentRow({ j, start, onConfirm }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" data-testid={`judgment-${j.id}`}>
      <span className="text-[12px] text-gray-700">{j.label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {j.options.map((opt) => (
          <Pill key={String(opt)} selected={j.value === opt} confirmed={j.confirmed} onClick={() => onConfirm(j.id, opt, j.proposed)}>
            {optionLabel(j.id, opt, start)}
          </Pill>
        ))}
        {j.confirmed ? (
          <span className="text-[10px] text-gray-400 w-16 text-right">Confirmed</span>
        ) : (
          <button type="button" onClick={() => onConfirm(j.id, j.value, j.proposed)} className="text-[11px] font-semibold text-gray-900 underline w-16 text-right">
            Confirm
          </button>
        )}
      </div>
    </div>
  );
}

function TreatmentRow({ j, firmRules, override, onConfirm, onTreatment }) {
  const row = j.id.slice('treatment.'.length);
  const copy = TREATMENT_COPY[row];
  const firm = firmRules[row];
  const alt = j.options.find((o) => o !== firm);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  return (
    <div className="space-y-1.5" data-testid={`judgment-${j.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-gray-700">
          {copy?.label}: <span className="font-semibold text-gray-900">{copy?.options[j.value]?.label || j.value}</span>
          <span className="text-gray-400">{override ? ', overridden for this deal' : ', firm rule'}</span>
        </span>
        <div className="flex items-center gap-2">
          {override ? (
            <button type="button" onClick={() => onTreatment(row, firm, '')} className="text-[11px] text-gray-500 underline">Use firm rule</button>
          ) : (
            <>
              {!open && <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-gray-500 underline">Override for this deal</button>}
              {j.confirmed ? (
                <span className="text-[10px] text-gray-400 w-16 text-right">Confirmed</span>
              ) : (
                <button type="button" onClick={() => onConfirm(j.id, firm, firm)} className="text-[11px] font-semibold text-gray-900 underline w-16 text-right">Confirm</button>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500">{copy?.options[j.value]?.detail}</p>
      {override && <p className="text-[11px] text-gray-500">Reason: {override.reason}</p>}
      {open && !override && (
        <div className="space-y-1.5 pl-2 border-l-2 border-gray-200">
          <p className="text-[11px] text-gray-600">
            Use <span className="font-semibold">{copy?.options[alt]?.label}</span> instead. {copy?.options[alt]?.detail}
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason, e.g. the credit agreement counts it as debt"
            aria-label={`Reason to override ${copy?.label}`}
            className="form-input text-[12px]"
          />
          {error && <p className="text-[11px] text-rose-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reason.trim()}
              onClick={() => {
                const err = onTreatment(row, alt, reason);
                if (err) setError(err);
                else { setOpen(false); setReason(''); setError(null); }
              }}
              className="px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-semibold disabled:opacity-40"
            >
              Override
            </button>
            <button type="button" onClick={() => { setOpen(false); setReason(''); setError(null); }} className="text-[11px] text-gray-400 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StatementJudgments({ build, firmRules, overrides, onConfirm, onTreatment }) {
  // Add-backs are confirmed in the EBITDA source section, not here.
  const judgments = build.judgments.filter((j) => !j.id.startsWith('addBack.'));
  if (!judgments.length) return null;
  const start = build.judgments.find((j) => j.id === 'ebitdaStart')?.value;
  const done = judgments.filter((j) => j.confirmed).length;
  return (
    <div className="border-t border-gray-200 pt-4 space-y-4" aria-label="Judgments to confirm">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Judgments</p>
        <p className={`text-[11px] ${done === judgments.length ? 'text-gray-500' : 'text-amber-700'}`}>
          {done} of {judgments.length} confirmed
        </p>
      </div>
      <p className="text-[11px] text-gray-500">Tranche proposes each call. Confirm it or pick another. Saving needs every one confirmed.</p>
      {GROUPS.map((g) => {
        const rows = judgments.filter((j) => g.match(j.id));
        if (!rows.length) return null;
        return (
          <div key={g.title} className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-700">{g.title}</p>
            {rows.map((j) => (g.title === 'Treatment'
              ? <TreatmentRow key={j.id} j={j} firmRules={firmRules} override={overrides?.[j.id.slice('treatment.'.length)]} onConfirm={onConfirm} onTreatment={onTreatment} />
              : <JudgmentRow key={j.id} j={j} start={start} onConfirm={onConfirm} />))}
          </div>
        );
      })}
    </div>
  );
}
