import React, { useEffect } from 'react';
import HeroDemo from './landing/HeroDemo';
import Reveal, { RevealGroup } from './landing/Reveal';
import SiteShell, { GOLD, CREAM, RULE } from './landing/SiteChrome';
import { MergePanel, BuildPanel, VerdictPanel, ScorecardPanel, DriftPanel } from './landing/ProductPanels';
import { MONITORING_COMING } from './landing/siteFacts';
import { useActiveSection } from '../hooks/useReveal';

// One idea per section: a headline, a line, one readable piece of the
// product. Depth lives on the Methodology page, which each section can link
// to. Every claim here has to match what is live. Figures come from
// landing/siteFacts.js and are checked by its test.

// Limits are plan terms, arranged by hand. Nothing here is a feature the
// product does not have. Larger teams get a line under the cards, not a
// third card with nothing behind it.
const PRICING = [
  {
    name: 'Analyst',
    price: '$200',
    period: '/mo',
    who: 'For individual analysts',
    features: ['1 user', 'All asset classes', 'Pass/flag/fail screening', 'Deal pipeline', 'CSV and PDF export', '50 active deals'],
  },
  {
    name: 'Team',
    price: '$500',
    period: '/mo',
    who: 'For credit teams of 2 to 10',
    features: ['Up to 10 users', 'Everything in Analyst', 'Unlimited deals', 'Firm-branded memos', 'Shared pipeline and audit trail', 'API and webhooks'],
    primary: true,
  },
];

const SETUP_STEPS = [
  { n: '1', title: 'Upload your pipeline', desc: 'Existing deals by CSV, scored in bulk.' },
  { n: '2', title: 'Set your thresholds', desc: 'DSCR, leverage, LTV and concentration limits.' },
  { n: '3', title: 'Invite the team', desc: 'Invite codes, with roles already set.' },
];

const SECURITY = ['Row-level data isolation', 'Role-based access', 'Audit trail on deal changes'];

function MethodLink({ to, children }) {
  return (
    <a
      href={`/methodology#${to}`}
      className="inline-flex items-center gap-1.5 text-[14px] font-medium text-gray-900 border-b border-gray-300 hover:border-gray-900 transition-colors"
    >
      {children}
      <span aria-hidden="true">&rarr;</span>
    </a>
  );
}

/**
 * Copy on one side, the product on the other. Copy is first in the markup,
 * so on a phone it sits above the visual. `flip` swaps the sides on desktop
 * so consecutive sections do not all lean the same way.
 */
function ProductSection({ id, title, line, small, link, flip, tint, children }) {
  return (
    <section id={id} className="scroll-mt-20" style={tint ? { backgroundColor: '#FAFAF8' } : undefined}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-20 md:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <Reveal className={flip ? 'lg:order-2' : ''}>
            <h2 className="text-3xl md:text-[40px] font-bold text-gray-900 mb-4 tracking-tight leading-[1.1] text-balance">
              {title}
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed max-w-[46ch]">{line}</p>
            {small && <div className="mt-5 text-[14px] text-gray-500 leading-relaxed max-w-[46ch]">{small}</div>}
            {link && <div className="mt-6">{link}</div>}
          </Reveal>
          <Reveal delay={120} className="min-w-0">
            {children}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ onGetStarted, onSignIn }) {
  // 88px clears the nav at either of its two heights.
  const activeSection = useActiveSection(['product', 'pricing'], 88);

  // Arriving from the Methodology page on /#pricing: the section does not
  // exist yet when the browser first tries the hash, because the auth check
  // renders before this page does.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth' });
    return true;
  };

  return (
    <SiteShell current={activeSection} onSection={scrollToSection} onGetStarted={onGetStarted} onSignIn={onSignIn}>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Warm ground, plus a faint rule grid fading out toward the middle.
            Without it the hero is a white field with text floating in it.
            This is the only decorative grid on the page. */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-amber-50/50 via-white to-white" />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 20%, #000 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, transparent 20%, #000 100%)',
          }}
        />
        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-8 pt-20 md:pt-32 pb-20 md:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-16 items-center">

            <div className="text-center lg:text-left">
              <Reveal>
                <p className="text-[15px] font-semibold tracking-wide mb-5" style={{ color: GOLD }}>
                  Pre-origination deal screening for ABL lenders
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-[40px] sm:text-[54px] md:text-[62px] font-extrabold text-gray-900 leading-[1.04] mb-7 tracking-[-0.025em] text-balance">
                  Screen deals from the documents you receive.
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-lg text-gray-500 mb-9 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  Upload the deal file. Tranche reads it, shows where the documents disagree and scores the deal against your thresholds.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-5 flex-wrap">
                  <button onClick={onGetStarted} className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-white shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all" style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(212, 168, 67, 0.3)' }}>
                    Request a trial
                  </button>
                  <a href="?demo=1" className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 hover:-translate-y-0.5 transition-all">
                    View demo
                  </a>
                </div>
                <p className="text-sm text-gray-500 max-w-xl mx-auto lg:mx-0">
                  For credit analysts, deal teams and committee members at non-bank lenders.
                  The demo runs on sample deals. No account needed.
                </p>
              </Reveal>
            </div>

            {/* The product, doing its job */}
            <Reveal delay={300} className="min-w-0">
              <HeroDemo />
            </Reveal>

          </div>
        </div>
      </section>

      <ProductSection
        id="product"
        tint
        flip
        title="Read the whole file at once."
        line="Upload the documents you were sent. Every field shows its source. Disagreements are shown, not resolved silently."
        small="What Tranche reads only prefills the form. You review it before anything is scored."
      >
        <MergePanel />
      </ProductSection>

      <ProductSection
        title="Statement lines in. EBITDA built."
        line="Enter the lines from the financials. Tranche builds EBITDA, debt and debt service, and shows each formula. You confirm every judgment."
        link={<MethodLink to="build">How the numbers are built</MethodLink>}
      >
        <BuildPanel />
      </ProductSection>

      <ProductSection
        tint
        flip
        title="Pass, flag or fail against your thresholds."
        line="Seven weighted factors, a verdict with its reasons, and a committee memo that names its sources."
        small="Collateral valued at liquidation. Cash flow stressed. Every estimate marked as one."
        link={<MethodLink to="scored">What is scored</MethodLink>}
      >
        <VerdictPanel />
      </ProductSection>

      <ProductSection
        title="Run on nine public borrowers."
        line="Every verdict is published with its reasons, including one the model gets wrong."
        small="These are large public companies, not lower-middle-market borrowers. The run shows how the model reasons. It does not prove the model."
        link={<MethodLink to="test">Read the method</MethodLink>}
      >
        <ScorecardPanel />
      </ProductSection>

      <ProductSection
        tint
        flip
        title="Monitor what you funded."
        line="Covenants are seeded from the underwrite. Tests are recorded and tracked against what you underwrote."
        small={(
          <>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Coming</span>
            <ul className="mt-2 flex flex-wrap gap-2">
              {MONITORING_COMING.map((item) => (
                <li key={item} className="text-[13px] text-gray-500 border border-dashed border-gray-300 rounded-full px-3 py-1">
                  {item}
                </li>
              ))}
            </ul>
          </>
        )}
      >
        <DriftPanel />
      </ProductSection>

      {/* Setup, with the security claims as a quiet row under it. */}
      <section>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-20 md:py-28">
          <Reveal>
            <h2 className="text-3xl md:text-[40px] font-bold text-gray-900 mb-4 tracking-tight text-center">Set up in one sitting.</h2>
            <p className="text-lg text-gray-500 text-center mb-12 max-w-xl mx-auto">
              No rollout and no implementation partner. Three steps.
            </p>
          </Reveal>
          <RevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {SETUP_STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-gray-200 p-6 h-full">
                <div className="text-[13px] font-semibold font-mono tabular-nums text-gray-400 mb-3">{s.n}</div>
                <h3 className="text-[16px] font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </RevealGroup>
          <Reveal>
            <p className="text-[15px] text-gray-500 leading-relaxed text-center max-w-2xl mx-auto mt-10">
              Already tracking deals in a CRM? Tranche has an API and webhooks. Send deals in from Salesforce,
              HubSpot or any system that can call a web address. Scores and stage changes come back.
            </p>
            <div className="flex items-center justify-center gap-x-8 gap-y-3 flex-wrap mt-10 pt-8 border-t max-w-3xl mx-auto" style={{ borderColor: RULE }}>
              {SECURITY.map((label) => (
                <span key={label} className="flex items-center gap-2 text-[13px] text-gray-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-[1180px] mx-auto px-4 sm:px-8 py-20 md:py-28">
          <h2 className="text-3xl md:text-[40px] font-bold text-gray-900 mb-4 text-center tracking-tight">Pricing</h2>
          <p className="text-gray-500 text-center mb-12 text-lg">Priced per organization, not per seat.</p>
          <RevealGroup className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.name} className="rounded-xl p-6 flex flex-col h-full bg-white border border-gray-200">
                <h3 className="text-lg font-bold mb-0.5 text-gray-900">{plan.name}</h3>
                <p className="text-sm mb-4 text-gray-500">{plan.who}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                  <span className="text-base text-gray-500">{plan.period}</span>
                </div>
                <button
                  onClick={onGetStarted}
                  className={`w-full py-3 rounded-lg text-[15px] font-semibold transition-all mb-5 hover:opacity-90 ${plan.primary ? 'text-white' : 'text-gray-900 border border-gray-300 bg-white'}`}
                  style={plan.primary ? { backgroundColor: GOLD } : undefined}
                >
                  Request a trial
                </button>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[14px] text-gray-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0 mt-0.5 text-gray-400" strokeWidth="2" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </RevealGroup>
          <p className="text-center text-[15px] text-gray-500 mt-10 max-w-lg mx-auto">
            Every plan starts with a trial. Plans are arranged directly with us, so there is nothing to check out first.
            Larger team or custom needs?{' '}
            <a href="mailto:team@gettranche.app" className="text-gray-900 border-b border-gray-300 hover:border-gray-900 transition-colors">Talk to us</a>.
          </p>
        </div>
      </section>

      {/* Close */}
      <section id="contact" style={{ backgroundColor: CREAM }}>
        <div className="max-w-[1080px] mx-auto px-4 sm:px-8 py-20 md:py-24 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-[40px] font-bold text-gray-900 mb-4 tracking-tight">
              Screen your first deal.
            </h2>
            <p className="text-gray-500 mb-9 text-lg max-w-lg mx-auto text-balance">
              Try it on sample deals now, or request a trial and we will set you up.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={onGetStarted}
                className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-white hover:opacity-90 hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(212,168,67,0.25)' }}
              >
                Request a trial
              </button>
              <a
                href="?demo=1"
                className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 hover:-translate-y-0.5 transition-all bg-white"
              >
                Open the demo
              </a>
            </div>
            <p className="text-[15px] text-gray-500 mt-7">
              Or email{' '}
              <a href="mailto:team@gettranche.app" className="text-gray-900 border-b border-gray-300 hover:border-gray-900 transition-colors">
                team@gettranche.app
              </a>
              . We reply within a business day.
            </p>
          </Reveal>
        </div>
      </section>

    </SiteShell>
  );
}
