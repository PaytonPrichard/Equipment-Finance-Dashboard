import React from 'react';

// ── Brand color ──────────────────────────────────────────────
const GOLD = '#C8A54A';
const GOLD_LIGHT = '#F5EDD6';

const FEATURES = [
  {
    title: 'Instant Risk Scoring',
    description: 'Pass/flag/fail verdict with composite score in under 2 minutes. DSCR, leverage, collateral coverage, and 7 other factors scored automatically.',
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
    name: 'Starter',
    price: '$200',
    period: '/mo',
    who: 'For individual analysts',
    features: ['1 user', 'All asset classes', 'Pass/flag/fail screening', 'Deal pipeline', 'CSV & PDF export', '50 active deals'],
    cta: 'Start Free Trial',
  },
  {
    name: 'Growth',
    price: '$500',
    period: '/mo',
    who: 'For credit teams of 2-10',
    features: ['Up to 10 users', 'Everything in Starter', 'Unlimited deals', 'Firm-branded memos', 'Shared pipeline & audit trail', 'Custom scoring weights', 'API & webhook integrations'],
    cta: 'Start Free Trial',
    highlight: true,
  },
  {
    name: 'Institution',
    price: '$1,500',
    period: '/mo',
    who: 'For lenders with custom workflows',
    features: ['Up to 50 users', 'Everything in Growth', 'API access', 'Custom scoring models', 'SSO integration', 'Dedicated support & SLA'],
    cta: 'Schedule a Demo',
  },
];

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">Tranche</span>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Features</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Pricing</button>
            <button onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })} className="text-[15px] text-gray-500 hover:text-gray-900 transition-colors">Contact</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="px-4 py-2 rounded-lg text-[15px] font-medium text-gray-600 hover:text-gray-900 transition-colors">Sign In</button>
            <button onClick={onGetStarted} className="px-5 py-2.5 rounded-lg text-[15px] font-semibold text-white hover:opacity-90 transition-all" style={{ backgroundColor: GOLD }}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Subtle warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/40 via-white to-white" />
        <div className="relative max-w-[1200px] mx-auto px-6 pt-24 md:pt-32 pb-16 text-center">
          <p className="text-[15px] font-semibold tracking-wide mb-6" style={{ color: GOLD }}>
            Pre-origination deal screening for ABL lenders
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-[56px] font-extrabold text-gray-900 leading-[1.1] mb-6 tracking-tight max-w-4xl mx-auto">
            Screen equipment, AR, and inventory deals in minutes, not hours.
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Automated risk scoring, configurable credit policy, and branded screening memos. Replace the spreadsheet your team uses to screen ABL deals.
          </p>
          <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={onGetStarted} className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-white shadow-lg hover:opacity-90 transition-all" style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(200, 165, 74, 0.3)' }}>
              Start 14-Day Free Trial
            </button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-7 py-3.5 rounded-lg text-[16px] font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 transition-all">
              See How It Works
            </button>
          </div>
          <p className="text-sm text-gray-400">No credit card required. Full access for 14 days.</p>
        </div>
      </section>

      {/* Product Screenshot */}
      <section className="max-w-[1100px] mx-auto px-6 pb-8">
        <div className="rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/60 overflow-hidden">
          <img
            src="/screenshot.png"
            alt="Tranche deal screening dashboard showing risk score, pass verdict, executive summary, and risk factor breakdown"
            className="w-full"
          />
        </div>
      </section>

      {/* Who is this for */}
      <section className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="flex items-center justify-center gap-x-10 gap-y-4 flex-wrap">
          {[
            { title: 'Credit Analysts', desc: 'Screen 10x more deals.' },
            { title: 'Deal Teams', desc: 'Track pipeline to funded.' },
            { title: 'Credit Committees', desc: 'Standardized memos.' },
          ].map((p, i) => (
            <React.Fragment key={p.title}>
              {i > 0 && <span className="hidden md:inline text-gray-200 text-lg select-none">/</span>}
              <div className="text-center">
                <span className="text-base font-semibold text-gray-900">{p.title}</span>
                <span className="text-base text-gray-400 ml-2">{p.desc}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">Purpose-built for ABL teams</h2>
          <p className="text-gray-500 text-center mb-12 text-lg">No consultants. No 6-month implementation. Start screening today.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200/80 p-6 hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: GOLD_LIGHT, color: GOLD }}>
                  {f.icon}
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">Screen a deal in 3 steps</h2>
          <p className="text-gray-500 text-center mb-14 text-lg">No learning curve. No training. Start today.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Enter deal data', desc: 'Select asset class. Input borrower financials and collateral details.' },
              { step: '2', title: 'Get instant results', desc: 'Risk score, pass/flag/fail verdict, stress test, and structure recommendations.' },
              { step: '3', title: 'Export and track', desc: 'Download a branded PDF memo. Save to pipeline. Track through funding.' },
            ].map((s, idx) => (
              <div key={s.step} className="relative text-center">
                {idx < 2 && (
                  <div className="hidden md:block absolute top-6 -right-4">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-300" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: GOLD }}>
                  <span className="text-base font-bold text-white">{s.step}</span>
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-[15px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Speed to Value */}
      <section className="bg-gray-900">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 text-center tracking-tight">Your whole pipeline, scored by end of day</h2>
          <p className="text-gray-400 text-center mb-12 text-lg">No 6-month rollout. No consultant engagement. One afternoon.</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {[
              {
                time: '10 min', title: 'Upload your pipeline',
                desc: 'Batch upload existing deals via CSV. Hundreds of deals scored at once.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
              },
              {
                time: '5 min', title: 'Set credit policy',
                desc: 'Configure DSCR, leverage, and concentration thresholds to match your firm.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>,
              },
              {
                time: '2 min', title: 'Invite your team',
                desc: 'Send invite codes. Role-based access is set up automatically.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>,
              },
              {
                time: 'Done', title: 'Dashboard is live',
                desc: 'Pipeline analytics, score distributions, and deal tracking. Ready to go.',
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
              },
            ].map((item, idx) => (
              <div key={item.title} className="bg-gray-800/60 rounded-xl border border-gray-700/50 p-6 relative">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(200,165,74,0.15)', color: GOLD }}>
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>{item.time}</span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{item.title}</h3>
                <p className="text-[15px] text-gray-400 leading-relaxed">{item.desc}</p>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-600" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Integration callout */}
          <div className="max-w-3xl mx-auto mt-12 p-6 rounded-2xl bg-gray-800/40 border border-gray-700/40">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(200,165,74,0.15)', color: GOLD }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white mb-1.5">Already tracking deals in a CRM?</h3>
                <p className="text-[15px] text-gray-400 leading-relaxed mb-3">
                  Connect Salesforce, HubSpot, or any system with the Tranche API. Deals flow in automatically, scores flow back. No CSV needed.
                </p>
                <div className="flex items-center gap-5 text-[13px] text-gray-500">
                  {['REST API', 'Webhooks', 'HMAC-signed payloads'].map(label => (
                    <span key={label} className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white">
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-28">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-center tracking-tight">Simple pricing</h2>
          <p className="text-gray-500 text-center mb-12 text-lg">Per-organization, not per-seat. Cancel anytime.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 flex flex-col ${
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
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-400">
            <span>14-day free trial</span>
            <span>&middot;</span>
            <span>No credit card required</span>
            <span>&middot;</span>
            <span>Annual: save 20%</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ backgroundColor: '#0F0E0C' }}>
        <div className="max-w-[1200px] mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Ready to screen your first deal?</h2>
          <p className="text-gray-400 mb-8 text-lg">Set up in 5 minutes. Screen your first deal in 2. No credit card, no contracts.</p>
          <button onClick={onGetStarted} className="px-8 py-4 rounded-lg text-[16px] font-semibold text-gray-900 hover:opacity-90 transition-all shadow-lg" style={{ backgroundColor: GOLD, boxShadow: '0 4px 24px rgba(200, 165, 74, 0.25)' }}>
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" style={{ backgroundColor: '#0F0E0C' }} className="border-t border-gray-800">
        <div className="max-w-[1200px] mx-auto px-6 py-14 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Get in touch</h2>
          <p className="text-gray-400 text-base mb-6">Questions about Tranche, pricing, or pilot programs? We respond within one business day.</p>
          <a
            href="mailto:team@usetranche.com"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg border text-base font-medium text-white hover:bg-gray-800 transition-all"
            style={{ borderColor: 'rgba(200,165,74,0.3)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            team@usetranche.com
          </a>
        </div>
      </section>

      {/* Trust Bar */}
      <section style={{ backgroundColor: '#0F0E0C' }} className="border-t border-gray-800">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {[
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'SOC 2 in progress' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, label: 'Encrypted at rest' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>, label: 'Role-based access' },
              { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'Audit trail on all actions' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2.5 text-gray-500">
                {t.icon}
                <span className="text-[13px]">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#0F0E0C' }} className="border-t border-gray-800">
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-500 tracking-tight">Tranche</span>
          <span className="text-xs text-gray-600">&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
