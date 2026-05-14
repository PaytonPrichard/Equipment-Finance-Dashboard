import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import TrancheLogo from './TrancheLogo';

const GOLD = '#D4A843';

function getCodeFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  return code ? code.trim() : null;
}

const INVITE_ERROR_MESSAGES = {
  invalid_code: 'This invite code is not recognized.',
  already_redeemed: 'This invite code has already been used.',
  expired: 'This invite code has expired. Please request a new one.',
  email_mismatch: 'This invite code is for a different email address.',
  error: 'Could not check this invite code right now. Please try again.',
};

export default function LoginPage({ passwordRecovery, onBackToLanding, initialMode, onRequestAccess }) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState(passwordRecovery ? 'update_password' : (initialMode || 'signin'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgNameInput, setOrgNameInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Invite-code signup state. Code comes from the URL once on mount and
  // never changes, so no setter is needed.
  const [inviteCode] = useState(() => getCodeFromUrl());
  const [inviteMeta, setInviteMeta] = useState(null); // { valid, org_name, plan, email_bound, reason }
  const [inviteLoading, setInviteLoading] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSignUpSuccess(false);
    setResetSent(false);
  };

  // If we're in signup mode without an invite code, bounce to Request Access.
  useEffect(() => {
    if (mode === 'signup' && !inviteCode) {
      if (onRequestAccess) onRequestAccess();
      else setMode('signin');
    }
  }, [mode, inviteCode, onRequestAccess]);

  // Validate the invite code when we have one in signup mode.
  useEffect(() => {
    if (mode !== 'signup' || !inviteCode) return;
    let cancelled = false;
    setInviteLoading(true);
    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc('validate_signup_invite', {
          p_code: inviteCode,
          p_email: null,
        });
        if (cancelled) return;
        if (rpcErr) {
          setInviteMeta({ valid: false, reason: 'error' });
        } else {
          setInviteMeta(data);
          if (data?.valid && data?.org_name && !orgNameInput) {
            setOrgNameInput(data.org_name);
          }
        }
      } catch {
        if (!cancelled) setInviteMeta({ valid: false, reason: 'error' });
      } finally {
        if (!cancelled) setInviteLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, mode]);

  const passwordChecks = [
    { key: 'length', label: 'At least 10 characters', test: (p) => p.length >= 10 },
    { key: 'upper', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
    { key: 'lower', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
    { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
    { key: 'special', label: 'One special character (!@#$%^&*)', test: (p) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ];

  const passwordValid = passwordChecks.every((c) => c.test(password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSignUpSuccess(false);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: authError } = await signIn(email, password);
        if (authError) setError(authError.message);
      } else if (mode === 'signup') {
        if (!fullName.trim()) {
          setError('Full name is required.');
          return;
        }
        if (!passwordValid) {
          setError('Password does not meet all requirements.');
          return;
        }
        if (!orgNameInput.trim()) {
          setError('Organization name is required.');
          return;
        }
        if (!inviteCode || !inviteMeta?.valid) {
          setError('Invalid invite code.');
          return;
        }

        // Server-side: create user, create org, redeem code, all atomic.
        const res = await fetch('/api/signup-with-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            fullName: fullName.trim(),
            code: inviteCode,
            orgName: orgNameInput.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // TEMP DEBUG: append server debug detail to the error. Strip before final commit.
          const debugStr = data.debug ? ` [debug: ${JSON.stringify(data.debug)}]` : '';
          setError((data.error || 'Could not create account. Please try again.') + debugStr);
          return;
        }

        // Bust the cached profile so the fresh org_id is read after sign-in.
        try { localStorage.removeItem('efd_profile_cache'); } catch { /* ignore */ }

        // Sign the user in. App.js will route to the authenticated app.
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError('Account created but sign-in failed. Try signing in manually.');
          return;
        }
        // Clean ?code= from URL so a refresh doesn't re-enter signup mode.
        if (typeof window !== 'undefined') {
          try {
            window.history.replaceState({}, '', window.location.pathname);
          } catch { /* ignore */ }
        }
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Please enter your email address.');
          return;
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (resetError) {
          setError(resetError.message);
        } else {
          setResetSent(true);
        }
      } else if (mode === 'update_password') {
        if (!passwordValid) {
          setError('Password does not meet all requirements.');
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(updateError.message);
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    signin: 'Sign in to your account',
    signup: inviteMeta?.org_name ? `Set up ${inviteMeta.org_name}` : 'Create your account',
    forgot: 'Reset your password',
    update_password: 'Set your new password',
  };

  const subtitles = {
    signin: 'Enter your credentials to continue',
    signup: 'You\'re using an invite code. Fill in the details to activate your account.',
    forgot: 'We\'ll send a reset link to your email',
    update_password: 'Choose a strong password for your account',
  };

  const submitLabels = {
    signin: { idle: 'Sign In', loading: 'Signing in...' },
    signup: { idle: 'Create Account', loading: 'Creating account...' },
    forgot: { idle: 'Send Reset Link', loading: 'Sending...' },
    update_password: { idle: 'Update Password', loading: 'Updating...' },
  };

  // Special-case render: signup mode with invalid invite code.
  const inviteBlocked = mode === 'signup' && inviteMeta && !inviteMeta.valid;

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {mode === 'signup' && !inviteBlocked && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
              <div className="w-8 h-0.5 bg-gray-200" />
              <div className="w-2 h-2 rounded-full bg-gray-200" />
              <span className="text-[10px] text-gray-400 ml-2">Activate your account</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2.5 mb-1">
            <TrancheLogo size={36} />
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tranche</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">ABL deal screening for credit teams</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-gray-200/40">
          {inviteBlocked ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50 border border-red-200">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-red-500" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Invite code unavailable</h2>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">
                {INVITE_ERROR_MESSAGES[inviteMeta.reason] || INVITE_ERROR_MESSAGES.invalid_code}
              </p>
              {onRequestAccess && (
                <button
                  onClick={onRequestAccess}
                  className="px-5 py-2.5 rounded-xl text-gray-900 text-sm font-semibold shadow-lg hover:opacity-90 transition-all"
                  style={{ backgroundColor: GOLD, boxShadow: '0 4px 16px rgba(212,168,67,0.3)' }}
                >
                  Request a Trial
                </button>
              )}
            </div>
          ) : inviteLoading && mode === 'signup' ? (
            <div className="text-center py-10">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-400">Checking your invite code...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{titles[mode]}</h2>
              <p className="text-sm text-gray-400 mb-6">{subtitles[mode]}</p>

              {signUpSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  Account created. Check your email to confirm your account, then sign in.
                </div>
              )}

              {resetSent && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                  Reset link sent. Check your inbox and spam folder. The link expires in 1 hour.
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Invite code banner */}
              {mode === 'signup' && inviteCode && inviteMeta?.valid && (
                <div className="mb-5 p-3 rounded-xl border" style={{ backgroundColor: 'rgba(212,168,67,0.08)', borderColor: 'rgba(212,168,67,0.25)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: GOLD }}>Invite Code</p>
                      <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5">{inviteCode}</p>
                    </div>
                    {inviteMeta.email_bound && (
                      <span className="text-[10px] text-gray-500 text-right max-w-[140px] leading-tight">
                        This code is for a specific email address.
                      </span>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      autoComplete="name"
                      className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                    />
                  </div>
                )}

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="orgName" className="block text-xs font-medium text-gray-500 mb-1.5">Organization Name</label>
                    <input
                      id="orgName"
                      type="text"
                      value={orgNameInput}
                      onChange={(e) => setOrgNameInput(e.target.value)}
                      placeholder="Acme Capital Partners"
                      required
                      maxLength={200}
                      autoComplete="organization"
                      className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5">Edit if needed. You can change this later in settings.</p>
                  </div>
                )}

                {mode !== 'update_password' && (
                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      autoComplete="email"
                      className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                    />
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div>
                    <label htmlFor="password" className="block text-xs font-medium text-gray-500 mb-1.5">
                      {mode === 'update_password' ? 'New Password' : 'Password'}
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signin' ? 'Enter your password' : 'Min 10 chars, upper, lower, number, special'}
                      required
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                    />
                    {(mode === 'signup' || mode === 'update_password') && password.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {passwordChecks.map((check) => {
                          const passes = check.test(password);
                          return (
                            <div key={check.key} className="flex items-center gap-2">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                className={passes ? 'text-emerald-400' : 'text-gray-400'} strokeWidth="2.5">
                                {passes
                                  ? <polyline points="20 6 9 17 4 12" />
                                  : <circle cx="12" cy="12" r="10" />}
                              </svg>
                              <span className={`text-[11px] ${passes ? 'text-emerald-400' : 'text-gray-400'}`}>
                                {check.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {mode === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl text-gray-900 text-sm font-semibold shadow-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: GOLD, boxShadow: '0 4px 16px rgba(212,168,67,0.3)' }}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>{submitLabels[mode].loading}</span>
                    </>
                  ) : (
                    <span>{submitLabels[mode].idle}</span>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center space-y-2">
                {mode === 'signin' && (
                  <div>
                    <span className="text-sm text-gray-400">Don't have an account? </span>
                    <button
                      onClick={() => onRequestAccess && onRequestAccess()}
                      className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
                    >
                      Request access
                    </button>
                  </div>
                )}
                {mode === 'signup' && (
                  <div>
                    <span className="text-sm text-gray-400">Already have an account? </span>
                    <button onClick={() => switchMode('signin')} className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      Sign In
                    </button>
                  </div>
                )}
                {(mode === 'forgot' || mode === 'update_password') && (
                  <button onClick={() => switchMode('signin')} className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                    Back to Sign In
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          {onBackToLanding && (
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
