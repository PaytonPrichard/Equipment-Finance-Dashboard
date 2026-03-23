import React, { useState, useMemo, useRef, useEffect } from 'react';
import { formatCurrency, formatRatio, formatPercent } from '../utils/format';
import { getModule } from '../modules';
import { DEFAULT_SOFR } from '../modules/equipment-finance/constants';

// Score deals using the appropriate module based on deal inputs
function scoreDeal(deal, sofr) {
  // Detect module from deal inputs
  const moduleKey = deal.inputs?.totalAROutstanding ? 'accounts_receivable'
    : deal.inputs?.totalInventory ? 'inventory_finance'
    : 'equipment_finance';
  const mod = getModule(moduleKey);
  const metrics = mod.calculateMetrics(deal.inputs, sofr);
  const riskScore = mod.calculateRiskScore(deal.inputs, metrics);
  const rec = mod.getRecommendation(riskScore.composite);
  return { metrics, riskScore, rec, moduleKey };
}

function scoreBadgeClasses(score) {
  if (score >= 75) return 'bg-emerald-500/[0.08] border-emerald-500/15 text-emerald-400';
  if (score >= 55) return 'bg-lime-500/[0.08] border-lime-500/15 text-lime-400';
  if (score >= 35) return 'bg-amber-500/[0.08] border-amber-500/15 text-amber-400';
  return 'bg-rose-500/[0.08] border-rose-500/15 text-rose-400';
}

// Define which direction is "better" for each metric row.
// 'higher' = higher is better, 'lower' = lower is better, null = no comparison.
const METRIC_ROWS = [
  { key: 'riskScore',     label: 'Risk Score',       direction: 'higher', format: (v) => v },
  { key: 'recommendation', label: 'Recommendation',   direction: null,     format: (v) => v },
  { key: 'dscr',          label: 'DSCR',             direction: 'higher', format: (v) => formatRatio(v) },
  { key: 'leverage',      label: 'Leverage',          direction: 'lower',  format: (v) => formatRatio(v) },
  { key: 'ltv',           label: 'LTV',               direction: 'lower',  format: (v) => formatPercent(v * 100) },
  { key: 'termCoverage',  label: 'Term / Life',       direction: 'lower',  format: (v) => formatPercent(v) },
  { key: 'revConcentration', label: 'Rev. Concentration', direction: 'lower', format: (v) => formatPercent(v) },
  { key: 'rate',          label: 'Screening Rate',    direction: 'lower',  format: (v) => formatPercent(v * 100, 2) },
  { key: 'monthlyPayment', label: 'Monthly Payment',  direction: 'lower',  format: (v) => formatCurrency(v) },
  { key: 'equipmentCost', label: 'Equipment Cost',    direction: null,     format: (v) => formatCurrency(v) },
  { key: 'netFinanced',   label: 'Net Financed',      direction: 'lower',  format: (v) => formatCurrency(v) },
];

function extractComparableValues(inputs, sofr = DEFAULT_SOFR) {
  const { metrics, riskScore, rec } = scoreDeal({ inputs }, sofr);

  return {
    metrics,
    riskScore: riskScore.composite,
    recommendation: rec.category,
    recommendationObj: rec,
    dscr: metrics.dscr,
    leverage: metrics.leverage,
    ltv: metrics.ltv,
    termCoverage: metrics.termCoverage,
    revConcentration: metrics.revenueConcentration,
    rate: metrics.rate,
    monthlyPayment: metrics.monthlyPayment,
    equipmentCost: inputs.equipmentCost || 0,
    netFinanced: metrics.netFinanced,
  };
}

function determineBetter(leftVal, rightVal, direction) {
  if (direction === null || leftVal === rightVal) return { left: false, right: false };
  if (direction === 'higher') {
    return { left: leftVal > rightVal, right: rightVal > leftVal };
  }
  // direction === 'lower'
  return { left: leftVal < rightVal, right: rightVal < leftVal };
}

export default function DealComparison({ exampleDeals, savedDeals, historicalDeals, sofr = DEFAULT_SOFR }) {
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');

  // Build a unified deal map keyed by a composite id
  const dealMap = useMemo(() => {
    const map = {};
    (exampleDeals || []).forEach((d) => { map[`example-${d.id}`] = { ...d, source: 'example', displayName: d.label }; });
    (savedDeals || []).forEach((d) => { map[`saved-${d.id}`] = { ...d, source: 'saved', displayName: d.name }; });
    (historicalDeals || []).forEach((d) => { map[`hist-${d.id}`] = { ...d, source: 'historical', displayName: d.inputs.companyName || d.id }; });
    return map;
  }, [exampleDeals, savedDeals, historicalDeals]);

  const leftDeal = leftId ? dealMap[leftId] : null;
  const rightDeal = rightId ? dealMap[rightId] : null;

  const leftData = useMemo(() => leftDeal ? extractComparableValues(leftDeal.inputs, sofr) : null, [leftDeal, sofr]);
  const rightData = useMemo(() => rightDeal ? extractComparableValues(rightDeal.inputs, sofr) : null, [rightDeal, sofr]);

  // Flat list of all deals for search
  const allDeals = useMemo(() => {
    const list = [];
    (exampleDeals || []).forEach((d) => {
      list.push({ cid: `example-${d.id}`, name: d.label, group: 'Examples', industry: d.inputs.industrySector, cost: d.inputs.equipmentCost });
    });
    (savedDeals || []).forEach((d) => {
      list.push({ cid: `saved-${d.id}`, name: d.name, group: 'Saved Deals', industry: d.inputs?.industrySector || '', cost: d.inputs?.equipmentCost || 0 });
    });
    (historicalDeals || []).forEach((d) => {
      list.push({ cid: `hist-${d.id}`, name: d.inputs.companyName || d.id, group: 'Historical', industry: d.inputs.industrySector, cost: d.inputs.equipmentCost });
    });
    return list;
  }, [exampleDeals, savedDeals, historicalDeals]);

  const DealSearchSelect = ({ value, onChange, otherId, label }) => {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const selectedDeal = allDeals.find((d) => d.cid === value);

    useEffect(() => {
      function handleClick(e) {
        if (ref.current && !ref.current.contains(e.target)) setOpen(false);
      }
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const filtered = useMemo(() => {
      const q = query.toLowerCase();
      return allDeals.filter((d) =>
        d.cid !== otherId &&
        (d.name.toLowerCase().includes(q) || d.industry.toLowerCase().includes(q) || d.group.toLowerCase().includes(q))
      );
    }, [query, otherId]);

    const grouped = useMemo(() => {
      const groups = {};
      filtered.forEach((d) => {
        if (!groups[d.group]) groups[d.group] = [];
        groups[d.group].push(d);
      });
      return groups;
    }, [filtered]);

    return (
      <div ref={ref} className="relative">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={open ? query : (selectedDeal ? selectedDeal.name : '')}
            onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
            onFocus={() => { setOpen(true); setQuery(''); }}
            placeholder="Search by name, industry..."
            className="form-input w-full"
            style={{ paddingLeft: '2.5rem' }}
          />
          {value && !open && (
            <button
              onClick={() => { onChange(''); setQuery(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 company-dropdown rounded-xl z-50 py-1 max-h-72 overflow-y-auto animate-fade-in">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-gray-400">No deals match &ldquo;{query}&rdquo;</div>
            ) : (
              Object.entries(grouped).map(([group, deals]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-200/50 sticky top-0 bg-[#0d1424]">
                    {group} ({deals.length})
                  </div>
                  {deals.map((d) => (
                    <button
                      key={d.cid}
                      onClick={() => { onChange(d.cid); setQuery(''); setOpen(false); }}
                      className={`w-full px-3 py-2 text-left hover:bg-gray-100/60 transition-colors flex items-center gap-3 ${value === d.cid ? 'bg-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{d.name}</p>
                        <p className="text-[10px] text-gray-400">{d.industry} &middot; {formatCurrency(d.cost)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderScoreBadge = (score) => (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-sm font-bold font-mono ${scoreBadgeClasses(score)}`}>
      {score}
    </span>
  );

  const renderCellValue = (row, data, isBetter) => {
    if (!data) return <span className="text-gray-400">--</span>;

    const val = data[row.key];

    // Special rendering for risk score
    if (row.key === 'riskScore') {
      return (
        <div className="flex items-center gap-2">
          {renderScoreBadge(val)}
          {isBetter && <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">Better</span>}
        </div>
      );
    }

    // Special rendering for recommendation
    if (row.key === 'recommendation') {
      const rec = data.recommendationObj;
      return <span className={`text-sm font-semibold ${rec.textClass}`}>{rec.category}</span>;
    }

    const formatted = row.format(val);
    return (
      <span className={`font-mono font-semibold text-sm ${isBetter ? 'text-emerald-400' : 'text-gray-800'}`}>
        {formatted}
      </span>
    );
  };

  const neitherSelected = !leftDeal && !rightDeal;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
          Deal Comparison
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left slot */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Deal A
            </label>
            <DealSearchSelect value={leftId} onChange={setLeftId} otherId={rightId} label="Deal A" />
          </div>

          {/* Right slot */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Deal B
            </label>
            <DealSearchSelect value={rightId} onChange={setRightId} otherId={leftId} label="Deal B" />
          </div>
        </div>
      </div>

      {/* Empty state */}
      {neitherSelected && (
        <div className="glass-card rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-400">
            Select two deals to compare side by side.
          </p>
        </div>
      )}

      {/* Comparison table */}
      {(leftDeal || rightDeal) && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            Metric Comparison
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 pr-4 w-1/3">
                    Metric
                  </th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 px-4 w-1/3">
                    {leftDeal ? leftDeal.displayName : 'Deal A'}
                  </th>
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest pb-3 pl-4 w-1/3">
                    {rightDeal ? rightDeal.displayName : 'Deal B'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((row, idx) => {
                  const leftVal = leftData ? leftData[row.key] : null;
                  const rightVal = rightData ? rightData[row.key] : null;

                  let better = { left: false, right: false };
                  if (leftData && rightData && row.direction) {
                    better = determineBetter(leftVal, rightVal, row.direction);
                  }

                  const rowBg = idx % 2 === 1 ? 'bg-gray-50' : '';

                  return (
                    <tr key={row.key} className={rowBg}>
                      <td className="py-3 pr-4 text-xs text-gray-500 font-medium">
                        {row.label}
                      </td>
                      <td className="py-3 px-4">
                        {renderCellValue(row, leftData, better.left)}
                      </td>
                      <td className="py-3 pl-4">
                        {renderCellValue(row, rightData, better.right)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
