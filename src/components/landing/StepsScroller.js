// ============================================================
// StepsScroller — the three steps, explored by hover.
//
// This was a scroll-pinned section: the page held still for nearly three
// screens while the panel advanced. It demonstrated the product, but it
// took the scroll away from the reader to do it, and a reader who wants to
// move on should be able to.
//
// Now it is an ordinary section. Hovering a step shows its panel, and it
// works by click and keyboard too, so nothing depends on having a pointer.
// ============================================================

import React, { useState } from 'react';

const GOLD = '#D4A843';

const STEPS = [
  {
    n: '1',
    title: 'Upload the file',
    desc: 'Application, financials, quote, cover email. Up to four at once. Each is classified and read in parallel.',
    panelTitle: 'Four documents, read together',
  },
  {
    n: '2',
    title: 'Review the merge',
    desc: 'Fields populate from the document best placed to know. Where documents disagree, both values are shown with their sources.',
    panelTitle: 'Merged, with the disagreements named',
  },
  {
    n: '3',
    title: 'Score and export',
    desc: 'Pass, flag or fail against your thresholds, with a committee memo that opens on the ask and closes by naming its sources.',
    panelTitle: 'Scored against your thresholds',
  },
];

// ---- Panels ----

function DocumentsPanel() {
  const docs = [
    ['01_credit-application.pdf', 'Credit application', '12'],
    ['02_financial-statements.pdf', 'Financial statements', '11'],
    ['03_equipment-quote.pdf', 'Equipment quote', '8'],
    ['04_broker-email.txt', 'Deal sheet', '18'],
  ];
  return (
    <div className="space-y-1.5">
      {docs.map(([name, type, fields]) => (
        <div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11.5px] font-mono font-medium text-gray-900">{name}</div>
            <div className="text-[10.5px] text-gray-500">{type}</div>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="text-[10.5px] text-gray-400 font-mono tabular-nums">{fields} fields</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" className="text-emerald-600" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function MergePanel() {
  // Identity first, then money, then the asset. A memo reads in that order,
  // and burying the borrower's name under three figures made the table look
  // arbitrary. Filenames lost their numeric prefix so the column fits
  // without truncating to an ellipsis.
  const rows = [
    { field: 'Company', value: 'Granite Ridge Materials LLC', src: 'credit-application.pdf', numeric: false },
    { field: 'Revenue', value: '38,400,000', src: 'financial-statements.pdf', numeric: true },
    { field: 'EBITDA', value: '7,400,000', src: 'financial-statements.pdf', numeric: true },
    { field: 'Equipment cost', value: '6,275,000', src: 'equipment-quote.pdf', numeric: true },
  ];
  return (
    <div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
        <div className="text-[11.5px] font-semibold text-amber-900 mb-1">
          3 fields where the documents disagree
        </div>
        <div className="text-[11px] leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">EBITDA:</span>{' '}
          <span className="font-mono tabular-nums text-gray-900">7,400,000</span>{' '}
          <span className="text-gray-500">from the financials. The broker email says</span>{' '}
          <span className="font-mono tabular-nums">7,900,000</span>.
        </div>
      </div>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-wider text-gray-400">
            <th className="text-left font-semibold pb-2">Field</th>
            <th className="text-right font-semibold pb-2">Value</th>
            <th className="text-right font-semibold pb-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.field} className="border-t border-gray-100">
              <td className="py-2 text-gray-700 whitespace-nowrap">{r.field}</td>
              <td className={`py-2 pl-3 text-right text-gray-900 ${r.numeric ? 'font-mono tabular-nums' : 'font-medium'}`}>
                {r.value}
              </td>
              <td className="py-2 pl-3 text-right text-gray-400 font-mono text-[10px] whitespace-nowrap">
                {r.src}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerdictPanel() {
  // Each factor carries what it was measured against and what it is worth.
  // A score of 35 with no target and no weight is a number the reader has to
  // take on trust, which is the opposite of the point.
  const factors = [
    { label: 'DSCR', value: '2.26x', target: 'target ≥ 1.25x', score: 93, weight: '25%' },
    { label: 'Leverage', value: '2.6x', target: 'target ≤ 3.5x', score: 82, weight: '20%' },
    { label: 'Industry', value: 'Mining', target: 'higher-risk sector', score: 35, weight: '15%' },
    { label: 'LTV', value: '85%', target: 'target ≤ 85%', score: 77, weight: '10%' },
  ];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 mb-4">
        <div>
          <div className="text-[13px] font-bold text-emerald-800">PASS</div>
          <div className="text-[11px] text-emerald-700">Meets screening criteria</div>
        </div>
        <div className="text-[24px] font-bold font-mono tabular-nums text-gray-900 leading-none">
          80<span className="text-[12px] text-gray-400">/100</span>
        </div>
      </div>

      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-wider text-gray-400">
            <th className="text-left font-semibold pb-2">Factor</th>
            <th className="text-left font-semibold pb-2 pl-3">Value</th>
            <th className="text-left font-semibold pb-2 pl-3">Measured against</th>
            <th className="text-right font-semibold pb-2 pl-3">Weight</th>
            <th className="text-right font-semibold pb-2 pl-3">Score</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.label} className="border-t border-gray-100">
              <td className="py-2 text-gray-800 font-medium whitespace-nowrap">{f.label}</td>
              <td className="py-2 pl-3 font-mono tabular-nums text-gray-900 whitespace-nowrap">{f.value}</td>
              <td className={`py-2 pl-3 whitespace-nowrap ${f.score < 50 ? 'text-amber-700' : 'text-gray-400'}`}>
                {f.target}
              </td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-gray-400">{f.weight}</td>
              <td className="py-2 pl-3 text-right">
                <span className="inline-flex items-center gap-2 justify-end">
                  <span className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden inline-block">
                    <span
                      className="h-full rounded-full block"
                      style={{ width: `${f.score}%`, backgroundColor: f.score < 50 ? '#d97706' : GOLD }}
                    />
                  </span>
                  <span className="font-mono tabular-nums text-gray-900 font-semibold w-5 text-right">{f.score}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-[10.5px] text-gray-500 mt-4 leading-relaxed border-t border-gray-100 pt-3">
        Industry carries 15% of the composite because sector cyclicality drives
        recovery in a downturn. Mining scores low, and the deal still passes.
        That is what the weighting is for.
      </p>
    </div>
  );
}

const PANELS = [DocumentsPanel, MergePanel, VerdictPanel];

export default function StepsScroller() {
  const [active, setActive] = useState(0);

  return (
    <section id="how-it-works" className="bg-white relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 85% 65% at 50% 50%, transparent 25%, #000 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 65% at 50% 50%, transparent 25%, #000 100%)',
        }}
      />

      <div className="relative max-w-[1200px] mx-auto px-6 py-20 md:py-28">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">
          Screen a deal in 3 steps
        </h2>
        <p className="text-gray-500 text-center mb-14 text-lg">
          Upload what you were sent. Review what it read. Export the memo.
        </p>

        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-14 items-start">

          {/* Steps */}
          <div className="space-y-1.5">
            {STEPS.map((s, i) => {
              const isActive = i === active;
              return (
                <button
                  key={s.n}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-current={isActive ? 'step' : undefined}
                  className="flex gap-4 text-left w-full rounded-xl p-4 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                  style={{
                    backgroundColor: isActive ? '#FAF8F2' : 'transparent',
                    boxShadow: `inset 2px 0 0 ${isActive ? GOLD : 'transparent'}`,
                  }}
                >
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-colors duration-300 mt-0.5"
                    style={{
                      backgroundColor: isActive ? GOLD : '#f1f0ed',
                      color: isActive ? '#fff' : '#9ca3af',
                    }}
                  >
                    {s.n}
                  </span>
                  <div>
                    <h3
                      className="text-[16px] font-semibold mb-1 transition-colors duration-300"
                      style={{ color: isActive ? '#111827' : '#6b7280' }}
                    >
                      {s.title}
                    </h3>
                    <p
                      className="text-[14px] leading-relaxed transition-colors duration-300"
                      style={{ color: isActive ? '#4b5563' : '#9ca3af' }}
                    >
                      {s.desc}
                    </p>
                  </div>
                </button>
              );
            })}
            <p className="text-[12px] text-gray-400 pl-4 pt-2">Hover a step to see it.</p>
          </div>

          {/* Panel */}
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-5 rounded-[26px] opacity-50 blur-2xl"
              style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(212,168,67,0.13), transparent 70%)' }}
            />
            <div className="relative rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
              <div className="border-b border-gray-100 relative h-[40px]">
                {STEPS.map((s, i) => (
                  <span
                    key={s.n}
                    className="absolute inset-0 flex items-center px-4 text-[11.5px] font-semibold text-gray-900"
                    style={{
                      opacity: i === active ? 1 : 0,
                      transition: i === active
                        ? 'opacity 220ms ease-out 110ms'
                        : 'opacity 100ms ease-in',
                    }}
                  >
                    {s.panelTitle}
                  </span>
                ))}
              </div>
              <div className="relative p-4" style={{ minHeight: 336 }}>
                {PANELS.map((Panel, i) => {
                  const isActive = i === active;
                  return (
                    <div
                      key={i}
                      aria-hidden={!isActive}
                      style={{
                        position: i === 0 ? 'relative' : 'absolute',
                        inset: i === 0 ? undefined : 16,
                        opacity: isActive ? 1 : 0,
                        pointerEvents: isActive ? 'auto' : 'none',
                        // Out fast, in after it has gone. Cross-fading two
                        // dense tables at the same time overlaps their rows
                        // and both become unreadable mid-transition.
                        transition: isActive
                          ? 'opacity 220ms ease-out 110ms'
                          : 'opacity 100ms ease-in',
                      }}
                    >
                      <Panel />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
