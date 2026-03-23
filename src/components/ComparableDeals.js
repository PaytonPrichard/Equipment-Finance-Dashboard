import React, { useMemo } from 'react';
import historicalDeals from '../data/historicalDeals';
import { calculateMetrics, calculateRiskScore, formatCurrency, formatRatio, DEFAULT_SOFR } from '../utils/calculations';

// Continuous proximity score: 1.0 at perfect match, decays toward 0
// tolerance = ratio at which score drops to ~0.5
function proximityScore(a, b, tolerance) {
  if (a <= 0 || b <= 0) return 0;
  const ratio = a > b ? a / b : b / a; // always >= 1
  // Exponential decay: score = e^(-k*(ratio-1)) where k = ln(2)/tolerance
  const k = Math.log(2) / (tolerance - 1);
  return Math.exp(-k * (ratio - 1));
}

function scoreSimilarity(current, candidate) {
  let score = 0;

  // Industry match (30 pts).exact match only
  if (current.industrySector === candidate.industrySector) score += 30;

  // Equipment type match (20 pts)
  if (current.equipmentType === candidate.equipmentType) score += 20;

  // Revenue proximity (15 pts).continuous decay, half-score at 3x difference
  score += proximityScore(current.annualRevenue, candidate.annualRevenue, 3) * 15;

  // EBITDA proximity (10 pts).half-score at 3x difference
  score += proximityScore(current.ebitda, candidate.ebitda, 3) * 10;

  // Equipment cost proximity (10 pts).half-score at 2.5x difference
  score += proximityScore(current.equipmentCost, candidate.equipmentCost, 2.5) * 10;

  // Credit rating match (10 pts).partial credit for adjacent ratings
  const CREDIT_ORDER = ['Strong', 'Adequate', 'Weak', 'Not Rated'];
  const ci = CREDIT_ORDER.indexOf(current.creditRating);
  const cj = CREDIT_ORDER.indexOf(candidate.creditRating);
  if (ci >= 0 && cj >= 0) {
    const diff = Math.abs(ci - cj);
    if (diff === 0) score += 10;
    else if (diff === 1) score += 5;
  }

  // Financing type match (5 pts)
  if ((current.financingType || 'EFA') === (candidate.financingType || 'EFA')) score += 5;

  return Math.round(score);
}

const OUTCOME_STYLES = {
  Performing: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  'Paid Off': { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  Watchlist: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  Defaulted: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

export default function ComparableDeals({ inputs, metrics, riskScore, sofr = DEFAULT_SOFR }) {
  const comparables = useMemo(() => {
    const currentName = (inputs.companyName || '').toLowerCase().trim();
    return historicalDeals
      .filter((deal) => {
        // Exclude the current deal if it matches a historical deal by name
        const histName = (deal.inputs.companyName || '').toLowerCase().trim();
        return !currentName || histName !== currentName;
      })
      .map((deal) => {
        const similarity = scoreSimilarity(inputs, deal.inputs);
        const m = calculateMetrics(deal.inputs, sofr);
        const rs = calculateRiskScore(deal.inputs, m);
        return { ...deal, similarity, m, rs };
      })
      .filter((d) => d.similarity >= 20)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 4);
  }, [inputs, sofr]);

  if (comparables.length === 0) return null;

  const performingCount = comparables.filter(
    (d) => d.outcome.status === 'Performing' || d.outcome.status === 'Paid Off'
  ).length;
  const troubledCount = comparables.filter(
    (d) => d.outcome.status === 'Watchlist' || d.outcome.status === 'Defaulted'
  ).length;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          Comparable Historical Deals
        </h3>
        <p className="text-[11px] text-gray-400">
          Most similar deals from portfolio history, matched by industry, equipment, size, and credit
        </p>
      </div>

      {/* Summary insight */}
      <div className={`rounded-xl p-3 flex items-center gap-3 ${
        performingCount > troubledCount
          ? 'bg-emerald-500/[0.06] border border-emerald-500/15'
          : troubledCount > performingCount
          ? 'bg-amber-500/[0.06] border border-amber-500/15'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          className={performingCount > troubledCount ? 'text-emerald-400' : troubledCount > performingCount ? 'text-amber-400' : 'text-gray-600'}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p className={`text-[12px] leading-relaxed ${
          performingCount > troubledCount ? 'text-emerald-700' : troubledCount > performingCount ? 'text-amber-700' : 'text-gray-700'
        }`}>
          {performingCount > troubledCount
            ? `${performingCount} of ${comparables.length} comparable deals are performing or paid off. Favorable precedent for this profile.`
            : troubledCount > performingCount
            ? `${troubledCount} of ${comparables.length} comparable deals are on watchlist or defaulted. Exercise caution with similar profiles.`
            : `Mixed outcomes among comparable deals. Results vary for this profile type.`}
        </p>
      </div>

      {/* Deal cards */}
      <div className="space-y-2.5">
        {comparables.map((deal) => {
          const os = OUTCOME_STYLES[deal.outcome.status] || OUTCOME_STYLES['Performing'];
          const scoreDelta = deal.rs.composite - riskScore.composite;

          return (
            <div key={deal.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-800">{deal.inputs.companyName || deal.id}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${os.bg} ${os.text} border ${os.border}`}>
                      {deal.outcome.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {deal.inputs.industrySector} &middot; {deal.inputs.equipmentType} &middot; {formatCurrency(deal.inputs.equipmentCost)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">Match</span>
                    <span className="text-sm font-bold font-mono text-gray-700">{deal.similarity}%</span>
                  </div>
                </div>
              </div>

              {/* Metric comparison */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-gray-400">Score</span>
                  <p className="font-mono text-sm font-semibold text-gray-800">
                    {deal.rs.composite}
                    {scoreDelta !== 0 && (
                      <span className={`text-[10px] ml-1 ${scoreDelta > 0 ? 'text-emerald-500' : scoreDelta < 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                        ({scoreDelta > 0 ? '+' : ''}{scoreDelta} vs your {riskScore.composite})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">DSCR</span>
                  <p className="font-mono text-sm font-semibold text-gray-800">{formatRatio(deal.m.dscr)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Leverage</span>
                  <p className="font-mono text-sm font-semibold text-gray-800">{formatRatio(deal.m.leverage)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">Revenue</span>
                  <p className="font-mono text-sm font-semibold text-gray-800">{formatCurrency(deal.inputs.annualRevenue)}</p>
                </div>
              </div>

              {/* Closure date if available */}
              {deal.closedDate && (
                <p className="text-[10px] text-gray-400 mt-2">
                  Closed: {deal.closedDate}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 italic">
        Comparability scored by industry, equipment type, deal size, credit rating, and revenue scale. Past performance is not indicative of future outcomes.
      </p>
    </div>
  );
}
