import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function OrgSetup({ profile, onComplete }) {
  const [mode, setMode] = useState(null); // null, 'create', 'join'
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedName = orgName.trim();
    if (!trimmedName) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);

    try {
      const slug = generateSlug(trimmedName);
      const { data, error: rpcError } = await supabase.rpc('create_org', {
        p_name: trimmedName,
        p_slug: slug,
      });

      if (rpcError) {
        setError(rpcError.message);
        setLoading(false);
        return;
      }

      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      // Clear cached profile so the new org_id gets picked up
      try { localStorage.removeItem('efd_profile_cache'); } catch (e) { /* ignore */ }

      // Signal completion so the app re-fetches the profile
      if (onComplete) {
        onComplete();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141210] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and App Title */}
        <div className="text-center mb-8">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-gold-500" />
            <div className="w-8 h-0.5 bg-gold-500" />
            <div className="w-2 h-2 rounded-full bg-gold-500" />
            <div className="w-8 h-0.5 bg-gold-500" />
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span className="text-[10px] text-slate-600 ml-2">Step 3 of 3</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
            Tranche
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Let's set up your organization to start screening deals
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {!mode && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Almost there
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Create a new organization or join an existing one to start screening.
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => setMode('create')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 transition-all"
                >
                  Create Organization
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm font-semibold hover:bg-white/[0.08] transition-all"
                >
                  Join Organization
                </button>
              </div>
            </>
          )}

          {mode === 'create' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Create Organization
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                You will be the admin of this organization.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <label htmlFor="orgName" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Organization Name
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Capital Partners"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all"
                  />
                  <p className="text-[10px] text-slate-600 mt-1.5">Your company name or fund name</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Organization</span>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setMode(null); setError(''); }}
                  className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {mode === 'join' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Join Organization
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Enter the invite code provided by your organization admin.
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {error}
                </div>
              )}

              {joinSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
                  You've joined the organization! Redirecting...
                </div>
              )}

              <form onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                const code = inviteCode.trim();
                if (!code) {
                  setError('Please enter an invite code.');
                  return;
                }
                setLoading(true);
                try {
                  const { data, error: rpcError } = await supabase.rpc('redeem_invite', { p_invite_code: code });
                  if (rpcError) {
                    setError(rpcError.message);
                  } else if (data?.error) {
                    setError(data.error);
                  } else {
                    setJoinSuccess(true);
                    setTimeout(() => { if (onComplete) onComplete(); }, 1500);
                  }
                } catch (err) {
                  setError('An unexpected error occurred. Please try again.');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label htmlFor="inviteCode" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Invite Code
                  </label>
                  <input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="e.g. A1B2C3D4"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all font-mono tracking-wider"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30 hover:from-gold-400 hover:to-gold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Joining...</span>
                    </>
                  ) : (
                    <span>Join Organization</span>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-xs text-slate-600 text-center">
                  Don't have a code? Ask your organization admin to send you an invite.
                </p>
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={() => { setMode(null); setError(''); setJoinSuccess(false); }}
                  className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors"
                >
                  Back
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-600 mt-6">
          Tranche &middot; Organization Setup
        </p>
      </div>
    </div>
  );
}
