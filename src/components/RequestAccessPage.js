import React, { useState } from 'react';
import TrancheLogo from './TrancheLogo';

const GOLD = '#D4A843';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RequestAccessPage({ onBackToLanding, onSignIn }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [firm, setFirm] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = name.trim() && firm.trim() && EMAIL_RE.test(email.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !firm.trim()) {
      setError('Name and firm are required.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid work email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          firm: firm.trim(),
          role: role.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError('Too many requests from your network. Please try again in an hour.');
        } else {
          setError(data.error || 'Could not submit. Please try again.');
        }
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <TrancheLogo size={36} />
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tranche</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">ABL deal screening for credit teams</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-gray-200/40">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(212,168,67,0.15)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Request received</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                Thanks for your interest. We review every request and will be in touch within one business day at the email you provided.
              </p>
              {onBackToLanding && (
                <button
                  onClick={onBackToLanding}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Back to home
                </button>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Request access to Tranche</h2>
              <p className="text-sm text-gray-400 mb-6">
                Tranche is currently available to vetted credit teams. Tell us a bit about you and we'll respond within one business day.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="ra-name" className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
                  <input
                    id="ra-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                    maxLength={200}
                    autoComplete="name"
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="ra-email" className="block text-xs font-medium text-gray-500 mb-1.5">Work Email</label>
                  <input
                    id="ra-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@yourfirm.com"
                    required
                    maxLength={320}
                    autoComplete="email"
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="ra-firm" className="block text-xs font-medium text-gray-500 mb-1.5">Firm</label>
                  <input
                    id="ra-firm"
                    type="text"
                    value={firm}
                    onChange={(e) => setFirm(e.target.value)}
                    placeholder="Acme Credit Partners"
                    required
                    maxLength={200}
                    autoComplete="organization"
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="ra-role" className="block text-xs font-medium text-gray-500 mb-1.5">
                    Role <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    id="ra-role"
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Credit Analyst, Director, etc."
                    maxLength={100}
                    autoComplete="organization-title"
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="ra-notes" className="block text-xs font-medium text-gray-500 mb-1.5">
                    Anything we should know? <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="ra-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Asset classes you focus on, team size, current screening process, etc."
                    rows={3}
                    maxLength={2000}
                    className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full py-2.5 rounded-xl text-gray-900 text-sm font-semibold shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD, boxShadow: '0 4px 16px rgba(212,168,67,0.3)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Request Access</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <span className="text-sm text-gray-400">Already have an account? </span>
                <button
                  onClick={onSignIn}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                >
                  Sign In
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          {onBackToLanding && !submitted && (
            <button
              onClick={onBackToLanding}
              className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors mb-2 block mx-auto"
            >
              &larr; Back to home
            </button>
          )}
          <p className="text-[11px] text-gray-400">Tranche &middot; ABL Deal Screening</p>
        </div>
      </div>
    </div>
  );
}
