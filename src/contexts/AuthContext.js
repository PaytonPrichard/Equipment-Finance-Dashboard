import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

// Null/offline context when Supabase client is not available
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

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Fetch profile and permissions for a given user
  // Uses localStorage cache for instant load, refreshes from Supabase in background
  const fetchProfileAndPermissions = useCallback(async (authUser, backgroundRefresh = false) => {
    if (!supabase || !authUser) {
      setProfile(null);
      setPermissions(null);
      return;
    }

    const cacheKey = 'efd_profile_cache';

    // On initial load, try cache first for instant availability
    if (!backgroundRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const cachedProfile = JSON.parse(cached);
          if (cachedProfile?.id === authUser.id && cachedProfile?.org_id) {
            setProfile(cachedProfile);
            const role = cachedProfile.role || 'analyst';
            setPermissions(resolvePermissions(role, []));
            // Refresh from network in background
            fetchProfileAndPermissions(authUser, true).catch(() => {});
            return;
          }
        }
      } catch (e) { /* ignore cache errors */ }
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, organizations(name, branding)')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
        if (!backgroundRefresh) {
          setProfile(null);
          setPermissions(null);
        }
        return;
      }

      setProfile(profileData);

      // Cache for next load
      try {
        localStorage.setItem(cacheKey, JSON.stringify(profileData));
      } catch (e) { /* ignore */ }

      // Fetch org-level permission overrides
      let orgOverrides = [];
      if (profileData?.org_id) {
        const { data: overrideData, error: overrideError } = await supabase
          .from('org_permissions')
          .select('*')
          .eq('org_id', profileData.org_id);

        if (overrideError) {
          console.error('Error fetching org permissions:', overrideError.message);
        } else {
          orgOverrides = overrideData || [];
        }
      }

      const role = profileData?.role || 'analyst';
      const resolved = resolvePermissions(role, orgOverrides);
      setPermissions(resolved);
    } catch (err) {
      console.error('Unexpected error fetching profile/permissions:', err);
      if (!backgroundRefresh) {
        setProfile(null);
        setPermissions(null);
      }
    }
  }, []);

  // Initialize session and listen for auth changes
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    // Read session from localStorage (instant), stop loading immediately,
    // then fetch profile and refresh token in the background
    const initSession = () => {
      try {
        const storageKey = `sb-${new URL(process.env.REACT_APP_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
        const stored = localStorage.getItem(storageKey);

        if (stored) {
          const parsed = JSON.parse(stored);
          const authUser = parsed?.user ?? null;

          if (mounted && authUser) {
            setSession(parsed);
            setUser(authUser);
            setEmailVerified(!!authUser.email_confirmed_at);
            setLoading(false);

            // Fetch profile in background (non-blocking)
            if (authUser.email_confirmed_at) {
              fetchProfileAndPermissions(authUser).catch(console.error);
            }

            // Refresh token in background
            supabase.auth.getSession().catch(() => {});
            return;
          }
        }
      } catch (err) {
        console.error('Error reading stored session:', err);
      }

      // No stored session — fall back to getSession
      supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
        if (error) console.error('Error getting session:', error.message);
        if (!mounted) return;

        const authUser = currentSession?.user ?? null;
        setSession(currentSession);
        setUser(authUser);
        setEmailVerified(!!authUser?.email_confirmed_at);
        setLoading(false);

        if (authUser?.email_confirmed_at) {
          fetchProfileAndPermissions(authUser).catch(console.error);
        }
      }).catch((err) => {
        console.error('getSession failed:', err);
        if (mounted) setLoading(false);
      });
    };

    initSession();

    // Listen for auth state changes (sign in, sign out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        // Detect password recovery flow
        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        }

        const authUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(authUser);
        setEmailVerified(!!authUser?.email_confirmed_at);

        if (authUser && authUser.email_confirmed_at) {
          await fetchProfileAndPermissions(authUser);
        } else {
          setProfile(null);
          setPermissions(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndPermissions]);

  // Auth actions
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
      options: {
        data: { full_name: fullName },
      },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    }
  }, []);

  // Re-fetch the current user's profile and permissions
  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileAndPermissions(user);
    }
  }, [user, fetchProfileAndPermissions]);

  // If Supabase is not configured, provide offline context
  if (!supabase) {
    return (
      <AuthContext.Provider value={OFFLINE_CONTEXT}>
        {children}
      </AuthContext.Provider>
    );
  }

  const value = {
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
