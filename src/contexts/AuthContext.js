import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { resolvePermissions } from '../lib/permissions';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const OFFLINE_CONTEXT = {
  user: null,
  profile: null,
  session: null,
  permissions: null,
  loading: false,
  signIn: async () => ({ error: { message: 'Auth unavailable in offline mode' } }),
  signUp: async () => ({ error: { message: 'Auth unavailable in offline mode' } }),
  signOut: async () => {},
  refreshProfile: async () => {},
};

const CACHE_KEY = 'efd_profile_cache';

function getAuthStorageKey() {
  try {
    return `sb-${new URL(process.env.REACT_APP_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

function readCachedProfile(userId) {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.id === userId) return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCachedProfile(profile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const retryTimerRef = useRef(null);
  const fetchingRef = useRef(false);

  // Fetch profile from Supabase with retry
  const fetchProfile = useCallback(async (authUser) => {
    if (!supabase || !authUser || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      // Single query, no fallback chain
      const { data, error } = await supabase
        .from('profiles')
        .select('*, organizations(name, branding, org_settings)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        // Try simpler query
        const fallback = await supabase
          .from('profiles')
          .select('*, organizations(name, branding)')
          .eq('id', authUser.id)
          .maybeSingle();

        if (fallback.data) {
          setProfile(fallback.data);
          writeCachedProfile(fallback.data);
          const role = fallback.data.role || 'analyst';
          setPermissions(resolvePermissions(role, []));
          fetchingRef.current = false;
          return;
        }

        // Both failed — schedule retry
        console.warn('Profile fetch failed, retrying in 5s:', error.message);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          fetchingRef.current = false;
          fetchProfile(authUser);
        }, 5000);
        fetchingRef.current = false;
        return;
      }

      if (data) {
        setProfile(data);
        writeCachedProfile(data);

        // Fetch org permissions
        let orgOverrides = [];
        if (data.org_id) {
          const { data: overrides } = await supabase
            .from('org_permissions')
            .select('*')
            .eq('org_id', data.org_id);
          orgOverrides = overrides || [];
        }

        const role = data.role || 'analyst';
        setPermissions(resolvePermissions(role, orgOverrides));
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      // Schedule retry
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        fetchingRef.current = false;
        fetchProfile(authUser);
      }, 5000);
    }

    fetchingRef.current = false;
  }, []);

  // Initialize: read auth from localStorage, load cached profile, fetch fresh in background
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const init = () => {
      const storageKey = getAuthStorageKey();
      if (!storageKey) { setLoading(false); return; }

      // Step 1: Read auth token from localStorage (instant)
      let authUser = null;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          authUser = parsed?.user ?? null;
          if (mounted && authUser) {
            setSession(parsed);
            setUser(authUser);
            setEmailVerified(!!authUser.email_confirmed_at);
          }
        }
      } catch { /* ignore */ }

      // Step 2: Load cached profile (instant)
      if (authUser) {
        const cached = readCachedProfile(authUser.id);
        if (cached && mounted) {
          setProfile(cached);
          const role = cached.role || 'analyst';
          setPermissions(resolvePermissions(role, []));
        }
      }

      // Step 3: Stop loading (UI is usable now)
      if (mounted) setLoading(false);

      // Step 4: Refresh profile from network (background, non-blocking)
      if (authUser?.email_confirmed_at) {
        fetchProfile(authUser);
      }

      // Step 5: Refresh auth token (background)
      supabase.auth.getSession().catch(() => {});
    };

    init();

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        }

        const authUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(authUser);
        setEmailVerified(!!authUser?.email_confirmed_at);

        if (event === 'SIGNED_IN' && authUser?.email_confirmed_at) {
          // Fresh sign in — fetch profile
          fetchProfile(authUser);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setPermissions(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) return { error: { message: 'Auth unavailable in offline mode' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signUp = useCallback(async (email, password, fullName) => {
    if (!supabase) return { error: { message: 'Auth unavailable in offline mode' } };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    // Clear everything
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('efd_tutorial_state');
      localStorage.removeItem('efd_session_token');
      const storageKey = getAuthStorageKey();
      if (storageKey) localStorage.removeItem(storageKey);
    } catch { /* ignore */ }

    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions(null);
    setEmailVerified(false);

    await supabase.auth.signOut().catch(() => {});

    window.location.href = '/';
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      fetchingRef.current = false; // Allow re-fetch
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  if (!supabase) {
    return (
      <AuthContext.Provider value={OFFLINE_CONTEXT}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      permissions,
      loading,
      passwordRecovery,
      emailVerified,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
