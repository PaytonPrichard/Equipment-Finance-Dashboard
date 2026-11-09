import React from 'react';
import SiteShell, { GOLD, CREAM, RULE } from './landing/SiteChrome';
import { ScorecardPanel } from './landing/ProductPanels';
import {
  EQUIPMENT_FACTORS,
  SCORE_BANDS,
  LIMITS,
  CASH_FLOW_STRESS,
  HAIRCUTS,
  SCORECARD_RUN,
} from './landing/siteFacts';
import { useActiveSection } from '../hooks/useReveal';

// The depth the landing page links to. It publishes what the open demo
// already shows (factors, weights, targets, limits, formulas, stress
// scenarios) plus where each number comes from and where the model is
// blind. It leaves out the point-by-point scoring curves and the rate
// spread tables.
//
// Every figure comes from landing/siteFacts.js and is checked by its test.
// Known limits carry a date: update it when one of them is closed.

const LIMITS_AS_OF = 'October 12, 2026';

const SECTIONS = [
  { id: 'scored', label: 'What is scored' },
  { id: 'thresholds', label: 'Thresholds' },
  { id: 'build', label: 'How the numbers are built' },
  { id: 'benchmarks', label: 'Public benchmarks' },
  { id: 'test', label: 'The public-borrower run' },
  { id: 'limits', label: 'Known limits' },
];

const HAIRCUT_BASIS = {
  data: 'Resale data',
  estimated: 'Estimate, from market-value curves',
  general: 'General haircut, no type data',
};

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 pb-12 mb-12 border-b last:border-b-0 last:mb-0" style={{ borderColor: RULE }}>
      <h2 className="text-2xl md:text-[28px] font-bold text-gray-900 tracking-tight mb-4">{title}</h2>
      <div className="space-y-4 text-[16px] text-gray-600 leading-relaxed [&>p]:max-w-[68ch] [&>ul]:max-w-[68ch]">{children}</div>
    </section>
  );
}

/** A table that scrolls sideways inside its own card on a phone. */
function DataTable({ head, rows, minWidth = 460 }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-[14px]" style={{ minWidth }}>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-200" style={{ backgroundColor: '#FAFAF8' }}>
            {head.map((h) => <th key={h} className="text-left font-semibold px-4 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells) => (
            <tr key={cells[0]} className="border-t border-gray-100 first:border-t-0 align-top">
              {cells.map((cell, i) => (
                <td key={head[i]} className={`px-4 py-2.5 ${i === 0 ? 'text-gray-900 font-medium whitespace-nowrap' : 'text-gray-600'}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Formula({ name, children, note }) {
  return (
    <div className="rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-[14px] font-semibold text-gray-900">{name}</div>
      <div className="text-[14px] font-mono text-gray-700 mt-1">{children}</div>
      {note && <div className="text-[13px] text-gray-500 mt-1.5">{note}</div>}
    </div>
  );
}

export default function MethodologyPage({ onGetStarted, onSignIn }) {
  const active = useActiveSection(SECTIONS.map((s) => s.id), 100);

  return (
    <SiteShell current="methodology" onGetStarted={onGetStarted} onSignIn={onSignIn}>

      <header className="max-w-[1080px] mx-auto px-4 sm:px-8 pt-14 md:pt-20 pb-10 md:pb-12">
        <p className="text-[15px] font-semibold tracking-wide mb-4" style={{ color: GOLD }}>Methodology</p>
        <h1 className="text-[36px] sm:text-[48px] font-extrabold text-gray-900 leading-[1.06] tracking-[-0.02em] mb-5 text-balance max-w-3xl">
          How Tranche reaches a verdict.
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed max-w-2xl">
          What is scored, what each threshold rests on, how the numbers are built, and where the model is blind.
        </p>
      </header>

      <div className="max-w-[1080px] mx-auto px-4 sm:px-8 pb-20 lg:grid lg:grid-cols-[220px_1fr] lg:gap-14">

        {/* In-page nav. A sticky column on desktop, a scrolling row on a phone. */}
        <nav aria-label="On this page" className="sticky top-[64px] lg:top-24 z-10 lg:self-start -mx-4 sm:-mx-8 lg:mx-0 mb-10 lg:mb-0 bg-white/95 backdrop-blur border-b lg:border-b-0" style={{ borderColor: RULE }}>
          <ul className="flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto px-4 sm:px-8 lg:px-0 py-2 lg:py-0 lg:border-l" style={{ borderColor: RULE }}>
            {SECTIONS.map((s) => {
              const isActive = active === s.id;
              return (
                <li key={s.id} className="flex-shrink-0">
                  <a
                    href={`#${s.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`block text-[14px] px-3 lg:pl-4 py-1.5 rounded-lg lg:rounded-none lg:-ml-px lg:border-l-2 whitespace-nowrap transition-colors ${isActive ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 lg:border-transparent'}`}
                    style={isActive ? { backgroundColor: CREAM, borderColor: GOLD } : undefined}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">

          <Section id="scored" title="What is scored">
            <p>
              Every deal is scored on seven weighted factors, each from 0 to 100. The weighted sum is the composite score.
              The factors below are for equipment finance. Accounts receivable and inventory finance each have their own seven.
            </p>
            <DataTable
              head={['Factor', 'Weight', 'Scored toward']}
              rows={EQUIPMENT_FACTORS.map((f) => [f.label, `${f.weight}%`, f.target])}
              minWidth={380}
            />
            <p>
              A score of {SCORE_BANDS.pass} or more passes. A score under {SCORE_BANDS.flag} fails. Anything between is a flag.
              The score is not the whole verdict: a deal that breaches a limit is flagged or failed whatever it scores.
              Each flag lists its conditions. Each fail lists what failed.
            </p>
            <p>
              When EBITDA is not positive, leverage is shown as not meaningful and the deal fails. It is not scored as if
              leverage were low.
            </p>
          </Section>

          <Section id="thresholds" title="Thresholds">
            <p>
              There are two layers. A target is what a factor is scored toward. A limit is what makes a deal flag or fail.
              A deal can miss a target and still pass. It cannot breach a limit and pass.
            </p>
            <p>
              These are the default limits. You can change them. Today they are saved per user, not per firm.
            </p>
            <DataTable
              head={['Limit', 'Default', 'Where it comes from']}
              rows={LIMITS.map((l) => [l.label, l.display, l.source])}
              minWidth={560}
            />
            <p>
              Cash-flow DSCR and FCCR apply only when the cash-flow inputs are provided: maintenance capex, cash taxes,
              working capital change and rent. A reading below 1.0x on either one fails the deal.
            </p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">Stress scenarios</h3>
            <p>EBITDA is stressed down 10%, 20% and 30%. Cash-flow coverage is then run through these cases:</p>
            <ul className="list-disc pl-5 space-y-1">
              {CASH_FLOW_STRESS.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <p>A deal that covers in the base case and breaks in the combined severe case is flagged.</p>
          </Section>

          <Section id="build" title="How the numbers are built">
            <h3 className="text-[17px] font-semibold text-gray-900">From documents</h3>
            <p>
              Uploaded documents are classified and read. What is read only prefills the form. Every field shows the
              document it came from. When two documents disagree, both values are shown with their sources, and you choose.
              Nothing read from a document is scored until you have reviewed it.
            </p>
            <p>
              Which document wins by default depends on the kind of fact. Financial statements win on revenue and EBITDA.
              The equipment quote wins on the equipment. The credit application wins on who the borrower is.
            </p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">From statement lines</h3>
            <p>
              You can enter the lines from the financial statements instead of typing a final figure. Tranche builds the
              inputs and shows the formula behind each one. Today the lines are typed in. Reading them from the document
              is not built yet.
            </p>
            <div className="grid gap-3">
              <Formula name="EBITDA" note="Floorplan interest is deducted when floorplan is treated as inventory financing.">
                Operating income + Depreciation and amortization
              </Formula>
              <Formula name="Total debt" note="A floorplan payable is left out under the same treatment.">
                Revolver + Term loans and notes + Finance leases
              </Formula>
              <Formula name="Annual debt service" note="A revolver renews. Its balance counts for interest, not as principal due.">
                Cash interest paid + Current maturities of long-term debt
              </Formula>
              <Formula name="Maintenance capex" note="Depreciation is used as a proxy. It is always marked as an estimate.">
                Depreciation and amortization - Amortization of intangibles
              </Formula>
            </div>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">Treatment rules</h3>
            <p>
              Companies put the same items in different places. The rules do not move, and EBITDA and debt must agree on
              every item.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Finance leases are in debt, and their amortization is in EBITDA.</li>
              <li>Operating leases are out of both. Rent stays an expense.</li>
              <li>Floorplan is inventory financing. Its interest comes out of EBITDA and the payable stays out of debt.</li>
              <li>Captive fleet debt is analyzed at the corporate level.</li>
            </ul>
            <p>
              These are firm defaults that an admin can change. Changing one for a single deal needs a reason. Each choice
              is a judgment the analyst confirms, and a statement-built deal cannot be saved until every judgment is confirmed.
            </p>
            <p>
              When the borrower reports its own adjusted EBITDA, Tranche shows the gap to the built figure and how much of
              it the add-backs explain. An unexplained gap above 5% is called out.
            </p>
          </Section>

          <Section id="benchmarks" title="Public benchmarks">
            <p>
              Two sets of public data sit behind the equipment assumptions. Both were researched in October 2026.
            </p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-1">Industry risk tiers</h3>
            <p>
              Tiers were checked against pool losses in public equipment ABS prospectuses from John Deere Owner Trust,
              CNH Equipment Trust and Daimler Trucks Retail Trust. At the same age and vintage, truck pools lost four to
              six times as much as agricultural and construction pools. Trucking is scored high risk as a result, and
              agriculture moderate. These are pools of small retail contracts. They test sector assumptions and say
              nothing about a single borrower.
            </p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">Liquidation haircuts</h3>
            <p>
              Liquidation LTV compares the amount financed with what the equipment would bring in a forced sale. The
              haircut is the share of cost a lender should not expect back. Where there is no data for an equipment type,
              the general haircut is used, and the verdict and the memo say so.
            </p>
            <DataTable
              head={['Equipment', 'New', 'Used']}
              rows={HAIRCUTS.map((h) => [
                h.type,
                `${h.newPct}%. ${HAIRCUT_BASIS[h.newBasis]}`,
                `${h.usedPct}%. ${HAIRCUT_BASIS[h.usedBasis]}`,
              ])}
              minWidth={520}
            />
            <p>
              Sources include Iowa State extension auction tables, Sandhills market reports, Bureau of Economic Analysis
              depreciation rates and the SBA collateral rules, which value new machinery at 75% of price.
            </p>
          </Section>

          <Section id="test" title="The public-borrower run">
            <p>
              Tranche was run on nine public companies that borrow against equipment. The borrower figures come from each
              company&rsquo;s 10-K. The loan is hypothetical, because a 10-K describes the borrower and not an equipment loan.
              Every figure is as of the filing date.
            </p>
            <p>
              These are large public filers. Tranche is built for lower-middle-market lenders, whose borrowers are smaller
              and report less. Read this run as a view of how the model reasons, not as proof that it is right.
            </p>
            <ScorecardPanel detailed />
            <p className="text-[13px] text-gray-400">Run of {SCORECARD_RUN}. Equipment finance module, default thresholds.</p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">Two cases worth reading</h3>
            <p>
              <span className="font-semibold text-gray-900">Custom Truck One Source.</span>{' '}
              EBITDA covers debt service 2.50x, which looks comfortable. After fleet replacement, free cash flow covers it
              0.78x. For a rental business, EBITDA overstates debt capacity, because replacing the fleet is a recurring
              cost. This is what the cash-flow test is for.
            </p>
            <p>
              <span className="font-semibold text-gray-900">H&amp;E Equipment Services.</span>{' '}
              Tranche passes it at 83, and that is wrong. All $1.45B of its debt matured in 2028, inside the term of the
              test loan, and a change of control was pending. Tranche sees neither.
            </p>
            <h3 className="text-[17px] font-semibold text-gray-900 pt-3">What the run does establish</h3>
            <p>
              The statement build reproduces the inputs for all nine filings from their line items. An automated test
              holds it to that.
            </p>
          </Section>

          <Section id="limits" title="Known limits">
            <p className="text-[14px] text-gray-400">As of {LIMITS_AS_OF}.</p>
            <ul className="list-disc pl-5 space-y-3">
              <li>
                <span className="font-semibold text-gray-900">Maturity walls.</span>{' '}
                Tranche does not check whether the borrower&rsquo;s other debt comes due inside the term of the new loan.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Event risk.</span>{' '}
                A pending sale, merger or change of control is not an input.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Document reading.</span>{' '}
                It has been tested on sample documents we wrote, not on real borrower files. We do not publish an accuracy
                figure. That is why every field shows its source and nothing is scored before review.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Statement lines.</span>{' '}
                They are typed in by the analyst. Reading them from the document is not built yet.
              </li>
              <li>
                <span className="font-semibold text-gray-900">Thresholds.</span>{' '}
                They are saved per user. Two analysts at one firm can hold different limits until firm-level policy is built.
              </li>
              <li>
                <span className="font-semibold text-gray-900">The public-borrower run.</span>{' '}
                Nine companies, equipment finance only, all large public filers. Some filing figures were read by hand
                where the structured data did not carry them.
              </li>
            </ul>
          </Section>

        </div>
      </div>

      <section style={{ backgroundColor: CREAM }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-8 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 tracking-tight">See it on a sample deal.</h2>
          <p className="text-gray-500 mb-7 text-lg">The demo runs in your browser. No account needed.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={onGetStarted}
              className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: GOLD }}
            >
              Request a trial
            </button>
            <a href="/?demo=1" className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 transition-all bg-white">
              Open the demo
            </a>
          </div>
        </div>
      </section>

    </SiteShell>
  );
}
