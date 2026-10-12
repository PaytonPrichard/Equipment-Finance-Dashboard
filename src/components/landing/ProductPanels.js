// ============================================================
// ProductPanels — the product, shown still.
//
// These were the three panels of a hover-driven steps section. Hover does
// not exist on a phone, and a panel the reader has to operate is a panel
// most readers never see. Each one now sits beside the section it
// illustrates, always visible.
//
// They are drawings of the product, not the product: the real components
// pull in the scoring modules. Every figure comes from siteFacts.js, which
// siteFacts.test.js checks against the real modules and the demo data.
// ============================================================

import React from 'react';
import { GRANITE, PRAIRIE, DRIFT, SCORECARD, fmt } from './siteFacts';
import { GOLD } from './SiteChrome';

const VERDICT_TONE = {
  PASS: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  FLAG: 'border-amber-200 bg-amber-50 text-amber-800',
  FAIL: 'border-rose-200 bg-rose-50 text-rose-800',
};

export function VerdictBadge({ verdict }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-bold tracking-wide ${VERDICT_TONE[verdict]}`}>
      {verdict}
    </span>
  );
}

/**
 * The card every panel sits in. Wide tables scroll sideways inside it, so
 * the page itself never scrolls horizontally on a phone.
 */
export function PanelFrame({ title, tag, caption, children }) {
  return (
    <figure className="relative m-0 min-w-0">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 h-[40px] border-b border-gray-100">
          <span className="text-[11.5px] font-semibold text-gray-900 truncate">{title}</span>
          {tag && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
              {tag}
            </span>
          )}
        </div>
        <div className="p-4 overflow-x-auto">{children}</div>
      </div>
      {caption && <figcaption className="mt-3 text-[12px] text-gray-400 text-center">{caption}</figcaption>}
    </figure>
  );
}

export function MergePanel() {
  const c = GRANITE.ebitdaConflict;
  return (
    <PanelFrame title="Merged, with the disagreements named" caption="Actual output on a sample deal.">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-4">
        <div className="text-[11.5px] font-semibold text-amber-900 mb-1">
          {GRANITE.conflictCount} fields where the documents disagree
        </div>
        <div className="text-[11px] leading-snug text-gray-700">
          <span className="font-semibold text-gray-900">EBITDA:</span>{' '}
          <span className="font-mono tabular-nums text-gray-900">{fmt(c.chosen)}</span>{' '}
          <span className="text-gray-500">from the financials. The broker email says</span>{' '}
          <span className="font-mono tabular-nums">{fmt(c.alternative)}</span>.
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
          {GRANITE.merged.map((r) => (
            <tr key={r.field} className="border-t border-gray-100">
              <td className="py-2 text-gray-700 whitespace-nowrap">{r.field}</td>
              <td className={`py-2 pl-3 text-right text-gray-900 ${r.numeric ? 'font-mono tabular-nums' : 'font-medium'}`}>
                {r.numeric ? fmt(r.value) : r.value}
              </td>
              <td className="py-2 pl-3 text-right text-gray-400 font-mono text-[10px] whitespace-nowrap">{r.src}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelFrame>
  );
}

export function BuildPanel() {
  return (
    <PanelFrame title={PRAIRIE.company} tag="Demo data" caption={`Line items typed from the ${PRAIRIE.document}.`}>
      <div className="space-y-3 min-w-[300px]">
        {PRAIRIE.built.map((b) => (
          <div key={b.key} className="rounded-lg border border-gray-200 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="flex items-center gap-2 text-[12px] font-semibold text-gray-900">
                {b.label}
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white bg-gray-900 px-1.5 py-0.5 rounded">Built</span>
              </span>
              <span className="text-[13px] font-bold font-mono tabular-nums text-gray-900">{fmt(b.value)}</span>
            </div>
            {b.terms.map((t) => (
              <div key={`${t.sign}${t.label}`} className="flex items-baseline justify-between gap-3 text-[11px] leading-relaxed">
                <span className="text-gray-600">
                  <span className="inline-block w-3 font-mono text-gray-400">{t.sign === '-' ? '−' : '+'}</span>
                  {t.label}
                </span>
                <span className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="font-mono tabular-nums text-gray-800">{fmt(t.value)}</span>
                  <span className="font-mono text-[10px] text-gray-400 w-8 text-right">p. {t.page}</span>
                </span>
              </div>
            ))}
            {b.note && <div className="text-[10.5px] text-gray-500 mt-1.5">{b.note}</div>}
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-3 text-[11px] px-1">
          <span className="text-gray-600">
            Maintenance capex{' '}
            <span className="text-[9.5px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">Estimate</span>
          </span>
          <span className="font-mono tabular-nums text-gray-800">{fmt(PRAIRIE.maintenanceCapex)}</span>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <span className="font-semibold">{PRAIRIE.judgmentCount} judgments proposed, none confirmed.</span>{' '}
          The deal cannot be saved until each one is.
        </div>
      </div>
    </PanelFrame>
  );
}

export function VerdictPanel() {
  return (
    <PanelFrame title="Scored against your thresholds" caption="Actual output on a sample deal.">
      <div className="min-w-[440px]">
        <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 mb-4 ${VERDICT_TONE[GRANITE.verdict]}`}>
          <div>
            <div className="text-[13px] font-bold">{GRANITE.verdict}</div>
            <div className="text-[11px]">{GRANITE.company}</div>
          </div>
          <div className="text-[24px] font-bold font-mono tabular-nums text-gray-900 leading-none">
            {GRANITE.score}<span className="text-[12px] text-gray-400">/100</span>
          </div>
        </div>

        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-wider text-gray-400">
              <th className="text-left font-semibold pb-2">Factor</th>
              <th className="text-left font-semibold pb-2 pl-3">Reading</th>
              <th className="text-left font-semibold pb-2 pl-3">Target</th>
              <th className="text-right font-semibold pb-2 pl-3">Weight</th>
              <th className="text-right font-semibold pb-2 pl-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {GRANITE.factors.map((f) => (
              <tr key={f.key} className="border-t border-gray-100">
                <td className="py-1.5 text-gray-800 font-medium whitespace-nowrap">{f.label}</td>
                <td className="py-1.5 pl-3 text-gray-900 whitespace-nowrap">{f.value}</td>
                <td className={`py-1.5 pl-3 whitespace-nowrap ${f.met ? 'text-gray-400' : 'text-amber-700'}`}>{f.target}</td>
                <td className="py-1.5 pl-3 text-right font-mono tabular-nums text-gray-400">{f.weight}%</td>
                <td className="py-1.5 pl-3 text-right">
                  <span className="inline-flex items-center gap-2 justify-end">
                    <span className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden inline-block">
                      <span
                        className="h-full rounded-full block"
                        style={{ width: `${f.score}%`, backgroundColor: f.met ? GOLD : '#d97706' }}
                      />
                    </span>
                    <span className="font-mono tabular-nums text-gray-900 font-semibold w-6 text-right">{f.score}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[10.5px] text-gray-600 mt-3 leading-relaxed border-t border-gray-100 pt-3">
          Liquidation LTV {GRANITE.liquidationLtvPct}%.{' '}
          <span className="text-amber-800">
            Estimate: uses the general {GRANITE.liquidationHaircutPct}% haircut, with no resale data for this equipment type.
          </span>
        </p>
      </div>
    </PanelFrame>
  );
}

export function DriftPanel() {
  return (
    <PanelFrame title="Underwrote against current" tag="Demo data" caption="Sample facilities from the live demo.">
      <table className="w-full text-[11px] min-w-[420px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-wider text-gray-400">
            <th className="text-left font-semibold pb-2">Facility</th>
            <th className="text-left font-semibold pb-2 pl-3">Covenant</th>
            <th className="text-right font-semibold pb-2 pl-3">Underwrote</th>
            <th className="text-right font-semibold pb-2 pl-3">Current</th>
            <th className="text-right font-semibold pb-2 pl-3">Drift</th>
          </tr>
        </thead>
        <tbody>
          {DRIFT.map((r) => (
            <tr key={`${r.facility}${r.covenant}`} className="border-t border-gray-100">
              <td className="py-2 text-gray-800 font-medium whitespace-nowrap">{r.facility}</td>
              <td className="py-2 pl-3 text-gray-600">{r.covenant}</td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-gray-500">{r.underwrote}</td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-gray-900">{r.current}</td>
              <td className={`py-2 pl-3 text-right font-mono tabular-nums font-semibold ${r.worse ? 'text-rose-600' : 'text-emerald-600'}`}>{r.drift}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10.5px] text-gray-500 mt-3 leading-relaxed border-t border-gray-100 pt-3">
        Summit is still inside its 1.25x covenant. It is also a long way from what was underwritten.
      </p>
    </PanelFrame>
  );
}

/** `detailed` adds the filing and the reason, for the Methodology page. */
export function ScorecardPanel({ detailed = false }) {
  return (
    <PanelFrame
      title="Nine public borrowers, equipment finance"
      caption={detailed ? undefined : 'Run on figures from each 10-K, with a hypothetical loan.'}
    >
      <table className={`w-full text-[11px] ${detailed ? 'min-w-[640px]' : 'min-w-[300px]'}`}>
        <thead>
          <tr className="text-[9.5px] uppercase tracking-wider text-gray-400">
            <th className="text-left font-semibold pb-2">Borrower</th>
            {detailed && <th className="text-left font-semibold pb-2 pl-3">Filing</th>}
            <th className="text-left font-semibold pb-2 pl-3">Verdict</th>
            <th className="text-right font-semibold pb-2 pl-3">Score</th>
            {detailed && <th className="text-left font-semibold pb-2 pl-4">Why</th>}
          </tr>
        </thead>
        <tbody>
          {SCORECARD.map((r) => (
            <tr key={r.name} className="border-t border-gray-100 align-top">
              <td className="py-2 text-gray-800 font-medium whitespace-nowrap">
                {r.name}
                {r.wrong && !detailed && <span className="text-amber-700 font-normal"> · model is wrong here</span>}
              </td>
              {detailed && <td className="py-2 pl-3 text-gray-500 whitespace-nowrap">{r.filing}</td>}
              <td className="py-2 pl-3"><VerdictBadge verdict={r.verdict} /></td>
              <td className="py-2 pl-3 text-right font-mono tabular-nums text-gray-900">{r.score}</td>
              {detailed && (
                <td className={`py-2 pl-4 leading-relaxed ${r.wrong ? 'text-amber-800' : 'text-gray-600'}`}>{r.reason}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </PanelFrame>
  );
}
