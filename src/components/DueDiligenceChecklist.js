import React, { useState, useMemo } from 'react';

function generateChecklist(inputs, metrics, riskScore) {
  const items = [];
  const ft = inputs.financingType || 'EFA';

  // ---- Always ask ----
  items.push({
    id: 'fin-statements',
    category: 'Financial',
    priority: 'required',
    question: 'Obtain 3 years of audited or reviewed financial statements (P&L, balance sheet, cash flow)',
    why: 'Validates reported revenue and EBITDA trends. Single-year snapshots can be misleading.',
  });

  // ---- DSCR-driven ----
  if (metrics.dscr < 1.5) {
    items.push({
      id: 'dscr-trend',
      category: 'Financial',
      priority: 'high',
      question: 'Request trailing 12-month EBITDA by quarter — is cash flow trending up or down?',
      why: `DSCR of ${metrics.dscr.toFixed(2)}x has limited cushion. A declining trend would further weaken coverage.`,
    });
  }
  if (metrics.dscr < 1.25) {
    items.push({
      id: 'dscr-mgmt',
      category: 'Financial',
      priority: 'high',
      question: 'Ask management: what specific actions are planned to improve cash flow over the next 12 months?',
      why: 'Below-threshold DSCR needs a credible path to improvement before advancing.',
    });
  }

  // ---- Leverage-driven ----
  if (metrics.leverage > 3.5) {
    items.push({
      id: 'debt-schedule',
      category: 'Financial',
      priority: 'high',
      question: 'Obtain full debt schedule with maturities, rates, and covenants on all existing obligations',
      why: `Leverage of ${metrics.leverage.toFixed(1)}x — need to understand refinancing risk and covenant headroom.`,
    });
  }
  if (metrics.leverage > 5.0) {
    items.push({
      id: 'deleveraging',
      category: 'Financial',
      priority: 'high',
      question: 'What is the borrower\'s deleveraging plan? Are any existing facilities being retired?',
      why: 'Elevated leverage may make this deal unfeasible without a clear path to reducing total debt.',
    });
  }

  // ---- Existing debt service ----
  if (metrics.debtServiceEstimated) {
    items.push({
      id: 'actual-ds',
      category: 'Financial',
      priority: 'medium',
      question: `Confirm actual annual debt service — currently estimated at ${Math.round(metrics.existingDebtService).toLocaleString()}/yr based on ${(0.08 * 100).toFixed(0)}% blended rate`,
      why: 'Estimated debt service may overstate or understate actual obligations. Actual figures improve DSCR accuracy.',
    });
  }

  // ---- Revenue concentration ----
  if (metrics.revenueConcentration > 15) {
    items.push({
      id: 'rev-diversification',
      category: 'Operational',
      priority: 'medium',
      question: 'Request customer concentration breakdown — what % of revenue comes from top 3 customers?',
      why: `Equipment cost is ${metrics.revenueConcentration.toFixed(0)}% of revenue. High customer concentration would compound this risk.`,
    });
  }

  // ---- Equipment-driven ----
  if (inputs.equipmentCondition === 'Used') {
    items.push({
      id: 'appraisal',
      category: 'Collateral',
      priority: 'high',
      question: 'Obtain independent equipment appraisal (orderly liquidation value and fair market value)',
      why: 'Used equipment value is estimated at a 15% discount. Independent appraisal provides defensible collateral value.',
    });
  }
  if (inputs.equipmentCondition === 'New') {
    items.push({
      id: 'vendor-quote',
      category: 'Collateral',
      priority: 'medium',
      question: 'Confirm vendor quote and check if pricing is competitive with market alternatives',
      why: 'Validates that equipment cost reflects fair value, not an inflated or sole-source price.',
    });
  }

  // ---- Term / useful life ----
  if (metrics.termCoverage > 70) {
    items.push({
      id: 'maintenance-plan',
      category: 'Collateral',
      priority: 'medium',
      question: 'What is the borrower\'s maintenance program for this equipment? Request maintenance history if used.',
      why: `Loan term covers ${metrics.termCoverage.toFixed(0)}% of useful life — equipment condition at term-end is critical.`,
    });
  }

  // ---- Young company ----
  if (inputs.yearsInBusiness < 5) {
    items.push({
      id: 'owner-pfs',
      category: 'Credit',
      priority: 'high',
      question: 'Obtain personal financial statement (PFS) and tax returns from principal owner(s)',
      why: `Only ${inputs.yearsInBusiness} years in business — need owner's financial backing as secondary repayment source.`,
    });
    items.push({
      id: 'business-plan',
      category: 'Credit',
      priority: 'medium',
      question: 'Request business plan or growth projections with key assumptions documented',
      why: 'Early-stage companies need a clear forward-looking narrative to support credit.',
    });
  }

  // ---- Industry-specific ----
  const highRiskIndustries = ['Construction', 'Mining', 'Aviation', 'Marine', 'Agriculture'];
  if (highRiskIndustries.includes(inputs.industrySector)) {
    items.push({
      id: 'industry-cycle',
      category: 'Operational',
      priority: 'medium',
      question: `Where is ${inputs.industrySector} in its current cycle? Request borrower's view on near-term outlook and backlog/pipeline.`,
      why: `${inputs.industrySector} is cyclical — timing in the cycle affects default probability.`,
    });
  }

  // ---- Essential use ----
  if (!inputs.essentialUse) {
    items.push({
      id: 'essential-use-confirm',
      category: 'Collateral',
      priority: 'medium',
      question: 'Confirm why this equipment is not essential to operations. What alternatives does the borrower have?',
      why: 'Non-essential equipment has weaker recovery profiles — borrower may abandon it in distress.',
    });
  }

  // ---- FMV / TRAC specific ----
  if (ft === 'FMV') {
    items.push({
      id: 'remarketing',
      category: 'Collateral',
      priority: 'high',
      question: `Assess remarketing outlook for ${inputs.equipmentType} — are there active secondary markets and reliable dealers?`,
      why: 'Lessor bears residual value risk on FMV leases. Weak remarketing = potential loss at maturity.',
    });
  }
  if (ft === 'TRAC') {
    items.push({
      id: 'trac-residual',
      category: 'Collateral',
      priority: 'medium',
      question: 'Validate that the TRAC residual assumption is defensible — check used vehicle valuation guides (e.g., NADA, Black Book)',
      why: 'If lessee defaults on the guaranteed residual, the lessor must recover via disposition.',
    });
  }

  // ---- LTV-driven ----
  if (metrics.ltv > 0.9 && (inputs.downPayment || 0) === 0) {
    items.push({
      id: 'equity-contribution',
      category: 'Structure',
      priority: 'high',
      question: 'Has the borrower been asked about an equity contribution? Even 10-15% significantly reduces LTV risk.',
      why: `LTV of ${(metrics.ltv * 100).toFixed(0)}% with no down payment — skin in the game reduces moral hazard.`,
    });
  }

  // ---- Guarantor ----
  if (riskScore.composite < 55) {
    items.push({
      id: 'guarantor',
      category: 'Credit',
      priority: 'high',
      question: 'Is a personal or corporate guarantee available? If so, assess guarantor\'s net worth and liquidity.',
      why: 'Below-moderate screening score — additional credit support is likely needed for approval.',
    });
  }

  // ---- Insurance ----
  items.push({
    id: 'insurance',
    category: 'Collateral',
    priority: 'medium',
    question: 'Confirm borrower will maintain adequate property and liability insurance on financed equipment',
    why: 'Standard requirement, but needs to be verified and lender named as loss payee.',
  });

  // ---- Environmental (certain equipment) ----
  const envTypes = ['Heavy Machinery', 'Construction Equipment', 'Energy/Power Generation', 'Marine Vessels'];
  if (envTypes.includes(inputs.equipmentType)) {
    items.push({
      id: 'environmental',
      category: 'Operational',
      priority: 'low',
      question: 'Any environmental or regulatory compliance requirements associated with this equipment?',
      why: `${inputs.equipmentType} may have emissions, safety, or disposal regulations affecting operating costs and residual value.`,
    });
  }

  return items;
}

const PRIORITY_STYLES = {
  required: { label: 'Required', bg: 'bg-gold-500/10', border: 'border-gold-500/20', text: 'text-gray-600' },
  high: { label: 'High', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
  medium: { label: 'Medium', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  low: { label: 'Low', bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-gray-500' },
};

const CATEGORY_ICONS = {
  Financial: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
  ),
  Collateral: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
  ),
  Credit: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>
  ),
  Operational: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  ),
  Structure: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
  ),
};

export default function DueDiligenceChecklist({ inputs, metrics, riskScore }) {
  const [checked, setChecked] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [filterCategory, setFilterCategory] = useState('All');

  const items = useMemo(
    () => generateChecklist(inputs, metrics, riskScore),
    [inputs, metrics, riskScore]
  );

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(items.map((i) => i.category)))],
    [items]
  );

  const filtered = filterCategory === 'All' ? items : items.filter((i) => i.category === filterCategory);
  const completedCount = Object.values(checked).filter(Boolean).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Due Diligence Checklist
          </h3>
          <p className="text-[11px] text-gray-400">
            Probing questions and information requests based on this deal's risk profile
          </p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold font-mono text-gray-800">
            {completedCount}/{totalCount}
          </span>
          <p className="text-[10px] text-gray-400">completed</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPct}%`,
            background: progressPct === 100
              ? 'rgb(16, 185, 129)'
              : progressPct > 50
              ? 'rgb(59, 130, 246)'
              : 'rgb(148, 163, 184)',
          }}
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => {
          const count = cat === 'All' ? items.length : items.filter((i) => i.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`pill-btn px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1.5 ${
                filterCategory === cat ? 'pill-btn-active' : 'text-gray-400'
              }`}
            >
              {cat !== 'All' && (
                <span className="text-gray-400">{CATEGORY_ICONS[cat]}</span>
              )}
              {cat}
              <span className="text-[9px] text-gray-400">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {filtered.map((item) => {
          const ps = PRIORITY_STYLES[item.priority];
          const isChecked = checked[item.id] || false;
          const isExpanded = expandedId === item.id;

          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-all duration-200 ${
                isChecked
                  ? 'bg-white/[0.01] border-gray-200 opacity-60'
                  : 'bg-gray-50 border-gray-200 hover:border-white/[0.1]'
              }`}
            >
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Checkbox */}
                <button
                  onClick={() => setChecked((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isChecked
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : 'border-slate-600 hover:border-slate-400'
                  }`}
                >
                  {isChecked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${ps.bg} ${ps.text} border ${ps.border}`}>
                      {ps.label}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      {CATEGORY_ICONS[item.category]}
                      {item.category}
                    </span>
                  </div>
                  <p className={`text-[13px] leading-relaxed ${isChecked ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                    {item.question}
                  </p>
                </div>

                {/* Expand button */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="mt-0.5 text-gray-400 hover:text-gray-500 transition-colors flex-shrink-0"
                >
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Expanded rationale */}
              {isExpanded && (
                <div className="px-4 pb-3 pl-12 animate-fade-in">
                  <div className="rounded-lg bg-gray-50 px-3 py-2.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Why this matters</span>
                    <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{item.why}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {completedCount === totalCount && totalCount > 0 && (
        <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-4 flex items-center gap-3 animate-fade-in">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-400">All items addressed</p>
            <p className="text-[11px] text-gray-400">Due diligence checklist complete for this screening</p>
          </div>
        </div>
      )}
    </div>
  );
}
