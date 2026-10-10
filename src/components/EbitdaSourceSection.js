import React from 'react';
import NullableNumberInput from './NullableNumberInput';
import { money } from '../utils/statementFormat';

// The company's own EBITDA figures, beside the one Tranche builds.
//
// Stated: one number as the company names it. Adjusted: the company's total
// with its add-back bridge, line by line. The analyst accepts or rejects
// each add-back, and an add-back left undecided does not count. The gap to
// built EBITDA is split into what the bridge explains, what the firm's
// treatment explains, and what nothing explains, against the firm tolerance.

function SourceInputs({ source, onChange, label }) {
  const s = source || {};
  return (
    <>
      <input
        type="text"
        value={s.document || ''}
        onChange={(e) => onChange({ ...s, document: e.target.value })}
        placeholder="Doc"
        aria-label={`${label} document`}
        className="form-input col-span-2 text-[12px] px-2"
      />
      <input
        type="text"
        value={s.page ?? ''}
        onChange={(e) => onChange({ ...s, page: e.target.value })}
        placeholder="p."
        aria-label={`${label} page`}
        className="form-input col-span-2 text-[12px] px-2"
      />
    </>
  );
}

function CompanyFigure({ title, hint, figure, onChange }) {
  const f = figure || { value: null };
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-4 pt-1">
        <span className="text-[12px] text-gray-700">{title}</span>
        <input
          type="text"
          value={f.label || ''}
          onChange={(e) => onChange({ ...f, label: e.target.value })}
          placeholder={hint}
          aria-label={`${title} name`}
          className="form-input text-[11px] px-2 mt-1"
        />
      </div>
      <div className="col-span-4">
        <NullableNumberInput value={f.value ?? null} onChange={(v) => onChange({ ...f, value: v })} prefix="$" allowNegative ariaLabel={title} />
      </div>
      <SourceInputs source={f.source} onChange={(source) => onChange({ ...f, source })} label={title} />
    </div>
  );
}

function AddBackRow({ item, index, onChange, onRemove }) {
  const decide = (decision) => onChange({ ...item, decision: item.decision === decision ? null : decision });
  const pill = (d, text) => (
    <button
      type="button"
      aria-pressed={item.decision === d}
      onClick={() => decide(d)}
      className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-all ${
        item.decision === d ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="space-y-1.5 border-l-2 border-gray-200 pl-2" data-testid={`addback-${index}`}>
      <input
        type="text"
        value={item.label || ''}
        onChange={(e) => onChange({ ...item, label: e.target.value })}
        placeholder="Add-back, as the company names it"
        aria-label={`Add-back ${index + 1} name`}
        className="form-input text-[12px]"
      />
      <div className="grid grid-cols-12 gap-2 items-start">
        <div className="col-span-8">
          <NullableNumberInput value={item.amount ?? null} onChange={(v) => onChange({ ...item, amount: v })} prefix="$" allowNegative ariaLabel={`Add-back ${index + 1} amount`} />
        </div>
        <SourceInputs source={item.source} onChange={(source) => onChange({ ...item, source })} label={`Add-back ${index + 1}`} />
      </div>
      <div className="flex items-center gap-1.5">
        {pill('accepted', 'Accept')}
        {pill('rejected', 'Reject')}
        {!item.decision && <span className="text-[10px] text-amber-700">Not reviewed, excluded</span>}
        <button type="button" onClick={onRemove} className="ml-auto text-[10px] text-gray-400 hover:text-gray-700">Remove</button>
      </div>
    </div>
  );
}

function Comparison({ c }) {
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  const row = (label, value, strong) => (
    <div className="flex justify-between gap-4">
      <span className={strong ? 'font-semibold text-gray-800' : 'text-gray-600'}>{label}</span>
      <span className={strong ? 'font-semibold text-gray-900' : 'text-gray-700'}>{money(value)}</span>
    </div>
  );
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-[11px] space-y-0.5" data-testid={`comparison-${c.against}`}>
      {row('Built EBITDA', c.built, true)}
      {row(c.companyLabel, c.company, true)}
      {row('Gap', c.gap)}
      {c.against === 'adjusted' && row('Explained by listed add-backs', c.explainedByAddBacks)}
      {c.explainedByTreatment !== 0 && row('Explained by your treatment rules', c.explainedByTreatment)}
      <div className="flex justify-between gap-4 pt-1">
        <span className={c.overTolerance ? 'font-semibold text-amber-800' : 'text-gray-700'}>Unexplained</span>
        <span className={c.overTolerance ? 'font-semibold text-amber-800' : 'text-gray-700'}>
          {money(c.unexplained)}{c.unexplainedPct != null ? `, ${pct(c.unexplainedPct)} of built` : ''}
        </span>
      </div>
      <p className="text-gray-500 pt-1">
        Caveat above {pct(c.tolerance).replace('.0%', '%')}, your policy.{c.overTolerance ? ' Over it.' : ''}
      </p>
    </div>
  );
}

export default function EbitdaSourceSection({ financials, build, onChange }) {
  const adjusted = financials.adjustedEbitda;
  const addBacks = adjusted?.addBacks || [];
  const setAdjusted = (next) => onChange({ ...financials, adjustedEbitda: next });
  const setAddBacks = (list) => setAdjusted({ ...(adjusted || { value: null }), addBacks: list });
  const decided = addBacks.filter((a) => a.decision === 'accepted' || a.decision === 'rejected').length;
  const scoring = build?.derivations?.ebitda;

  return (
    <div className="border-t border-gray-200 pt-4 space-y-3" aria-label="EBITDA source">
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Company EBITDA</p>
        <p className="text-[11px] text-gray-500 mt-1">Optional. The company's own figures, compared with the built one. Which one scores is a judgment below.</p>
      </div>

      <CompanyFigure
        title="Stated EBITDA"
        hint="As the company names it"
        figure={financials.statedEbitda}
        onChange={(statedEbitda) => onChange({ ...financials, statedEbitda })}
      />
      <CompanyFigure
        title="Adjusted EBITDA"
        hint="e.g. Adjusted EBITDA"
        figure={adjusted}
        onChange={(next) => setAdjusted({ ...next, addBacks })}
      />

      {(adjusted?.value != null || addBacks.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold text-gray-700">Add-back bridge</p>
            {addBacks.length > 0 && <p className="text-[11px] text-gray-500">{decided} of {addBacks.length} reviewed</p>}
          </div>
          <p className="text-[11px] text-gray-500">Each line as the company lists it. Enter a deduction as a negative.</p>
          {addBacks.map((a, i) => (
            <AddBackRow
              key={i}
              index={i}
              item={a}
              onChange={(item) => setAddBacks(addBacks.map((x, j) => (j === i ? item : x)))}
              onRemove={() => setAddBacks(addBacks.filter((_, j) => j !== i))}
            />
          ))}
          <button
            type="button"
            onClick={() => setAddBacks([...addBacks, { label: '', amount: null, decision: null }])}
            className="text-[11px] font-semibold text-gray-900 underline"
          >
            Add a line
          </button>
        </div>
      )}

      {build?.comparisons?.map((c) => <Comparison key={c.against} c={c} />)}

      {scoring && build.ebitdaSource !== 'built' && (
        <p className="text-[11px] text-gray-700">Scoring on: <span className="font-semibold">{scoring.label}</span></p>
      )}
    </div>
  );
}
