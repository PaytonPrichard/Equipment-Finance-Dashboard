import React from 'react';
import TrancheLogo from './TrancheLogo';
import HeroDemo from './landing/HeroDemo';
import StepsScroller from './landing/StepsScroller';
import Reveal, { RevealGroup } from './landing/Reveal';
import { useScrolledPast } from '../hooks/useReveal';

// ── Brand color ──────────────────────────────────────────────
const GOLD = '#D4A843';
// Warm putty. Biased toward the gold rather than a neutral grey, so the
// margin around the sheet reads as chosen rather than as unpainted.
const GROUND = '#E3DED2';
const GOLD_LIGHT = '#F5EDD6';

const FEATURES = [
  {
    title: 'Instant Risk Scoring',
    description: 'Pass/flag/fail verdict with composite score in under 2 minutes. DSCR, leverage, LTV, industry risk, and three other factors scored automatically.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    title: 'Multi-Asset Screening',
    description: 'Equipment, accounts receivable, and inventory finance from one platform. Each asset class has its own scoring model and form schema.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    title: 'Configurable Credit Policy',
    description: 'Set your own DSCR floors, leverage ceilings, and concentration limits. The screening model adapts to your firm, not the other way around.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    title: 'Pipeline & Collaboration',
    description: 'Track deals from screening through funded. Kanban board with stage gates, document attachments, role-based access, and full audit trail.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Branded Memos',
    description: 'Generate credit committee-ready PDFs with your firm logo, colors, and disclaimers. One click from screening to deliverable.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    title: 'CRM Integrations',
    description: 'REST API and webhooks connect Salesforce, HubSpot, or any CRM. Deals flow in, scores flow back. HMAC-signed payloads.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
];

const PRICING = [
  {
    name: 'Analyst',
    price: '$200',
    period: '/mo',
    who: 'For individual analysts',
    features: ['1 user', 'All asset classes', 'Pass/flag/fail screening', 'Deal pipeline', 'CSV & PDF export', '50 active deals'],
    cta: 'Request a trial',
  },
  {
    name: 'Team',
    price: '$500',
    period: '/mo',
    who: 'For credit teams of 2-10',
    features: ['Up to 10 users', 'Everything in Analyst', 'Unlimited deals', 'Firm-branded memos', 'Shared pipeline & audit trail', 'Custom scoring weights', 'API & webhook integrations'],
    cta: 'Request a trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$1,500',
    period: '/mo',
    who: 'For lenders with custom workflows',
    features: ['Up to 50 users', 'Everything in Team', 'Custom scoring models', 'SSO integration', 'Dedicated support & SLA'],
    cta: 'Schedule a demo',
  },
];

export default function LandingPage({ onGetStarted, onSignIn }) {
  // Drives the nav from transparent-over-hero to solid once you scroll.
  const scrolled = useScrolledPast(24);

  // The how-it-works section is a tall pinned scroller, so its top is a
  // run-up rather than its content. Jumping to the element itself lands on
  // blank page. Aim a sixth of the way in, which is the middle of step one.
  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const travel = rect.height - window.innerHeight;
    const top = rect.top + window.scrollY + Math.max(0, travel) / 6;
    window.scrollTo({ top: Math.round(top), behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: GROUND }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: GROUND,
          borderBottom: `1px solid ${scrolled ? 'rgba(22,21,15,0.08)' : 'transparent'}`,
        }}
      >
        <div
          className="max-w-[1240px] mx-auto px-8 flex items-center justify-between transition-all duration-300"
          style={{ height: scrolled ? 64 : 76 }}
        >
          <span className="flex items-center gap-2.5 text-xl font-extrabold text-gray-900 tracking-tight">
            <TrancheLogo size={32} />
            Tranche
          </span>
          <div className="hidden md:flex items-center gap-7">
            <button onClick={scrollToHowItWorks} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">How it works</button>
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Features</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Pricing</button>
            <a href="?demo=1" className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Demo</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onSignIn} className="px-3 py-2 rounded-lg text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign in</button>
            <button onClick={onGetStarted} className="px-5 py-2.5 rounded-lg text-[15px] font-semibold text-white hover:opacity-90 transition-all" style={{ backgroundColor: GOLD }}>Get started</button>
          </div>
        </div>
      </nav>

      {/* The sheet. Everything below sits on it. */}
      <div className="px-3 sm:px-5 pb-3 sm:pb-5">
        <div
          className="bg-white rounded-[20px] sm:rounded-[28px] overflow-hidden"
          style={{
            // Layered rather than one blur: a hairline to define the edge
            // against the putty, a tight shadow for contact, and two wide
            // soft ones for lift. Tinted warm (22,21,15) instead of black,
            // so the shadow belongs to this ground rather than sitting on it.
            boxShadow:
              '0 0 0 1px rgba(22,21,15,0.045), 0 1px 2px rgba(22,21,15,0.04), 0 14px 32px -10px rgba(22,21,15,0.10), 0 44px 88px -36px rgba(22,21,15,0.16)',
          }}
        >

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Warm ground, plus a faint rule grid fading out toward the middle.
            Without it the hero is a white field with text floating in it. */}
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
        <div className="relative max-w-[1180px] mx-auto px-8 pt-24 md:pt-32 pb-24 md:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-16 items-center">

            {/* Copy */}
            <div className="text-center lg:text-left">
              <Reveal>
                <p className="text-[15px] font-semibold tracking-wide mb-5" style={{ color: GOLD }}>
                  Pre-origination deal screening for ABL lenders
                </p>
              </Reveal>
              <Reveal delay={80}>
                <h1 className="text-[42px] sm:text-[54px] md:text-[64px] font-extrabold text-gray-900 leading-[1.04] mb-7 tracking-[-0.025em] text-balance">
                  Screen equipment, AR, and inventory deals in minutes, not hours.
                </h1>
              </Reveal>
              <Reveal delay={160}>
                <p className="text-lg text-gray-500 mb-9 leading-relaxed max-w-xl mx-auto lg:mx-0">
                  A deal arrives as documents that disagree with each other. Tranche reads them together, shows you where they disagree, scores the deal against your credit policy, and produces the memo.
                </p>
              </Reveal>
              <Reveal delay={240}>
                <div className="flex items-center justify-center lg:justify-start gap-4 mb-4 flex-wrap">
                  <button onClick={onGetStarted} className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-white shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all" style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(212, 168, 67, 0.3)' }}>
                    Request a trial
                  </button>
                  <a href="?demo=1" className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 hover:-translate-y-0.5 transition-all">
                    View demo
                  </a>
                </div>
                <p className="text-sm text-gray-500">Try the live demo on sample deals. No account needed.</p>
              </Reveal>
            </div>

            {/* The product, doing its job */}
            <Reveal delay={300}>
              <HeroDemo />
            </Reveal>

          </div>
        </div>
      </section>

      {/* Who it moves between */}
      <section className="max-w-[1180px] mx-auto px-8 pt-4 pb-16">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-gray-400 mb-10">
            One deal, three desks
          </p>
        </Reveal>
        <div className="relative max-w-4xl mx-auto">
          {/* The line the deal travels along. */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-[26px] left-[16%] right-[16%] h-px"
            style={{ background: 'linear-gradient(90deg, transparent, #e5e0d4 15%, #e5e0d4 85%, transparent)' }}
          />
          <RevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
            {[
              { role: 'Credit analyst', does: 'Screens the file', gets: 'Verdict in two minutes' },
              { role: 'Deal team', does: 'Moves it through stages', gets: 'Pipeline with an audit trail' },
              { role: 'Credit committee', does: 'Makes the call', gets: 'A memo that names its sources' },
            ].map((p) => (
              <div key={p.role} className="text-center">
                <div className="flex justify-center mb-4">
                  <span
                    className="w-[52px] h-[52px] rounded-full bg-white border flex items-center justify-center"
                    style={{ borderColor: '#e5e0d4' }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: GOLD }} />
                  </span>
                </div>
                <div className="text-[15px] font-semibold text-gray-900 mb-1">{p.role}</div>
                <div className="text-[13.5px] text-gray-500 mb-2">{p.does}</div>
                <div className="text-[13px] text-gray-400">{p.gets}</div>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-[1180px] mx-auto px-8 py-24 md:py-32">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">Purpose-built for ABL teams</h2>
            <p className="text-gray-500 text-center mb-12 text-lg">No consultants. No 6-month implementation. Start screening today.</p>
          </Reveal>
          <RevealGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200/80 p-6 hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 transition-all h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: GOLD_LIGHT, color: GOLD }}>
                    {f.icon}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{f.title}</h3>
                </div>
                <p className="text-[15px] text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* How It Works */}
      <StepsScroller />

      {/* Time to value */}
      <section className="relative overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, #000 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, #000 100%)',
          }}
        />
        <div className="relative max-w-[1000px] mx-auto px-8 py-24 md:py-28">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-start">

            <Reveal>
              <p className="text-[13px] font-semibold uppercase tracking-wider mb-4" style={{ color: GOLD }}>
                Setup
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight text-balance">
                Live in under twenty minutes
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-6">
                No rollout, no consultants, no implementation partner. Four things,
                in one sitting.
              </p>
              <p className="text-[15px] text-gray-500 leading-relaxed">
                Already tracking deals in a CRM? Salesforce, HubSpot and anything else
                connect through the API. Deals flow in, scores flow back.
              </p>
            </Reveal>

            <div className="relative">
              {/* The rail the steps hang from. */}
              <div
                aria-hidden="true"
                className="absolute left-[27px] top-3 bottom-6 w-px"
                style={{ backgroundColor: '#e5e0d4' }}
              />
              <RevealGroup className="space-y-7">
                {[
                  { time: '10', unit: 'min', title: 'Upload your pipeline', desc: 'Existing deals by CSV, scored in bulk.' },
                  { time: '5', unit: 'min', title: 'Set your credit policy', desc: 'DSCR, leverage and concentration thresholds.' },
                  { time: '2', unit: 'min', title: 'Invite the team', desc: 'Invite codes, with roles already configured.' },
                  { time: 'Live', unit: '', title: 'Dashboard is up', desc: 'Score distribution and pipeline analytics.' },
                ].map((item) => (
                  <div key={item.title} className="flex gap-5 items-start relative">
                    <div
                      className="w-14 h-14 rounded-full bg-white border flex flex-col items-center justify-center flex-shrink-0 relative z-10"
                      style={{ borderColor: '#e5e0d4' }}
                    >
                      <span className="text-[17px] font-bold leading-none tabular-nums" style={{ color: GOLD }}>
                        {item.time}
                      </span>
                      {item.unit && <span className="text-[9.5px] font-semibold text-gray-400 mt-0.5">{item.unit}</span>}
                    </div>
                    <div className="pt-2.5">
                      <h3 className="text-[15.5px] font-semibold text-gray-900 mb-0.5">{item.title}</h3>
                      <p className="text-[14px] text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </RevealGroup>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white">
        <div className="max-w-[1180px] mx-auto px-8 py-24 md:py-32">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">Simple pricing</h2>
          <p className="text-gray-500 text-center mb-12 text-lg">Priced per organization, not per seat.</p>
          <RevealGroup className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 flex flex-col h-full ${
                  plan.highlight
                    ? 'bg-gray-900 text-white relative ring-2'
                    : 'bg-white border border-gray-200'
                }`}
                style={plan.highlight ? { ringColor: GOLD } : undefined}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold text-white uppercase tracking-wider" style={{ backgroundColor: GOLD }}>
                    Most Popular
                  </div>
                )}
                <h3 className={`text-lg font-bold mb-0.5 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
                <p className={`text-sm mb-4 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.who}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className={`text-3xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                  <span className={`text-base ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
                </div>
                <button
                  onClick={onGetStarted}
                  className={`w-full py-3 rounded-lg text-[15px] font-semibold transition-all mb-5 ${
                    plan.highlight
                      ? 'text-gray-900 hover:opacity-90'
                      : 'text-white hover:opacity-90'
                  }`}
                  style={{ backgroundColor: plan.highlight ? GOLD : '#111827' }}
                >
                  {plan.cta}
                </button>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2.5 text-[14px] ${plan.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="flex-shrink-0 mt-0.5" strokeWidth="2" style={{ color: plan.highlight ? GOLD : '#9CA3AF' }}>
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
            Every plan starts with a trial. Plans are arranged directly with us,
            so there is nothing to check out and no contract to sign first.
          </p>
        </div>
      </section>

      {/* Close */}
      <section id="contact" className="relative overflow-hidden" style={{ backgroundColor: '#12110E' }}>
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: 'radial-gradient(70% 90% at 50% 0%, rgba(212,168,67,0.10), transparent 70%)' }}
        />
        <div className="relative max-w-[1080px] mx-auto px-8 py-24 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-[40px] font-bold text-white mb-4 tracking-tight">
              Screen your first deal today
            </h2>
            <p className="text-gray-400 mb-9 text-lg max-w-lg mx-auto text-balance">
              Try it on sample deals now, or send us yours and we will set you up.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={onGetStarted}
                className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-900 hover:opacity-90 hover:-translate-y-0.5 transition-all"
                style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(212,168,67,0.25)' }}
              >
                Request a trial
              </button>
              <a
                href="?demo=1"
                className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-200 border border-gray-700 hover:border-gray-500 hover:-translate-y-0.5 transition-all"
              >
                Open the demo
              </a>
            </div>
            <p className="text-[15px] text-gray-500 mt-7">
              Or email{' '}
              <a href="mailto:team@gettranche.app" className="text-gray-300 hover:text-white transition-colors border-b border-gray-600">
                team@gettranche.app
              </a>
              . We reply within a business day.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Footer. The three security claims used to have a band of their own
          between the CTA and here, which made the page say goodbye four times.
          They are quieter and better placed as a footer row. */}
      <footer style={{ backgroundColor: '#12110E' }} className="border-t border-gray-800/60">
        <div className="max-w-[1080px] mx-auto px-8 py-9">
          <div className="flex items-center justify-center gap-x-8 gap-y-3 flex-wrap pb-7 mb-7 border-b border-gray-800/60">
            {['Row-level data isolation', 'Role-based access', 'Audit trail on deal changes'].map((label) => (
              <span key={label} className="flex items-center gap-2 text-[13px] text-gray-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="flex items-center gap-2 text-sm font-bold text-gray-400 tracking-tight">
              <TrancheLogo size={20} framed={false} />
              Tranche
            </span>
            <div className="flex items-center gap-5">
              <a href="/privacy.html" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy</a>
              <a href="/terms.html" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms</a>
              <a href="mailto:team@gettranche.app" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Contact</a>
              <span className="text-xs text-gray-600">&copy; {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>

        </div>
      </div>
    </div>
  );
}
