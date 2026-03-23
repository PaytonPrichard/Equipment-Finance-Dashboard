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
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and App Title */}
        <div className="text-center mb-8">
          {/* Progress — only show for signup flow */}
          {mode === 'signup' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-gray-700 animate-pulse" />
              <div className="w-8 h-0.5 bg-gray-200" />
              <div className="w-2 h-2 rounded-full bg-gray-200" />
              <div className="w-8 h-0.5 bg-gray-200" />
              <div className="w-2 h-2 rounded-full bg-gray-200" />
              <span className="text-[10px] text-gray-400 ml-2">Step 1 of 3</span>
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1">
            Tranche
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            ABL deal screening for credit teams
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl backdrop-blur-xl p-8 shadow-2xl shadow-gray-200/40">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{titles[mode]}</h2>
          <p className="text-sm text-gray-400 mb-6">{subtitles[mode]}</p>

          {/* Success messages */}
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

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name (sign up only) */}
            {mode === 'signup' && (
              <div>
                <label htmlFor="fullName" className="block text-xs font-medium text-gray-500 mb-1.5">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                  className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                />
              </div>
            )}

            {/* Email (not shown in update_password mode) */}
            {mode !== 'update_password' && (
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-gray-500 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="w-full px-3.5 py-3 rounded-xl bg-white border border-gray-200 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/40 focus:border-gray-400 transition-all"
                />
              </div>
            )}

            {/* Password (not shown in forgot mode) */}
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

            {/* Forgot password link (signin mode only) */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-300/20 hover:shadow-gray-300/30 hover:from-gray-700 hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                <span className="text-sm text-gray-400">Don't have an account? </span>
                <button onClick={() => switchMode('signup')} className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors">
                  Sign Up
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
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors mb-2 block mx-auto"
            >
              &larr; Back to home
            </button>
          )}
          <p className="text-[11px] text-gray-400">
            Tranche &middot; ABL Deal Screening
          </p>
        </div>
      </div>
    </div>
  );
}
