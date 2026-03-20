import React from 'react';
import { formatCurrency } from '../utils/calculations';

function getDscrColor(dscr) {
  if (dscr >= 1.5) return { text: 'text-emerald-400', bg: 'bg-emerald-500', bar: 'bg-emerald-500/60', label: 'Strong' };
  if (dscr >= 1.25) return { text: 'text-gold-400', bg: 'bg-gold-500', bar: 'bg-gold-500/60', label: 'Adequate' };
  if (dscr >= 1.0) return { text: 'text-amber-400', bg: 'bg-amber-500', bar: 'bg-amber-500/60', label: 'Warning' };
  return { text: 'text-rose-400', bg: 'bg-rose-500', bar: 'bg-rose-500/60', label: 'Danger' };
}

function StatusIcon({ dscr }) {
  if (dscr >= 1.25) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (dscr >= 1.0) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function StressTestPanel({ stressResults }) {
  if (!stressResults || stressResults.length === 0) return null;

  const maxDscr = Math.max(...stressResults.map((r) => r.dscr), 1);

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Sensitivity Analysis
        </h3>
        <p className="text-[11px] text-slate-500">
          EBITDA stress scenarios — same debt service obligations
        </p>
      </div>

      {/* Scenario Table */}
      <div className="space-y-2">
        {/* Column Headers */}
        <div className="grid grid-cols-[1.4fr_0.9fr_0.7fr_0.6fr_0.3fr] gap-3 px-3 pb-1">
          <span className="text-[10px] text-slate-600">Scenario</span>
          <span className="text-[10px] text-slate-600">EBITDA</span>
          <span className="text-[10px] text-slate-600">DSCR</span>
          <span className="text-[10px] text-slate-600">Score</span>
          <span className="text-[10px] text-slate-600 text-center">Status</span>
        </div>

        {/* Rows */}
        {stressResults.map((row, i) => {
          const color = getDscrColor(row.dscr);
          return (
            <div
              key={i}
              className="bg-white/[0.02] rounded-xl grid grid-cols-[1.4fr_0.9fr_0.7fr_0.6fr_0.3fr] gap-3 items-center px-3 py-2.5"
            >
              <div>
                <span className="font-mono font-semibold text-sm text-slate-200">
                  {row.label}
                </span>
                {row.decline > 0 && (
                  <span className="text-[10px] text-slate-600 ml-1.5">
                    -{(row.decline * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <span className="font-mono font-semibold text-sm text-slate-200">
                {formatCurrency(row.ebitda)}
              </span>
              <span className={`font-mono font-semibold text-sm ${color.text}`}>
                {row.dscr.toFixed(2)}x
              </span>
              <span className="font-mono font-semibold text-sm text-slate-200">
                {row.score}
              </span>
              <div className="flex justify-center">
                <StatusIcon dscr={row.dscr} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini Bar Chart */}
      <div className="mt-6 mb-2">
        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          DSCR Comparison
        </h4>
        <div className="space-y-2">
          {stressResults.map((row, i) => {
            const color = getDscrColor(row.dscr);
            const widthPct = Math.max((row.dscr / maxDscr) * 100, 2);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-[10px] text-slate-600 w-28 truncate flex-shrink-0">
                  {row.label}
                </span>
                <div className="flex-1 h-5 bg-white/[0.02] rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${color.bar} rounded-lg`}
                    style={{ width: `${widthPct}%`, transition: 'width 0.6s ease' }}
                  />
                  {/* 1.0x threshold marker */}
                  {maxDscr > 0 && (
                    <div
                      className="absolute top-0 h-full w-px bg-slate-500/40"
                      style={{ left: `${(1.0 / maxDscr) * 100}%` }}
                    />
                  )}
                </div>
                <span className={`font-mono font-semibold text-sm ${color.text} w-14 text-right flex-shrink-0`}>
                  {row.dscr.toFixed(2)}x
                </span>
              </div>
            );
          })}
        </div>
        {/* 1.0x label */}
        <div className="flex items-center gap-3 mt-1">
          <span className="w-28 flex-shrink-0" />
          <div className="flex-1 relative">
            {maxDscr > 0 && (
              <span
                className="absolute text-[9px] text-slate-600 -translate-x-1/2"
                style={{ left: `${(1.0 / maxDscr) * 100}%` }}
              >
                1.0x
              </span>
            )}
          </div>
          <span className="w-14 flex-shrink-0" />
        </div>
      </div>

      {/* Note */}
      <div className="mt-4 px-3 py-2 rounded-lg bg-white/[0.02]">
        <p className="text-[10px] text-slate-600">
          DSCR below 1.0x indicates inability to service debt from operating cash flow
        </p>
      </div>
    </div>
  );
}
