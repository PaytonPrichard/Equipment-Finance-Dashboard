import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  parseCsvDeals,
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  formatCurrency,
  DEFAULT_SOFR,
} from '../utils/calculations';

// ── CSV Template ──────────────────────────────────────────────
const TEMPLATE_HEADERS =
  'CompanyName,YearsInBusiness,AnnualRevenue,EBITDA,TotalExistingDebt,IndustrySector,CreditRating,EquipmentType,EquipmentCondition,EquipmentCost,DownPayment,FinancingType,UsefulLife,LoanTerm,EssentialUse';
const TEMPLATE_ROW =
  'Acme Corp,10,50000000,8000000,20000000,Manufacturing,Adequate,Heavy Machinery,New,5000000,500000,EFA,15,84,true';

// ── Score helpers ─────────────────────────────────────────────
function scoreBadgeBg(s) {
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

// ── Distribution bucket colors ────────────────────────────────
const DIST_COLORS = {
  Strong:     { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/[0.06] border border-emerald-500/15' },
  Moderate:   { bar: 'bg-lime-500',    text: 'text-lime-400',    bg: 'bg-lime-500/[0.06] border border-lime-500/15' },
  Borderline: { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/[0.06] border border-amber-500/15' },
  Weak:       { bar: 'bg-rose-500',    text: 'text-rose-400',    bg: 'bg-rose-500/[0.06] border border-rose-500/15' },
};

// ── Column definitions ────────────────────────────────────────
const COLUMNS = [
  { key: 'companyName',   label: 'Company Name',  accessor: (d) => d.inputs.companyName },
  { key: 'industrySector',label: 'Industry',       accessor: (d) => d.inputs.industrySector },
  { key: 'equipmentCost', label: 'Equipment Cost', accessor: (d) => d.inputs.equipmentCost, format: (v) => formatCurrency(v) },
  { key: 'dscr',          label: 'DSCR',           accessor: (d) => d.metrics.dscr,          format: (v) => v.toFixed(2) + 'x' },
  { key: 'leverage',      label: 'Leverage',       accessor: (d) => d.metrics.leverage,      format: (v) => v.toFixed(1) + 'x' },
  { key: 'score',         label: 'Risk Score',     accessor: (d) => d.riskScore.composite,   badge: true },
  { key: 'recommendation',label: 'Recommendation', accessor: (d) => d.rec.category,          recStyle: true },
];

export default function BatchScreening({ sofr = DEFAULT_SOFR, onLoadDeal }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);
  const [scoredDeals, setScoredDeals] = useState([]);
  const [sortKey, setSortKey] = useState('score');
  const [sortAsc, setSortAsc] = useState(false);

  // ── CSV Upload ────────────────────────────────────────────
  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        if (!text || !text.trim()) {
          setStatus({ type: 'error', message: 'File is empty.' });
          return;
        }

        const deals = parseCsvDeals(text);
        if (!deals || deals.length === 0) {
          setStatus({ type: 'error', message: 'No valid rows found in CSV.' });
          return;
        }

        // Score every deal
        const scored = deals.map((deal) => {
          const metrics = calculateMetrics(deal.inputs, sofr);
          const riskScore = calculateRiskScore(deal.inputs, metrics);
          const rec = getRecommendation(riskScore.composite);
          return { ...deal, metrics, riskScore, rec };
        });

        setScoredDeals(scored);
        setStatus({ type: 'success', message: `Screened ${scored.length} deal${scored.length === 1 ? '' : 's'}` });
        setTimeout(() => setStatus(null), 4000);
      } catch (err) {
        setStatus({ type: 'error', message: err.message || 'Failed to parse CSV.' });
      }
    };
    reader.onerror = () => {
      setStatus({ type: 'error', message: 'Failed to read file.' });
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [sofr]);

  // ── Template Download ─────────────────────────────────────
  const downloadTemplate = useCallback(() => {
    const csv = `${TEMPLATE_HEADERS}\n${TEMPLATE_ROW}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_screening_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Distribution stats ────────────────────────────────────
  const distribution = useMemo(() => {
    const buckets = { Strong: 0, Moderate: 0, Borderline: 0, Weak: 0 };
    scoredDeals.forEach((d) => {
      const s = d.riskScore.composite;
      if (s >= 75) buckets.Strong++;
      else if (s >= 55) buckets.Moderate++;
      else if (s >= 35) buckets.Borderline++;
      else buckets.Weak++;
    });
    return buckets;
  }, [scoredDeals]);

  // ── Sorting ───────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortAsc((prev) => (sortKey === key ? !prev : true));
    setSortKey(key);
  }, [sortKey]);

  const sortedDeals = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return scoredDeals;
    return [...scoredDeals].sort((a, b) => {
      let va = col.accessor(a);
      let vb = col.accessor(b);
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [scoredDeals, sortKey, sortAsc]);

  // ── Render ────────────────────────────────────────────────
  const total = scoredDeals.length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Upload area */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Batch Deal Screening</h3>
        <p className="text-[11px] text-slate-500 mb-4">
          Upload a CSV to screen multiple deals at once. Each deal will be scored and ranked automatically.
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 flex items-center gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Upload CSV
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFile}
          />

          <button
            type="button"
            className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gold-400 hover:text-gold-300 flex items-center gap-1.5"
            onClick={downloadTemplate}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
            Download Template
          </button>

          {status?.type === 'success' && (
            <span className="text-emerald-400 text-[11px]">{status.message}</span>
          )}
          {status?.type === 'error' && (
            <span className="text-rose-400 text-[11px]">{status.message}</span>
          )}
        </div>
      </div>

      {/* Summary dashboard — only show after deals are screened */}
      {total > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold font-mono text-slate-100">{total}</p>
              <p className="text-[11px] text-slate-500 mt-1">Deals Screened</p>
            </div>
            {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => {
              const c = DIST_COLORS[bucket];
              return (
                <div key={bucket} className={`${c.bg} rounded-2xl p-5 text-center`}>
                  <p className={`text-2xl font-bold font-mono ${c.text}`}>{distribution[bucket]}</p>
                  <p className="text-[11px] text-slate-500 mt-1">{bucket}</p>
                </div>
              );
            })}
          </div>

          {/* Distribution bar */}
          <div className="glass-card rounded-2xl p-5">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
              Score Distribution
            </h4>
            <div className="flex rounded-lg overflow-hidden h-5">
              {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => {
                const pct = total > 0 ? (distribution[bucket] / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={bucket}
                    className={`${DIST_COLORS[bucket].bar} relative group transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${bucket}: ${distribution[bucket]} (${pct.toFixed(0)}%)`}
                  >
                    {pct >= 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90">
                        {distribution[bucket]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => (
                <span key={bucket} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className={`inline-block w-2 h-2 rounded-sm ${DIST_COLORS[bucket].bar}`} />
                  {bucket} ({bucket === 'Strong' ? '75+' : bucket === 'Moderate' ? '55-74' : bucket === 'Borderline' ? '35-54' : '<35'})
                </span>
              ))}
            </div>
          </div>

          {/* Sortable table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {COLUMNS.map((col) => {
                      const active = sortKey === col.key;
                      return (
                        <th
                          key={col.key}
                          className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer select-none hover:text-slate-300 transition-colors"
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {active && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className={`transition-transform ${sortAsc ? '' : 'rotate-180'}`}
                              >
                                <polyline points="18 15 12 9 6 15" />
                              </svg>
                            )}
                            {!active && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-slate-700"
                              >
                                <polyline points="7 10 12 5 17 10" />
                                <polyline points="7 14 12 19 17 14" />
                              </svg>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => onLoadDeal && onLoadDeal(deal.inputs)}
                      title="Click to load into screening form"
                    >
                      {COLUMNS.map((col) => {
                        const raw = col.accessor(deal);

                        // Risk score badge
                        if (col.badge) {
                          return (
                            <td key={col.key} className="px-5 py-3">
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${scoreBadgeBg(raw)} ${scoreColor(raw)} font-mono`}
                              >
                                {raw}
                              </span>
                            </td>
                          );
                        }

                        // Recommendation with color
                        if (col.recStyle) {
                          return (
                            <td key={col.key} className={`px-5 py-3 text-[11px] font-semibold ${deal.rec.textClass}`}>
                              {raw}
                            </td>
                          );
                        }

                        // Default formatted cell
                        const display = col.format ? col.format(raw) : raw;
                        return (
                          <td key={col.key} className="px-5 py-3 text-[12px] text-slate-300 font-mono whitespace-nowrap">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-white/[0.04] text-[10px] text-slate-600">
              Click any row to load the deal into the screening form &middot; Click column headers to sort
            </div>
          </div>
        </>
      )}
    </div>
  );
}
