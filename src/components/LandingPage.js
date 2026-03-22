import React from 'react';

const CORE_FEATURES = [
  {
    title: 'Instant Risk Scoring',
    description: 'Proprietary scoring model. Pass/flag/fail verdict in under 2 minutes.',
    highlight: true,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    title: 'Multi-Asset Screening',
    description: 'Equipment, AR, inventory. One platform. Consistent underwriting across all three.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    title: 'Configurable Credit Policy',
    description: 'Set your own thresholds for DSCR, leverage, and concentration to match your standards.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const MORE_FEATURES = [
  {
    title: 'Deal Pipeline',
    description: 'Track deals from screening through funded. Stage workflows, notes, and document attachments.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    title: 'Branded Memos',
    description: 'Export credit committee-ready screening memos with your firm logo and branding.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    title: 'Team Collaboration',
    description: 'Role-based access, shared pipeline, audit trail, and org-level analytics.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
    name: 'Analyst',
    price: '$200',
    period: '/mo',
    who: 'For solo analysts replacing spreadsheets',
    features: ['1 user', 'All asset classes', 'Pass/flag/fail screening', 'Deal pipeline', 'CSV & PDF export', 'Up to 50 active deals'],
    cta: 'Start 14-Day Free Trial',
    highlight: false,
  },
  {
    name: 'Team',
    price: '$500',
    period: '/mo',
    who: 'For credit teams of 2-10 collaborating on deals',
    features: ['Up to 10 users', 'Everything in Analyst', 'Unlimited deals', 'Firm-branded memos', 'Shared pipeline & audit trail', 'Custom scoring weights'],
    cta: 'Start 14-Day Free Trial',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$1,500',
    period: '/mo',
    who: 'For institutional lenders with custom workflows',
    features: ['Up to 50 users', 'Everything in Team', 'API access', 'Custom scoring models', 'SSO integration', 'Dedicated support & SLA'],
    cta: 'Schedule a Demo',
    highlight: false,
  },
];

export default function LandingPage({ onGetStarted, onSignIn }) {
  return (
    <div className="min-h-screen bg-[#141210]">
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 bg-[#141210]/95 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-extrabold text-white tracking-tight">Tranche</span>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-slate-400 hover:text-white transition-colors">Features</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-slate-400 hover:text-white transition-colors">How It Works</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</button>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onSignIn} className="text-sm text-gold-400 hover:text-gold-300 transition-colors font-medium">Sign In</button>
            <button onClick={onGetStarted} className="px-4 py-2 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 transition-all">Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-14 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-500/10 border border-gold-500/20 text-[11px] text-gold-400 font-semibold mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
          Pre-origination deal screening for ABL lenders
        </div>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
          Screen equipment, AR, and inventory<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-400 to-gold-600">deals in 2 minutes, not 2 hours.</span>
        </h1>
        <p className="text-base text-slate-400 max-w-2xl mx-auto mb-6 leading-relaxed">
          Automated risk scoring, configurable credit policy, and branded screening memos.
          Replace the spreadsheet your team uses to screen ABL deals.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button onClick={onGetStarted} className="px-6 py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 transition-all">
            Start 14-Day Free Trial
          </button>
          <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="px-6 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 font-semibold hover:bg-white/[0.08] transition-all">
            See How It Works
          </button>
        </div>
        <p className="text-[11px] text-slate-600 mt-3">No credit card required. Full Team features for 14 days.</p>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            {[
              { value: '2 min', label: 'Average screening time' },
              { value: '3', label: 'Asset classes supported' },
              { value: '7', label: 'Risk factors scored' },
              { value: '100%', label: 'Self-serve, no consultants' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-xl font-bold font-mono text-gold-400">{stat.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Purpose-built for ABL teams</h2>
          <p className="text-slate-400 max-w-lg mx-auto">Automate screening, reduce risk, and fund more deals with confidence.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {CORE_FEATURES.map((feature) => (
            <div key={feature.title} className={`rounded-2xl p-5 transition-all ${
              feature.highlight
                ? 'bg-gradient-to-br from-gold-500/[0.08] to-transparent border-2 border-gold-500/20 hover:border-gold-500/40'
                : 'bg-white/[0.02] border border-white/[0.06] hover:border-gold-500/20 hover:bg-white/[0.03]'
            }`}>
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-[12px] text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {MORE_FEATURES.map((feature) => (
            <div key={feature.title} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 hover:border-gold-500/20 hover:bg-white/[0.03] transition-all">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 mb-4">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-[12px] text-slate-400 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="border-y border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-3">Get your first screening in 3 steps</h2>
            <p className="text-slate-400">No learning curve. No consultants. Start today.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '1', title: 'Enter deal data', description: 'Select asset class. Input borrower financials and collateral details.' },
              { step: '2', title: 'Review results instantly', description: 'Risk score, pass/flag/fail verdict, metrics, stress test, and structure.' },
              { step: '3', title: 'Export and track', description: 'Download a branded PDF memo. Save to pipeline. Track through funding.' },
            ].map((s, idx) => (
              <div key={s.step} className="relative text-center">
                {idx < 2 && (
                  <div className="hidden md:block absolute top-6 -right-4 w-8">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-500/40" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                )}
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold-500/20">
                  <span className="text-lg font-bold text-white">{s.step}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{s.title}</h3>
                <p className="text-[12px] text-slate-400 leading-relaxed max-w-xs mx-auto">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-400">Per-organization, not per-seat. No setup fees. Cancel anytime.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? 'bg-gradient-to-b from-gold-500/[0.08] to-transparent border-2 border-gold-500/30 relative'
                  : 'bg-white/[0.02] border border-white/[0.06]'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gold-500 text-[10px] font-bold text-white uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-white mb-0.5">{plan.name}</h3>
              <p className="text-[11px] text-gold-400 font-medium mb-3">{plan.who}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.period}</span>
              </div>
              <button
                onClick={onGetStarted}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mb-6 ${
                  plan.highlight
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30'
                    : 'bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08]'
                }`}
              >
                {plan.cta}
              </button>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[12px] text-slate-300">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400 flex-shrink-0 mt-0.5" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-8 mt-8 text-[11px] text-slate-500">
          <span>14-day free trial</span>
          <span>&middot;</span>
          <span>No credit card required</span>
          <span>&middot;</span>
          <span>Cancel anytime</span>
          <span>&middot;</span>
          <span>Annual: save 20%</span>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Ready to screen your first deal?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Set up in 5 minutes. Screen your first deal in 2. No credit card, no contracts.
          </p>
          <button onClick={onGetStarted} className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 transition-all text-lg">
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
          <span className="text-[12px] font-bold text-slate-600 tracking-tight">Tranche</span>
          <span className="text-[10px] text-slate-700">&copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
