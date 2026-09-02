// ============================================================
// StepsScroller — the three steps, pinned while you scroll past them.
//
// The step copy stays on the left and the panel on the right changes as
// each step becomes active, so the reader sees the product advance
// through the process rather than reading three descriptions of it.
//
// On phones this falls back to an ordinary stack. Pinning a section and
// taking over the scroll on a small screen is hostile: there is no room
// for a side-by-side, and it makes the page feel broken rather than
// considered.
// ============================================================

import React, { useState, useEffect } from 'react';
import { useScrollProgress, useMediaQuery, prefersReducedMotion } from '../../hooks/useReveal';

const GOLD = '#D4A843';

const STEPS = [
  {
    n: '1',
    title: 'Upload the file',
    desc: 'Application, financials, quote, cover email. Up to four at once. Each is classified and read in parallel.',
  },
  {
    n: '2',
    title: 'Review the merge',
    desc: 'Fields populate from the document best placed to know. Where documents disagree, both values are shown with their sources.',
  },
  {
    n: '3',
    title: 'Score and export',
    desc: 'Pass, flag or fail against your thresholds, with a committee memo that opens on the ask and closes by naming its sources.',
  },
];

// ---- The panel for each step ----

function DocumentsPanel() {
  const docs = [
    ['01_credit-application.pdf', 'Credit application'],
    ['02_financial-statements.pdf', 'Financial statements'],
    ['03_equipment-quote.pdf', 'Equipment quote'],
    ['04_broker-email.txt', 'Deal sheet'],
  ];
  return (
    <div className="space-y-1.5">
      {docs.map(([name, type]) => (
        <div key={name} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11.5px] font-mono font-medium text-gray-900 truncate">{name}</div>
            <div className="text-[10.5px] text-gray-500">{type}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="3" className="text-emerald-600 flex-shrink-0" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function MergePanel() {
  const rows = [
    ['EBITDA', '7,400,000', '02_financial-statements.pdf'],
    ['Revenue', '38,400,000', '02_financial-statements.pdf'],
    ['Equipment cost', '6,275,000', '03_equipment-quote.pdf'],
    ['Company', 'Granite Ridge Materials LLC', '01_credit-application.pdf'],
  ];
  return (
    <div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 mb-3">
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
      <div className="space-y-1">
        {rows.map(([field, value, src]) => (
          <div key={field} className="flex items-baseline justify-between gap-2 text-[11px] py-1 border-b border-gray-100 last:border-0">
            <span className="text-gray-700 flex-shrink-0">{field}</span>
            <span className="font-mono tabular-nums text-gray-900 truncate">{value}</span>
            <span className="text-gray-400 font-mono text-[10px] truncate max-w-[140px]">{src}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictPanel() {
  const factors = [
    ['DSCR', '2.26x', 93],
    ['Leverage', '2.6x', 82],
    ['Industry', 'Mining', 35],
    ['LTV', '85%', 77],
  ];
  return (
    <div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 mb-3">
        <div>
          <div className="text-[13px] font-bold text-emerald-800">PASS</div>
          <div className="text-[11px] text-emerald-700">Meets screening criteria</div>
        </div>
        <div className="text-[22px] font-bold font-mono tabular-nums text-gray-900">80<span className="text-[12px] text-gray-400">/100</span></div>
      </div>
      <div className="space-y-1.5">
        {factors.map(([label, value, score]) => (
          <div key={label} className="flex items-center gap-3 text-[11px]">
            <span className="text-gray-700 w-20 flex-shrink-0">{label}</span>
            <span className="font-mono tabular-nums text-gray-500 w-14 flex-shrink-0">{value}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: score < 50 ? '#d97706' : GOLD }} />
            </div>
            <span className="font-mono tabular-nums text-gray-400 w-6 text-right flex-shrink-0">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PANELS = [DocumentsPanel, MergePanel, VerdictPanel];
const PANEL_TITLES = ['Four documents, read together', 'Merged, with the disagreements named', 'Scored against your thresholds'];

export default function StepsScroller() {
  // Pinning needs both the height for a side-by-side and a visitor who has
  // not asked for less motion.
  const wide = useMediaQuery('(min-width: 900px)');
  const pinned = wide && !prefersReducedMotion();
  const [ref, progress] = useScrollProgress(pinned);

  // Clicking a step should work, because a numbered list of steps looks
  // clickable whether or not it is. An explicit choice overrides the scroll
  // position until the reader scrolls again.
  const [picked, setPicked] = useState(null);

  const scrolled = pinned
    ? Math.min(STEPS.length - 1, Math.floor(progress * 0.999 * STEPS.length))
    : -1;
  const active = picked !== null ? picked : scrolled;

  // Scrolling releases a click, so the section never gets stuck on a step
  // the reader has scrolled away from.
  useEffect(() => { setPicked(null); }, [scrolled]);

  // Put the viewport where the given step is the scroll-driven answer, so
  // clicking and scrolling agree rather than fighting.
  //
  // Measured from the rect rather than offsetTop: offsetTop is relative to
  // the nearest positioned ancestor, which is not guaranteed to be the
  // document once anything above gains a transform or a position.
  const goToStep = (i) => {
    setPicked(i);
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sectionTop = rect.top + window.scrollY;
    const travel = rect.height - window.innerHeight;
    if (travel <= 0) return;
    // Land in the middle of the step's band, so a nudge in either direction
    // does not immediately flip to a neighbour.
    const target = sectionTop + travel * ((i + 0.5) / STEPS.length);
    window.scrollTo({ top: Math.round(target), behavior: 'smooth' });
  };

  // ---- Stacked fallback ----
  if (!pinned) {
    return (
      <section id="how-it-works" className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">
            Screen a deal in 3 steps
          </h2>
          <p className="text-gray-500 text-center mb-12 text-lg">
            Upload what you were sent. Review what it read. Export the memo.
          </p>
          <div className="space-y-10 max-w-lg mx-auto">
            {STEPS.map((s, i) => {
              const Panel = PANELS[i];
              return (
                <div key={s.n}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: GOLD }}>
                      {s.n}
                    </span>
                    <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
                  </div>
                  <p className="text-[15px] text-gray-500 leading-relaxed mb-4">{s.desc}</p>
                  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                    <Panel />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ---- Pinned ----
  return (
    <section id="how-it-works" ref={ref} className="bg-white relative" style={{ height: '280vh' }}>
      <div className="sticky top-0 h-screen flex items-center overflow-hidden">
        {/* The pinned viewport is mostly margin by design, and empty margin
            reads as unfinished rather than as restraint. A faint rule grid
            and one warm wash give the whitespace a floor without competing
            with the panel. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 90% 70% at 50% 50%, transparent 30%, #000 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 50%, transparent 30%, #000 100%)',
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'radial-gradient(50% 45% at 72% 50%, rgba(212,168,67,0.06), transparent 70%)' }}
        />
        {/* Progress rail, so the reader can see how far the section runs. */}
        <div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-px bg-gray-100">
          <div
            className="w-px transition-[height] duration-200 ease-out"
            style={{ height: `${Math.round(progress * 100)}%`, backgroundColor: GOLD }}
          />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-6 w-full">
          <div className="grid grid-cols-2 gap-16 items-center">

            {/* Steps */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Screen a deal in 3 steps
              </h2>
              <p className="text-gray-500 mb-10 text-lg">
                Upload what you were sent. Review what it read. Export the memo.
              </p>
              <div className="space-y-7">
                {STEPS.map((s, i) => {
                  const isActive = i === active;
                  return (
                    <button
                      key={s.n}
                      type="button"
                      onClick={() => goToStep(i)}
                      aria-current={isActive ? 'step' : undefined}
                      className="flex gap-4 text-left w-full transition-opacity duration-400 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-gray-300 hover:opacity-100"
                      style={{ opacity: isActive ? 1 : 0.4 }}
                    >
                      <div className="flex flex-col items-center flex-shrink-0">
                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-colors duration-400"
                          style={{
                            backgroundColor: isActive ? GOLD : '#e5e7eb',
                            color: isActive ? '#fff' : '#6b7280',
                          }}
                        >
                          {s.n}
                        </span>
                        {i < STEPS.length - 1 && (
                          <span className="w-px flex-1 mt-2 bg-gray-200" style={{ minHeight: 28 }} />
                        )}
                      </div>
                      <div className="pb-1">
                        <h3 className="text-[17px] font-semibold text-gray-900 mb-1.5">{s.title}</h3>
                        <p className="text-[15px] text-gray-500 leading-relaxed max-w-[42ch]">{s.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Panel */}
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-[28px] opacity-50 blur-2xl"
                style={{ background: 'radial-gradient(60% 60% at 50% 40%, rgba(212,168,67,0.14), transparent 70%)' }}
              />
              <div className="relative rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 text-[11.5px] font-semibold text-gray-900 relative h-[38px]">
                  {PANEL_TITLES.map((title, i) => (
                    <span
                      key={title}
                      className="absolute inset-0 flex items-center px-4 transition-opacity duration-400 ease-out"
                      style={{ opacity: i === Math.max(0, active) ? 1 : 0 }}
                    >
                      {title}
                    </span>
                  ))}
                </div>
                {/* Panels are stacked and cross-faded rather than swapped.
                    Toggling display made the panel snap while the step text
                    faded over 400ms, so the two visibly disagreed mid-scroll. */}
                <div className="relative p-4" style={{ minHeight: 268 }}>
                  {PANELS.map((Panel, i) => (
                    <div
                      key={i}
                      aria-hidden={i !== active}
                      className="transition-opacity duration-400 ease-out"
                      style={{
                        position: i === 0 ? 'relative' : 'absolute',
                        inset: i === 0 ? undefined : 16,
                        opacity: i === active ? 1 : 0,
                        pointerEvents: i === active ? 'auto' : 'none',
                      }}
                    >
                      <Panel />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
