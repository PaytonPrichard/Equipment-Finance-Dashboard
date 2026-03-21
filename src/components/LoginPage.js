import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage({ passwordRecovery, onBackToLanding }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState(passwordRecovery ? 'update_password' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSignUpSuccess(false);
    setResetSent(false);
  };

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
          setLoading(false);
          return;
        }
        if (!passwordValid) {
          setError('Password does not meet all requirements.');
          setLoading(false);
          return;
        }
        const { error: authError } = await signUp(email, password, fullName.trim());
        if (authError) {
          setError(authError.message);
        } else {
          setSignUpSuccess(true);
        }
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Please enter your email address.');
          setLoading(false);
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
          setLoading(false);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          setError(updateError.message);
        } else {
          // Password updated — sign in automatically happens via session
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
    signup: 'Create your account',
    forgot: 'Reset your password',
    update_password: 'Set your new password',
  };

  const subtitles = {
    signin: 'Enter your credentials to continue',
    signup: 'Fill in the details below to get started',
    forgot: 'We\'ll send a reset link to your email',
    update_password: 'Choose a strong password for your account',
  };

  const submitLabels = {
    signin: { idle: 'Sign In', loading: 'Signing in...' },
    signup: { idle: 'Create Account', loading: 'Creating account...' },
    forgot: { idle: 'Send Reset Link', loading: 'Sending...' },
    update_password: { idle: 'Update Password', loading: 'Updating...' },
  };

  return (
    <div className="min-h-screen bg-[#141210] flex items-center justify-center px-4">
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
            Deal Screening & Portfolio Management
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-black/20">
          <h2 className="text-lg font-semibold text-white mb-1">{titles[mode]}</h2>
          <p className="text-sm text-slate-500 mb-6">{subtitles[mode]}</p>

          {/* Success messages */}
          {signUpSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              Account created successfully. Please check your email to confirm your account, then sign in.
            </div>
          )}

          {resetSent && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
              Reset link sent! Check your inbox (and spam folder) for an email from us. The link expires in 1 hour.
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (sign up only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all"
                />
              </div>
            )}

            {/* Email (not shown in update_password mode) */}
            {mode !== 'update_password' && (
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all"
                />
              </div>
            )}

            {/* Password (not shown in forgot mode) */}
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
                  {mode === 'update_password' ? 'New Password' : 'Password'}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signin' ? 'Enter your password' : 'Min 10 chars, upper, lower, number, special'}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-gold-500/40 focus:border-gold-500/40 transition-all"
                />
                {(mode === 'signup' || mode === 'update_password') && password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {passwordChecks.map((check) => {
                      const passes = check.test(password);
                      return (
                        <div key={check.key} className="flex items-center gap-2">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            className={passes ? 'text-emerald-400' : 'text-slate-600'} strokeWidth="2.5">
                            {passes
                              ? <polyline points="20 6 9 17 4 12" />
                              : <circle cx="12" cy="12" r="10" />}
                          </svg>
                          <span className={`text-[11px] ${passes ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {check.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Forgot password link (signin mode only) */}
            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-[12px] text-gold-400/70 hover:text-gold-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
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
                  <span>{submitLabels[mode].loading}</span>
                </>
              ) : (
                <span>{submitLabels[mode].idle}</span>
              )}
            </button>
          </form>

          {/* Mode toggle links */}
          <div className="mt-6 text-center space-y-2">
            {mode === 'signin' && (
              <div>
                <span className="text-sm text-slate-500">Don't have an account? </span>
                <button onClick={() => switchMode('signup')} className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors">
                  Sign Up
                </button>
              </div>
            )}
            {mode === 'signup' && (
              <div>
                <span className="text-sm text-slate-500">Already have an account? </span>
                <button onClick={() => switchMode('signin')} className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors">
                  Sign In
                </button>
              </div>
            )}
            {(mode === 'forgot' || mode === 'update_password') && (
              <button onClick={() => switchMode('signin')} className="text-sm text-gold-400 hover:text-gold-300 font-medium transition-colors">
                Back to Sign In
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="text-[11px] text-gold-400 hover:text-gold-300 font-medium transition-colors mb-2 block mx-auto"
            >
              &larr; Back to home
            </button>
          )}
          <p className="text-[11px] text-slate-600">
            ABL Screening Platform &middot; Secure Authentication
          </p>
        </div>
      </div>
    </div>
  );
}
