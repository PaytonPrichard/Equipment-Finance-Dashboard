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
      // Insert new organization
      const slug = generateSlug(trimmedName);
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: trimmedName, slug })
        .select()
        .single();

      if (orgError) {
        setError(orgError.message);
        setLoading(false);
        return;
      }

      // Update user profile with the new org_id and admin role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ org_id: orgData.id, role: 'admin' })
        .eq('id', profile.id);

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

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
    <div className="min-h-screen bg-[#111116] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and App Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 shadow-lg shadow-gold-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Equipment Finance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Set up your organization to get started
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          {!mode && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1">
                Welcome!
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                You need an organization to continue. Create a new one or join an existing organization.
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
          Equipment Finance Dashboard &middot; Organization Setup
        </p>
      </div>
    </div>
  );
}
