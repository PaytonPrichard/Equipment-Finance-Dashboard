import React, { useState, useEffect } from 'react';
import { DEFAULT_TREATMENT_RULES, TREATMENT_ROWS, treatmentOptions, validateTreatmentRules } from '../lib/borrowerBuild';
import { TREATMENT_COPY } from '../utils/statementFormat';

// Wording shared with the New Deal form and the memo.
export { TREATMENT_COPY };

const SAVED_NOTICE = 'Saved. New screens use these rules. Deals already saved keep the rules they were built with.';

/**
 * Firm treatment rules for building EBITDA, debt and debt service from
 * statements. Admins edit, everyone else reads. `onSave(rules)` resolves
 * true on success.
 */
export default function TreatmentRulesCard({ rules: savedRaw, editable, onSave }) {
  const saved = validateTreatmentRules(savedRaw);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const savedKey = JSON.stringify(saved);

  useEffect(() => { setDraft(JSON.parse(savedKey)); }, [savedKey]);

  const dirty = JSON.stringify(draft) !== savedKey;
  const tolerancePct = Math.round(draft.ebitdaGapTolerance * 1000) / 10;

  const update = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    setNotice(null);
  };

  const save = async () => {
    setSaving(true);
    const ok = await onSave(validateTreatmentRules(draft));
    setSaving(false);
    if (ok) setNotice(SAVED_NOTICE);
  };

  return (
    <div>
      <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Treatment Rules</h4>
      <p className="text-[12px] text-gray-400 mb-3">
        How EBITDA, debt and debt service are built from statements. Analysts can override per deal, with a reason.
      </p>
      <div className="space-y-3">
        {TREATMENT_ROWS.map((row) => {
          const meta = TREATMENT_COPY[row];
          const current = draft[row];
          return (
            <fieldset key={row} className="border border-gray-200 rounded-xl p-3">
              <legend className="px-1 text-[12px] font-semibold text-gray-900">{meta.label}</legend>
              <div className="space-y-1.5">
                {treatmentOptions(row).map((opt) => (
                  <label key={opt} className={`flex items-start gap-2 ${editable ? 'cursor-pointer' : ''}`}>
                    <input
                      type="radio"
                      name={`treatment-${row}`}
                      value={opt}
                      checked={current === opt}
                      disabled={!editable}
                      onChange={() => update({ [row]: opt })}
                      className="mt-1"
                      style={{ accentColor: '#111827' }}
                    />
                    <span>
                      <span className="text-[12px] text-gray-900 font-medium">{meta.options[opt].label}</span>
                      {opt === DEFAULT_TREATMENT_RULES[row] && <span className="ml-1.5 text-[10px] text-gray-400">Tranche default</span>}
                      <span className="block text-[11px] text-gray-500">{meta.options[opt].detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

        <div className="border border-gray-200 rounded-xl p-3">
          <label htmlFor="treatment-gap-tolerance" className="block text-[12px] font-semibold text-gray-900">
            EBITDA gap tolerance
          </label>
          <p className="text-[11px] text-gray-500 mb-2">
            Unexplained gap between built and company EBITDA above this shows a caveat. Tranche default 5%.
          </p>
          <div className="relative w-32">
            <input
              id="treatment-gap-tolerance"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={tolerancePct}
              disabled={!editable}
              onChange={(e) => {
                const pct = parseFloat(e.target.value);
                if (Number.isFinite(pct) && pct >= 0 && pct <= 100) update({ ebitdaGapTolerance: pct / 100 });
              }}
              className="w-full px-3.5 py-2 pr-8 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/40 disabled:text-gray-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
          </div>
        </div>
      </div>

      {editable ? (
        <div className="mt-3">
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 text-[12px] font-semibold hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save treatment rules'}
          </button>
          {notice && <p role="status" className="mt-2 text-[11px] text-gray-600">{notice}</p>}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-gray-400">Set by your firm's admin.</p>
      )}
    </div>
  );
}
