// ============================================================
// DealProvenance — where these numbers came from.
//
// The one place that shows the whole chain: documents in, fields out,
// what the analyst changed, how the fields rolled into factors, and what
// the composite was judged against.
//
// It exists because "the model does not make anything up" is a claim, and
// a claim an analyst cannot inspect is just a claim. Every row here is
// traceable: a value, the document that supplied it, and whether a person
// overrode it.
//
// Nothing on this screen is computed specially for it. Field sources come
// from the merge, factors from the module's describeFactors, the verdict
// from evaluateScreening. If the chain is wrong, the deal is wrong.
// ============================================================

import React, { useMemo, useState } from 'react';
import { valuesAgree, DOCUMENT_TYPE_LABELS } from '../lib/extractionMerge';

const FIELD_LABELS = {
  companyName: 'Company', annualRevenue: 'Revenue', priorYearRevenue: 'Prior revenue',
  ebitda: 'EBITDA', priorYearEbitda: 'Prior EBITDA', yearsInBusiness: 'Years in business',
  totalExistingDebt: 'Existing debt', actualAnnualDebtService: 'Annual debt service',
  maintenanceCapex: 'Maintenance capex', cashOnHand: 'Cash', availableLiquidity: 'Liquidity',
  industrySector: 'Industry', creditRating: 'Credit rating', equipmentType: 'Equipment type',
  equipmentCondition: 'Condition', equipmentCost: 'Equipment cost', downPayment: 'Down payment',
  financingType: 'Structure', usefulLife: 'Useful life', loanTerm: 'Term',
  essentialUse: 'Essential use', totalAROutstanding: 'Total AR',
  requestedAdvanceRate: 'Advance rate', arUnder30: 'AR 0-30', arOver30: 'AR 31-60',
  arOver60: 'AR 61-90', arOver90: 'AR 90+', topCustomerConcentration: 'Top customer',
  dilutionRate: 'Dilution', ineligiblesPct: 'Ineligibles', existingABLFacility: 'Existing ABL',
  totalInventory: 'Total inventory', rawMaterials: 'Raw materials', workInProgress: 'WIP',
  finishedGoods: 'Finished goods', obsoleteInventory: 'Obsolete',
  inventoryTurnover: 'Turnover', averageDaysOnHand: 'Days on hand', nolvPct: 'NOLV',
  perishable: 'Perishable',
};

const labelFor = (k) => FIELD_LABELS[k] || k;

function display(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  return String(v);
}

// How a field got its current value. The distinction that matters is
// extracted-and-accepted versus extracted-and-corrected: the second means
// a person looked at the document and disagreed with the reading.
const ORIGIN = {
  extracted: { label: 'From document', cls: 'text-gray-500' },
  corrected: { label: 'Analyst corrected', cls: 'text-amber-700 font-medium' },
  manual: { label: 'Entered by analyst', cls: 'text-gray-500' },
};

function classifyField(field, currentValue, source) {
  if (!source) return 'manual';
  return valuesAgree(currentValue, source.value) ? 'extracted' : 'corrected';
}

export default function DealProvenance({
  inputs,
  provenance,
  factors = [],
  riskScore,
  screeningResult,
  criteria,
  moduleInitialInputs = {},
}) {
  const [showAllFields, setShowAllFields] = useState(false);

  const rows = useMemo(() => {
    const sources = provenance?.fieldSources || {};
    const out = [];
    for (const [field, value] of Object.entries(inputs || {})) {
      const isDefault = valuesAgree(value, moduleInitialInputs[field]);
      const source = sources[field];
      // A field left at its default that no document mentioned carries no
      // information; showing it would bury the rows that do.
      if (!source && isDefault) continue;
      if (value === undefined || value === null || value === '') continue;
      out.push({ field, value, source, origin: classifyField(field, value, source) });
    }
    const rank = { corrected: 0, extracted: 1, manual: 2 };
    return out.sort((a, b) => rank[a.origin] - rank[b.origin] || labelFor(a.field).localeCompare(labelFor(b.field)));
  }, [inputs, provenance, moduleInitialInputs]);

  const documents = provenance?.documents || [];
  const conflicts = provenance?.conflicts || [];
  const corrected = rows.filter((r) => r.origin === 'corrected');
  const visibleRows = showAllFields ? rows : rows.slice(0, 8);

  const composite = riskScore?.composite ?? null;
  const verdict = (screeningResult?.verdict || '').toUpperCase();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-[15px] font-bold text-gray-900">Where these numbers came from</h3>
        {composite != null && (
          <span className="text-[11px] text-gray-400 font-mono">
            {rows.length} fields &rarr; {factors.length} factors &rarr; {composite}/100
          </span>
        )}
      </div>
      <p className="text-[12px] text-gray-500 mb-4 max-w-[65ch]">
        Every value below is traceable to a document you uploaded or to something you typed.
        Nothing on this screen was written by a model.
      </p>

      {/* ---- 1. Documents ---- */}
      <section className="mb-5">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Source documents
        </div>
        {documents.length === 0 ? (
          <div className="text-[12px] text-gray-500 rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
            No documents. Every figure in this deal was entered by hand.
          </div>
        ) : (
          <div className="space-y-1">
            {documents.map((d) => (
              <div
                key={d.fileName}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-gray-900 truncate">{d.fileName}</div>
                  <div className="text-[11px] text-gray-500">
                    {DOCUMENT_TYPE_LABELS[d.documentType] || 'Document'}
                  </div>
                </div>
                <div className="text-[11px] text-gray-400 font-mono flex-shrink-0">
                  {d.fieldCount} {d.fieldCount === 1 ? 'field' : 'fields'}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- 2. Disagreements ---- */}
      {conflicts.length > 0 && (
        <section className="mb-5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Where the documents disagreed
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
            {conflicts.map((c) => (
              <div key={c.field} className="text-[11px] leading-snug text-gray-700">
                <span className="font-semibold text-gray-900">{labelFor(c.field)}:</span>{' '}
                used <span className="font-medium text-gray-900">{display(c.chosen.value)}</span> from{' '}
                <span className="text-gray-600">{c.chosen.fileName}</span>.
                {c.alternatives.map((alt) => (
                  <span key={alt.fileName}>
                    {' '}{alt.fileName} said {display(alt.value)}.
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- 3. Field by field ---- */}
      <section className="mb-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Field by field
          </div>
          {corrected.length > 0 && (
            <div className="text-[11px] text-amber-700">
              {corrected.length} corrected by you
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="text-left font-semibold pb-1.5 pr-3">Field</th>
                <th className="text-right font-semibold pb-1.5 pr-3">Value</th>
                <th className="text-left font-semibold pb-1.5 pr-3">Origin</th>
                <th className="text-left font-semibold pb-1.5">Document</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.field} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-900">{labelFor(r.field)}</td>
                  <td className="py-1.5 pr-3 text-right font-mono text-gray-900 tabular-nums">
                    {display(r.value)}
                  </td>
                  <td className={`py-1.5 pr-3 ${ORIGIN[r.origin].cls}`}>
                    {ORIGIN[r.origin].label}
                    {r.origin === 'corrected' && (
                      <span className="text-gray-400"> (was {display(r.source.value)})</span>
                    )}
                  </td>
                  <td className="py-1.5 text-gray-400 truncate max-w-[180px]">
                    {r.source ? r.source.fileName : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 8 && (
          <button
            onClick={() => setShowAllFields(!showAllFields)}
            className="mt-2 text-[11px] text-gray-500 hover:text-gray-800 transition-colors"
          >
            {showAllFields ? 'Show fewer' : `Show all ${rows.length} fields`}
          </button>
        )}
      </section>

      {/* ---- 4. How the fields became a score ---- */}
      {factors.length > 0 && (
        <section className="mb-5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            How that scored
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                  <th className="text-left font-semibold pb-1.5 pr-3">Factor</th>
                  <th className="text-left font-semibold pb-1.5 pr-3">Value</th>
                  <th className="text-left font-semibold pb-1.5 pr-3">Target</th>
                  <th className="text-right font-semibold pb-1.5 pr-3">Score</th>
                  <th className="text-right font-semibold pb-1.5">Weight</th>
                </tr>
              </thead>
              <tbody>
                {factors.map((f) => (
                  <tr key={f.key} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 text-gray-900">{f.label}</td>
                    <td className="py-1.5 pr-3 text-gray-600">{f.caption}</td>
                    <td className={`py-1.5 pr-3 ${f.passed ? 'text-gray-400' : 'text-amber-700'}`}>
                      {f.target}
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-gray-900">
                      {Math.round(f.score)}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-gray-400">
                      {Math.round(f.weight * 100)}%
                    </td>
                  </tr>
                ))}
                {composite != null && (
                  <tr className="border-t-2 border-gray-300">
                    <td className="py-2 pr-3 font-semibold text-gray-900" colSpan={3}>
                      Weighted composite
                    </td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums font-bold text-gray-900">
                      {composite}
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-gray-400">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- 5. The policy it was judged against ---- */}
      {criteria && composite != null && (
        <section>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Judged against
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5 text-[12px] text-gray-700">
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono tabular-nums text-[11px]">
              <span>Composite <strong className="text-gray-900">{composite}</strong></span>
              <span>Pass at <strong className="text-gray-900">{criteria.passScore}</strong></span>
              <span>Flag at <strong className="text-gray-900">{criteria.flagScore}</strong></span>
              {verdict && <span>Verdict <strong className="text-gray-900">{verdict}</strong></span>}
            </div>
            {(screeningResult?.reasons || []).length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {screeningResult.reasons.map((r, i) => (
                  <li key={i} className="text-[11px] text-gray-600">
                    <span className={r.level === 'fail' ? 'text-rose-700' : 'text-amber-700'}>
                      {r.level === 'fail' ? 'Fail' : 'Flag'}
                    </span>
                    {' · '}{r.text}
                  </li>
                ))}
              </ul>
            )}
            <div className="text-[11px] text-gray-400 mt-2">
              Thresholds are your firm's, set in Settings. The memo prints them alongside the score.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
