// ============================================================
// HeroDemo — the product doing its actual job, on loop.
//
// The hero used to be a screenshot. This runs the sequence instead:
// four documents land, each is classified, the conflict surfaces, the
// deal scores. It is the one thing the product does that nothing else
// does, so it is what a stranger should see first.
//
// The numbers are the real ones from
// test-deal-sheets/equipment/granite-ridge-multidoc, so nothing here
// claims behaviour the product does not have. No scoring runs: this is a
// choreographed replay, not a live screening, and it is on the marketing
// page rather than in the app.
//
// Pauses when scrolled out of view. Under reduced motion it parks on the
// finished state, which is the honest still frame of the same story.
// ============================================================

import React from 'react';
import { useLoopingSteps } from '../../hooks/useReveal';

const GOLD = '#D4A843';

// Field counts match what extraction actually returns for these documents.
const DOCUMENTS = [
  { name: '01_credit-application.pdf', type: 'Credit application', fields: 12 },
  { name: '02_financial-statements.pdf', type: 'Financial statements', fields: 11 },
  { name: '03_equipment-quote.pdf', type: 'Equipment quote', fields: 8 },
  { name: '04_broker-email.txt', type: 'Deal sheet', fields: 18 },
];

// Step map. Index into the durations array below.
//  0        empty, waiting
//  1-4      documents arriving, one per step
//  5-8      each resolving to a classification
//  9        the conflict block
// 10        the verdict
// 11        hold on the finished state
const DURATIONS = [700, 380, 380, 380, 620, 260, 260, 260, 640, 1500, 2600, 1400];
const LAST_STEP = DURATIONS.length - 1;

const ARRIVED_AT = [1, 2, 3, 4];   // step at which each document appears
const RESOLVED_AT = [5, 6, 7, 8];  // step at which each finishes reading

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3 text-gray-300" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="3" className="text-emerald-600" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function HeroDemo() {
  const [ref, step] = useLoopingSteps(DURATIONS);

  const showConflicts = step >= 9;
  const showVerdict = step >= 10;

  return (
    <div
      ref={ref}
      aria-label="Tranche reading four deal documents and reconciling them"
      role="img"
      className="relative"
    >
      {/* Soft ground so the panel reads as lifted, not pasted on. */}
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[28px] opacity-60 blur-2xl"
        style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(212,168,67,0.16), transparent 70%)' }}
      />

      {/* Fixed height. The panel fills through the loop and empties on
          restart; without a reserved box the whole page would shift up and
          down every eight seconds, which reads as broken rather than alive. */}
      <div className="relative rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="text-[12px] font-semibold text-gray-900">Deal documents</div>
          <div className="text-[11px] text-gray-400 font-mono tabular-nums">
            {step === 0
              ? 'Ready'
              : showVerdict
                ? '20 fields from 4 documents'
                : `${DOCUMENTS.filter((_, i) => step >= RESOLVED_AT[i]).length} of 4 read`}
          </div>
        </div>

        {/* Documents */}
        <div className="px-4 py-3 space-y-1.5">
          {DOCUMENTS.map((doc, i) => {
            const arrived = step >= ARRIVED_AT[i];
            const resolved = step >= RESOLVED_AT[i];
            return (
              <div
                key={doc.name}
                className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-2.5 py-2 transition-all duration-500 ease-out"
                style={{
                  opacity: arrived ? 1 : 0,
                  transform: arrived ? 'translateY(0)' : 'translateY(8px)',
                }}
              >
                <div className="min-w-0">
                  <div className="text-[11.5px] font-medium text-gray-900 truncate font-mono">
                    {doc.name}
                  </div>
                  <div className="text-[10.5px] text-gray-500 transition-opacity duration-300"
                       style={{ opacity: resolved ? 1 : 0 }}>
                    {doc.type}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10.5px] text-gray-400 font-mono tabular-nums transition-opacity duration-300"
                        style={{ opacity: resolved ? 1 : 0 }}>
                    {doc.fields} fields
                  </span>
                  {resolved ? <Check /> : arrived ? <Spinner /> : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* The conflict. The reason this component exists.
            Its space is reserved for the whole loop and only opacity moves,
            so nothing below it shifts as the sequence plays. */}
        <div
          className="transition-all duration-500 ease-out px-4"
          style={{
            height: 96,
            opacity: showConflicts ? 1 : 0,
            transform: showConflicts ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[11.5px] font-semibold text-amber-900 mb-1">
              3 fields where the documents disagree
            </div>
            <div className="text-[11px] leading-snug text-gray-700">
              <span className="font-semibold text-gray-900">EBITDA:</span>{' '}
              <span className="font-mono tabular-nums text-gray-900">7,400,000</span>{' '}
              <span className="text-gray-500">from 02_financial-statements.pdf.</span>
            </div>
            <div className="text-[11px] leading-snug text-gray-500">
              04_broker-email.txt says{' '}
              <span className="font-mono tabular-nums">7,900,000</span>.{' '}
              <span className="font-semibold text-amber-800 underline underline-offset-2">Use that</span>
            </div>
          </div>
        </div>

        {/* Verdict. Space reserved for the same reason. */}
        <div
          className="transition-all duration-500 ease-out border-t border-gray-100"
          style={{
            opacity: showVerdict ? 1 : 0,
            transform: showVerdict ? 'translateY(0)' : 'translateY(6px)',
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-gray-900 truncate">
                Granite Ridge Materials LLC
              </div>
              <div className="text-[11px] text-gray-500">Mining &middot; Equipment finance</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-[10.5px] font-bold text-emerald-800 tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                PASS
              </span>
              <span
                className="px-2 py-1 rounded-md text-[11px] font-bold font-mono tabular-nums text-gray-900"
                style={{ backgroundColor: 'rgba(212,168,67,0.16)' }}
              >
                80/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress hairline, so the loop reads as deliberate rather than jumpy. */}
      <div className="mt-3 h-[2px] rounded-full bg-gray-200/70 overflow-hidden" aria-hidden="true">
        <div
          className="h-full rounded-full transition-all duration-500 ease-linear"
          style={{ width: `${(step / LAST_STEP) * 100}%`, backgroundColor: GOLD }}
        />
      </div>
      <div className="mt-2 text-[11px] text-gray-400 text-center" aria-hidden="true">
        Four documents, read together. Real output from the sample deal set.
      </div>
    </div>
  );
}
