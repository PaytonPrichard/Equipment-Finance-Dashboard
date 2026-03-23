import React, { useMemo } from 'react';
import historicalDeals from '../data/historicalDeals';
import { calculateMetrics, calculateRiskScore, formatRatio, formatPercent, DEFAULT_SOFR } from '../utils/calculations';

// Define whether higher or lower is "better" for each metric,
// so we can color-code the comparison arrows correctly.
const METRIC_DEFS = [
  { key: 'dscr',                 label: 'DSCR',                 format: formatRatio,                       higherIsBetter: true  },
  { key: 'leverage',             label: 'Leverage',             format: formatRatio,                       higherIsBetter: false },
  { key: 'ltv',                  label: 'LTV',                  format: (v) => formatPercent(v * 100),     higherIsBetter: false },
  { key: 'termCoverage',         label: 'Term Coverage',        format: (v) => formatPercent(v),           higherIsBetter: false },
  { key: 'revenueConcentration', label: 'Revenue Concentration',format: (v) => formatPercent(v),           higherIsBetter: false },
  { key: 'riskScore',            label: 'Risk Score',           format: (v) => String(Math.round(v)),      higherIsBetter: true  },
];

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export default function IndustryBenchmarks({ inputs, metrics, riskScore, sofr = DEFAULT_SOFR }) {
  const industry = inputs.industrySector;

  const currentName = (inputs.companyName || '').toLowerCase().trim();

  const { industryAverages, dealCount, smallSample } = useMemo(() => {
    // Filter historical deals to the same industry, EXCLUDING the current deal by name
    const sameIndustry = historicalDeals.filter((deal) => {
      if (deal.inputs.industrySector !== industry) return false;
      // Exclude the current company so a deal doesn't benchmark against itself
      const histName = (deal.inputs.companyName || '').toLowerCase().trim();
      if (currentName && histName === currentName) return false;
      return true;
    });

    if (sameIndustry.length === 0) {
      return { industryAverages: null, dealCount: 0, smallSample: true };
    }

    // Calculate metrics and risk score for each historical deal
    const computed = sameIndustry.map((deal) => {
      const m = calculateMetrics(deal.inputs, sofr);
      const rs = calculateRiskScore(deal.inputs, m);
      return { m, rs };
    });

    return {
      industryAverages: {
        dscr: average(computed.map((c) => c.m.dscr)),
        leverage: average(computed.map((c) => c.m.leverage)),
        ltv: average(computed.map((c) => c.m.ltv)),
        termCoverage: average(computed.map((c) => c.m.termCoverage)),
        revenueConcentration: average(computed.map((c) => c.m.revenueConcentration)),
        riskScore: average(computed.map((c) => c.rs.composite)),
      },
      dealCount: sameIndustry.length,
      smallSample: sameIndustry.length < 3,
    };
  }, [industry, sofr, currentName]);

  // Current deal values (including the risk score composite)
  const currentValues = useMemo(() => ({
    dscr: metrics.dscr,
    leverage: metrics.leverage,
    ltv: metrics.ltv,
    termCoverage: metrics.termCoverage,
    revenueConcentration: metrics.revenueConcentration,
    riskScore: riskScore.composite,
  }), [metrics, riskScore]);

  if (!industryAverages) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Industry Benchmarks
        </h3>
        <div className="mt-4 rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-500">
            No historical data for <span className="font-semibold text-gray-700">{industry}</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Benchmarks will appear once comparable deals exist in the portfolio.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Industry Benchmarks
        </h3>
        <p className="text-[11px] text-gray-400">
          Comparison against {dealCount} historical {industry} deal{dealCount !== 1 ? 's' : ''} in the portfolio
          {currentName && <span className="text-gray-400"> (excluding current company)</span>}
        </p>
        {smallSample && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400 flex-shrink-0" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-[11px] text-amber-300">
              Limited sample — only {dealCount} comparable deal{dealCount !== 1 ? 's' : ''}. Averages may not be representative.
            </span>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="space-y-2">
        {/* Column Headers */}
        <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.5fr] gap-3 px-3 pb-1">
          <span className="text-[10px] text-gray-400">Metric</span>
          <span className="text-[10px] text-gray-400 text-right">This Deal</span>
          <span className="text-[10px] text-gray-400 text-right">Industry Avg</span>
          <span className="text-[10px] text-gray-400 text-center">vs Avg</span>
        </div>

        {/* Rows */}
        {METRIC_DEFS.map((def) => {
          const current = currentValues[def.key];
          const avg = industryAverages[def.key];
          const delta = current - avg;
          const isBetter = def.higherIsBetter ? delta > 0 : delta < 0;
          // Treat very small differences as neutral
          const isNeutral = Math.abs(delta) < 0.01;

          let arrowColor, arrowChar;
          if (isNeutral) {
            arrowColor = 'text-gray-400';
            arrowChar = '—';
          } else if (isBetter) {
            arrowColor = 'text-emerald-400';
            arrowChar = '\u25B2'; // up triangle
          } else {
            arrowColor = 'text-rose-400';
            arrowChar = '\u25BC'; // down triangle
          }

          // For "better = lower" metrics where current < avg, the arrow should
          // still point down visually but be green (favorable). And vice versa.
          // Re-derive the visual arrow direction based on the raw delta sign.
          if (!isNeutral) {
            arrowChar = delta > 0 ? '\u25B2' : '\u25BC';
          }

          return (
            <div
              key={def.key}
              className="bg-gray-50 rounded-xl grid grid-cols-[1.2fr_0.8fr_0.8fr_0.5fr] gap-3 items-center px-3 py-2.5"
            >
              <span className="text-sm text-gray-700 font-medium">{def.label}</span>
              <span className="font-mono font-semibold text-sm text-gray-800 text-right">
                {def.format(current)}
              </span>
              <span className="font-mono font-semibold text-sm text-gray-500 text-right">
                {def.format(avg)}
              </span>
              <div className="flex justify-center">
                <span className={`font-mono font-bold text-sm ${arrowColor}`}>
                  {arrowChar}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 font-mono text-xs font-bold">{'\u25B2'}</span>
          <span className="text-[10px] text-gray-400">Better than avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-rose-400 font-mono text-xs font-bold">{'\u25BC'}</span>
          <span className="text-[10px] text-gray-400">Worse than avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-mono text-xs font-bold">—</span>
          <span className="text-[10px] text-gray-400">At average</span>
        </div>
      </div>

      {/* Footnote */}
      <p className="text-[10px] text-gray-400 italic">
        Averages based on {dealCount} historical {industry} deal{dealCount !== 1 ? 's' : ''}. Benchmarks are for screening context only and do not constitute credit guidance.
      </p>
    </div>
  );
}
