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
  const fetchProfileAndPermissions = useCallback(async (authUser) => {
    if (!supabase || !authUser) {
      setProfile(null);
      setPermissions(null);
      return;
    }

    try {
      // Fetch user profile from public.profiles
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError.message);
        setProfile(null);
        setPermissions(null);
        return;
      }

      setProfile(profileData);

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

      // Resolve effective permissions using role + org overrides
      const role = profileData?.role || 'analyst';
      const resolved = resolvePermissions(role, orgOverrides);
      setPermissions(resolved);
    } catch (err) {
      console.error('Unexpected error fetching profile/permissions:', err);
      setProfile(null);
      setPermissions(null);
    }
  }, []);

  // Initialize session and listen for auth changes
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    // Get existing session
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error.message);
        }

        if (mounted) {
          const authUser = currentSession?.user ?? null;
          setSession(currentSession);
          setUser(authUser);
          setEmailVerified(!!authUser?.email_confirmed_at);

          if (authUser && authUser.email_confirmed_at) {
            await fetchProfileAndPermissions(authUser);
          }

          setLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error initializing session:', err);
        if (mounted) setLoading(false);
      }
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
