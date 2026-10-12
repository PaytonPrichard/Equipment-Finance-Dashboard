import React from 'react';
import { BUILT_FIELDS, pendingJudgments, debtGap, rulesOutOfDate } from '../lib/statementBuild';
import { BUILT_FIELD_LABELS } from '../utils/statementFormat';

// Borrower Profile's view of the statements: offer them, or say in one line
// what they build and what is left, with the way into the full-width view.

export default function StatementsSummary({ inputs, state, treatmentRules, onAdd, onOpen }) {
  const financials = inputs.financials;
  if (!financials) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold text-gray-800">Financial statements</p>
          <p className="text-[11px] text-gray-500">Build revenue, EBITDA, debt and debt service from the statement line items.</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-[11px] font-semibold hover:bg-gray-200 transition-all flex-shrink-0"
        >
          Add statements
        </button>
      </div>
    );
  }

  const built = BUILT_FIELDS.filter((f) => state?.built?.[f] !== undefined).map((f) => BUILT_FIELD_LABELS[f]);
  const pending = pendingJudgments(state || {});
  const gap = debtGap(state || {}, inputs);
  const stale = rulesOutOfDate(inputs, treatmentRules);
  const todo = [
    stale && 'firm rules changed',
    pending > 0 && `${pending} judgment${pending === 1 ? '' : 's'} to confirm`,
    gap && 'debt lines needed',
  ].filter(Boolean);

  return (
    <div className="rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4" data-testid="statements-summary">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-gray-800">
          Financial statements{financials.fiscalYearEnd ? `, FYE ${financials.fiscalYearEnd}` : ''}
        </p>
        <p className="text-[11px] text-gray-500">
          {built.length ? `Builds ${built.join(', ')}.` : 'Nothing built yet.'}
          {todo.length > 0 && <span className="text-amber-700"> Still to do: {todo.join(', ')}.</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="px-3 py-2 rounded-lg bg-gray-900 text-white text-[11px] font-semibold hover:bg-gray-800 transition-all flex-shrink-0"
      >
        Edit statements
      </button>
    </div>
  );
}
