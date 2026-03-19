import React, { useState, useMemo } from 'react';
import {
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  formatCurrency,
  DEFAULT_SOFR,
} from '../utils/calculations';

const STATUS_STYLE = {
  Performing: { bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/15', text: 'text-emerald-400' },
  'Paid Off': { bg: 'bg-blue-500/[0.08]', border: 'border-blue-500/15', text: 'text-blue-400' },
  Watchlist: { bg: 'bg-amber-500/[0.08]', border: 'border-amber-500/15', text: 'text-amber-400' },
  Defaulted: { bg: 'bg-rose-500/[0.08]', border: 'border-rose-500/15', text: 'text-rose-400' },
};

function scoreBg(s) {
  if (s >= 75) return 'bg-emerald-500/[0.08] border-emerald-500/15';
  if (s >= 55) return 'bg-lime-500/[0.08] border-lime-500/15';
  if (s >= 35) return 'bg-amber-500/[0.08] border-amber-500/15';
  return 'bg-rose-500/[0.08] border-rose-500/15';
}
function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400';
  if (s >= 55) return 'text-lime-400';
  if (s >= 35) return 'text-amber-400';
  return 'text-rose-400';
}

function modelAligned(score, status) {
  if (score >= 75 && (status === 'Performing' || status === 'Paid Off')) return true;
  if (score >= 55 && score < 75 && status === 'Performing') return true;
  if (score >= 35 && score < 55 && (status === 'Watchlist' || status === 'Defaulted')) return true;
  if (score < 35 && (status === 'Defaulted' || status === 'Watchlist')) return true;
  if (score < 75 && (status === 'Performing' || status === 'Paid Off')) return 'conservative';
  if (score >= 55 && (status === 'Defaulted' || status === 'Watchlist')) return false;
  return true;
}

export default function HistoricalDealsTable({ deals, sofr = DEFAULT_SOFR }) {
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('All');

  const scored = useMemo(() =>
    deals.map((d) => {
      const m = calculateMetrics(d.inputs, sofr);
      const rs = calculateRiskScore(d.inputs, m);
      const rec = getRecommendation(rs.composite);
      return { ...d, m, rs, rec, aligned: modelAligned(rs.composite, d.outcome.status) };
    }), [deals, sofr]);

  const filtered = filter === 'All' ? scored : scored.filter((d) => d.outcome.status === filter);

  const stats = useMemo(() => {
    const t = scored.length;
    const correct = scored.filter((d) => d.aligned === true).length;
    const conservative = scored.filter((d) => d.aligned === 'conservative').length;
    const defaults = scored.filter((d) => d.outcome.status === 'Defaulted');
    const caught = defaults.filter((d) => d.rs.composite < 55).length;
    return { t, correct, conservative, defaults: defaults.length, caught };
  }, [scored]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { v: stats.t, l: 'Historical Deals', c: 'text-slate-100', bg: 'glass-card' },
          { v: `${stats.correct + stats.conservative}/${stats.t}`, l: 'Directionally Correct', c: 'text-emerald-400', bg: 'bg-emerald-500/[0.06] border border-emerald-500/15' },
          { v: `${stats.caught}/${stats.defaults}`, l: 'Defaults Flagged', c: 'text-rose-400', bg: 'bg-rose-500/[0.06] border border-rose-500/15' },
          { v: `${Math.round(((stats.correct + stats.conservative) / stats.t) * 100)}%`, l: 'Model Accuracy', c: 'text-blue-400', bg: 'bg-blue-500/[0.06] border border-blue-500/15' },
        ].map((s) => (
          <div key={s.l} className={`${s.bg} rounded-2xl p-5 text-center`}>
            <p className={`text-2xl font-bold font-mono ${s.c}`}>{s.v}</p>
            <p className="text-[11px] text-slate-500 mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mr-1">Filter:</span>
        {['All', 'Performing', 'Paid Off', 'Watchlist', 'Defaulted'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium ${filter === s ? 'pill-btn-active' : 'text-slate-500'}`}
          >
            {s}
            <span className="text-slate-600 ml-1">
              ({s === 'All' ? scored.length : scored.filter((d) => d.outcome.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {/* Deal list */}
      <div className="space-y-3">
        {filtered.map((deal) => {
          const ss = STATUS_STYLE[deal.outcome.status] || STATUS_STYLE.Performing;
          const exp = expandedId === deal.id;
          const onTimePct = deal.outcome.paymentsMade > 0
            ? Math.round((deal.outcome.paymentsOnTime / deal.outcome.paymentsMade) * 100)
            : 0;

          return (
            <div key={deal.id} className={`glass-card rounded-2xl overflow-hidden transition-all ${exp ? 'ring-1 ring-blue-500/20' : ''}`}>
              <button
                onClick={() => setExpandedId(exp ? null : deal.id)}
                className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                {/* Score badge */}
                <div className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${scoreBg(deal.rs.composite)}`}>
                  <span className={`text-lg font-bold font-mono leading-none ${scoreColor(deal.rs.composite)}`}>
                    {deal.rs.composite}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-200 truncate">{deal.inputs.companyName}</span>
                    <span className="text-[10px] text-slate-600 font-mono flex-shrink-0">{deal.id}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{deal.inputs.industrySector}</span>
                    <span className="text-slate-700">&middot;</span>
                    <span>{deal.inputs.financingType || 'EFA'}</span>
                    <span className="text-slate-700">&middot;</span>
                    <span>{formatCurrency(deal.inputs.equipmentCost)}</span>
                    <span className="text-slate-700">&middot;</span>
                    <span>{deal.closedDate}</span>
                  </div>
                </div>

                {/* Status */}
                <div className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border flex-shrink-0 ${ss.bg} ${ss.border} ${ss.text}`}>
                  {deal.outcome.status}
                </div>

                {/* Alignment icon */}
                <div className="flex-shrink-0" title={
                  deal.aligned === true ? 'Correctly predicted' :
                  deal.aligned === 'conservative' ? 'Conservative — deal outperformed' : 'Risk not flagged'
                }>
                  {deal.aligned === true ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : deal.aligned === 'conservative' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-400" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>

                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  className={`text-slate-600 transition-transform flex-shrink-0 ${exp ? 'rotate-180' : ''}`} strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Expanded detail */}
              {exp && (
                <div className="px-5 pb-5 border-t border-white/[0.04] animate-slide-down">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
                    {/* Model */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Model Assessment
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { l: 'DSCR', v: `${deal.m.dscr.toFixed(2)}x` },
                          { l: 'Leverage', v: `${deal.m.leverage.toFixed(1)}x` },
                          { l: 'LTV', v: `${(deal.m.ltv * 100).toFixed(0)}%` },
                        ].map((x) => (
                          <div key={x.l} className="bg-white/[0.02] rounded-xl p-2.5 text-center">
                            <p className="text-[10px] text-slate-600">{x.l}</p>
                            <p className="font-mono font-semibold text-sm text-slate-200">{x.v}</p>
                          </div>
                        ))}
                      </div>
                      <div className={`rounded-xl p-3 border ${deal.rec.bgClass}`}>
                        <span className={`text-xs font-bold ${deal.rec.textClass}`}>{deal.rec.category}</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">{deal.rec.detail}</p>
                      </div>
                    </div>

                    {/* Actual */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Actual Performance
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { l: 'Months', v: deal.outcome.monthsCompleted },
                          { l: 'Payments', v: deal.outcome.paymentsMade },
                          { l: 'On-Time', v: `${onTimePct}%`, c: onTimePct >= 95 ? 'text-emerald-400' : onTimePct >= 80 ? 'text-amber-400' : 'text-rose-400' },
                        ].map((x) => (
                          <div key={x.l} className="bg-white/[0.02] rounded-xl p-2.5 text-center">
                            <p className="text-[10px] text-slate-600">{x.l}</p>
                            <p className={`font-mono font-semibold text-sm ${x.c || 'text-slate-200'}`}>{x.v}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white/[0.02] rounded-xl p-3">
                        <p className="text-[11px] text-slate-400 leading-relaxed">{deal.outcome.notes}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-slate-600 pt-2">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Correctly predicted
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-blue-400" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Conservative
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          Missed
        </span>
      </div>
    </div>
  );
}
