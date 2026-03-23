import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrgPlan } from '../hooks/useOrgPlan';
import { supabase } from '../lib/supabase';

const PLANS = [
  {
    key: 'analyst',
    name: 'Analyst',
    price: 200,
    annualPrice: 167,
    description: 'Replace your spreadsheets',
    features: ['1 user', 'All asset classes', 'Pass/flag/fail screening', 'Deal pipeline', 'Dashboard metrics', 'Document attachments', 'CSV & PDF export', 'Up to 50 active deals'],
    stripePlanMonthly: 'analyst_monthly',
    stripePlanAnnual: 'analyst_annual',
  },
  {
    key: 'team',
    name: 'Team',
    price: 500,
    annualPrice: 417,
    description: 'Built for credit teams',
    features: ['Up to 10 users', 'Everything in Analyst', 'Unlimited deals', 'Firm-branded memo export', 'Shared pipeline & analytics', 'Audit trail', 'Custom scoring weights', 'Priority support'],
    highlight: true,
    stripePlanMonthly: 'pro_monthly',
    stripePlanAnnual: 'pro_annual',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 1500,
    annualPrice: 1250,
    description: 'For institutional lenders',
    features: ['Up to 50 users', 'Everything in Team', 'API access', 'Custom scoring models', 'SSO integration', 'Dedicated support', 'Custom onboarding', 'SLA guarantee'],
    stripePlanMonthly: 'enterprise_monthly',
    stripePlanAnnual: 'enterprise_annual',
  },
];

export default function BillingPage() {
  const { user, profile } = useAuth();
  const { plan, isExpired, daysRemaining } = useOrgPlan();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const orgName = profile?.organizations?.name || 'Your Organization';
  const currentPlan = plan || 'free';

  const handleUpgrade = async (planConfig) => {
    if (!supabase || !user) return;

    setLoading(planConfig.key);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Please sign in again to upgrade.');
        setLoading(null);
        return;
      }

      const stripePlan = billingCycle === 'annual' ? planConfig.stripePlanAnnual : planConfig.stripePlanMonthly;

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: stripePlan }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.message || data.error);
      }
    } catch (err) {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      {/* Current Plan Status */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{orgName}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                currentPlan === 'free' ? 'bg-slate-500/15 text-gray-500 border border-slate-500/30' :
                currentPlan === 'pilot' ? 'bg-gray-200 text-gray-600 border border-gray-300' :
                'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}>
                {currentPlan === 'free' ? 'Free' : currentPlan}
              </span>
              {daysRemaining !== null && daysRemaining > 0 && (
                <span className="text-[11px] text-gray-400">{daysRemaining} days remaining</span>
              )}
              {isExpired && (
                <span className="text-[11px] text-rose-400 font-medium">Expired. Upgrade to continue.</span>
              )}
            </div>
          </div>
          {currentPlan !== 'free' && (
            <button
              onClick={async () => {
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  if (!token) return;
                  const res = await fetch('/api/customer-portal', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                  });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                  else setError(data.message || data.error || 'Unable to open billing portal');
                } catch { setError('Unable to open billing portal'); }
              }}
              className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 font-medium hover:bg-gray-100 transition-all"
            >
              Manage Subscription
            </button>
          )}
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            billingCycle === 'monthly' ? 'bg-gray-200 text-gray-600 border border-gray-300' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('annual')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            billingCycle === 'annual' ? 'bg-gray-200 text-gray-600 border border-gray-300' : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          Annual
          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">
            SAVE 17%
          </span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 text-rose-300 text-sm text-center">
          {error}
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((p) => {
          const price = billingCycle === 'annual' ? p.annualPrice : p.price;
          const isCurrentPlan = currentPlan === p.key;
          return (
            <div
              key={p.key}
              className={`rounded-2xl p-6 ${
                p.highlight
                  ? 'bg-gradient-to-b from-gray-100 to-transparent border-2 border-gray-300 relative'
                  : 'glass-card'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gray-700 text-[10px] font-bold text-gray-900 uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-gray-900 mb-0.5">{p.name}</h3>
              <p className="text-[11px] text-gray-400 mb-4">{p.description}</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-extrabold text-gray-900">${price}</span>
                <span className="text-sm text-gray-400">/{billingCycle === 'annual' ? 'mo' : 'month'}</span>
              </div>
              {billingCycle === 'annual' && (
                <p className="text-[10px] text-gray-400 -mt-3 mb-4">
                  ${price * 10}/year (2 months free)
                </p>
              )}
              <button
                onClick={() => !isCurrentPlan && handleUpgrade(p)}
                disabled={isCurrentPlan || loading === p.key}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mb-5 ${
                  isCurrentPlan
                    ? 'bg-gray-50 border border-gray-200 text-gray-400 cursor-default'
                    : p.highlight
                    ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-gray-900 shadow-lg shadow-gray-300/20 hover:shadow-gray-300/30 disabled:opacity-50'
                    : 'bg-gray-50 border border-gray-200 text-gray-900 hover:bg-gray-100 disabled:opacity-50'
                }`}
              >
                {loading === p.key ? 'Redirecting...' : isCurrentPlan ? 'Current Plan' : 'Upgrade'}
              </button>
              <ul className="space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-gray-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-600 flex-shrink-0 mt-0.5" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[11px] text-gray-400">
        All plans include a 14-day free trial. Cancel anytime.
      </p>
    </div>
  );
}
