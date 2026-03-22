import React from 'react';

const FEATURES = [
  {
    title: 'Instant Risk Scoring',
    description: 'Pass/flag/fail verdict with composite score in under 2 minutes.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    title: 'Multi-Asset Screening',
    description: 'Equipment, AR, and inventory from one platform.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    title: 'Configurable Credit Policy',
    description: 'Set your own DSCR, leverage, and concentration thresholds.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    title: 'Deal Pipeline',
    description: 'Track deals from screening through funded with document attachments.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Branded Memos',
    description: 'Export credit committee-ready PDFs with your firm branding.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    title: 'Team Collaboration',
    description: 'Role-based access, shared pipeline, and audit trail.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
    features: ['Up to 10 users', 'Everything in Starter', 'Unlimited deals', 'Firm-branded memos', 'Shared pipeline & audit trail', 'Custom scoring weights'],
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
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/60">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">Tranche</span>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Features</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Pricing</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onSignIn} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:text-gray-900 border border-gray-300 hover:border-gray-400 transition-all">Sign In</button>
            <button onClick={onGetStarted} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition-all">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-sm text-gray-500 font-medium mb-3">Pre-origination deal screening for ABL lenders</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-4 tracking-tight">
          Screen equipment, AR, and inventory<br />
          deals in 2 minutes, not 2 hours.
        </h1>
        <p className="text-base text-gray-500 max-w-xl mx-auto mb-6">
          Automated risk scoring, configurable credit policy, and branded screening memos. Replace the spreadsheet your team uses to screen ABL deals.
        </p>
        <div className="flex items-center justify-center gap-3 mb-3">
          <button onClick={onGetStarted} className="px-6 py-3 rounded-lg text-white bg-gray-900 hover:bg-gray-800 font-semibold transition-all">
            Start 14-Day Free Trial
          </button>
          <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-3 rounded-lg text-gray-700 border border-gray-300 font-semibold hover:border-gray-400 transition-all">
            See How It Works
          </button>
        </div>
        <p className="text-xs text-gray-400">No credit card required. Full access for 14 days.</p>
        <p className="text-[12px] text-gray-400 mt-4">Built for credit teams at mid-market lenders. Currently in pilot with select firms.</p>
      </section>

      {/* Product Screenshot */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        {/* Replace the src below with a real screenshot of a scored deal */}
        {/* To add: take a screenshot showing verdict banner + score gauge + metric cards */}
        <div className="rounded-2xl bg-[#141210] border border-gray-200 shadow-2xl shadow-gray-300/30 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-white/[0.06]">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
            <span className="text-[10px] text-slate-600 ml-2 font-mono">tranche</span>
          </div>
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-lg font-bold font-mono text-emerald-400">82</p>
                <p className="text-[9px] text-slate-500">Risk Score</p>
              </div>
              <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-sm font-bold text-emerald-400">PASS</p>
                <p className="text-[9px] text-slate-500">Verdict</p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                <p className="text-sm font-bold font-mono text-slate-300">1.72x</p>
                <p className="text-[9px] text-slate-500">DSCR</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {['Leverage 2.8x', 'LTV 78%', 'Term 60%', 'Score 82/100'].map(m => (
                <div key={m} className="bg-white/[0.03] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-slate-400 font-mono">{m}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Credit Analysts', desc: 'Screen 10x more deals with consistent criteria.' },
            { title: 'Deal Teams', desc: 'Track pipeline from screening through funded.' },
            { title: 'Credit Committees', desc: 'Receive standardized memos with full audit trail.' },
          ].map(p => (
            <div key={p.title} className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{p.title}</h3>
              <p className="text-[13px] text-gray-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Purpose-built for ABL teams</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">No consultants. No 6-month implementation. Start screening today.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-all">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-white border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Screen a deal in 3 steps</h2>
          <p className="text-gray-500 text-center mb-8 text-sm">No learning curve. Start today.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {[
              { step: '1', title: 'Enter deal data', desc: 'Select asset class. Input borrower and collateral details.' },
              { step: '2', title: 'Get instant results', desc: 'Risk score, verdict, stress test, and structure recommendations.' },
              { step: '3', title: 'Export and track', desc: 'Download branded PDF. Add to pipeline. Track through funding.' },
            ].map((s, idx) => (
              <div key={s.step} className="relative text-center">
                {idx < 2 && (
                  <div className="hidden md:block absolute top-5 -right-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-300" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
                <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mx-auto mb-3">
                  <span className="text-sm font-bold text-white">{s.step}</span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-[13px] text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Simple pricing</h2>
        <p className="text-gray-500 text-center mb-8 text-sm">Per-organization, not per-seat. Cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl p-5 flex flex-col ${
                plan.highlight
                  ? 'bg-gray-900 text-white relative'
                  : 'bg-white border border-gray-200'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gray-700 text-[10px] font-bold text-white uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <h3 className={`text-base font-bold mb-0.5 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.name}</h3>
              <p className={`text-[12px] mb-3 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.who}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className={`text-2xl font-extrabold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>{plan.price}</span>
                <span className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>{plan.period}</span>
              </div>
              <button
                onClick={onGetStarted}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all mb-4 ${
                  plan.highlight
                    ? 'bg-white text-gray-900 hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {plan.cta}
              </button>
              <ul className="space-y-2 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-[12px] ${plan.highlight ? 'text-gray-300' : 'text-gray-600'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-gray-400' : 'text-gray-400'}`} strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-6 mt-6 text-[12px] text-gray-400">
          <span>14-day free trial</span>
          <span>&middot;</span>
          <span>No credit card required</span>
          <span>&middot;</span>
          <span>Annual: save 20%</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900">
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Ready to screen your first deal?</h2>
          <p className="text-gray-400 mb-6 text-sm">Set up in 5 minutes. Screen your first deal in 2. No credit card, no contracts.</p>
          <button onClick={onGetStarted} className="px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-all">
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            {[
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'SOC 2 in progress' },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, label: 'Encrypted at rest' },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>, label: 'Role-based access' },
              { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, label: 'Audit trail on all actions' },
            ].map(t => (
              <div key={t.label} className="flex items-center gap-2 text-gray-500">
                {t.icon}
                <span className="text-[11px]">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-[12px] font-bold text-gray-500 tracking-tight">Tranche</span>
          <span className="text-[10px] text-gray-600">&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
