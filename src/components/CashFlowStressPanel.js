import React from 'react';
import { formatCurrency } from '../utils/calculations';
import { describeMissing } from '../utils/cashFlowMetrics';

// Cash-flow stress table. The numbers come from computeCashFlowAnalysis,
// the same call evaluateScreening makes, so this table and the verdict
// always agree. Colors are judged against the firm's floors.

function ratioClass(value, floor) {
  if (value == null) return 'text-gray-400';
  if (value < 1.0) return 'text-rose-600';
  if (floor > 0 && value < floor) return 'text-amber-600';
  return 'text-gray-800';
}

const fmt = (v) => (v == null || !Number.isFinite(v) ? 'n/a' : `${v.toFixed(2)}x`);

export default function CashFlowStressPanel({ analysis, criteria }) {
  if (!analysis) return null;
  const showCf = analysis.base.cashFlowDscr != null;
  const showFccr = analysis.base.fccr != null;
  // Columns vary with what was provided, so the template is inline rather
  // than a Tailwind class, which the precompiled stylesheet could not know.
  const cols = ['1.6fr', '0.8fr', '0.6fr', showCf && '0.7fr', showFccr && '0.6fr'].filter(Boolean).join(' ');
  const grid = 'grid gap-3';

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-5">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Cash-Flow Stress
        </h3>
        <p className="text-[11px] text-gray-400">
          Cash left for the lender after taxes, capex and working capital
        </p>
      </div>

      {(!showCf || !showFccr) && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 space-y-1">
          {!showCf && analysis.missing.cashFlowDscr.length > 0 && (
            <p className="text-[11px] text-amber-700">
              Cash-flow DSCR not provided. Add {describeMissing(analysis.missing.cashFlowDscr)}.
            </p>
          )}
          {!showFccr && analysis.missing.fccr.length > 0 && (
            <p className="text-[11px] text-amber-700">
              FCCR not provided. Add {describeMissing(analysis.missing.fccr)}.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className={`${grid} px-3 pb-1`} style={{ gridTemplateColumns: cols }}>
          <span className="text-[10px] text-gray-400">Scenario</span>
          <span className="text-[10px] text-gray-400">EBITDA</span>
          <span className="text-[10px] text-gray-400">DSCR</span>
          {showCf && <span className="text-[10px] text-gray-400">Cash-flow DSCR</span>}
          {showFccr && <span className="text-[10px] text-gray-400">FCCR</span>}
        </div>

        {analysis.scenarios.map((row) => {
          const gates = row.kind === 'combined';
          return (
            <div
              key={row.key}
              className={`${grid} items-center px-3 py-2.5 rounded-xl ${gates ? 'bg-gray-100 border border-gray-200' : 'bg-gray-50'}`}
              style={{ gridTemplateColumns: cols }}
            >
              <div className="min-w-0">
                <div className="font-mono font-semibold text-sm text-gray-800">{row.label}</div>
                <div className="text-[10px] text-gray-400">{row.detail}</div>
                {gates && <div className="text-[10px] text-gray-500 font-semibold">Below 1.0x flags the deal</div>}
              </div>
              <span className="font-mono font-semibold text-sm text-gray-800">{formatCurrency(row.ebitda)}</span>
              <span className={`font-mono font-semibold text-sm ${ratioClass(row.dscr, 0)}`}>{fmt(row.dscr)}</span>
              {showCf && (
                <span className={`font-mono font-semibold text-sm ${ratioClass(row.cashFlowDscr, criteria?.minCashFlowDscr)}`}>{fmt(row.cashFlowDscr)}</span>
              )}
              {showFccr && (
                <span className={`font-mono font-semibold text-sm ${ratioClass(row.fccr, criteria?.minFccr)}`}>{fmt(row.fccr)}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 px-3 py-2 rounded-lg bg-gray-50 space-y-1">
        {analysis.assumptions.map((a) => (
          <p key={a} className="text-[10px] text-gray-400">{a}</p>
        ))}
        <p className="text-[10px] text-gray-400">
          Floors: cash-flow DSCR {criteria?.minCashFlowDscr > 0 ? `${criteria.minCashFlowDscr.toFixed(2)}x` : 'off'}, FCCR {criteria?.minFccr > 0 ? `${criteria.minFccr.toFixed(2)}x` : 'off'}. Floors and scenarios are set in Screening Policy.
        </p>
      </div>
    </div>
  );
}
