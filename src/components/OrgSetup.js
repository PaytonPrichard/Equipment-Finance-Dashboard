import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import TrancheLogo from './TrancheLogo';

// Self-serve org creation is closed. Users land here only if they have an
// auth account but no org (legacy users, or users invited via team invite
// who haven't redeemed yet). The only path forward is a team invite code.

export default function OrgSetup({ profile, onComplete }) {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and App Title */}
        <div className="text-center mb-8">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-8 h-0.5 bg-gray-700" />
            <div className="w-2 h-2 rounded-full bg-gray-700" />
            <div className="w-8 h-0.5 bg-gray-700" />
            <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
            <span className="text-[10px] text-gray-400 ml-2">Step 3 of 3</span>
          </div>
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <TrancheLogo size={36} />
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Tranche
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Let's set up your organization to start screening deals
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-2xl shadow-gray-200/40">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Join your organization
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Enter the invite code your organization admin sent you. New firms join Tranche by request only.
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {joinSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
              Joined the organization. Redirecting...
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
                try { localStorage.removeItem('efd_profile_cache'); } catch { /* ignore */ }
                setTimeout(() => { if (onComplete) onComplete(); }, 1500);
              }
            } catch (err) {
              setError('An unexpected error occurred. Please try again.');
            } finally {
              setLoading(false);
            }
          }} className="space-y-4">
            <div>
              <label htmlFor="inviteCode" className="block text-xs font-medium text-gray-500 mb-1.5">
                Invite Code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all font-mono tracking-wider"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-gray-900 text-sm font-semibold shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: '#D4A843', boxShadow: '0 4px 16px rgba(212,168,67,0.3)' }}
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
                <span>Join organization</span>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              No invite yet? Ask your organization admin, or request a trial at gettranche.app.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-400 mt-6">
          Tranche &middot; Organization setup
        </p>
      </div>
    </div>
  );
}
