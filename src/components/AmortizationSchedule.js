import React, { useState, useMemo } from 'react';
import { generateAmortizationSchedule, formatCurrencyFull } from '../utils/calculations';

export default function AmortizationSchedule({ principal, annualRate, termMonths }) {
  const [isOpen, setIsOpen] = useState(false);

  const schedule = useMemo(
    () => generateAmortizationSchedule(principal, annualRate, termMonths),
    [principal, annualRate, termMonths]
  );

  if (!schedule || !schedule.years || schedule.years.length === 0) return null;

  const interestPct =
    schedule.totalCost > 0
      ? ((schedule.totalInterest / schedule.totalCost) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-400" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Amortization Schedule
            </h3>
            <p className="text-[11px] text-slate-500">
              {formatCurrencyFull(schedule.totalCost)} total cost &middot; {formatCurrencyFull(schedule.totalInterest)} interest ({interestPct}%)
            </p>
          </div>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500"
          strokeWidth="2"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/[0.02] rounded-xl px-3 py-2.5 text-center">
              <span className="text-[10px] text-slate-600">Total Principal</span>
              <p className="font-mono text-sm font-semibold text-slate-200">{formatCurrencyFull(schedule.totalPrincipal)}</p>
            </div>
            <div className="bg-white/[0.02] rounded-xl px-3 py-2.5 text-center">
              <span className="text-[10px] text-slate-600">Total Interest</span>
              <p className="font-mono text-sm font-semibold text-amber-400">{formatCurrencyFull(schedule.totalInterest)}</p>
            </div>
            <div className="bg-white/[0.02] rounded-xl px-3 py-2.5 text-center">
              <span className="text-[10px] text-slate-600">Total Cost</span>
              <p className="font-mono text-sm font-semibold text-slate-200">{formatCurrencyFull(schedule.totalCost)}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Year', 'Principal', 'Interest', 'Total Payment', 'Ending Balance'].map((h) => (
                    <th key={h} className="text-[10px] font-bold text-slate-600 uppercase tracking-wider text-right pb-2 px-2 first:text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.years.map((row) => {
                  const principalPct =
                    row.totalPayment > 0 ? (row.principal / row.totalPayment) * 100 : 0;
                  return (
                    <tr key={row.year} className="border-b border-white/[0.03] last:border-0">
                      <td className="py-2 px-2 text-[12px] text-slate-400 font-semibold">
                        Yr {row.year}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-mono text-[12px] text-slate-300">{formatCurrencyFull(row.principal)}</span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-mono text-[12px] text-slate-400">{formatCurrencyFull(row.interest)}</span>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <div>
                          <span className="font-mono text-[12px] text-slate-300">{formatCurrencyFull(row.totalPayment)}</span>
                          {/* Mini principal/interest ratio bar */}
                          <div className="h-1 mt-1 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className="h-full bg-blue-500/40 rounded-full"
                              style={{ width: `${principalPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <span className="font-mono text-[12px] text-slate-400">{formatCurrencyFull(row.endingBalance)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-blue-500/40" /> Principal portion
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 rounded-full bg-white/[0.04]" /> Interest portion
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
